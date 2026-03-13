// ─── Physical constants ───────────────────────────────────────────────────────
export const GALLONS_PER_BARREL = 42;

// ─── Initial values (Feb 28, 2026) ───────────────────────────────────────────
export const INIT = {
  straitThroughput: 21,         // mbd – Strait of Hormuz full capacity
  opecOutput: 27,               // mbd
  usProduction: 13.2,           // mbd
  nonOpecRoW: 39.8,             // mbd  (101 - 27 - 13.2 - 21 = 39.8)
  sprReleaseRate: 0,            // mbd

  globalDemand: 102,            // mbd baseline
  wtiCrude: 67,                 // $/bbl
  crackSpread: 18,              // $/bbl base

  refineryUtilization: 0.87,    // fraction
  gasolineInventory: 247,       // M bbl
  avgGasolineInventory: 247,    // M bbl – long-run average

  retailGasPrice: 2.98,         // $/gal
  consumerDemand: 369,          // M gal/day

  // Retail gas price components
  federalTax: 0.184,            // $/gal
  avgStateTax: 0.37,            // $/gal (average)
  distributionBase: 0.15,       // $/gal
  retailerMarginBase: 0.26,     // $/gal – calibrated to hit $2.98 anchor

  // calibration offset (small residual to anchor Week 0 precisely)
  calibrationOffset: 0.0,       // $/gal
} as const;

export const TAXES_AND_FEES = INIT.federalTax + INIT.avgStateTax; // $0.554

// ─── Simulation parameters ────────────────────────────────────────────────────
export const SIM = {
  weeksTotal: 30,               // Week 0 (Feb 28) → Week 30 (late Sep 2026)

  // Crude price model
  crudePriceElasticity: 4.0,    // exponent in (D/S)^e  – calibrated
  riskPremiumDecayRate: 0.75,   // per-week decay when reopened

  // Supply loss ramp (Strait disruption reaches full effect over ~4 weeks)
  straitLagWeeks: 4,            // weeks to full physical effect
  // Rerouting via Cape is slow and limited (high shipping costs, capacity)
  straitReroutingFraction: 0.08, // only 8% of disrupted flow ultimately reroutable
  straitReroutingWeeks: 5,      // weeks until max rerouting

  // Effective Strait impact on WTI-relevant markets.
  // Strait carries ~21 mbd; ~65% matters for WTI pricing (rest is Asian/non-WTI)
  straitWTIImpactFraction: 0.65,

  // Pass-through lag: EMA of crude price feeding into gas assembly
  // Low alpha = slow pass-through (gas lags crude by 1-2 weeks)
  crudeLagAlpha: 0.45,

  // Crack spread model
  crackBaseSpread: 18,          // $/bbl
  crackUtilLow: 0.87,           // utilization at which util_factor = 1.0
  crackUtilHigh: 0.95,          // utilization at which util_factor = 1.4
  crackSeasonalFactor: 1.15,    // multiplier during Mar–May maintenance
  crackSeasonalStartWeek: 1,    // when seasonal factor begins to phase in
  crackSeasonalEndWeek: 13,     // last week of seasonal window
  // How aggressively crack spread responds to high crude prices
  // Calibrated to produce ~$40-50/bbl crack at $120+ crude (2022 precedent)
  crackCrudeSensitivity: 0.015, // per $/bbl above $80

  // Retailer margin ratchet
  // Margin rises by this fraction of spot crude per-gallon increase
  marginRatchetUpFraction: 0.13,
  marginRatchetDownHalfLife: 3.5, // weeks for excess margin to bleed off

  // Demand destruction (short-run)
  demandElasticityDefault: -0.03,
  demandReferencePrice: 2.98,   // $/gal (Week 0)

  // US production response (lagged 8-12 wks)
  usProductionResponseLag: 10,  // weeks
  usProductionElasticity: 0.015,// fractional output increase per $/bbl crude increase

  // Gasoline inventory
  refineryOutputPerMbdCrude: 0.46,
  inventoryWeeks: 3.0,

  // SPR IEA coordinated release (March 11, 2026 = Week ~1.5)
  sprDefaultRelease: 400,       // M bbl total
  sprReleaseRateDefault: 2.0,   // mbd during drawdown
  sprTriggerPrice: 4.50,        // $/gal political trigger

  // Risk premium model (Section 4.2)
  // The supply/demand model already captures most of the physical disruption.
  // Risk premium adds the speculative/futures premium on top of fundamentals.
  // Small initial jump ($3) calibrated so Week 1 crude ≈ $85 (target).
  // Grows at 20%/week as crisis extends, reaching ~$25 cap by Week 12.
  riskPremiumBase: 3,           // $/bbl immediate speculation premium at closure
  riskPremiumMax: 25,           // $/bbl cap (consistent with 2022 precedent)
  riskPremiumGrowthRate: 0.20,  // per-week growth; reaches cap at ~Week 10
} as const;
