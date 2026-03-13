/**
 * System State Panel — variable dashboard + loop indicator.
 * Section 6.3 of the design document.
 */

import type { ReactNode } from "react";
import type { SimState } from "../simulation/variables";

interface Props {
  state: SimState;
  prevState?: SimState;
}

function TrendArrow({ current, prev }: { current: number; prev?: number }) {
  if (!prev) return null;
  const delta = current - prev;
  if (Math.abs(delta) < 0.001) return <span style={{ color: "#718096" }}>→</span>;
  return delta > 0
    ? <span style={{ color: "#fc8181" }}>↑</span>
    : <span style={{ color: "#68d391" }}>↓</span>;
}

function VarRow({
  label, value, prev, unit, format, highlight,
}: {
  label: string;
  value: number;
  prev?: number;
  unit: string;
  format?: (v: number) => string;
  highlight?: boolean;
}) {
  const display = format ? format(value) : value.toFixed(2);
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "4px 0",
      borderBottom: "1px solid #1a2235",
    }}>
      <span style={{ fontSize: 11, color: "#718096", flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontWeight: highlight ? 700 : 400,
        color: highlight ? "#63b3ed" : "#e2e8f0",
        fontVariantNumeric: "tabular-nums",
        marginRight: 6,
      }}>
        {display} {unit}
      </span>
      <TrendArrow current={value} prev={prev} />
    </div>
  );
}

interface LoopBadgeProps {
  id: string;
  label: string;
  type: "R" | "B";
  intensity: number;
}
function LoopBadge({ id, label, type, intensity }: LoopBadgeProps) {
  const isActive = intensity > 0.15;
  const rColor = "#fc8181";
  const bColor = "#68d391";
  const activeColor = type === "R" ? rColor : bColor;
  const opacity = isActive ? Math.min(0.4 + intensity * 0.6, 1) : 0.25;

  return (
    <div title={`${id}: ${label} (intensity ${(intensity * 100).toFixed(0)}%)`} style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 7px",
      borderRadius: 4,
      border: `1px solid ${isActive ? activeColor : "#2d3748"}`,
      background: isActive ? `${activeColor}22` : "transparent",
      opacity,
      cursor: "default",
      transition: "all 0.3s",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? activeColor : "#4a5568" }}>
        {id}
      </span>
      <span style={{ fontSize: 9, color: isActive ? activeColor : "#4a5568", maxWidth: 90, lineHeight: 1.2 }}>
        {label}
      </span>
      {isActive && (
        <div style={{
          width: 4, height: 20, borderRadius: 2,
          background: activeColor,
          opacity: 0.6,
          marginLeft: 2,
          transform: `scaleY(${0.2 + intensity * 0.8})`,
          transformOrigin: "bottom",
        }} />
      )}
    </div>
  );
}

export default function SystemState({ state, prevState }: Props) {
  const p = prevState;
  const loops = state.loopActivity;

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingRight: 2 }}>
      {/* Week indicator */}
      <div style={{
        background: "#1a2235",
        borderRadius: 6,
        padding: "6px 10px",
        marginBottom: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: "#718096" }}>Week {state.week} snapshot</span>
        <span style={{ fontSize: 12, color: "#a0aec0", fontWeight: 700 }}>
          {weekToDate(state.week)}
        </span>
      </div>

      {/* Gas price highlight */}
      <div style={{
        background: "linear-gradient(135deg, #1a2f4a, #1e3a5f)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 12,
        border: "1px solid #2c5282",
      }}>
        <div style={{ fontSize: 10, color: "#718096", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Gas Price (National Avg)
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#63b3ed", fontVariantNumeric: "tabular-nums" }}>
          ${state.retailGasPrice.toFixed(2)}
          <span style={{ fontSize: 13, fontWeight: 400, color: "#a0aec0" }}>/gal</span>
        </div>
        {p && (
          <div style={{ fontSize: 11, color: state.retailGasPrice > p.retailGasPrice ? "#fc8181" : "#68d391" }}>
            {state.retailGasPrice > p.retailGasPrice ? "▲" : "▼"}{" "}
            ${Math.abs(state.retailGasPrice - p.retailGasPrice).toFixed(3)} from prev week
          </div>
        )}
      </div>

      {/* Supply/demand gauge */}
      <SupplyDemandGauge supply={state.globalSupplyMbd} demand={state.globalDemandMbd} />

      {/* Variable table */}
      <div style={{ marginTop: 10 }}>
        <SectionLabel>Supply</SectionLabel>
        <VarRow label="Strait throughput" value={state.straitEffectiveMbd} prev={p?.straitEffectiveMbd} unit="mbd" format={(v) => v.toFixed(1)} />
        <VarRow label="OPEC+ output" value={state.opecOutputMbd} prev={p?.opecOutputMbd} unit="mbd" format={(v) => v.toFixed(1)} />
        <VarRow label="US production" value={state.usProductionMbd} prev={p?.usProductionMbd} unit="mbd" format={(v) => v.toFixed(2)} />
        <VarRow label="SPR release" value={state.sprReleaseRateMbd} prev={p?.sprReleaseRateMbd} unit="mbd" format={(v) => v.toFixed(2)} />
        <VarRow label="Global supply" value={state.globalSupplyMbd} prev={p?.globalSupplyMbd} unit="mbd" format={(v) => v.toFixed(1)} highlight />
        <VarRow label="Global demand" value={state.globalDemandMbd} prev={p?.globalDemandMbd} unit="mbd" format={(v) => v.toFixed(1)} />

        <SectionLabel>Price</SectionLabel>
        <VarRow label="WTI crude" value={state.wtiCrude} prev={p?.wtiCrude} unit="$/bbl" format={(v) => `$${v.toFixed(1)}`} highlight />
        <VarRow label="Risk premium" value={state.riskPremium} prev={p?.riskPremium} unit="$/bbl" format={(v) => `$${v.toFixed(1)}`} />
        <VarRow label="Crack spread" value={state.crackSpread} prev={p?.crackSpread} unit="$/bbl" format={(v) => `$${v.toFixed(1)}`} />

        <SectionLabel>Refining &amp; Inventory</SectionLabel>
        <VarRow label="Refinery util." value={state.refineryUtilization * 100} prev={p ? p.refineryUtilization * 100 : undefined} unit="%" format={(v) => `${v.toFixed(1)}%`} />
        <VarRow label="Gasoline inventory" value={state.gasolineInventory} prev={p?.gasolineInventory} unit="M bbl" format={(v) => `${v.toFixed(0)}`} />
        <VarRow label="Inventory pressure" value={state.inventoryPressure * 100} prev={p ? p.inventoryPressure * 100 : undefined} unit="%" format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`} />

        <SectionLabel>Retail</SectionLabel>
        <VarRow label="Retailer margin" value={state.retailerMargin} prev={p?.retailerMargin} unit="$/gal" format={(v) => `$${v.toFixed(3)}`} />
        <VarRow label="Distribution" value={state.distributionCost} prev={p?.distributionCost} unit="$/gal" format={(v) => `$${v.toFixed(3)}`} />
        <VarRow label="Demand modifier" value={(state.demandModifier - 1) * 100} prev={p ? (p.demandModifier - 1) * 100 : undefined} unit="%" format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`} />
      </div>

      {/* Feedback loop activity */}
      <div style={{ marginTop: 14 }}>
        <SectionLabel>Feedback Loops</SectionLabel>
        <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 6 }}>
          Reinforcing (price amplifying)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          <LoopBadge id="R1" label="Speculation Spiral" type="R" intensity={loops.R1_speculation} />
          <LoopBadge id="R2" label="Inventory Panic" type="R" intensity={loops.R2_inventoryPanic} />
          <LoopBadge id="R3" label="Crack Expansion" type="R" intensity={loops.R3_crackExpansion} />
        </div>
        <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 6 }}>
          Balancing (price dampening)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <LoopBadge id="B1" label="Demand Destruction" type="B" intensity={loops.B1_demandDestruction} />
          <LoopBadge id="B2" label="SPR / IEA Release" type="B" intensity={loops.B2_spr} />
          <LoopBadge id="B3" label="Production Response" type="B" intensity={loops.B3_productionResponse} />
          <LoopBadge id="B4" label="Rerouting (Cape)" type="B" intensity={loops.B4_rerouting} />
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 9, textTransform: "uppercase", letterSpacing: "0.10em",
      color: "#4a5568", marginTop: 10, marginBottom: 3,
    }}>
      {children}
    </div>
  );
}

function SupplyDemandGauge({ supply, demand }: { supply: number; demand: number }) {
  const surplus = supply - demand;
  const pct = clamp((surplus / demand) * 100, -8, 8);
  const isDeficit = surplus < 0;
  const barWidth = Math.abs(pct) / 8 * 50; // 0–50% of bar

  return (
    <div style={{
      background: "#1a2235", borderRadius: 6, padding: "8px 10px",
    }}>
      <div style={{ fontSize: 10, color: "#718096", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Market Balance
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "#4a5568", width: 50, textAlign: "right" }}>Surplus</span>
        <div style={{ flex: 1, height: 10, background: "#2d3748", borderRadius: 5, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "#4a5568" }} />
          <div style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: isDeficit ? `${50 - barWidth}%` : "50%",
            width: `${barWidth}%`,
            background: isDeficit ? "#fc8181" : "#68d391",
            transition: "all 0.3s",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "#4a5568", width: 50 }}>Deficit</span>
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: isDeficit ? "#fc8181" : "#68d391", fontWeight: 700 }}>
        {isDeficit ? "▼" : "▲"} {Math.abs(surplus).toFixed(1)} mbd {isDeficit ? "deficit" : "surplus"}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function weekToDate(week: number): string {
  const start = new Date(2026, 1, 28); // Feb 28
  const d = new Date(start.getTime() + week * 7 * 86400000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
