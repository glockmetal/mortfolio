/**
 * Sensitivity color strip below the main chart.
 * Shows which variable is the dominant driver of uncertainty at each time step.
 * Section 6.2 — horizontal bar color-coded by dominant driver.
 */

import type { SimState, DominantDriver } from "../simulation/variables";

interface Props {
  deterministic: SimState[];
}

export const DRIVER_COLORS: Record<DominantDriver, string> = {
  crude_supply:       "#4299e1",  // blue
  speculation:        "#9f7aea",  // purple
  crack_spread:       "#ed8936",  // orange
  inventory:          "#667eea",  // indigo
  demand_destruction: "#f56565",  // red
  spr:                "#38a169",  // green
};

export const DRIVER_LABELS: Record<DominantDriver, string> = {
  crude_supply:       "Crude Supply",
  speculation:        "Speculation",
  crack_spread:       "Crack Spread",
  inventory:          "Inventory",
  demand_destruction: "Demand Destruction",
  spr:                "SPR/IEA Release",
};

export default function SensitivityStrip({ deterministic }: Props) {
  const activeDrivers = Array.from(
    new Set(deterministic.map((s) => s.dominantDriver))
  );

  return (
    <div style={{ marginTop: 4 }}>
      {/* Color bar */}
      <div style={{ display: "flex", height: 10, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        {deterministic.map((state) => (
          <div
            key={state.week}
            title={`Week ${state.week}: ${DRIVER_LABELS[state.dominantDriver]}`}
            style={{
              flex: 1,
              background: DRIVER_COLORS[state.dominantDriver],
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#4a5568", marginRight: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Dominant driver:
        </span>
        {activeDrivers.map((d) => (
          <span key={d} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#718096" }}>
            <span style={{
              display: "inline-block", width: 8, height: 8,
              borderRadius: 2, background: DRIVER_COLORS[d],
            }} />
            {DRIVER_LABELS[d]}
          </span>
        ))}
      </div>
    </div>
  );
}
