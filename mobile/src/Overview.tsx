import { useEffect, useState } from "react";
import { BarChart, type ChartBar } from "./Chart";
import {
  categoryColor,
  dayLong,
  money,
  money0,
  monthName,
  monthTitle,
  type Bucket,
  type MonthSummary,
  type SafeToSpend,
} from "../../shared/spending";
import { budgetLine } from "./Budget";
import { useLook } from "./look";
import { CategoryIcon, Chevron, Section } from "./ui";

type Range = "day" | "week" | "month";

export function Overview({
  summary,
  weeks,
  months,
  onOpenCategory,
  sts,
  onEditBudget,
}: {
  summary: MonthSummary;
  weeks: Bucket[];
  months: Bucket[];
  onOpenCategory: (category: string) => void;
  sts: SafeToSpend | null;
  onEditBudget: () => void;
}) {
  const { look } = useLook();
  const [allCategories, setAllCategories] = useState(false);
  // Category totals are net of marks, so shares are measured against the
  // net category total rather than the gross month total.
  const netTotal = summary.categories.reduce((s, c) => s + c.total, 0);
  const shownCategories = allCategories ? summary.categories : summary.categories.slice(0, 5);
  return (
    <>
      <Section plain>
        {look === "calm" ? (
          <CalmSummary summary={summary} sts={sts} onEditBudget={onEditBudget} />
        ) : (
          <div className="group"><div className="card"><SummaryCard summary={summary} sts={sts} onEditBudget={onEditBudget} /></div></div>
        )}
      </Section>

      <Section footer="Rent is left out of the bars. Tap or drag across the chart to see a bar.">
        <div className="card">
          <SpendChart summary={summary} weeks={weeks} months={months} />
        </div>
      </Section>

      <Section header="Categories" footer="Rent is your share, net of your roommate's transfer.">
        {shownCategories.map((c) => {
          const share = netTotal > 0 ? c.total / netTotal : 0;
          return (
            <button
              key={c.category}
              type="button"
              className="row"
              style={{ ["--inset" as string]: "58px" }}
              onClick={() => onOpenCategory(c.category)}
              aria-label={`${c.category}, ${money(c.total)}, ${Math.round(share * 100)} percent, ${c.count} transactions`}
            >
              <CategoryIcon category={c.category} />
              <span className="row-main" style={{ gap: 7 }}>
                <span className="row-title" style={{ justifyContent: "space-between" }}>
                  <span>{c.category}</span>
                  <span className="num dim">{money(c.total)}</span>
                </span>
                <span className="meter">
                  <span style={{ width: `${Math.max(1, share * 100)}%`, background: categoryColor(c.category) }} />
                </span>
              </span>
              <Chevron />
            </button>
          );
        })}
        {summary.categories.length > 5 && (
          <button type="button" className="text-button" onClick={() => setAllCategories((v) => !v)}>
            {allCategories ? "Show Top 5" : `Show All ${summary.categories.length}`}
          </button>
        )}
      </Section>
    </>
  );
}

/** The budget line under "Safe to spend today", or a link to set one. */
function BudgetLink({ sts, onEditBudget }: { sts: SafeToSpend | null; onEditBudget: () => void }) {
  return (
    <button type="button" className="link-button" onClick={onEditBudget}>
      {sts ? `${money0(sts.budget)} budget · Edit` : "Set a monthly budget"}
    </button>
  );
}

/** Calm fintech summary: a green hero card with the rent / everyday split, then three stat tiles. */
function CalmSummary({ summary, sts, onEditBudget }: { summary: MonthSummary; sts: SafeToSpend | null; onEditBudget: () => void }) {
  const everyday = Math.max(0, summary.outOfPocketExRent);
  const whole = summary.rent + everyday;
  const rentPct = whole > 0 ? (summary.rent / whole) * 100 : 0;
  const [dollars, cents = "00"] = money(summary.outOfPocket).split(".");
  const current = sts?.status === "current" ? sts : null;
  return (
    <div>
      <div className="hero">
        <div className="hero-label">Out of pocket</div>
        <div className="hero-number num">
          {dollars}
          <small>.{cents}</small>
        </div>
        <div className="hero-split" role="img" aria-label={`Rent ${money(summary.rent)}, everyday ${money(everyday)}`}>
          <span style={{ width: `${rentPct}%`, background: "rgba(255,255,255,0.55)" }} />
          <span style={{ width: `${100 - rentPct}%`, background: "var(--hero-accent)" }} />
        </div>
        <div className="hero-legend">
          <span><i style={{ background: "rgba(255,255,255,0.55)" }} />Rent {money0(summary.rent)}</span>
          <span><i style={{ background: "var(--hero-accent)" }} />Everyday {money(everyday)}</span>
        </div>
      </div>
      <div className="tiles">
        {current ? (
          <>
            <div className={`tile ${current.left < 0 ? "warn" : "good"}`}>
              <span className="tile-value num">{money(current.safeToday)}</span>
              <span className="tile-label">safe today</span>
            </div>
            <div className="tile">
              <span className="tile-value num">{money(Math.max(0, current.left))}</span>
              <span className="tile-label">left this month</span>
            </div>
          </>
        ) : (
          <>
            <div className="tile">
              <span className="tile-value num">{money(summary.perDayExRent)}</span>
              <span className="tile-label">a day, rent aside</span>
            </div>
            <div className="tile">
              <span className="tile-value num">{summary.transactions.length}</span>
              <span className="tile-label">transactions</span>
            </div>
          </>
        )}
        {summary.brexWaiting > 0 ? (
          <div className="tile warn">
            <span className="tile-value num">{money(summary.brexWaiting)}</span>
            <span className="tile-label">waiting on Brex</span>
          </div>
        ) : (
          <div className="tile good">
            <span className="tile-value num">{money(summary.marksSum + summary.brexReceived)}</span>
            <span className="tile-label">paid back</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 10, paddingLeft: 4 }}>
        <BudgetLink sts={sts} onEditBudget={onEditBudget} />
      </div>
    </div>
  );
}

function SummaryCard({ summary, sts, onEditBudget }: { summary: MonthSummary; sts: SafeToSpend | null; onEditBudget: () => void }) {
  const current = sts?.status === "current" ? sts : null;
  const chips = (summary.brexWaiting > 0 || summary.marksSum > 0) && (
    <div className="chips">
      {summary.brexWaiting > 0 && <span className="badge orange">{money(summary.brexWaiting)} waiting on Brex</span>}
      {summary.marksSum > 0 && <span className="badge green">{money(summary.marksSum)} paid back</span>}
    </div>
  );

  if (current) {
    const over = current.left < 0;
    const used = current.budget > 0 ? Math.min(100, Math.max(0, (current.spent / current.budget) * 100)) : 100;
    return (
      <div>
        <div className="eyebrow">Safe to spend today</div>
        <div className="big-number num" style={{ color: over ? "var(--red)" : "var(--green)", marginTop: 2 }}>{money(current.safeToday)}</div>
        <div className="dim" style={{ fontSize: 14 }}>{budgetLine(current)}</div>
        <div className="meter" style={{ marginTop: 12 }} role="img" aria-label={`${Math.round(used)} percent of the budget used`}>
          <span style={{ width: `${used}%`, background: over ? "var(--red)" : "var(--green)" }} />
        </div>
        <div className="stats">
          <Stat value={money(Math.max(0, current.left))} label="Left this month" />
          <Stat value={money(summary.outOfPocketExRent)} label="Everyday" />
          <Stat value={money0(summary.outOfPocket)} label="With rent" />
        </div>
        {chips}
        <div style={{ marginTop: 12 }}>
          <BudgetLink sts={sts} onEditBudget={onEditBudget} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="eyebrow">Everyday spending</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        <span className="big-number num">{money(summary.outOfPocketExRent)}</span>
        {summary.rent > 0 && <span className="dim">+ {money0(summary.rent)} rent</span>}
      </div>
      <div className="stats">
        {sts ? (
          <Stat value={sts.left >= 0 ? `${money0(sts.left)} under` : `${money0(-sts.left)} over`} label="Budget" />
        ) : (
          <Stat value={money(summary.perDayExRent)} label="Per day" />
        )}
        <Stat value={money0(summary.outOfPocket)} label="Out of pocket" />
        <Stat value={String(summary.transactions.length)} label="Transactions" />
      </div>
      {chips}
      <div style={{ marginTop: 12 }}>
        <BudgetLink sts={sts} onEditBudget={onEditBudget} />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="stat-value num">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function SpendChart({ summary, weeks, months }: { summary: MonthSummary; weeks: Bucket[]; months: Bucket[] }) {
  const [range, setRange] = useState<Range>("day");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => setSelected(null), [range, summary.month]);

  let bars: ChartBar[];
  let caption: string;
  let value: string;
  let detail: string;
  let highlight: string | undefined;

  if (range === "day") {
    bars = summary.daily.map((p) => ({
      key: p.iso,
      value: p.exRent,
      trend: p.trend7,
      label: (p.day - 1) % 7 === 0 ? String(p.day) : "",
    }));
    const point = summary.daily.find((p) => p.iso === selected);
    if (point) {
      caption = dayLong(point.iso);
      value = money(point.exRent);
      detail = point.rent > 0 ? `7-day average ${money(point.trend7)} · rent day` : `7-day average ${money(point.trend7)}`;
    } else {
      caption = "Daily average, rent aside";
      value = money(summary.perDayExRent);
      detail = `${money(summary.outOfPocketExRent)} over ${summary.daysCovered} days in ${monthName(summary.month)}`;
    }
  } else {
    const list = range === "week" ? weeks : months;
    bars = list.map((b) => ({ key: b.key, value: b.exRent, label: b.label }));
    if (range === "month") highlight = summary.month;
    const b = list.find((x) => x.key === selected);
    if (b) {
      caption = b.title;
      value = money(b.exRent);
      detail = b.rent > 0 ? `+ ${money0(b.rent)} rent` : "No rent";
    } else {
      const avg = list.length ? list.reduce((s, x) => s + x.exRent, 0) / list.length : 0;
      caption = range === "week" ? "Weekly average, rent aside" : "Monthly average, rent aside";
      value = money(avg);
      detail = range === "week" ? `Across ${list.length} weeks, Monday to Sunday` : `Across ${list.length} months`;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="segmented" role="group" aria-label="Chart range">
        {(["day", "week", "month"] as const).map((r) => (
          <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
            {r === "day" ? "Day" : r === "week" ? "Week" : "Month"}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        <div className="eyebrow">{caption}</div>
        <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 1 }}>{value}</div>
        <div className="dim" style={{ fontSize: 15 }}>{detail}</div>
      </div>
      <BarChart
        bars={bars}
        selected={selected}
        onSelect={setSelected}
        highlight={highlight}
        ariaLabel={
          range === "day"
            ? `Daily spending in ${monthTitle(summary.month)}, rent left out, with a 7-day average line`
            : range === "week"
              ? "Weekly spending, rent left out"
              : "Monthly spending, rent left out"
        }
      />
      {range === "day" && (
        <div className="dim" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 2, borderRadius: 1, background: "var(--orange-line)" }} aria-hidden="true" />
          7-day moving average
        </div>
      )}
    </div>
  );
}
