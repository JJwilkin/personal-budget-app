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
  type Dashboard,
  type MonthSummary,
} from "./data";
import { useLook } from "./look";
import { CategoryIcon, Chevron, Section } from "./ui";

type Range = "day" | "week" | "month";

export function Overview({
  data,
  summary,
  weeks,
  months,
  onOpenCategory,
}: {
  data: Dashboard;
  summary: MonthSummary;
  weeks: Bucket[];
  months: Bucket[];
  onOpenCategory: (category: string) => void;
}) {
  const { look, setLook } = useLook();
  return (
    <>
      <Section plain>
        {look === "calm" ? (
          <CalmSummary summary={summary} />
        ) : (
          <div className="group"><div className="card"><SummaryCard summary={summary} /></div></div>
        )}
      </Section>

      <Section footer="Rent is left out of the bars so everyday spending stays readable. Tap or drag across the chart to see a bar.">
        <div className="card">
          <SpendChart summary={summary} weeks={weeks} months={months} />
        </div>
      </Section>

      <Section header="Categories" footer="Rent is your share only, with your roommate's transfer already taken off.">
        {summary.categories.map((c) => {
          const share = summary.total > 0 ? c.total / summary.total : 0;
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
      </Section>

      {data.meta && data.meta.accounts.length > 0 && (
        <Section header="Accounts" footer="Balances are the banks' last reported figures.">
          {data.meta.accounts.map((a) => (
            <div key={a.label} className="row">
              <span className="row-main">{a.label}</span>
              <span className="num dim">{a.owed ? `${a.balance} owed` : a.balance}</span>
            </div>
          ))}
        </Section>
      )}

      <Section header="Look" plain footer="Changes how the app looks on this device only.">
        <div className="segmented" role="group" aria-label="Look">
          <button type="button" aria-pressed={look === "ios"} onClick={() => setLook("ios")}>iOS</button>
          <button type="button" aria-pressed={look === "calm"} onClick={() => setLook("calm")}>Calm</button>
        </div>
      </Section>
    </>
  );
}

/** Calm fintech summary: a green hero card with the rent / everyday split, then three stat tiles. */
function CalmSummary({ summary }: { summary: MonthSummary }) {
  const everyday = Math.max(0, summary.outOfPocketExRent);
  const whole = summary.rent + everyday;
  const rentPct = whole > 0 ? (summary.rent / whole) * 100 : 0;
  const [dollars, cents = "00"] = money(summary.outOfPocket).split(".");
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
        <div className="tile">
          <span className="tile-value num">{money(summary.perDayExRent)}</span>
          <span className="tile-label">a day, rent aside</span>
        </div>
        <div className="tile">
          <span className="tile-value num">{summary.transactions.length}</span>
          <span className="tile-label">transactions</span>
        </div>
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
    </div>
  );
}

function SummaryCard({ summary }: { summary: MonthSummary }) {
  return (
    <div>
      <div className="eyebrow">Everyday spending</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        <span className="big-number num">{money(summary.outOfPocketExRent)}</span>
        {summary.rent > 0 && <span className="dim">+ {money0(summary.rent)} rent</span>}
      </div>
      <div className="stats">
        <Stat value={money(summary.perDayExRent)} label="Per day" />
        <Stat value={money0(summary.outOfPocket)} label="Out of pocket" />
        <Stat value={String(summary.transactions.length)} label="Transactions" />
      </div>
      {(summary.brexWaiting > 0 || summary.marksSum > 0) && (
        <div className="chips">
          {summary.brexWaiting > 0 && <span className="badge orange">{money(summary.brexWaiting)} waiting on Brex</span>}
          {summary.marksSum > 0 && <span className="badge green">{money(summary.marksSum)} paid back</span>}
        </div>
      )}
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
      trend: p.trend3,
      label: (p.day - 1) % 7 === 0 ? String(p.day) : "",
    }));
    const point = summary.daily.find((p) => p.iso === selected);
    if (point) {
      caption = dayLong(point.iso);
      value = money(point.exRent);
      detail = point.rent > 0 ? `3-day average ${money(point.trend3)} · rent day` : `3-day average ${money(point.trend3)}`;
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
            ? `Daily spending in ${monthTitle(summary.month)}, rent left out, with a 3-day average line`
            : range === "week"
              ? "Weekly spending, rent left out"
              : "Monthly spending, rent left out"
        }
      />
      {range === "day" && (
        <div className="dim" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 2, borderRadius: 1, background: "var(--orange-line)" }} aria-hidden="true" />
          3-day moving average
        </div>
      )}
    </div>
  );
}
