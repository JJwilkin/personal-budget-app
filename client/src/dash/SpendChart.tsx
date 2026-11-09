import { useState } from "react";
import { categoryColor, CATEGORY_COLORS, money, money0 } from "../../../shared/spending";

export type Range = "day" | "week" | "month";

export type ChartBucket = {
  key: string;
  /** Axis label; empty to skip. */
  label: string;
  /** Tooltip heading. */
  title: string;
  /** Spending by category, rent excluded. */
  segs: { cat: string; v: number }[];
  rent: number;
  /** Days later in the current month: drawn as empty outlines. */
  future?: boolean;
  trend?: number;
  /** Biggest merchants in the bucket, for the tooltip. */
  top: string[];
};

const W = 760;
const H = 230;
const PAD_L = 46;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 26;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const CAT_ORDER = Object.keys(CATEGORY_COLORS);

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

/** Smooth line through the points; control points never dip below `floor` (the $0 line). */
function smoothPath(pts: { x: number; y: number }[], floor: number): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1y = Math.min(floor, p1.y + (p2.y - p0.y) / 6);
    const c2y = Math.min(floor, p2.y - (p3.y - p1.y) / 6);
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${c1y.toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const sum = (segs: { v: number }[]) => segs.reduce((s, x) => s + x.v, 0);

/**
 * Stacked bars of everyday spending (rent left out, marked with a pin on the
 * day it landed), an optional 7-day trend line, hover tooltips, and click or
 * Enter to focus a bar. With a category picked, only that category is drawn.
 */
export function SpendChart({
  buckets,
  focus,
  category,
  onFocus,
  ariaLabel,
}: {
  buckets: ChartBucket[];
  focus: string | null;
  category: string | null;
  onFocus: (key: string | null) => void;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = (b: ChartBucket) =>
    [...b.segs]
      .filter((s) => !category || s.cat === category)
      .sort((a, c) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(c.cat));
  const max = niceMax(Math.max(0, ...buckets.map((b) => Math.max(sum(shown(b)), category ? 0 : (b.trend ?? 0)))));
  const slot = PLOT_W / Math.max(1, buckets.length);
  const barW = Math.max(3, Math.min(34, slot * 0.64));
  const y = (v: number) => PAD_T + PLOT_H - (Math.max(0, v) / max) * PLOT_H;
  const cx = (i: number) => PAD_L + slot * i + slot / 2;

  const trend = category
    ? []
    : buckets
        .map((b, i) => (b.trend !== undefined && !b.future ? { x: cx(i), y: y(b.trend) } : null))
        .filter((p): p is { x: number; y: number } => p !== null);

  const tipKey = hover ?? focus;
  const tipIndex = buckets.findIndex((b) => b.key === tipKey);
  const tip = tipIndex >= 0 ? buckets[tipIndex] : undefined;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(max * f) + 4} textAnchor="end" fontSize={11} fill="var(--dim-2)">
              {money0(max * f)}
            </text>
          </g>
        ))}

        {buckets.map((b, i) => {
          const segs = shown(b);
          const total = sum(segs);
          const dim = focus !== null && b.key !== focus;
          const x = cx(i) - barW / 2;
          let acc = 0;
          return (
            <g
              key={b.key}
              role={b.future ? undefined : "button"}
              tabIndex={b.future ? undefined : 0}
              aria-label={b.future ? undefined : `${b.title}: ${money(total)}${b.rent > 0 ? ", rent landed" : ""}`}
              aria-pressed={b.future ? undefined : focus === b.key}
              style={{ cursor: b.future ? "default" : "pointer", outline: "none" }}
              onMouseEnter={() => !b.future && setHover(b.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => !b.future && setHover(b.key)}
              onBlur={() => setHover(null)}
              onClick={() => !b.future && onFocus(focus === b.key ? null : b.key)}
              onKeyDown={(e) => {
                if (!b.future && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onFocus(focus === b.key ? null : b.key);
                }
              }}
            >
              <rect x={cx(i) - slot / 2} y={PAD_T} width={slot} height={PLOT_H} fill="transparent" />
              {b.future ? (
                <rect x={x} y={y(0) - 8} width={barW} height={8} rx={3} fill="none" stroke="var(--border)" strokeDasharray="3 3" />
              ) : total > 0 ? (
                segs.map((s) => {
                  const h = (s.v / max) * PLOT_H;
                  const top = y(acc + s.v);
                  acc += s.v;
                  return (
                    <rect
                      key={s.cat}
                      x={x}
                      y={top}
                      width={barW}
                      height={Math.max(1.5, h)}
                      rx={Math.min(4, barW / 3)}
                      fill={categoryColor(s.cat)}
                      opacity={dim ? 0.3 : 1}
                    />
                  );
                })
              ) : (
                <rect x={x} y={y(0) - 3} width={barW} height={3} rx={1.5} fill="var(--border)" />
              )}
              {b.rent > 0 && (
                <g transform={`translate(${cx(i) - 9} ${Math.max(PAD_T, y(total) - 24)})`} opacity={dim ? 0.4 : 1} aria-hidden="true">
                  <rect width={18} height={18} rx={6} fill="var(--accent-soft)" />
                  <path d="M4 9l5-4.5L14 9v5h-3.2v-3.4H7.2V14H4z" fill="var(--accent)" />
                </g>
              )}
              {(focus === b.key || hover === b.key) && !b.future && (
                <rect x={x - 3} y={y(total) - 3} width={barW + 6} height={Math.max(6, y(0) - y(total) + 3)} rx={6} fill="none" stroke="var(--text)" strokeOpacity={0.35} />
              )}
              {b.label && (
                <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--dim-2)">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}

        {trend.length > 1 && (
          <path d={smoothPath(trend, y(0))} fill="none" stroke="var(--trend)" strokeWidth={2.5} strokeLinecap="round" pointerEvents="none" />
        )}
      </svg>

      {tip && !tip.future && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max max-w-[240px] -translate-x-1/2 rounded-[14px] bg-[var(--text)] px-3 py-2 text-[12.5px] leading-snug text-[var(--bg)] shadow-lg"
          style={{ left: `${Math.min(85, Math.max(15, (cx(tipIndex) / W) * 100))}%` }}
          role="status"
        >
          <div className="font-bold">
            {tip.title} · {money(sum(shown(tip)))}
          </div>
          {tip.rent > 0 && <div className="opacity-80">Rent {money0(tip.rent)} landed (not in the bar)</div>}
          {tip.trend !== undefined && !category && <div className="opacity-80">7-day average {money(tip.trend)}</div>}
          {tip.top.length > 0 && <div className="opacity-80">{tip.top.join(", ")}</div>}
        </div>
      )}
    </div>
  );
}
