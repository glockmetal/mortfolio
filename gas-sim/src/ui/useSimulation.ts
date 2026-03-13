/**
 * React hook that runs the Monte Carlo simulation and memoizes results.
 * Debounces parameter changes to avoid thrashing on slider drag.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { runMonteCarlo } from "../simulation/monte-carlo";
import type { MonteCarloResult } from "../simulation/monte-carlo";
import { runDeterministic } from "../simulation/engine";
import { DEFAULT_INPUTS } from "../simulation/variables";
import type { ScenarioInputs, SimState } from "../simulation/variables";

export interface SimulationOutput {
  mc: MonteCarloResult;
  deterministic: SimState[];
  isRunning: boolean;
}

const DEBOUNCE_MS = 80;
const MONTE_CARLO_RUNS = 400;

export function useSimulation(inputs: ScenarioInputs): SimulationOutput {
  const [mc, setMc] = useState<MonteCarloResult>(() =>
    runMonteCarlo(DEFAULT_INPUTS, MONTE_CARLO_RUNS)
  );
  const [deterministic, setDeterministic] = useState<SimState[]>(() =>
    runDeterministic(DEFAULT_INPUTS)
  );
  const [isRunning, setIsRunning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSim = useCallback((inp: ScenarioInputs) => {
    setIsRunning(true);
    // Run synchronously in a zero-delay setTimeout to allow React to render spinner
    setTimeout(() => {
      try {
        const det = runDeterministic(inp);
        const mcResult = runMonteCarlo(inp, MONTE_CARLO_RUNS);
        setDeterministic(det);
        setMc(mcResult);
      } finally {
        setIsRunning(false);
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSim(inputs), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputs, runSim]);

  return { mc, deterministic, isRunning };
}
