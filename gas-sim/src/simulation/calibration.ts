/**
 * Calibration utilities.
 *
 * Verifies that the deterministic run passes through the anchor points
 * from Section 8 of the design document.
 */

import { runDeterministic } from "./engine";
import { SCENARIOS } from "./variables";
import { OBSERVED } from "../data/observed";

export interface CalibrationResult {
  passed: boolean;
  checks: CalibrationCheck[];
}

export interface CalibrationCheck {
  label: string;
  week: number;
  targetGas: number;
  actualGas: number;
  targetCrude?: number;
  actualCrude?: number;
  errorGas: number;
  toleranceGas: number;
  passed: boolean;
}

/**
 * Run the 6-week scenario (closest to observed reality) and check
 * that simulated prices fall within tolerance of anchor data.
 */
export function runCalibrationCheck(): CalibrationResult {
  // Use 6-week scenario as the reference for observed data
  const states = runDeterministic(SCENARIOS.sixWeek);

  const checks: CalibrationCheck[] = OBSERVED.map((obs) => {
    // Find closest integer week
    const weekIdx = Math.round(obs.week);
    const state = states[Math.min(weekIdx, states.length - 1)];

    const errorGas = Math.abs(state.retailGasPrice - obs.gasPrice);
    // Allow ±$0.20 tolerance for anchor points
    const toleranceGas = 0.20;

    return {
      label: obs.date,
      week: obs.week,
      targetGas: obs.gasPrice,
      actualGas: state.retailGasPrice,
      targetCrude: obs.wti,
      actualCrude: state.wtiCrude,
      errorGas,
      toleranceGas,
      passed: errorGas <= toleranceGas,
    };
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

/**
 * Print calibration results to console (for Phase 1 Node headless test)
 */
export function printCalibrationReport(): void {
  const result = runCalibrationCheck();

  console.log("\n=== Calibration Report ===");
  console.log(`Overall: ${result.passed ? "PASSED ✓" : "FAILED ✗"}\n`);

  result.checks.forEach((c) => {
    const status = c.passed ? "✓" : "✗";
    console.log(`${status} ${c.label} (Week ${c.week})`);
    console.log(`  Gas:   target=$${c.targetGas.toFixed(2)}  model=$${c.actualGas.toFixed(2)}  error=$${c.errorGas.toFixed(3)}`);
    if (c.targetCrude !== undefined && c.actualCrude !== undefined) {
      console.log(`  Crude: target=$${c.targetCrude.toFixed(0)}/bbl  model=$${c.actualCrude.toFixed(1)}/bbl`);
    }
    console.log();
  });

  // Sanity checks (Section 8.2)
  const states = runDeterministic(SCENARIOS.indefinite);
  const week12Gas = states[12]?.retailGasPrice ?? 0;
  const week12Crude = states[12]?.wtiCrude ?? 0;

  console.log("=== Sanity Checks (Indefinite closure) ===");
  console.log(`Week 12 gas: $${week12Gas.toFixed(2)}/gal (should approach/exceed $5.00)`);
  console.log(`Week 12 crude: $${week12Crude.toFixed(1)}/bbl`);

  const twoWeekStates = runDeterministic(SCENARIOS.twoWeek);
  const peakGas = Math.max(...twoWeekStates.map((s) => s.retailGasPrice));
  const endGas = twoWeekStates[twoWeekStates.length - 1].retailGasPrice;
  console.log(`\n2-week scenario peak gas: $${peakGas.toFixed(2)}/gal (target $3.80–$4.00)`);
  console.log(`2-week scenario end gas:  $${endGas.toFixed(2)}/gal (target $3.20–$3.40)`);
}
