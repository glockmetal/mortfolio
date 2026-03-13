/**
 * Monte Carlo uncertainty layer.
 *
 * Runs N simulations with parameter samples drawn from distributions,
 * then computes percentile bands across all runs at each time step.
 *
 * Section 5 of the design document.
 */

import { runDeterministic } from "./engine";
import type { ParameterSample } from "./engine";
import type { ScenarioInputs } from "./variables";
import { SIM } from "../data/constants";

// ─── Pseudo-random utilities (deterministic seeded LCG for reproducibility) ──

class LCG {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }

  next(): number {
    this.state = ((this.state * 1664525 + 1013904223) & 0xffffffff) >>> 0;
    return this.state / 0xffffffff;
  }

  /** Box-Muller normal sample */
  normal(mean: number, std: number): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }

  uniform(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }
}

// ─── Parameter sampling (Section 5.1) ─────────────────────────────────────────

function sampleParameters(rng: LCG): ParameterSample {
  return {
    // Risk premium: Normal, mean=base, σ=5-8
    riskPremiumBase: rng.normal(SIM.riskPremiumBase, 6),

    // Demand elasticity: Uniform [-0.05, -0.02]
    demandElasticity: rng.uniform(-0.05, -0.02),

    // Crack spread base: Normal, mean=18, σ=3
    crackBaseSpread: Math.max(10, rng.normal(SIM.crackBaseSpread, 3)),

    // Retailer margin ratchet half-life: Uniform [1, 4] weeks
    marginRatchetDownHalfLife: rng.uniform(1, 4),

    // Crude lag alpha: Uniform [0.40, 0.70]
    crudeLagAlpha: rng.uniform(0.40, 0.70),

    // SPR trigger price: slight variation
    sprTriggerPrice: rng.normal(SIM.sprTriggerPrice, 0.25),
  };
}

// ─── Percentile computation ───────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ─── Output type ──────────────────────────────────────────────────────────────

export interface PercentileBand {
  week: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  // Crude oil bands
  crudeP10: number;
  crudeP25: number;
  crudeP50: number;
  crudeP75: number;
  crudeP90: number;
}

export interface MonteCarloResult {
  bands: PercentileBand[];
  runs: number;
  /** All individual run gas prices [run][week] for sensitivity analysis */
  allGasPrices: number[][];
  allCrudePrices: number[][];
}

// ─── Main Monte Carlo runner ──────────────────────────────────────────────────

export function runMonteCarlo(
  inputs: ScenarioInputs,
  runs = 500,
  seed = 42
): MonteCarloResult {
  const rng = new LCG(seed);
  const weeks = SIM.weeksTotal + 1; // 0..30

  // Collect gas and crude prices per run
  const gasByWeek: number[][] = Array.from({ length: weeks }, () => []);
  const crudeByWeek: number[][] = Array.from({ length: weeks }, () => []);

  const allGasPrices: number[][] = [];
  const allCrudePrices: number[][] = [];

  for (let r = 0; r < runs; r++) {
    const params = sampleParameters(rng);
    const states = runDeterministic(inputs, params);

    const gasRun: number[] = [];
    const crudeRun: number[] = [];

    states.forEach((s, w) => {
      gasByWeek[w].push(s.retailGasPrice);
      crudeByWeek[w].push(s.wtiCrude);
      gasRun.push(s.retailGasPrice);
      crudeRun.push(s.wtiCrude);
    });

    allGasPrices.push(gasRun);
    allCrudePrices.push(crudeRun);
  }

  // Compute percentile bands at each week
  const bands: PercentileBand[] = gasByWeek.map((gasVals, w) => {
    const sortedGas = [...gasVals].sort((a, b) => a - b);
    const sortedCrude = [...crudeByWeek[w]].sort((a, b) => a - b);

    return {
      week: w,
      p10: percentile(sortedGas, 0.10),
      p25: percentile(sortedGas, 0.25),
      p50: percentile(sortedGas, 0.50),
      p75: percentile(sortedGas, 0.75),
      p90: percentile(sortedGas, 0.90),
      crudeP10: percentile(sortedCrude, 0.10),
      crudeP25: percentile(sortedCrude, 0.25),
      crudeP50: percentile(sortedCrude, 0.50),
      crudeP75: percentile(sortedCrude, 0.75),
      crudeP90: percentile(sortedCrude, 0.90),
    };
  });

  return { bands, runs, allGasPrices, allCrudePrices };
}
