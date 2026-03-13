// ─── Variable type definitions ────────────────────────────────────────────────

export interface SimState {
  week: number;

  // Supply layer
  straitEffectiveMbd: number;   // mbd flowing through Strait (accounting for rerouting lag)
  opecOutputMbd: number;        // mbd OPEC+ production
  usProductionMbd: number;      // mbd US crude production
  sprReleaseRateMbd: number;    // mbd SPR / IEA drawdown
  globalSupplyMbd: number;      // mbd total effective supply

  // Demand layer
  globalDemandMbd: number;      // mbd global crude demand
  consumerDemandGpd: number;    // M gal/day US gasoline demand

  // Price layer
  wtiCrude: number;             // $/bbl WTI crude (spot, current)
  wtiCrudeEma: number;          // $/bbl WTI crude EMA (used for gas price)
  riskPremium: number;          // $/bbl speculative/geopolitical premium

  // Refinery layer
  crackSpread: number;          // $/bbl 3-2-1 crack spread
  refineryUtilization: number;  // fraction (0–1)

  // Gas layer
  gasolineInventory: number;    // M bbl
  inventoryPressure: number;    // dimensionless: (avg - current) / avg
  distributionCost: number;     // $/gal
  retailerMargin: number;       // $/gal
  retailGasPrice: number;       // $/gal headline output

  // Demand response
  demandModifier: number;       // fraction (1.0 = no effect, <1 = destruction)

  // Sensitivity: which variable has the highest partial derivative on gas price
  dominantDriver: DominantDriver;

  // Feedback loop activity [0-1]
  loopActivity: LoopActivity;

  // SPR remaining
  sprRemainingMBbl: number;     // M bbl remaining in reserve
}

export type DominantDriver =
  | "crude_supply"
  | "crack_spread"
  | "inventory"
  | "demand_destruction"
  | "spr"
  | "speculation";

export interface LoopActivity {
  R1_speculation: number;       // 0–1
  R2_inventoryPanic: number;    // 0–1
  R3_crackExpansion: number;    // 0–1
  B1_demandDestruction: number; // 0–1
  B2_spr: number;               // 0–1
  B3_productionResponse: number;// 0–1
  B4_rerouting: number;         // 0–1
}

// ─── User inputs (scenario configuration) ────────────────────────────────────

export interface ScenarioInputs {
  // Strait of Hormuz
  straitOpenFraction: number;       // 0 = fully closed, 1 = fully open
  reopeningWeek: number | null;     // null = never reopens during simulation
  reopeningSpeed: "sudden" | "gradual";

  // Supply responses
  opecResponseMbd: number;          // additional mbd OPEC pumps (+2 = surge, -1 = cut)
  sprReleaseTotalMBbl: number;      // total M bbl IEA/SPR to release (0 = off)
  sprEnabled: boolean;

  // Demand
  demandElasticity: number;         // e.g. -0.03

  // Model toggles
  seasonalMaintenanceOn: boolean;

  // Scenario label
  label: string;
}

export const DEFAULT_INPUTS: ScenarioInputs = {
  straitOpenFraction: 0,
  reopeningWeek: null,
  reopeningSpeed: "gradual",
  opecResponseMbd: 0,
  sprReleaseTotalMBbl: 400,
  sprEnabled: true,
  demandElasticity: -0.03,
  seasonalMaintenanceOn: true,
  label: "Custom",
};

// ─── Scenario presets (Section 6.1) ──────────────────────────────────────────

export const SCENARIOS: Record<string, ScenarioInputs> = {
  twoWeek: {
    straitOpenFraction: 0,
    reopeningWeek: 2,
    reopeningSpeed: "sudden",
    opecResponseMbd: 0,
    sprReleaseTotalMBbl: 400,
    sprEnabled: true,
    demandElasticity: -0.03,
    seasonalMaintenanceOn: true,
    label: "2-Week Closure",
  },
  sixWeek: {
    straitOpenFraction: 0,
    reopeningWeek: 6,
    reopeningSpeed: "gradual",
    opecResponseMbd: 0,
    sprReleaseTotalMBbl: 400,
    sprEnabled: true,
    demandElasticity: -0.03,
    seasonalMaintenanceOn: true,
    label: "6-Week Closure",
  },
  twelveWeek: {
    straitOpenFraction: 0,
    reopeningWeek: 12,
    reopeningSpeed: "gradual",
    opecResponseMbd: 0.5,
    sprReleaseTotalMBbl: 400,
    sprEnabled: true,
    demandElasticity: -0.03,
    seasonalMaintenanceOn: true,
    label: "12-Week Closure",
  },
  indefinite: {
    straitOpenFraction: 0,
    reopeningWeek: null,
    reopeningSpeed: "gradual",
    opecResponseMbd: 0,
    sprReleaseTotalMBbl: 400,
    sprEnabled: true,
    demandElasticity: -0.03,
    seasonalMaintenanceOn: true,
    label: "Indefinite Closure",
  },
};
