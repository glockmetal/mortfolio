/**
 * Main gas price chart — probability cone + observed data overlay.
 * Section 6.2 of the design document.
 */

import { useMemo } from "react";
import {
  ComposedChart, Area, Line, Scatter, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { PercentileBand } from "../simulation/monte-carlo";
import type { SimState } from "../simulation/variables";
import { OBSERVED, GAS_RECORD_HIGH, PRICE_THRESHOLDS } from "../data/observed";

interface Props {
  bands: PercentileBand[];
  deterministic: SimState[];
  scrubberWeek: number;
  onScrubberChange: (week: number) => void;
}

interface ChartRow {
  week: number;
  // Shaded cone areas (Recharts Area uses [lo, hi])
  band_outer: [number, number];  // P10–P90
  band_inner: [number, number];  // P25–P75
  p50: number;
  observed?: number;
}

const WEEKS_LABELS: Record<number, string> = {
  0: "Feb 28",
  4: "Mar 28",
  8: "Apr 25",
  13: "Jun 6",
  17: "Jul 4",
  22: "Aug 8",
  26: "Sep 5",
  30: "Sep 26",
};

function formatWeekLabel(week: number): string {
  return WEEKS_LABELS[week] ?? `Wk ${week}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const weekLabel = formatWeekLabel(Number(label));
  const obs = OBSERVED.find((o) => Math.round(o.week) === Number(label));

  return (
    <div style={{
      background: "#1a1f2e",
      border: "1px solid #2d3748",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 13,
      color: "#e2e8f0",
      minWidth: 180,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#a0aec0" }}>
        {weekLabel} (Week {label})
      </div>
      {payload.map((entry: any) => {
        if (!entry.value && entry.value !== 0) return null;
        const val = Array.isArray(entry.value) ? entry.value[1] : entry.value;
        if (!val) return null;
        return (
          <div key={entry.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
            <span style={{ color: entry.color || "#a0aec0" }}>{entry.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              ${typeof val === "number" ? val.toFixed(2) : val}
            </span>
          </div>
        );
      })}
      {obs && (
        <div style={{ borderTop: "1px solid #2d3748", marginTop: 6, paddingTop: 6, color: "#f6e05e" }}>
          Observed: ${obs.gasPrice.toFixed(2)} ({obs.source})
        </div>
      )}
    </div>
  );
}

export default function MainChart({ bands, deterministic: _deterministic, scrubberWeek, onScrubberChange }: Props) {
  const data: ChartRow[] = useMemo(() => {
    return bands.map((b) => {
      const obs = OBSERVED.find((o) => Math.round(o.week) === b.week);
      return {
        week: b.week,
        band_outer: [b.p10, b.p90],
        band_inner: [b.p25, b.p75],
        p50: b.p50,
        observed: obs?.gasPrice,
      };
    });
  }, [bands]);

  // Current scrubber gas price for display
  const currentBand = bands[Math.min(scrubberWeek, bands.length - 1)];

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {/* Price callout bar */}
      <div style={{
        display: "flex",
        gap: 24,
        marginBottom: 12,
        flexWrap: "wrap",
        fontSize: 13,
        color: "#a0aec0",
      }}>
        <Callout label="Median (P50)" value={currentBand?.p50} color="#63b3ed" />
        <Callout label="P10–P90 range" value={`$${currentBand?.p10?.toFixed(2)}–$${currentBand?.p90?.toFixed(2)}`} color="#4a5568" />
        <Callout label="Current (AAA)" value={PRICE_THRESHOLDS.today} color="#f6e05e" isDollar />
        <Callout label="Pre-conflict" value={PRICE_THRESHOLDS.preConflict} color="#68d391" isDollar />
        <Callout label="All-time record" value={GAS_RECORD_HIGH} color="#fc8181" isDollar />
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
          onClick={(e) => {
            if (e?.activeLabel !== undefined) {
              onScrubberChange(Number(e.activeLabel));
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" opacity={0.6} />

          <XAxis
            dataKey="week"
            type="number"
            domain={[0, 30]}
            ticks={Object.keys(WEEKS_LABELS).map(Number)}
            tickFormatter={formatWeekLabel}
            stroke="#4a5568"
            tick={{ fill: "#718096", fontSize: 11 }}
          />

          <YAxis
            domain={[2.50, "auto"]}
            tickFormatter={(v) => `$${v.toFixed(2)}`}
            stroke="#4a5568"
            tick={{ fill: "#718096", fontSize: 11 }}
            width={62}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* P10–P90 outer cone */}
          <Area
            type="monotone"
            dataKey="band_outer"
            fill="#2b4a6f"
            fillOpacity={0.45}
            stroke="none"
            name="P10–P90"
            connectNulls
          />

          {/* P25–P75 inner cone (darker) */}
          <Area
            type="monotone"
            dataKey="band_inner"
            fill="#2c5282"
            fillOpacity={0.65}
            stroke="none"
            name="P25–P75"
            connectNulls
          />

          {/* Median line */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#63b3ed"
            strokeWidth={2.5}
            dot={false}
            name="Median"
          />

          {/* Observed data points */}
          <Scatter
            dataKey="observed"
            fill="#f6e05e"
            stroke="#f6e05e"
            strokeWidth={2}
            r={5}
            name="Observed (AAA)"
          />

          {/* Reference lines */}
          <ReferenceLine
            y={GAS_RECORD_HIGH}
            stroke="#fc8181"
            strokeDasharray="6 3"
            label={{ value: `Record $${GAS_RECORD_HIGH}`, fill: "#fc8181", fontSize: 11, position: "insideTopRight" }}
          />
          <ReferenceLine
            y={PRICE_THRESHOLDS.today}
            stroke="#f6e05e"
            strokeDasharray="3 3"
            label={{ value: `Today $${PRICE_THRESHOLDS.today}`, fill: "#f6e05e", fontSize: 11, position: "insideBottomRight" }}
          />
          <ReferenceLine
            y={PRICE_THRESHOLDS.preConflict}
            stroke="#68d391"
            strokeDasharray="3 3"
            label={{ value: `Pre-conflict $${PRICE_THRESHOLDS.preConflict}`, fill: "#68d391", fontSize: 11, position: "insideBottomRight" }}
          />
          <ReferenceLine
            y={4.50}
            stroke="#ed8936"
            strokeDasharray="4 4"
            opacity={0.7}
            label={{ value: "SPR trigger $4.50", fill: "#ed8936", fontSize: 10, position: "insideTopRight" }}
          />
          <ReferenceLine
            y={5.00}
            stroke="#f56565"
            strokeDasharray="4 4"
            opacity={0.6}
            label={{ value: "$5.00", fill: "#f56565", fontSize: 10, position: "insideTopRight" }}
          />

          {/* Scrubber line */}
          <ReferenceLine
            x={scrubberWeek}
            stroke="#a0aec0"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Scrubber slider */}
      <div style={{ padding: "4px 16px 0" }}>
        <input
          type="range"
          min={0}
          max={30}
          value={scrubberWeek}
          onChange={(e) => onScrubberChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#63b3ed", cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4a5568", marginTop: 2 }}>
          <span>Feb 28</span>
          <span style={{ color: "#a0aec0" }}>Week {scrubberWeek} — {formatWeekLabel(scrubberWeek)}</span>
          <span>Sep 26</span>
        </div>
      </div>
    </div>
  );
}

function Callout({
  label, value, color, isDollar,
}: { label: string; value: number | string | undefined; color: string; isDollar?: boolean }) {
  const display = typeof value === "number"
    ? (isDollar ? `$${value.toFixed(2)}` : `$${value.toFixed(2)}`)
    : value ?? "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4a5568" }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {display}
      </span>
    </div>
  );
}
