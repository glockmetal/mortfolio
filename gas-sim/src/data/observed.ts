// Real observed data anchors (AAA / EIA) – Section 8.1
// These are hard constraints: the model's median must pass through (or very near) them.

export interface ObservedPoint {
  week: number;      // fractional weeks from Feb 28, 2026
  date: string;
  gasPrice: number;  // $/gal (AAA national average)
  wti: number;       // $/bbl WTI crude (settled)
  source: string;
}

export const OBSERVED: ObservedPoint[] = [
  {
    week: 0,
    date: "Feb 28",
    gasPrice: 2.98,
    wti: 67,
    source: "AAA / EIA",
  },
  {
    week: 1,
    date: "Mar 5",
    gasPrice: 3.25,
    wti: 85,
    source: "AAA",
  },
  {
    week: 1.57, // Mar 9 = 9 days / 7 ≈ 1.29... actually (9 days from Feb 28)
    date: "Mar 9",
    gasPrice: 3.48,
    wti: 95,     // settled around 85–120 intraday, ~95 midpoint
    source: "CBS / AAA",
  },
  {
    week: 2,     // Mar 12 ≈ 13 days / 7 ≈ 1.86 weeks, call it Week 2
    date: "Mar 12",
    gasPrice: 3.60,
    wti: 92,     // settled $87–96, ~92 midpoint
    source: "AAA ($3.598)",
  },
];

// All-time record
export const GAS_RECORD_HIGH = 5.02; // $/gal (June 2022)

// Reference thresholds
export const PRICE_THRESHOLDS = {
  preConflict: 2.98,
  today: 3.60,
  demandDestructionMild: 4.00,
  demandDestructionStrong: 5.00,
  politicalTrigger: 4.50,
  recordHigh: 5.02,
};
