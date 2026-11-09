import { useRef, useState, type PointerEvent } from "react";
import { money0 } from "./data";

export type ChartBar = {
  key: string;
  value: number;
  /** Axis label; empty to skip. */
  label: string;
  trend?: number;
};

const W = 340;
const H = 190;
const PAD_L = 40;
const PAD_R = 4;
const PAD_T = 8;
const PAD_B = 22;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

// Smooth line through points (Catmull-Rom as cubic Béziers).
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Bar chart with an optional trend line. Tap or drag across it to select a bar, like iOS charts. */
export function BarChart({
  bars,
  selected,
  onSelect,
  highlight,
  ariaLabel,
}: {
  bars: ChartBar[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Bar to emphasise when nothing is selected. */
  highlight?: string;
  ariaLabel: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const max = niceMax(Math.max(0, ...bars.map((b) => Math.max(b.value, b.trend ?? 0))));
  const slot = PLOT_W / Math.max(1, bars.length);
  const barW = Math.max(2, Math.min(28, slot * 0.62));
  const y = (v: number) => PAD_T + PLOT_H - (Math.max(0, v) / max) * PLOT_H;
  const cx = (i: number) => PAD_L + slot * i + slot / 2;
  const emphasis = selected ?? highlight ?? null;
  const tallest = bars.reduce<ChartBar | null>((m, b) => (b.value > (m?.value ?? 0) ? b : m), null);
  const peak = emphasis ?? tallest?.key ?? null;

  const keyAt = (e: PointerEvent<SVGSVGElement>): string | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((x - PAD_L) / slot);
    return bars[Math.min(bars.length - 1, Math.max(0, i))]?.key ?? null;
  };

  const trendPts = bars.every((b) => b.trend !== undefined)
    ? bars.map((b, i) => ({ x: cx(i), y: y(b.trend ?? 0) }))
    : [];

  return (
    <svg
      ref={svgRef}
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        setDragging(true);
        const k = keyAt(e);
        onSelect(k === selected ? null : k);
      }}
      onPointerMove={(e) => {
        if (dragging && e.pointerType !== "mouse") onSelect(keyAt(e));
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line className="grid" x1={PAD_L} x2={W - PAD_R} y1={y(max * f)} y2={y(max * f)} />
          <text x={PAD_L - 6} y={y(max * f) + 3} textAnchor="end">{money0(max * f)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const h = Math.max(b.value > 0 ? 2 : 0, PLOT_H - (y(b.value) - PAD_T));
        const dim = emphasis !== null && b.key !== emphasis;
        return (
          <g key={b.key}>
            {h > 0 && (
              <rect className={`bar${dim ? " dim" : ""}${b.key === peak ? " peak" : ""}`} x={cx(i) - barW / 2} y={PAD_T + PLOT_H - h} width={barW} height={h} rx={Math.min(3, barW / 2)} />
            )}
            {b.label && (
              <text x={cx(i)} y={H - 6} textAnchor="middle">{b.label}</text>
            )}
          </g>
        );
      })}
      {trendPts.length > 1 && <path className="trend" d={smoothPath(trendPts)} />}
    </svg>
  );
}
