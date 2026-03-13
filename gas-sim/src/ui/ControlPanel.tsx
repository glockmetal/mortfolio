/**
 * Control Panel — sliders and toggles for scenario assumptions.
 * Section 6.1 of the design document.
 */

import type { ScenarioInputs } from "../simulation/variables";
import { SCENARIOS } from "../simulation/variables";

interface Props {
  inputs: ScenarioInputs;
  onChange: (updated: ScenarioInputs) => void;
}

function SliderRow({
  label,
  sublabel,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  sublabel?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500 }}>{label}</span>
          {sublabel && (
            <span style={{ fontSize: 10, color: "#4a5568", marginLeft: 6 }}>{sublabel}</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "#63b3ed", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#4299e1" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2d3748", marginTop: 1 }}>
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 10, textTransform: "uppercase", letterSpacing: "0.10em",
      color: "#4a5568", fontWeight: 700, marginBottom: 8, marginTop: 16,
      borderBottom: "1px solid #1e2a3a", paddingBottom: 4,
    }}>
      {title}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: "#e2e8f0" }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
          background: checked ? "#4299e1" : "#2d3748",
          position: "relative", transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: checked ? 22 : 3,
          width: 14, height: 14, borderRadius: "50%",
          background: "#e2e8f0", transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

export default function ControlPanel({ inputs, onChange }: Props) {
  const update = (patch: Partial<ScenarioInputs>) =>
    onChange({ ...inputs, ...patch, label: "Custom" });

  const loadPreset = (key: keyof typeof SCENARIOS) =>
    onChange({ ...SCENARIOS[key] });

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingRight: 4 }}>
      {/* Scenario presets */}
      <SectionHeader title="Scenario Presets" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        {(["twoWeek", "sixWeek", "twelveWeek", "indefinite"] as const).map((key) => (
          <button
            key={key}
            onClick={() => loadPreset(key)}
            style={{
              padding: "6px 4px",
              borderRadius: 6,
              border: `1px solid ${inputs.label === SCENARIOS[key].label ? "#4299e1" : "#2d3748"}`,
              background: inputs.label === SCENARIOS[key].label ? "#1e3a5f" : "#0f1623",
              color: inputs.label === SCENARIOS[key].label ? "#63b3ed" : "#718096",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: inputs.label === SCENARIOS[key].label ? 700 : 400,
              transition: "all 0.15s",
            }}
          >
            {SCENARIOS[key].label}
          </button>
        ))}
      </div>

      {/* Strait of Hormuz */}
      <SectionHeader title="Strait of Hormuz" />

      <SliderRow
        label="Strait Throughput"
        sublabel="(% of normal)"
        min={0} max={100} step={5}
        value={Math.round(inputs.straitOpenFraction * 100)}
        format={(v) => `${v}%`}
        onChange={(v) => update({ straitOpenFraction: v / 100 })}
      />

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "#e2e8f0" }}>Reopening Week</span>
          <span style={{ fontSize: 12, color: "#63b3ed", fontWeight: 700 }}>
            {inputs.reopeningWeek === null ? "Never" : `Week ${inputs.reopeningWeek}`}
          </span>
        </div>
        <input
          type="range"
          min={-1} max={20} step={1}
          value={inputs.reopeningWeek === null ? -1 : inputs.reopeningWeek}
          onChange={(e) => {
            const v = Number(e.target.value);
            update({ reopeningWeek: v < 0 ? null : v });
          }}
          style={{ width: "100%", accentColor: "#4299e1" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2d3748", marginTop: 1 }}>
          <span>Never</span><span>Week 20</span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#e2e8f0", marginBottom: 6 }}>Reopening Speed</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["sudden", "gradual"] as const).map((s) => (
            <button
              key={s}
              onClick={() => update({ reopeningSpeed: s })}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 5,
                border: `1px solid ${inputs.reopeningSpeed === s ? "#4299e1" : "#2d3748"}`,
                background: inputs.reopeningSpeed === s ? "#1e3a5f" : "#0f1623",
                color: inputs.reopeningSpeed === s ? "#63b3ed" : "#718096",
                fontSize: 11, cursor: "pointer", textTransform: "capitalize",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Supply responses */}
      <SectionHeader title="Supply Response" />

      <SliderRow
        label="OPEC+ Response"
        sublabel="(mbd extra)"
        min={-1} max={2} step={0.25}
        value={inputs.opecResponseMbd}
        format={(v) => v >= 0 ? `+${v.toFixed(2)} mbd` : `${v.toFixed(2)} mbd`}
        onChange={(v) => update({ opecResponseMbd: v })}
      />

      <Toggle
        label="SPR / IEA Release (400 M bbl)"
        checked={inputs.sprEnabled}
        onChange={(v) => update({ sprEnabled: v })}
      />

      {inputs.sprEnabled && (
        <SliderRow
          label="SPR Release Total"
          sublabel="(M bbl)"
          min={0} max={600} step={50}
          value={inputs.sprReleaseTotalMBbl}
          format={(v) => `${v} M bbl`}
          onChange={(v) => update({ sprReleaseTotalMBbl: v })}
        />
      )}

      {/* Demand */}
      <SectionHeader title="Demand" />

      <SliderRow
        label="Demand Elasticity"
        sublabel="(short-run)"
        min={-0.08} max={-0.01} step={0.005}
        value={inputs.demandElasticity}
        format={(v) => v.toFixed(3)}
        onChange={(v) => update({ demandElasticity: v })}
      />

      {/* Model toggles */}
      <SectionHeader title="Model" />
      <Toggle
        label="Seasonal Refinery Maintenance"
        checked={inputs.seasonalMaintenanceOn}
        onChange={(v) => update({ seasonalMaintenanceOn: v })}
      />
    </div>
  );
}
