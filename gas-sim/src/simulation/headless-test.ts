/**
 * Phase 1 headless test — run directly with ts-node or tsx.
 * Verifies anchor-point calibration and prints weekly snapshots.
 *
 * Usage: npx tsx src/simulation/headless-test.ts
 */

import { runDeterministic } from "./engine";
import { runMonteCarlo } from "./monte-carlo";
import { SCENARIOS } from "./variables";
import { printCalibrationReport } from "./calibration";

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║  Gas Price System Dynamics Simulator – Phase 1 Test  ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

// ── Phase 1: Deterministic weekly snapshots ───────────────────────────────────

const sixWeekStates = runDeterministic(SCENARIOS.sixWeek);

console.log("=== 6-Week Scenario – Weekly Snapshots ===\n");
console.log(
  "Week".padStart(4),
  "Gas $/gal".padStart(10),
  "WTI $/bbl".padStart(10),
  "Crack $/bbl".padStart(12),
  "Risk Prem".padStart(10),
  "Supply mbd".padStart(11),
  "Demand mbd".padStart(11),
  "Inventory".padStart(10),
  "Driver".padStart(16)
);
console.log("─".repeat(100));

sixWeekStates.forEach((s) => {
  console.log(
    String(s.week).padStart(4),
    `$${s.retailGasPrice.toFixed(2)}`.padStart(10),
    `$${s.wtiCrude.toFixed(1)}`.padStart(10),
    `$${s.crackSpread.toFixed(1)}`.padStart(12),
    `$${s.riskPremium.toFixed(1)}`.padStart(10),
    `${s.globalSupplyMbd.toFixed(1)}`.padStart(11),
    `${s.globalDemandMbd.toFixed(1)}`.padStart(11),
    `${s.gasolineInventory.toFixed(0)}`.padStart(10),
    s.dominantDriver.padStart(16)
  );
});

// ── Calibration check ─────────────────────────────────────────────────────────
printCalibrationReport();

// ── Phase 2: Monte Carlo verification ────────────────────────────────────────
console.log("\n=== Monte Carlo – 500 Runs (6-Week Scenario) ===\n");
console.log("Running Monte Carlo... (this may take a moment)");

const mc = runMonteCarlo(SCENARIOS.sixWeek, 500);

console.log(
  "Week".padStart(4),
  "P10".padStart(8),
  "P25".padStart(8),
  "P50".padStart(8),
  "P75".padStart(8),
  "P90".padStart(8),
  "Spread".padStart(8)
);
console.log("─".repeat(60));

mc.bands.forEach((b) => {
  console.log(
    String(b.week).padStart(4),
    `$${b.p10.toFixed(2)}`.padStart(8),
    `$${b.p25.toFixed(2)}`.padStart(8),
    `$${b.p50.toFixed(2)}`.padStart(8),
    `$${b.p75.toFixed(2)}`.padStart(8),
    `$${b.p90.toFixed(2)}`.padStart(8),
    `$${(b.p90 - b.p10).toFixed(2)}`.padStart(8)
  );
});

// Verify cone widens over time
const spreads = mc.bands.map((b) => b.p90 - b.p10);
const coneWidensOk = spreads.every((s, i) => {
  if (i < 2) return true; // skip first two weeks
  return s >= spreads[Math.max(0, i - 2)] * 0.9; // allow small dips
});
console.log(`\nCone widens over time: ${coneWidensOk ? "✓" : "✗"}`);

// Check median ≈ deterministic
const maxMedianVsDet = mc.bands.reduce((max, b, w) => {
  const det = sixWeekStates[w]?.retailGasPrice ?? 0;
  return Math.max(max, Math.abs(b.p50 - det));
}, 0);
console.log(`Max median vs deterministic gap: $${maxMedianVsDet.toFixed(3)} (should be <$0.30)`);

// Week 2 check: cone should pass through ~$3.60
const week2Band = mc.bands[2];
console.log(`\nWeek 2 cone: [$${week2Band.p10.toFixed(2)}, $${week2Band.p90.toFixed(2)}]`);
console.log(`Week 2 median: $${week2Band.p50.toFixed(2)} (target ~$3.60)`);

console.log("\n✓ Phase 1 & 2 complete.\n");
