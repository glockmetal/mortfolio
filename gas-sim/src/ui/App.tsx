/**
 * Gas Price System Dynamics Simulator
 * Main application layout — three-panel design (controls | chart | system state)
 */

import { useState } from "react";
import type { ScenarioInputs } from "../simulation/variables";
import { SCENARIOS } from "../simulation/variables";
import { useSimulation } from "./useSimulation";
import MainChart from "./MainChart";
import CrudeChart from "./CrudeChart";
import ControlPanel from "./ControlPanel";
import SystemState from "./SystemState";
import SensitivityStrip from "./SensitivityStrip";

export default function App() {
  const [inputs, setInputs] = useState<ScenarioInputs>(SCENARIOS.sixWeek);
  const [scrubberWeek, setScrubberWeek] = useState(2);
  const [showCrude, setShowCrude] = useState(true);

  const { mc, deterministic, isRunning } = useSimulation(inputs);

  const currentState = deterministic[Math.min(scrubberWeek, deterministic.length - 1)];
  const prevState = scrubberWeek > 0
    ? deterministic[scrubberWeek - 1]
    : undefined;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b0f1a",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        background: "#0d1424",
        borderBottom: "1px solid #1e2a3a",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
            Gas Price System Dynamics Simulator
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: "#4a5568" }}>
            Strait of Hormuz closure · Probability cone · 500 Monte Carlo runs
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isRunning && (
            <span style={{
              fontSize: 11, color: "#63b3ed",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{
                display: "inline-block", width: 8, height: 8,
                borderRadius: "50%", background: "#63b3ed",
                animation: "pulse 1s ease-in-out infinite",
              }} />
              Computing…
            </span>
          )}
          <span style={{
            fontSize: 10, color: "#2d3748",
            background: "#0f1623",
            border: "1px solid #1e2a3a",
            padding: "3px 8px",
            borderRadius: 4,
          }}>
            {inputs.label}
          </span>
        </div>
      </header>

      {/* Main layout: controls | chart area | system state */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "220px 1fr 220px",
        gap: 0,
        overflow: "hidden",
        minHeight: 0,
      }}>
        {/* Left: Control Panel */}
        <aside style={{
          background: "#0d1424",
          borderRight: "1px solid #1e2a3a",
          padding: "14px 12px",
          overflowY: "auto",
        }}>
          <div style={{
            fontSize: 10, textTransform: "uppercase",
            letterSpacing: "0.12em", color: "#4a5568",
            marginBottom: 12, fontWeight: 700,
          }}>
            Assumptions
          </div>
          <ControlPanel inputs={inputs} onChange={setInputs} />
        </aside>

        {/* Center: Charts */}
        <main style={{
          padding: "14px 16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          {/* Chart title */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#a0aec0" }}>
                U.S. Average Gas Price Forecast
              </h2>
              <p style={{ margin: 0, fontSize: 11, color: "#4a5568" }}>
                Feb 28 – late Sep 2026 · Shaded cone = P10–P90 probability range
              </p>
            </div>
            <button
              onClick={() => setShowCrude((v) => !v)}
              style={{
                fontSize: 10, padding: "4px 8px",
                background: showCrude ? "#1e3a5f" : "#1a2235",
                border: `1px solid ${showCrude ? "#4299e1" : "#2d3748"}`,
                color: showCrude ? "#63b3ed" : "#4a5568",
                borderRadius: 4, cursor: "pointer",
              }}
            >
              {showCrude ? "Hide" : "Show"} Crude Sub-Chart
            </button>
          </div>

          {/* Main gas price chart */}
          <div style={{ flex: showCrude ? "0 0 auto" : 1 }}>
            <MainChart
              bands={mc.bands}
              deterministic={deterministic}
              scrubberWeek={scrubberWeek}
              onScrubberChange={setScrubberWeek}
            />
          </div>

          {/* Sensitivity strip */}
          <SensitivityStrip deterministic={deterministic} />

          {/* Crude sub-chart */}
          {showCrude && (
            <div style={{
              background: "#0d1424",
              border: "1px solid #1e2a3a",
              borderRadius: 8,
              padding: "12px 14px",
            }}>
              <CrudeChart bands={mc.bands} scrubberWeek={scrubberWeek} />
            </div>
          )}

          {/* Disclaimer */}
          <Disclaimer />
        </main>

        {/* Right: System State */}
        <aside style={{
          background: "#0d1424",
          borderLeft: "1px solid #1e2a3a",
          padding: "14px 12px",
          overflowY: "auto",
        }}>
          <div style={{
            fontSize: 10, textTransform: "uppercase",
            letterSpacing: "0.12em", color: "#4a5568",
            marginBottom: 12, fontWeight: 700,
          }}>
            System State
          </div>
          <SystemState state={currentState} prevState={prevState} />
        </aside>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        * { box-sizing: border-box; }
        input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 2px;
          background: #2d3748;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #4299e1;
          cursor: pointer;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
      `}</style>
    </div>
  );
}

function Disclaimer() {
  return (
    <div style={{
      background: "#0f1623",
      border: "1px solid #1e2a3a",
      borderRadius: 8,
      padding: "12px 14px",
      fontSize: 11,
      color: "#4a5568",
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 700, color: "#718096", marginBottom: 4, fontSize: 11 }}>
        ⚠ Epistemic Disclaimer — Section 9
      </div>
      <p style={{ margin: "0 0 6px" }}>
        <strong style={{ color: "#718096" }}>This is a structural exploration tool, not a price forecast.</strong>{" "}
        It shows how factors interact, not where prices will land. Use it to build intuition, not to make bets.
      </p>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        <li>Cannot predict geopolitical decisions. Strait reopening is a human choice, not a modelable variable.</li>
        <li>Cannot capture black swan cascades (e.g., Aramco attack, Gulf Coast hurricane).</li>
        <li>Produces national averages — California and Kansas are in entirely different worlds.</li>
        <li>Feedback loop parameters are estimated from literature, not fit to this specific crisis.</li>
        <li>No financial market layer — futures positioning, options gamma, and margin calls are absent.</li>
      </ul>
    </div>
  );
}
