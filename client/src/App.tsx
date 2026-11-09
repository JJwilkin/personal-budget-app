import { useId, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";

type Dashboard = ApiResponse<typeof api, "getDashboard">;
type Txn = Dashboard["transactions"][number];
type Mark = Dashboard["marks"][number];
type MarkType = Mark["mark_type"];

const CATCOLORS: Record<string, string> = {
  Rent: "#0e6b4f",
  "Food & drink": "#d97c1e",
  Groceries: "#7fb069",
  Shopping: "#2a7f9e",
  "Transport & rides": "#4a6fa5",
  Travel: "#c2504e",
  Entertainment: "#8e5ea2",
  "Utilities & bills": "#5b8c5a",
  Health: "#3d9b8f",
  Home: "#a67c52",
  "Personal care": "#c97b9a",
  "Donations & fees": "#8a8d3c",
  "People & transfers": "#6b7f8e",
  Other: "#9aa39c",
};

const MARK_LABELS: Record<MarkType, string> = {
  paid_back: "Paid back by others",
  reimbursed: "Reimbursed",
  refunded: "Refunded",
};

function money(n: number, digits = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money0(n: number): string {
  return money(Math.round(n), 0);
}

function monthLabel(ym: string): string {
  const [y = 2026, m = 1] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function monthShort(ym: string): string {
  const [y = 2026, m = 1] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function fmtLong(iso: string): string {
  const [y = 2026, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDate(iso: string): string {
  const [y = 2026, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type Seg = { cat: string; v: number };
type StackRow = {
  key: string;
  label: string;
  title: string;
  total: number;
  segs: Seg[];
};

const CAT_ORDER = Object.keys(CATCOLORS);

function segsFor(txns: Txn[]): Seg[] {
  const m = new Map<string, number>();
  for (const t of txns) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
  return CAT_ORDER.filter((c) => (m.get(c) ?? 0) > 0).map((cat) => ({
    cat,
    v: m.get(cat) ?? 0,
  }));
}

function isoOf(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Catmull-Rom spline through the points, expressed as cubic Bézier
// segments, so the trend reads as one smooth curve instead of straight
// segments between days.
function smoothTrendPath(pts: { cx: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const first = pts[0];
  if (!first) return "";
  if (pts.length < 3) {
    return pts
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.cx} ${p.y}`)
      .join(" ");
  }
  let d = `M ${first.cx} ${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    if (!p1 || !p2) continue;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.cx + (p2.cx - p0.cx) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.cx - (p3.cx - p1.cx) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.cx} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function StackedBarChart({
  rows,
  ariaLabel,
  selectedKey,
  onSelect,
  trendPoints,
  trendLabel,
}: {
  rows: StackRow[];
  ariaLabel: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  trendPoints?: number[];
  trendLabel?: string;
}) {
  const W = 720;
  const H = 224;
  const padB = 24;
  const padT = 30;
  const plotH = H - padB - padT;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const bw = W / Math.max(1, rows.length);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hoverTrend, setHoverTrend] = useState<number | null>(null);
  const geom = rows.map((r, i) => {
    const h = Math.max(1, (plotH * r.total) / max);
    const x = i * bw + bw * 0.18;
    const w = bw * 0.64;
    const y = H - padB - h;
    return { r, i, h, x, w, y, cx: x + w / 2 };
  });
  const trendGeom =
    trendPoints && trendPoints.length === rows.length
      ? trendPoints.map((v, i) => {
          const cx = geom[i]?.cx ?? i * bw + bw / 2;
          const clamped = Math.max(0, Math.min(v, max));
          const y = H - padB - (plotH * clamped) / max;
          return { v, cx, y, i };
        })
      : [];
  const trendPath = smoothTrendPath(trendGeom);
  const lastTrend = trendGeom[trendGeom.length - 1];
  const hoverP = hoverTrend != null ? trendGeom[hoverTrend] : undefined;
  const hoverPrev =
    hoverTrend != null && hoverTrend > 0
      ? trendGeom[hoverTrend - 1]
      : undefined;
  const hoverDelta =
    hoverP && hoverPrev ? hoverP.v - hoverPrev.v : null;
  const hoverDay = hoverP ? rows[hoverP.i] : undefined;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={ariaLabel}
      className="w-full"
      style={{ height: "auto" }}
    >
      <defs>
        {geom.map(({ r, i, h, x, w, y }) => (
          <clipPath key={r.key} id={`${uid}-${i}`}>
            <rect x={x} y={y} width={w} height={h} rx={3} />
          </clipPath>
        ))}
      </defs>
      {geom.map(({ r, i, h, x, w, y, cx }) => {
        const selected = selectedKey === r.key;
        const dimmed = selectedKey != null && !selected;
        const price = money0(r.total);
        const priceW = price.length * 6.6 + 4;
        let acc = 0;
        const segRects = r.segs.map((s) => {
          const sh = (plotH * s.v) / max;
          const sy = H - padB - acc - sh;
          acc += sh;
          return { ...s, sy, sh };
        });
        return (
          <g
            key={r.key}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${r.title}: ${money(r.total)} total — show its transactions`}
            onClick={() => onSelect(r.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(r.key);
              }
            }}
            style={{ cursor: "pointer" }}
            opacity={dimmed ? 0.4 : 1}
          >
            <rect
              x={i * bw}
              y={padT - 8}
              width={bw}
              height={plotH + 8}
              fill="transparent"
            />
            <g clipPath={`url(#${uid}-${i})`}>
              {segRects.map((s) => (
                <rect
                  key={s.cat}
                  x={x}
                  y={s.sy}
                  width={w}
                  height={Math.max(0.75, s.sh)}
                  fill={CATCOLORS[s.cat] ?? "#9aa39c"}
                >
                  <title>{`${s.cat}: ${money(s.v)}`}</title>
                </rect>
              ))}
            </g>
            {selected && (
              <rect
                x={x - 2.5}
                y={y - 2.5}
                width={w + 5}
                height={h + 5}
                rx={4}
                fill="none"
                stroke="var(--amber)"
                strokeWidth={2.5}
              />
            )}
            {h >= 16 && w >= priceW ? (
              <text
                x={cx}
                y={y + 14}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="#ffffff"
                stroke="rgba(0,0,0,0.28)"
                strokeWidth={2.5}
                paintOrder="stroke"
                style={{ fontFamily: "var(--font-mono)", pointerEvents: "none" }}
              >
                {price}
              </text>
            ) : h >= priceW + 10 ? (
              <text
                x={cx}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fill="#ffffff"
                stroke="rgba(0,0,0,0.28)"
                strokeWidth={2.5}
                paintOrder="stroke"
                transform={`rotate(-90 ${cx} ${y + h / 2})`}
                style={{ fontFamily: "var(--font-mono)", pointerEvents: "none" }}
              >
                {price}
              </text>
            ) : (
              <text
                x={cx}
                y={y - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="var(--dim)"
                style={{ fontFamily: "var(--font-mono)", pointerEvents: "none" }}
              >
                {price}
              </text>
            )}
            {(rows.length <= 14 || i % Math.ceil(rows.length / 10) === 0) && (
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fontSize={11}
                fill="var(--dim-2)"
              >
                {r.label}
              </text>
            )}
          </g>
        );
      })}
      {trendGeom.length > 1 && (
        <g>
          <title>{trendLabel ?? "3-day moving average (excl. rent)"}</title>
          {/* smooth trend line through the 3-day average points */}
          <path
            d={trendPath}
            fill="none"
            stroke="var(--amber)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          />
          {trendGeom.map((p) => {
            const prev = p.i > 0 ? trendGeom[p.i - 1] : undefined;
            const delta = prev ? p.v - prev.v : null;
            const changeText =
              delta == null
                ? "first day shown"
                : delta === 0
                  ? "no change from the previous day"
                  : `${delta > 0 ? "up" : "down"} ${money(Math.abs(delta))} from the previous day`;
            return (
              <g key={p.i}>
                <circle
                  cx={p.cx}
                  cy={p.y}
                  r={hoverTrend === p.i ? 4.5 : 2.6}
                  fill="var(--amber)"
                  stroke="var(--surface)"
                  strokeWidth={1.2}
                  style={{ pointerEvents: "none" }}
                />
                <circle
                  cx={p.cx}
                  cy={p.y}
                  r={Math.max(9, bw / 2)}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${rows[p.i]?.title ?? `Day ${p.i + 1}`}: 3-day average excluding rent ${money(p.v)}, ${changeText}`}
                  onMouseEnter={() => setHoverTrend(p.i)}
                  onMouseLeave={() =>
                    setHoverTrend((h) => (h === p.i ? null : h))
                  }
                  onFocus={() => setHoverTrend(p.i)}
                  onBlur={() =>
                    setHoverTrend((h) => (h === p.i ? null : h))
                  }
                  onClick={() => setHoverTrend(p.i)}
                  style={{ cursor: "pointer", outline: "none" }}
                >
                  <title>{`${rows[p.i]?.title ?? `Day ${p.i + 1}`}: 3-day avg (excl. rent) ${money(p.v)} — ${changeText}`}</title>
                </circle>
              </g>
            );
          })}
          {hoverP && hoverDay && (
            <g style={{ pointerEvents: "none" }}>
              {(() => {
                const line1 = `${hoverDay.title} · 3-day avg ${money(hoverP.v)}`;
                const line2 =
                  hoverDelta == null
                    ? "First day shown"
                    : hoverDelta === 0
                      ? "No change vs previous day"
                      : `${hoverDelta > 0 ? "+" : "−"}${money(Math.abs(hoverDelta))} vs previous day`;
                const boxW =
                  Math.max(line1.length, line2.length) * 6.4 + 16;
                const boxH = 38;
                const boxX = Math.max(
                  4,
                  Math.min(W - boxW - 4, hoverP.cx - boxW / 2),
                );
                const boxY =
                  hoverP.y - boxH - 10 >= 2
                    ? hoverP.y - boxH - 10
                    : hoverP.y + 12;
                return (
                  <>
                    <line
                      x1={hoverP.cx}
                      x2={hoverP.cx}
                      y1={hoverP.y}
                      y2={H - padB}
                      stroke="var(--amber)"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.6}
                    />
                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxW}
                      height={boxH}
                      rx={6}
                      fill="var(--surface)"
                      stroke="var(--amber)"
                      strokeWidth={1}
                    />
                    <text
                      x={boxX + 8}
                      y={boxY + 15}
                      fontSize={11}
                      fontWeight={700}
                      fill="var(--text)"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {line1}
                    </text>
                    <text
                      x={boxX + 8}
                      y={boxY + 30}
                      fontSize={11}
                      fontWeight={600}
                      fill={
                        hoverDelta == null || hoverDelta === 0
                          ? "var(--dim)"
                          : hoverDelta > 0
                            ? "var(--rust)"
                            : "var(--accent)"
                      }
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {line2}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
          {trendLabel && lastTrend && (
            <>
              <rect
                x={Math.max(4, Math.min(W - trendLabel.length * 6.9 - 14, lastTrend.cx - (trendLabel.length * 6.9) / 2))}
                y={Math.max(padT - 26, lastTrend.y - 24)}
                width={trendLabel.length * 6.9 + 10}
                height={16}
                rx={4}
                fill="var(--surface)"
                stroke="var(--amber)"
                strokeWidth={0.75}
                opacity={0.96}
              />
              <text
                x={Math.max(9, Math.min(W - trendLabel.length * 6.9 - 9, lastTrend.cx - (trendLabel.length * 6.9) / 2)) + 5}
                y={Math.max(padT - 14, lastTrend.y - 12)}
                fontSize={10.5}
                fontWeight={700}
                fill="var(--amber)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {trendLabel}
              </text>
            </>
          )}
        </g>
      )}
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="var(--border)" />
    </svg>
  );
}

function CatLegend({ rows }: { rows: StackRow[] }) {
  const present = CAT_ORDER.filter((c) =>
    rows.some((r) => r.segs.some((s) => s.cat === c)),
  );
  if (present.length === 0) return null;
  return (
    <ul
      className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5"
      aria-label="Category colors in the bars"
    >
      {present.map((c) => (
        <li
          key={c}
          className="flex items-center gap-1.5 text-[12px] text-[var(--dim)]"
        >
          <span
            className="inline-block h-[10px] w-[10px] shrink-0 rounded-[3px]"
            style={{ background: CATCOLORS[c] ?? "#9aa39c" }}
          />
          {c}
        </li>
      ))}
    </ul>
  );
}

function MarkEditor({
  txn,
  existing,
  onClose,
}: {
  txn: Txn;
  existing: Mark | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<MarkType>(existing?.mark_type ?? "paid_back");
  const [amount, setAmount] = useState<string>(
    existing ? String(existing.amount) : "",
  );
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [error, setError] = useState<string>("");

  const save = useMutation({
    mutationFn: (args: {
      transaction_id: string;
      mark_type: MarkType;
      amount: number;
      note: string;
    }) => api.saveMark(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: () => setError("Couldn't save — check your connection and try again."),
  });
  const clear = useMutation({
    mutationFn: (id: string) => api.clearMark({ transaction_id: id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: () => setError("Couldn't remove the mark — try again."),
  });

  const parsed = Number(amount);
  const valid =
    amount.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    parsed <= txn.amount + 0.001;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError(`Enter an amount between $0.01 and ${money(txn.amount)}.`);
      return;
    }
    save.mutate({
      transaction_id: txn.id,
      mark_type: type,
      amount: Math.round(parsed * 100) / 100,
      note: note.trim(),
    });
  }

  function quick(pct: number) {
    setAmount(String(Math.round(txn.amount * pct * 100) / 100));
    setError("");
  }
  function split(people: number) {
    const others = ((people - 1) / people) * txn.amount;
    setAmount(String(Math.round(others * 100) / 100));
    setError("");
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-3"
      aria-label={`Mark ${txn.name}`}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mark type">
        {(Object.keys(MARK_LABELS) as MarkType[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
              type === t
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
            }`}
          >
            {MARK_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--dim)]">
            Amount paid back
          </span>
          <input
            aria-label="Amount paid back in dollars"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="num w-32 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[15px] text-[var(--text)]"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" aria-label="Quick amounts">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => quick(p / 100)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--dim)]"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] text-[var(--dim)]">Split evenly:</span>
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => split(n)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--dim)]"
            aria-label={`Split between ${n} people — others pay their share`}
          >
            {n} people
          </button>
        ))}
        {valid && (
          <span className="num ml-1 text-[13px] text-[var(--dim)]">
            Your share: {money(txn.amount - parsed)}
          </span>
        )}
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--dim)]">
          Note (who paid you back, etc.)
        </span>
        <input
          aria-label="Note for this mark"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Roommate paid their half"
          className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)]"
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-[var(--rust)]">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : existing ? "Update mark" : "Save mark"}
        </button>
        {existing && (
          <button
            type="button"
            disabled={clear.isPending}
            onClick={() => clear.mutate(txn.id)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13.5px] font-semibold text-[var(--rust)] disabled:opacity-60"
          >
            Remove mark
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-2 text-[13.5px] font-semibold text-[var(--dim)]"
        >
          Cancel
        </button>
      </div>
      <p className="mt-2 text-[12px] text-[var(--dim-2)]">
        Saved on the server — it syncs to all your devices.
      </p>
    </form>
  );
}

function TxnList({
  txns,
  marksById,
}: {
  txns: Txn[];
  marksById: Map<string, Mark>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <div>
      {txns.map((t) => {
        const mark = marksById.get(t.id);
        const editing = editingId === t.id;
        return (
          <div
            key={t.id}
            className="border-b border-dashed border-[var(--border)] py-2.5 last:border-0"
          >
            <div className="flex items-baseline gap-3">
              <span className="w-[52px] shrink-0 text-[12.5px] text-[var(--dim-2)]">
                {fmtDate(t.date)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{t.name}</span>
                {t.pending && (
                  <span className="ml-1.5 rounded-full bg-[var(--amber-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--amber)]">
                    pending
                  </span>
                )}
                {t.brex_eligible && (
                  <span className="ml-1.5 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                    Brex-eligible
                  </span>
                )}
                <span className="block text-[12px] text-[var(--dim-2)]">
                  {t.category} · {t.account}
                </span>
                {mark && (
                  <span className="mt-0.5 block text-[12.5px] font-medium text-[var(--accent)]">
                    {MARK_LABELS[mark.mark_type]}: {money(mark.amount)}
                    {mark.note ? ` · ${mark.note}` : ""} — your share{" "}
                    {money(t.amount - mark.amount)}
                  </span>
                )}
              </span>
              <span className="num shrink-0 text-right text-[13.5px]">
                {money(t.amount)}
                {mark && (
                  <span className="block text-[12px] text-[var(--accent)]">
                    −{money(mark.amount)}
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-expanded={editing}
                aria-label={`${mark ? "Edit mark on" : "Mark"} ${t.name}`}
                onClick={() => setEditingId(editing ? null : t.id)}
                className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--dim)]"
              >
                {mark ? "Edit" : "Mark"}
              </button>
            </div>
            {editing && (
              <MarkEditor
                txn={t}
                existing={mark}
                onClose={() => setEditingId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DrillPanel({
  title,
  txns,
  marksById,
  onClose,
}: {
  title: string;
  txns: Txn[];
  marksById: Map<string, Mark>;
  onClose: () => void;
}) {
  const total = txns.reduce((s, t) => s + t.amount, 0);
  const cats = new Map<string, number>();
  for (const t of txns) cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
  const catRows = [...cats.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div
      className="mt-3 rounded-[14px] border-2 border-[var(--amber)] bg-[var(--surface)] p-4 shadow-sm"
      aria-label={`Transactions for ${title}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-bold tracking-tight">
          {title} — <span className="num">{money(total)}</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close transaction details"
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--dim)]"
        >
          Close
        </button>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--dim)]">
        {txns.length} transaction{txns.length === 1 ? "" : "s"} in this bar
      </p>
      <ul
        className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5"
        aria-label="Category subtotals"
      >
        {catRows.map(([c, v]) => (
          <li
            key={c}
            className="flex items-center gap-1.5 text-[12.5px] text-[var(--dim)]"
          >
            <span
              className="inline-block h-[10px] w-[10px] shrink-0 rounded-[3px]"
              style={{ background: CATCOLORS[c] ?? "#9aa39c" }}
            />
            {c}{" "}
            <span className="num font-semibold text-[var(--text)]">
              {money(v)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 border-t border-dashed border-[var(--border)]">
        <TxnList txns={txns} marksById={marksById} />
      </div>
    </div>
  );
}

export function App() {
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard({}),
  });
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(200);
  const [filter, setFilter] = useState<"all" | "marked" | "unmarked">("all");
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<{ kind: "day" | "week"; key: string } | null>(
    null,
  );
  const [refreshMsg, setRefreshMsg] = useState("");

  const refresh = useMutation({
    mutationFn: () => api.refreshFromPlaid({}),
    onSuccess: (result) =>
      setRefreshMsg(
        result.started
          ? "Refresh started — new transactions will appear here once the check finishes."
          : "Refresh isn't available in this copy — it runs on sample data. The live version refreshes from your accounts.",
      ),
    onError: () => setRefreshMsg("Couldn't start the refresh. Try again in a bit."),
  });

  const data = dash.data;
  const months = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set(data.transactions.map((t) => t.date.slice(0, 7)));
    return [...set].sort();
  }, [data]);

  const activeMonth =
    month && months.includes(month) ? month : (months[months.length - 1] ?? "");

  const view = useMemo(() => {
    if (!data || !activeMonth) return null;
    const marksById = new Map(data.marks.map((m) => [m.transaction_id, m]));
    const txns = data.transactions
      .filter((t) => t.date.startsWith(activeMonth))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const total = txns.reduce((s, t) => s + t.amount, 0);
    const marksSum = txns.reduce(
      (s, t) => s + (marksById.get(t.id)?.amount ?? 0),
      0,
    );
    const brexReceived = data.meta?.brexReceivedByMonth[activeMonth] ?? 0;
    const brexEligible = txns
      .filter((t) => t.brex_eligible)
      .reduce((s, t) => s + t.amount, 0);
    const oop = total - brexReceived - marksSum;
    const rent = txns
      .filter((t) => t.category === "Rent")
      .reduce((s, t) => s + t.amount, 0);
    const isCurrent =
      data.meta != null && activeMonth === data.meta.asOf.slice(0, 7);
    const daysInMonth = (() => {
      const [y = 2026, m = 1] = activeMonth.split("-").map(Number);
      if (isCurrent && data.meta) {
        const d = Number(data.meta.asOf.split("-")[2] ?? "1");
        return Number.isFinite(d) && d > 0 ? d : new Date(y, m, 0).getDate();
      }
      return new Date(y, m, 0).getDate();
    })();
    const cats = new Map<string, { n: number; total: number }>();
    for (const t of txns) {
      const c = cats.get(t.category) ?? { n: 0, total: 0 };
      c.n += 1;
      c.total += t.amount;
      cats.set(t.category, c);
    }
    const catRows = [...cats.entries()]
      .map(([cat, v]) => ({ cat, ...v }))
      .sort((a, b) => b.total - a.total);
    const merch = new Map<string, { n: number; total: number }>();
    for (const t of txns) {
      const mm = merch.get(t.name) ?? { n: 0, total: 0 };
      mm.n += 1;
      mm.total += t.amount;
      merch.set(t.name, mm);
    }
    const merchRows = [...merch.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    const byDate = new Map<string, Txn[]>();
    for (const t of txns) {
      const arr = byDate.get(t.date) ?? [];
      arr.push(t);
      byDate.set(t.date, arr);
    }
    const daily = [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([d, arr]) => ({
        key: d,
        label: String(Number(d.split("-")[2] ?? "1")),
        title: fmtDate(d),
        total: arr.reduce((s, t) => s + t.amount, 0),
        segs: segsFor(arr),
      }));
    // Daily spend excluding rent, then trailing 3-day moving average:
    // for each day, average of that day + the two days before it (fewer at month start).
    const dailyExRent = daily.map(
      (d) => d.total - (d.segs.find((s) => s.cat === "Rent")?.v ?? 0),
    );
    const dailyTrend3 = dailyExRent.map((_, i) => {
      const start = Math.max(0, i - 2);
      const slice = dailyExRent.slice(start, i + 1);
      return slice.reduce((s, v) => s + v, 0) / Math.max(1, slice.length);
    });
    const large = txns.filter(
      (t) => t.amount >= threshold && t.category !== "Rent",
    );
    const largeSum = large.reduce((s, t) => s + t.amount, 0);
    const everyday = total - rent - largeSum;
    return {
      marksById,
      txns,
      total,
      marksSum,
      brexReceived,
      brexEligible,
      brexUnpaid: Math.max(0, brexEligible - brexReceived),
      oop,
      rent,
      daysInMonth,
      isCurrent,
      catRows,
      merchRows,
      daily,
      dailyExRent,
      dailyTrend3,
      large: [...large].sort((a, b) => b.amount - a.amount),
      largeSum,
      everyday,
    };
  }, [data, activeMonth, threshold]);

  const weekly = useMemo(() => {
    if (!data) return [] as (StackRow & { start: string; end: string })[];
    const map = new Map<string, Txn[]>();
    for (const t of data.transactions) {
      const [y = 2026, m = 1, d = 1] = t.date.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      const add = (7 - dt.getDay()) % 7; // days until Sunday
      const end = new Date(y, m - 1, d + add);
      const key = isoOf(end);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, arr]) => {
        const [y = 2026, m = 1, d = 1] = k.split("-").map(Number);
        const start = isoOf(new Date(y, m - 1, d - 6));
        return {
          key: k,
          start,
          end: k,
          label: fmtDate(k),
          title: `Week ending ${fmtDate(k)}`,
          total: arr.reduce((s, t) => s + t.amount, 0),
          segs: segsFor(arr),
        };
      });
  }, [data]);

  const marksByIdAll = useMemo(
    () =>
      new Map(
        (data?.marks ?? []).map((m) => [m.transaction_id, m] as const),
      ),
    [data],
  );

  const drill = useMemo(() => {
    if (!data || !sel) return null;
    let list: Txn[];
    let title: string;
    if (sel.kind === "day") {
      list = data.transactions.filter((t) => t.date === sel.key);
      title = fmtLong(sel.key);
    } else {
      const wk = weekly.find((w) => w.key === sel.key);
      if (!wk) return null;
      list = data.transactions.filter(
        (t) => t.date >= wk.start && t.date <= wk.end,
      );
      title = `Week of ${fmtDate(wk.start)} – ${fmtDate(wk.end)}`;
    }
    const sorted = [...list].sort((a, b) =>
      a.date === b.date ? b.amount - a.amount : a.date < b.date ? 1 : -1,
    );
    return { title, txns: sorted };
  }, [data, sel, weekly]);

  const toggleDay = (key: string) =>
    setSel((s) =>
      s?.kind === "day" && s.key === key ? null : { kind: "day", key },
    );
  const toggleWeek = (key: string) =>
    setSel((s) =>
      s?.kind === "week" && s.key === key ? null : { kind: "week", key },
    );

  const markedSummary = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.transactions.map((t) => [t.id, t]));
    const rows = data.marks
      .map((m) => ({ mark: m, txn: byId.get(m.transaction_id) }))
      .filter((r) => r.txn != null)
      .sort((a, b) => (a.mark.updated_at < b.mark.updated_at ? 1 : -1));
    const totalMarked = rows.reduce((s, r) => s + r.mark.amount, 0);
    return { rows, totalMarked };
  }, [data]);

  if (dash.isPending) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <SafeAreaTopScrim backgroundColor="var(--bg)" />
        <main className="mx-auto max-w-[1060px] px-5 py-16 text-center">
          <p className="text-[var(--dim)]">Loading your spending…</p>
        </main>
      </div>
    );
  }
  if (dash.error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <SafeAreaTopScrim backgroundColor="var(--bg)" />
        <main className="mx-auto max-w-[1060px] px-5 py-16 text-center">
          <p className="font-semibold">Couldn't load your spending.</p>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["dashboard"] })}
            className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white"
          >
            Try again
          </button>
        </main>
      </div>
    );
  }
  if (!data.seeded || !view) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <SafeAreaTopScrim backgroundColor="var(--bg)" />
        <main className="mx-auto max-w-[1060px] px-5 py-16 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Your spending</h1>
          <p className="mx-auto mt-3 max-w-md text-[var(--dim)]">
            No transactions are stored yet. Your spending history is imported
            when the dashboard is set up — if this screen persists, ask Muse
            to finish the import.
          </p>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["dashboard"] })}
            className="mt-5 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white"
          >
            Check again
          </button>
        </main>
      </div>
    );
  }

  const meta = data.meta;
  const filteredTxns = view.txns.filter((t) => {
    if (filter === "marked") return view.marksById.has(t.id);
    if (filter === "unmarked") return !view.marksById.has(t.id);
    return true;
  });
  const visibleTxns = showAll ? filteredTxns : filteredTxns.slice(0, 15);
  const totalAll = data.transactions.reduce((s, t) => s + t.amount, 0);
  const brexTotalReceived = (meta?.brexDeposits ?? []).reduce(
    (s, d) => s + d.amount,
    0,
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto max-w-[1060px] px-5 pb-16 pt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
          <h1 className="text-[30px] font-extrabold tracking-tight">Your spending</h1>
          <p className="text-[13.5px] text-[var(--dim)]">
            Your linked accounts · data through{" "}
            <strong className="text-[var(--text)]">{meta ? fmtLong(meta.asOf) : ""}</strong>
          </p>
        </div>

        {meta && (
          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Account balances"
          >
            {meta.accounts.map((a) => (
              <span
                key={a.label}
                className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--dim)] shadow-sm"
              >
                {a.label} —{" "}
                <span className="num font-semibold text-[var(--text)]">
                  {a.balance}
                </span>
                {a.owed ? " owed" : ""}
              </span>
            ))}
          </div>
        )}

        <div
          className="mt-5 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-[3px]"
          role="group"
          aria-label="Choose month"
        >
          {months.map((ym) => (
            <button
              key={ym}
              type="button"
              aria-pressed={activeMonth === ym}
              onClick={() => {
                setMonth(ym);
                setShowAll(false);
                setSel(null);
              }}
              className={`rounded-full px-4 py-1.5 text-[13.5px] font-semibold ${
                activeMonth === ym
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--dim)]"
              }`}
            >
              {monthShort(ym)}
            </button>
          ))}
        </div>

        <section
          className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
          aria-label={`${monthLabel(activeMonth)} summary`}
        >
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dim-2)]">
              Out of pocket · {monthShort(activeMonth)}
            </p>
            <p className="num mt-1 text-[27px] font-extrabold tracking-tight">
              {money0(view.oop)}
            </p>
            <p className="text-[13px] text-[var(--dim)]">
              {money(view.total)} spent
              {view.brexReceived > 0 &&
                ` − ${money(view.brexReceived)} Brex received`}
              {view.marksSum > 0 && ` − ${money(view.marksSum)} paid back`}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dim-2)]">
              Per day
            </p>
            <p className="num mt-1 text-[27px] font-extrabold tracking-tight">
              {money0(view.oop / view.daysInMonth)}
            </p>
            <p className="text-[13px] text-[var(--dim)]">
              {money0((view.oop - view.rent) / view.daysInMonth)} a day once rent
              is set aside
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dim-2)]">
              Transactions
            </p>
            <p className="num mt-1 text-[27px] font-extrabold tracking-tight">
              {view.txns.length}
            </p>
            <p className="text-[13px] text-[var(--dim)]">
              {view.isCurrent ? "so far this month" : "in the full month"}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dim-2)]">
              Paid back to you
            </p>
            <p className="num mt-1 text-[27px] font-extrabold tracking-tight">
              {money0(view.marksSum + view.brexReceived)}
            </p>
            <p className="text-[13px] text-[var(--dim)]">
              {money(view.brexReceived)} Brex deposits
              {view.marksSum > 0 && ` · ${money(view.marksSum)} your marks`}
            </p>
          </div>
        </section>

        <section className="mt-8" aria-label="Spending by day">
          <h2 className="text-[19px] font-bold tracking-tight">Day by day</h2>
          <p className="mb-3 text-[13.5px] text-[var(--dim)]">
            {monthLabel(activeMonth)}
            {view.isCurrent ? " so far" : ""} — rent lands as one net payment
            on the 2nd. Each bar is stacked by category with the day's total
            in it — tap a bar to see its transactions. The smooth amber line
            is the 3-day moving average of daily spend excluding rent (each
            point averages that day and the two days before it) — hover or
            tap a point on the line to see the average and how it changed
            from the day before.
          </p>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <StackedBarChart
              rows={view.daily}
              ariaLabel={`Daily spending in ${monthLabel(activeMonth)}, stacked by category, with a smooth 3-day moving average line excluding rent. Hover a point on the line to see the average and its change from the previous day. Latest 3-day average ${money(view.dailyTrend3[view.dailyTrend3.length - 1] ?? 0)} per day.`}
              selectedKey={sel?.kind === "day" ? sel.key : null}
              onSelect={toggleDay}
              trendPoints={view.dailyTrend3}
              trendLabel="3-day avg (excl. rent)"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--amber)]">
                <span
                  aria-hidden="true"
                  className="inline-block h-0 w-10 rounded-full border-t-[3px] border-[var(--amber)]"
                />
                3-day moving average (excl. rent)
                <span className="num font-bold">
                  {money(view.dailyTrend3[view.dailyTrend3.length - 1] ?? 0)}
                  /day latest
                </span>
              </span>
              <span className="text-[12px] text-[var(--dim)]">
                Month avg excl. rent:{" "}
                <span className="num font-semibold text-[var(--text)]">
                  {money((view.total - view.rent) / Math.max(1, view.daysInMonth))}
                  /day
                </span>
              </span>
            </div>
            <CatLegend rows={view.daily} />
          </div>
          {sel?.kind === "day" && drill && (
            <DrillPanel
              title={drill.title}
              txns={drill.txns}
              marksById={marksByIdAll}
              onClose={() => setSel(null)}
            />
          )}
        </section>

        <section className="mt-8" aria-label="Weekly spending">
          <h2 className="text-[19px] font-bold tracking-tight">Week by week</h2>
          <p className="mb-3 text-[13.5px] text-[var(--dim)]">
            All three months, weeks ending Sunday. The tall weeks are rent
            weeks and a vacation week. Bars are stacked by category — tap one
            to see that week's transactions.
          </p>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <StackedBarChart
              rows={weekly}
              ariaLabel="Weekly spending totals, September to November 2026, stacked by category"
              selectedKey={sel?.kind === "week" ? sel.key : null}
              onSelect={toggleWeek}
            />
            <CatLegend rows={weekly} />
          </div>
          {sel?.kind === "week" && drill && (
            <DrillPanel
              title={drill.title}
              txns={drill.txns}
              marksById={marksByIdAll}
              onClose={() => setSel(null)}
            />
          )}
        </section>

        <section className="mt-8 grid gap-3 lg:grid-cols-[1.25fr_1fr]" aria-label="Categories and merchants">
          <div>
            <h2 className="text-[19px] font-bold tracking-tight">Where it went</h2>
            <p className="mb-3 text-[13.5px] text-[var(--dim)]">
              Rent is shown at your share only — your roommate's transfer is already
              taken off.
            </p>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              {view.catRows.map((c) => (
                <div
                  key={c.cat}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-dashed border-[var(--border)] py-2 last:border-0 sm:grid-cols-[170px_1fr_86px]"
                >
                  <span className="text-[13.5px] font-semibold">
                    {c.cat}{" "}
                    <span className="text-[12px] font-normal text-[var(--dim-2)]">
                      ×{c.n}
                    </span>
                  </span>
                  <span className="order-3 col-span-2 h-[10px] overflow-hidden rounded-[5px] bg-[var(--surface-2)] sm:order-none sm:col-span-1">
                    <span
                      className="block h-full rounded-[5px]"
                      style={{
                        width: `${Math.max(2, (c.total / (view.catRows[0]?.total ?? 1)) * 100)}%`,
                        background: CATCOLORS[c.cat] ?? "#9aa39c",
                      }}
                    />
                  </span>
                  <span className="num text-right text-[13px]">
                    {money(c.total)}
                    <span className="block text-[11.5px] text-[var(--dim-2)]" style={{ fontFamily: "var(--font-sans)" }}>
                      {((c.total / view.total) * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-[19px] font-bold tracking-tight">Top merchants</h2>
            <p className="mb-3 text-[13.5px] text-[var(--dim)]">
              {monthLabel(activeMonth)}.
            </p>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              {view.merchRows.map((m) => (
                <div
                  key={m.name}
                  className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--border)] py-[7px] text-[14px] last:border-0"
                >
                  <span>
                    <strong className="font-semibold">{m.name}</strong>{" "}
                    <span className="text-[12px] text-[var(--dim-2)]">×{m.n}</span>
                  </span>
                  <span className="num text-[13.5px]">{money(m.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8" aria-label="Everyday versus large-ticket spending">
          <h2 className="text-[19px] font-bold tracking-tight">
            Everyday vs large-ticket
          </h2>
          <p className="mb-3 text-[13.5px] text-[var(--dim)]">
            Large-ticket is any single charge at or above the threshold (rent
            excluded — it's a fixed bill). Adjust it and the split updates.
          </p>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-[13.5px] font-semibold" htmlFor="threshold">
                Large-ticket threshold
              </label>
              <input
                id="threshold"
                aria-label="Large-ticket threshold in dollars"
                inputMode="numeric"
                value={String(threshold)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/[^0-9]/g, ""));
                  if (Number.isFinite(v)) setThreshold(Math.min(5000, Math.max(25, v || 25)));
                }}
                className="num w-24 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px]"
              />
              <div className="flex gap-1.5" role="group" aria-label="Threshold presets">
                {[100, 150, 200, 300].map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={threshold === p}
                    onClick={() => setThreshold(p)}
                    className={`rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${
                      threshold === p
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] text-[var(--dim)]"
                    }`}
                  >
                    ${p}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="mt-4 flex h-[26px] overflow-hidden rounded-[8px]"
              role="img"
              aria-label={`Everyday spending ${money(view.everyday)}, large-ticket ${money(view.largeSum)}, rent ${money(view.rent)}`}
            >
              <span style={{ width: `${(view.everyday / view.total) * 100}%`, background: "var(--accent)" }} />
              <span style={{ width: `${(view.largeSum / view.total) * 100}%`, background: "var(--amber)" }} />
              <span style={{ width: `${(view.rent / view.total) * 100}%`, background: "var(--surface-2)" }} />
            </div>
            <div className="mt-3 grid gap-2 text-[13.5px] sm:grid-cols-3">
              <p>
                <strong>Everyday</strong>{" "}
                <span className="num">{money(view.everyday)}</span>
                <span className="block text-[var(--dim)]">
                  {money(view.everyday / view.daysInMonth)} a day — the pace
                  day-to-day choices set
                </span>
              </p>
              <p>
                <strong>Large-ticket</strong>{" "}
                <span className="num">{money(view.largeSum)}</span>
                <span className="block text-[var(--dim)]">
                  {view.large.length} charge{view.large.length === 1 ? "" : "s"} —{" "}
                  {money(view.largeSum / view.daysInMonth)} a day spread across
                  the month
                </span>
              </p>
              <p>
                <strong>Rent (your share)</strong>{" "}
                <span className="num">{money(view.rent)}</span>
                <span className="block text-[var(--dim)]">fixed, net of your roommate's transfer</span>
              </p>
            </div>
            {view.large.length > 0 && (
              <ul className="mt-3 border-t border-dashed border-[var(--border)] pt-2">
                {view.large.slice(0, 8).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-baseline justify-between gap-3 py-[5px] text-[13.5px]"
                  >
                    <span>
                      {t.name}{" "}
                      <span className="text-[var(--dim-2)]">{fmtDate(t.date)}</span>
                    </span>
                    <span className="num">{money(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-8" aria-label="Brex reimbursements">
          <h2 className="text-[19px] font-bold tracking-tight">
            Brex — total vs out of pocket
          </h2>
          <p className="mb-3 text-[13.5px] text-[var(--dim)]">
            You file Uber rides, Lime pass rides, DoorDash and weekday food
            orders in Brex. Only reimbursements that have actually landed in
            your checking account come off out of pocket — eligible charges
            still waiting on Brex don't.
          </p>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="grid gap-3 text-center sm:grid-cols-3">
              <p>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dim-2)]">
                  Brex-eligible charges
                </span>
                <span className="num text-[22px] font-extrabold">
                  {money(view.brexEligible)}
                </span>
              </p>
              <p>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dim-2)]">
                  Actually received
                </span>
                <span className="num text-[22px] font-extrabold text-[var(--accent)]">
                  {money(view.brexReceived)}
                </span>
              </p>
              <p>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dim-2)]">
                  Still waiting on Brex
                </span>
                <span className="num text-[22px] font-extrabold text-[var(--amber)]">
                  {money(view.brexUnpaid)}
                </span>
              </p>
            </div>
            <div
              className="mt-4 flex h-[14px] overflow-hidden rounded-[7px] bg-[var(--surface-2)]"
              role="img"
              aria-label={`Of ${money(view.brexEligible)} eligible, ${money(view.brexReceived)} received and ${money(view.brexUnpaid)} still waiting`}
            >
              {view.brexEligible > 0 && (
                <>
                  <span
                    style={{
                      width: `${(view.brexReceived / view.brexEligible) * 100}%`,
                      background: "var(--accent)",
                    }}
                  />
                  <span
                    style={{
                      width: `${(view.brexUnpaid / view.brexEligible) * 100}%`,
                      background: "var(--amber)",
                    }}
                  />
                </>
              )}
            </div>
            {meta && (
              <div className="mt-5 border-t border-dashed border-[var(--border)] pt-3">
                <h3 className="text-[14.5px] font-bold">
                  All Brex reimbursements received — {money(brexTotalReceived)}{" "}
                  all-time
                </h3>
                <p className="mt-1 text-[13px] text-[var(--dim)]">
                  Every “BREX REIMB” deposit in your checking account,
                  listed below.
                </p>
                <ul className="mt-2">
                  {meta.brexDeposits.map((d) => (
                    <li
                      key={`${d.date}-${d.amount}`}
                      className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--border)] py-[6px] text-[13.5px] last:border-0"
                    >
                      <span>
                        {d.date} · {d.payer}{" "}
                        <span className="text-[var(--dim-2)]">· Checking account</span>
                      </span>
                      <span className="num">{money(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {meta && meta.recurring.length > 0 && (
          <section className="mt-8" aria-label="Recurring bills and subscriptions">
            <h2 className="text-[19px] font-bold tracking-tight">
              Recurring bills &amp; subscriptions
            </h2>
            <p className="mb-3 text-[13.5px] text-[var(--dim)]">
              Detected from repeat charges across your accounts. Amounts are
              the most recent charge. Electric, internet and car insurance are kept out
              of the spending totals above — they're shared household bills
              tracked with your roommate on Splitwise.
            </p>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              {meta.recurring.map((r) => (
                <div
                  key={r.name}
                  className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--border)] py-2 text-[14px] last:border-0"
                >
                  <span>
                    <strong className="font-semibold">{r.name}</strong>
                    <span className="block text-[12.5px] text-[var(--dim-2)]">
                      {r.detail}
                    </span>
                  </span>
                  <span className="num whitespace-nowrap text-right text-[13.5px]">
                    {money(r.amount)}
                    <span
                      className="block text-[11.5px] text-[var(--dim-2)]"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {r.cadence}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {markedSummary && markedSummary.rows.length > 0 && (
          <section className="mt-8" aria-label="Your payback marks">
            <h2 className="text-[19px] font-bold tracking-tight">
              Marked as paid back — {money(markedSummary.totalMarked)} total
            </h2>
            <p className="mb-3 text-[13.5px] text-[var(--dim)]">
              These amounts already come off your out-of-pocket totals above,
              and they're saved on the server so they show on every device.
            </p>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              {markedSummary.rows.slice(0, 12).map(({ mark, txn }) => (
                <div
                  key={mark.transaction_id}
                  className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--border)] py-2 text-[14px] last:border-0"
                >
                  <span>
                    <strong className="font-semibold">{txn?.name}</strong>{" "}
                    <span className="text-[var(--dim-2)]">
                      {txn ? fmtDate(txn.date) : ""} · {MARK_LABELS[mark.mark_type]}
                      {mark.note ? ` · ${mark.note}` : ""}
                    </span>
                  </span>
                  <span className="num whitespace-nowrap text-[13.5px]">
                    −{money(mark.amount)}
                    {txn && (
                      <span
                        className="block text-right text-[11.5px] text-[var(--dim-2)]"
                        style={{ fontFamily: "var(--font-sans)" }}
                      >
                        your share {money(txn.amount - mark.amount)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8" aria-label="Transactions">
          <h2 className="text-[19px] font-bold tracking-tight">
            Transactions · {monthLabel(activeMonth)}
          </h2>
          <div className="mb-3 mt-1 flex flex-wrap items-center gap-3">
            <div
              className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-[3px]"
              role="group"
              aria-label="Filter transactions"
            >
              {(
                [
                  ["all", "All"],
                  ["marked", "Marked only"],
                  ["unmarked", "Not marked"],
                ] as const
              ).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => {
                    setFilter(f);
                    setShowAll(false);
                  }}
                  className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${
                    filter === f
                      ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                      : "text-[var(--dim)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[12.5px] text-[var(--dim-2)]">
              Group dinner, split bill, refund — mark it and your share updates
              everywhere.
            </span>
          </div>
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            {visibleTxns.length === 0 && (
              <p className="py-4 text-center text-[var(--dim)]">
                No transactions match this filter.
              </p>
            )}
            <TxnList
              key={`${activeMonth}-${filter}`}
              txns={visibleTxns}
              marksById={view.marksById}
            />
            {!showAll && filteredTxns.length > 15 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-3 w-full rounded-full border border-[var(--border)] py-2.5 text-[13.5px] font-semibold text-[var(--dim)]"
              >
                Show all {filteredTxns.length}
              </button>
            )}
          </div>
        </section>

        <footer className="mt-10 border-t border-[var(--border)] pt-4 text-[12.5px] text-[var(--dim-2)]">
          <p>
            Snapshot through {meta ? fmtLong(meta.asOf) : ""} from your linked bank
            accounts via Plaid; balances are the banks' last
            reported figures and may lag. Spending excludes credit-card
            payments, transfers between your own accounts, and the rent
            pass-through so nothing is counted twice. Rent is counted once,
            from your checking-account debit, net of your roommate's transfers.
            Three-month total: {money(totalAll)} across{" "}
            {data.transactions.length} transactions.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate()}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--dim)] disabled:opacity-60"
            >
              {refresh.isPending ? "Starting…" : "Refresh from my accounts"}
            </button>
            {refreshMsg && <span role="status">{refreshMsg}</span>}
          </div>
        </footer>
      </main>
    </div>
  );
}
