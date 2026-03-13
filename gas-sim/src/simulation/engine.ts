/**
 * Gas Price System Dynamics Engine
 *
 * Synchronous update simulation advancing in weekly time steps.
 * All variables are updated simultaneously from the prior state.
 *
 * Section 4 math from the design document.
 */

import { INIT, TAXES_AND_FEES, SIM, GALLONS_PER_BARREL } from "../data/constants";
import type { SimState, ScenarioInputs, DominantDriver, LoopActivity } from "./variables";

// ─── Helper utilities ─────────────────────────────────────────────────────────

function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val));
}

/**
 * Strait effective throughput at week t.
 * Models the physical lag (transit times) and rerouting build-up.
 */
function straitEffectiveThroughput(
  t: number,
  _inputs: ScenarioInputs,
  straitOpenFractionAtT: number
): number {
  const closureFraction = 1 - straitOpenFractionAtT;
  if (closureFraction <= 0) return INIT.straitThroughput;

  // Physical supply loss ramps up over straitLagWeeks (tankers in transit)
  const physicalRamp = clamp(t / SIM.straitLagWeeks, 0, 1);

  // Rerouting via Cape of Good Hope builds up over straitReroutingWeeks
  // (ships start being redirected once closure is clear, ~2 week initial delay)
  const reroutingRamp = clamp((t - 2) / SIM.straitReroutingWeeks, 0, 1);
  const rerouteOffset = SIM.straitReroutingFraction * reroutingRamp;

  // Net effective loss to WTI-relevant supply (not all Strait oil is US-relevant)
  const netLossFraction = closureFraction * physicalRamp * (1 - rerouteOffset) * SIM.straitWTIImpactFraction;

  return INIT.straitThroughput * (1 - netLossFraction);
}

/**
 * Strait open fraction at week t, accounting for reopening scenario.
 */
function straitOpenFractionAtWeek(t: number, inputs: ScenarioInputs): number {
  if (inputs.reopeningWeek === null) {
    return inputs.straitOpenFraction; // stays closed (or at set fraction)
  }

  if (t < inputs.reopeningWeek) {
    return inputs.straitOpenFraction;
  }

  if (inputs.reopeningSpeed === "sudden") {
    return 1.0;
  }

  // Gradual reopening over 4 weeks
  const progress = clamp((t - inputs.reopeningWeek) / 4, 0, 1);
  return inputs.straitOpenFraction + (1 - inputs.straitOpenFraction) * progress;
}

/**
 * Risk premium: spikes on Strait closure, grows while closed, decays on reopening.
 *
 * Key fix: uses ADDITIVE jump at first closure week (prevRisk can be 0,
 * multiplicative * 0 would always stay 0).
 */
function computeRiskPremium(
  _t: number,
  prevRisk: number,
  straitOpenFraction: number,
  _prevStraitOpen: number
): number {
  const closureFraction = 1 - straitOpenFraction;

  if (closureFraction <= 0) {
    // Strait is (re)open: premium decays toward 0
    return prevRisk * SIM.riskPremiumDecayRate;
  }

  // Jump to base premium if this is the first week with the Strait closed,
  // OR if prevRisk is essentially zero (initial condition when strait starts closed).
  // This additive jump models the immediate futures-market speculation shock.
  const baseTarget = SIM.riskPremiumBase * closureFraction;
  if (prevRisk < baseTarget * 0.5) {
    return baseTarget;
  }

  // Strait has been closed for at least one week: grow multiplicatively.
  // This models the escalating speculation spiral (Loop R1) while closure persists.
  const grown = prevRisk * (1 + SIM.riskPremiumGrowthRate * closureFraction);
  return clamp(grown, 0, SIM.riskPremiumMax);
}

/**
 * Utilization factor for crack spread (Section 4.3)
 * Scales linearly: 1.0 at crackUtilLow, 1.4 at crackUtilHigh
 */
function utilizationFactor(util: number): number {
  const lo = SIM.crackUtilLow;
  const hi = SIM.crackUtilHigh;
  const scale = clamp((util - lo) / (hi - lo), 0, 1.5); // allow slight overshoot
  return 1.0 + scale * 0.4;
}

/**
 * Seasonal factor for crack spread (Section 4.3)
 * Ramps to 1.15 during Mar–May (weeks 1–13), returns to 1.0 otherwise
 */
function seasonalFactor(t: number, on: boolean): number {
  if (!on) return 1.0;
  const start = SIM.crackSeasonalStartWeek;
  const end = SIM.crackSeasonalEndWeek;
  if (t < start) return 1.0;
  if (t > end) return 1.0;
  // Phase in over 2 weeks, phase out over 2 weeks
  const rampIn = clamp((t - start) / 2, 0, 1);
  const rampOut = clamp((end - t) / 2, 0, 1);
  const phase = Math.min(rampIn, rampOut);
  return 1.0 + (SIM.crackSeasonalFactor - 1.0) * phase;
}

/**
 * Retailer margin ratchet (Section 4.4)
 * Rises fast when crude goes up, decays slowly when crude goes down.
 */
function computeRetailerMargin(
  prevMargin: number,
  crudeChange: number,           // $/bbl crude price change this step
  _prevWti: number,
  inventoryPressure: number
): number {
  const crudeChangePerGallon = crudeChange / GALLONS_PER_BARREL;

  let newMargin: number;
  if (crudeChangePerGallon > 0) {
    // Fast upward ratchet: fraction of per-gallon crude increase becomes margin
    const marginIncrease = crudeChangePerGallon * SIM.marginRatchetUpFraction;
    newMargin = prevMargin + marginIncrease;
    // Add inventory pressure premium (low inventory → retailers extract more)
    newMargin += Math.max(0, inventoryPressure) * 0.03;
  } else {
    // Slow downward decay: half-life ~3 weeks
    const decayFactor = Math.pow(0.5, 1 / SIM.marginRatchetDownHalfLife);
    const target = INIT.retailerMarginBase;
    newMargin = target + (prevMargin - target) * decayFactor;
  }

  return clamp(newMargin, INIT.retailerMarginBase * 0.5, 0.80);
}

/**
 * Demand modifier (Section 4.5)
 * Short-run price elasticity ≈ -0.03
 */
function computeDemandModifier(gasPrice: number, elasticity: number): number {
  const ratio = gasPrice / SIM.demandReferencePrice;
  return 1 + elasticity * Math.log(ratio);
}

/**
 * Determine dominant driver (Section 5.2)
 * Computes approximate partial derivatives and returns the largest contributor.
 */
function computeDominantDriver(
  t: number,
  state: Partial<SimState>,
  inventoryPressure: number,
  riskPremium: number,
  _demandModifier: number,
  gasPrice: number
): DominantDriver {
  const crackSensitivity = state.crackSpread! / GALLONS_PER_BARREL;
  const inventorySensitivity = Math.abs(inventoryPressure) * 0.15;
  const riskSensitivity = riskPremium / GALLONS_PER_BARREL;
  const demandSensitivity = Math.abs(1 - _demandModifier) * gasPrice;
  const sprActive = (state.sprReleaseRateMbd ?? 0) > 0.5;

  if (sprActive && t > 2 && gasPrice > 4.0) return "spr";
  if (demandSensitivity > 0.3) return "demand_destruction";
  if (inventorySensitivity > 0.1 && t > 3) return "inventory";
  if (riskSensitivity > 0.15 && t < 6) return "speculation";
  if (crackSensitivity > 0.35 && t >= 2) return "crack_spread";
  return "crude_supply";
}

/**
 * Compute loop activity scores (0–1 intensity) based on current state
 */
function computeLoopActivity(
  t: number,
  wtiChange: number,
  inventoryPressure: number,
  crackSpread: number,
  gasPrice: number,
  _demandModifier: number,
  sprRate: number,
  straitOpen: number,
  usProductionChange: number
): LoopActivity {
  // R1: Speculation spiral – strong in weeks 1–4 when crude is rising fast
  const R1 = clamp(
    (wtiChange > 0 ? wtiChange / 10 : 0) * Math.exp(-t / 8) * (1 - straitOpen),
    0, 1
  );

  // R2: Inventory panic – dominant weeks 2–6 when inventories draw down
  const R2 = clamp(
    inventoryPressure > 0 ? inventoryPressure * 3 * Math.min(1, t / 2) : 0,
    0, 1
  );

  // R3: Crack spread expansion – weeks 2–8
  const R3 = clamp(
    (crackSpread - SIM.crackBaseSpread) / SIM.crackBaseSpread * 2,
    0, 1
  );

  // B1: Demand destruction – kicks in above $4
  const B1 = clamp((gasPrice - 4.0) / 1.5, 0, 1);

  // B2: SPR
  const B2 = clamp(sprRate / 2.5, 0, 1);

  // B3: Production response – only after week 10
  const B3 = clamp((t - 8) / 8 * (usProductionChange > 0 ? 1 : 0), 0, 1);

  // B4: Rerouting – builds weeks 2–6
  const B4 = clamp((t - 2) / 4, 0, 1) * (1 - straitOpen);

  return { R1_speculation: R1, R2_inventoryPanic: R2, R3_crackExpansion: R3,
           B1_demandDestruction: B1, B2_spr: B2, B3_productionResponse: B3,
           B4_rerouting: B4 };
}

// ─── Core step function ───────────────────────────────────────────────────────

/**
 * Advance the simulation by one week.
 * Takes the previous state and user inputs; returns the new state.
 */
export function stepSimulation(
  prev: SimState,
  t: number,
  inputs: ScenarioInputs,
  paramOverrides: Partial<ParameterSample> = {}
): SimState {
  const params = { ...DEFAULT_PARAMS, ...paramOverrides };

  // ── 1. Strait open fraction at this week ──────────────────────────────────
  const straitOpen = straitOpenFractionAtWeek(t, inputs);
  const straitMbd = straitEffectiveThroughput(t, inputs, straitOpen);

  // ── 2. OPEC+ output ───────────────────────────────────────────────────────
  // OPEC responds to price signal with ~4-week lag (simplified: immediate for now)
  const opecOutput = INIT.opecOutput + inputs.opecResponseMbd;

  // ── 3. US production (lagged price response) ──────────────────────────────
  // Shale responds ~10 weeks after price signal
  let usProduction = prev.usProductionMbd;
  if (t > SIM.usProductionResponseLag) {
    const crudeSignalWeeksAgo = prev.wtiCrude; // simplified: use prev crude
    const stimulation = SIM.usProductionElasticity * Math.max(0, crudeSignalWeeksAgo - 80);
    usProduction = INIT.usProduction * (1 + stimulation);
  }

  // ── 4. SPR release ────────────────────────────────────────────────────────
  let sprRate = 0;
  let sprRemaining = prev.sprRemainingMBbl;
  if (inputs.sprEnabled && inputs.sprReleaseTotalMBbl > 0) {
    const triggerPrice = params.sprTriggerPrice;
    if (prev.retailGasPrice >= triggerPrice || t >= 1.5) {
      // IEA release announced Mar 11 (~Week 1.5) regardless of exact price
      const maxRate = SIM.sprReleaseRateDefault;
      sprRate = Math.min(maxRate, sprRemaining / 4); // spread over ~4 months
      sprRemaining = Math.max(0, sprRemaining - sprRate);
    }
  }

  // ── 5. Global supply ──────────────────────────────────────────────────────
  const globalSupply = straitMbd + opecOutput + usProduction + INIT.nonOpecRoW + sprRate;

  // ── 6. Global demand ──────────────────────────────────────────────────────
  // Baseline + seasonal + demand destruction from prior gas price
  const seasonalDemandFactor = 1.0 + 0.01 * Math.sin((t / 52) * 2 * Math.PI + 0.5); // mild seasonal
  const demandModifier = computeDemandModifier(prev.retailGasPrice, params.demandElasticity);
  const globalDemand = INIT.globalDemand * seasonalDemandFactor * demandModifier;

  // ── 7. Supply/demand ratio and crude price ────────────────────────────────
  const sdRatio = globalDemand / globalSupply;

  // Risk premium (additive jump on closure, multiplicative growth while closed)
  const prevStraitOpen = straitOpenFractionAtWeek(t - 1, inputs);
  const riskPremium = computeRiskPremium(t, prev.riskPremium, straitOpen, prevStraitOpen);

  // Crude price: Section 4.2
  const wtiCrude = clamp(
    INIT.wtiCrude * Math.pow(sdRatio, SIM.crudePriceElasticity) + riskPremium,
    20,
    250
  );

  // EMA of crude for retail gas price (pass-through lag)
  const alpha = params.crudeLagAlpha;
  const wtiCrudeEma = alpha * wtiCrude + (1 - alpha) * prev.wtiCrudeEma;

  // ── 8. Refinery utilization ───────────────────────────────────────────────
  // Rises when demand for refining is high, constrained by crude supply
  const supplyStress = clamp((globalDemand - globalSupply) / globalSupply, -0.05, 0.10);
  const refineryUtilization = clamp(
    INIT.refineryUtilization + supplyStress * 0.5,
    0.75,
    0.97
  );

  // ── 9. Crack spread (Section 4.3) ────────────────────────────────────────
  const utilFactor = utilizationFactor(refineryUtilization);
  const seasFactor = seasonalFactor(t, inputs.seasonalMaintenanceOn);
  const crudeFactor = 1 + SIM.crackCrudeSensitivity * Math.max(0, wtiCrude - 80);
  const crackSpread = params.crackBaseSpread * utilFactor * seasFactor * crudeFactor;

  // ── 10. Gasoline inventory ────────────────────────────────────────────────
  // Refinery output (approx barrels/day → weekly M bbl)
  const refineryOutputMbd = globalSupply * SIM.refineryOutputPerMbdCrude * refineryUtilization;
  const consumptionMbd = prev.consumerDemandGpd * 7 / 1000 / GALLONS_PER_BARREL; // M gal/day → mbd rough
  const inventoryChange = (refineryOutputMbd - consumptionMbd) * 0.1; // scaled for units
  const gasolineInventory = clamp(
    prev.gasolineInventory + inventoryChange,
    100, 400
  );
  const inventoryPressure = (INIT.avgGasolineInventory - gasolineInventory) / INIT.avgGasolineInventory;

  // ── 11. Distribution cost (rises under supply stress) ────────────────────
  const distributionCost = INIT.distributionBase + Math.max(0, supplyStress) * 0.3;

  // ── 12. Retailer margin ratchet ───────────────────────────────────────────
  // Use SPOT crude change for margin (retailers react to spot price fear,
  // not the lagged EMA). This captures the "rises fast" asymmetry.
  const crudeChange = wtiCrude - prev.wtiCrude;
  const retailerMargin = computeRetailerMargin(
    prev.retailerMargin,
    crudeChange,
    prev.wtiCrude,
    inventoryPressure
  );

  // ── 13. Retail gas price (Section 4.4) ───────────────────────────────────
  const retailGasPrice = clamp(
    (wtiCrudeEma + crackSpread) / GALLONS_PER_BARREL
      + TAXES_AND_FEES
      + distributionCost
      + retailerMargin,
    1.50, 15.00
  );

  // ── 14. Consumer demand ───────────────────────────────────────────────────
  const consumerDemandGpd = INIT.consumerDemand * demandModifier * seasonalDemandFactor;

  // ── 15. Diagnostics ───────────────────────────────────────────────────────
  const dominantDriver = computeDominantDriver(
    t, { crackSpread, sprReleaseRateMbd: sprRate }, inventoryPressure,
    riskPremium, demandModifier, retailGasPrice
  );

  const prevUsProduction = prev.usProductionMbd;
  const loopActivity = computeLoopActivity(
    t, wtiCrude - prev.wtiCrude, inventoryPressure, crackSpread,
    retailGasPrice, demandModifier, sprRate, straitOpen,
    usProduction - prevUsProduction
  );

  return {
    week: t,
    straitEffectiveMbd: straitMbd,
    opecOutputMbd: opecOutput,
    usProductionMbd: usProduction,
    sprReleaseRateMbd: sprRate,
    globalSupplyMbd: globalSupply,
    globalDemandMbd: globalDemand,
    consumerDemandGpd,
    wtiCrude,
    wtiCrudeEma,
    riskPremium,
    crackSpread,
    refineryUtilization,
    gasolineInventory,
    inventoryPressure,
    distributionCost,
    retailerMargin,
    retailGasPrice,
    demandModifier,
    dominantDriver,
    loopActivity,
    sprRemainingMBbl: sprRemaining,
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialState(): SimState {
  return {
    week: 0,
    straitEffectiveMbd: INIT.straitThroughput,
    opecOutputMbd: INIT.opecOutput,
    usProductionMbd: INIT.usProduction,
    sprReleaseRateMbd: 0,
    globalSupplyMbd: 101,
    globalDemandMbd: 102,
    consumerDemandGpd: INIT.consumerDemand,
    wtiCrude: INIT.wtiCrude,
    wtiCrudeEma: INIT.wtiCrude,
    riskPremium: 0,
    crackSpread: INIT.crackSpread,
    refineryUtilization: INIT.refineryUtilization,
    gasolineInventory: INIT.gasolineInventory,
    inventoryPressure: 0,
    distributionCost: INIT.distributionBase,
    retailerMargin: INIT.retailerMarginBase,
    retailGasPrice: INIT.retailGasPrice,
    demandModifier: 1.0,
    dominantDriver: "crude_supply",
    loopActivity: {
      R1_speculation: 0, R2_inventoryPanic: 0, R3_crackExpansion: 0,
      B1_demandDestruction: 0, B2_spr: 0, B3_productionResponse: 0, B4_rerouting: 0,
    },
    sprRemainingMBbl: 700, // US SPR ~360 M bbl + IEA coordinated ~400 M bbl
  };
}

// ─── Full deterministic run ───────────────────────────────────────────────────

export function runDeterministic(
  inputs: ScenarioInputs,
  paramOverrides: Partial<ParameterSample> = {}
): SimState[] {
  const states: SimState[] = [];
  let state = createInitialState();
  states.push(state);

  for (let t = 1; t <= SIM.weeksTotal; t++) {
    state = stepSimulation(state, t, inputs, paramOverrides);
    states.push(state);
  }

  return states;
}

// ─── Parameter sample type (for Monte Carlo) ─────────────────────────────────

export interface ParameterSample {
  riskPremiumBase: number;
  demandElasticity: number;
  crackBaseSpread: number;
  marginRatchetDownHalfLife: number;
  crudeLagAlpha: number;
  sprTriggerPrice: number;
}

export const DEFAULT_PARAMS: ParameterSample = {
  riskPremiumBase: SIM.riskPremiumBase,
  demandElasticity: -0.03,
  crackBaseSpread: SIM.crackBaseSpread,
  marginRatchetDownHalfLife: SIM.marginRatchetDownHalfLife,
  crudeLagAlpha: SIM.crudeLagAlpha,
  sprTriggerPrice: SIM.sprTriggerPrice,
};
