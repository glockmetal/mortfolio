/**
 * Crude oil sub-chart — implied crude trajectory (Section 6.4)
 * Makes the model's crude assumptions transparent.
 */

import { useMemo } from "react";
import {
  ComposedChart, Area, Line, Scatter, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { PercentileBand } from "../simulation/monte-carlo";
import { OBSERVED } from "../data/observed";

interface Props {
  bands: PercentileBand[];
  scrubberWeek: number;
}

const WEEKS_LABELS: Record<number, string> = {
  0: "Feb 28", 4: "Mar 28", 8: "Apr 25",
  13: "Jun 6", 17: "Jul 4", 22: "Aug 8",
  26: "Sep 5", 30: "Sep 26",
};

function CrudeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const obs = OBSERVED.find((o) => Math.round(o.week) === Number(label));
  return (
    <div style={{
      background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8,
      padding: "8px 12px", fontSize: 12, color: "#e2e8f0",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#a0aec0" }}>
        Week {label} — {WEEKS_LABELS[Number(label)] ?? ""}
      </div>
      {payload.map((e: any) => {
        const val = Array.isArray(e.value) ? e.value[1] : e.value;
        if (!val) return null;
        return (
          <div key={e.name} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: e.color }}>{e.name}</span>
            <span>${typeof val === "number" ? val.toFixed(1) : val}/bbl</span>
          </div>
        );
      })}
      {obs && <div style={{ color: "#f6e05e", marginTop: 4 }}>Observed: ${obs.wti}/bbl</div>}
    </div>
  );
}

export default function CrudeChart({ bands, scrubberWeek }: Props) {
  const data = useMemo(() =>
    bands.map((b) => {
      const obs = OBSERVED.find((o) => Math.round(o.week) === b.week);
      return {
        week: b.week,
        band_outer: [b.crudeP10, b.crudeP90],
        band_inner: [b.crudeP25, b.crudeP75],
        p50: b.crudeP50,
        observed: obs?.wti,
      };
    }), [bands]);

  return (
    <div>
      <div style={{ fontSize: 11, color: "#718096", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Implied WTI Crude Oil Trajectory
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" opacity={0.5} />
          <XAxis
            dataKey="week" type="number" domain={[0, 30]}
            ticks={Object.keys(WEEKS_LABELS).map(Number)}
            tickFormatter={(v) => WEEKS_LABELS[v] ?? `${v}`}
            stroke="#4a5568" tick={{ fill: "#718096", fontSize: 10 }}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            stroke="#4a5568" tick={{ fill: "#718096", fontSize: 10 }}
            width={52}
          />
          <Tooltip content={<CrudeTooltip />} />

          <Area type="monotone" dataKey="band_outer"
            fill="#2d3a1f" fillOpacity={0.5} stroke="none" name="P10–P90" />
          <Area type="monotone" dataKey="band_inner"
            fill="#2d4a1f" fillOpacity={0.65} stroke="none" name="P25–P75" />
          <Line type="monotone" dataKey="p50"
            stroke="#68d391" strokeWidth={2} dot={false} name="Median" />
          <Scatter dataKey="observed"
            fill="#f6e05e" stroke="#f6e05e" r={4} name="Observed" />

          <ReferenceLine y={67} stroke="#4a5568" strokeDasharray="3 3"
            label={{ value: "Pre-conflict $67", fill: "#4a5568", fontSize: 10, position: "insideTopRight" }} />
          <ReferenceLine x={scrubberWeek} stroke="#a0aec0" strokeWidth={1.5} strokeDasharray="2 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
