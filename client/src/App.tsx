import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api } from "./api";
import {
  addDays,
  categoryColor,
  dayLong,
  dayShort,
  daysInMonth,
  monthKey,
  monthName,
  monthShort,
  monthsIn,
  monthTitle,
  money,
  money0,
  summarize,
  weekEnding,
  type Dashboard,
  type MonthSummary,
  type Transaction,
} from "../../shared/spending";
import { MarkDrawer } from "./dash/MarkDrawer";
import { SpendChart, type ChartBucket, type Range } from "./dash/SpendChart";
import { Card, Chip, Segmented, TxnRow } from "./dash/ui";

type MarkFilter = "all" | "unmarked" | "marked";

// ---------- chart buckets ----------

function bucketOf(txns: Transaction[]): Pick<ChartBucket, "segs" | "rent" | "top"> {
  const byCat = new Map<string, number>();
  let rent = 0;
  for (const t of txns) {
    if (t.category === "Rent") rent += t.amount;
    else byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  }
  const top = txns
    .filter((t) => t.category !== "Rent")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 2)
    .map((t) => `${t.name} ${money(t.amount)}`);
  return { segs: [...byCat.entries()].map(([cat, v]) => ({ cat, v })), rent, top };
}

function group(txns: Transaction[], keyOf: (t: Transaction) => string): Map<string, Transaction[]> {
  const m = new Map<string, Transaction[]>();
  for (const t of txns) m.set(keyOf(t), [...(m.get(keyOf(t)) ?? []), t]);
  return m;
}

function dayBuckets(s: MonthSummary): ChartBucket[] {
  const byDay = group(s.transactions, (t) => t.date);
  const out: ChartBucket[] = [];
  for (let d = 1; d <= daysInMonth(s.month); d++) {
    const iso = `${s.month}-${String(d).padStart(2, "0")}`;
    out.push({
      key: iso,
      label: d === 1 || d % 5 === 0 ? String(d) : "",
      title: dayLong(iso),
      ...bucketOf(byDay.get(iso) ?? []),
      future: s.isCurrent && d > s.daysCovered && !byDay.has(iso),
      trend: s.daily[d - 1]?.trend3,
    });
  }
  return out;
}

function weekBuckets(data: Dashboard): ChartBucket[] {
  const byWeek = group(data.transactions, (t) => weekEnding(t.date));
  return [...byWeek.keys()].sort().map((end) => ({
    key: end,
    label: dayShort(end),
    title: `${dayShort(addDays(end, -6))} – ${dayShort(end)}`,
    ...bucketOf(byWeek.get(end) ?? []),
  }));
}

function monthBuckets(data: Dashboard): ChartBucket[] {
  const byMonth = group(data.transactions, (t) => monthKey(t.date));
  return [...byMonth.keys()].sort().map((m) => ({
    key: m,
    label: monthShort(m),
    title: monthTitle(m),
    ...bucketOf(byMonth.get(m) ?? []),
  }));
}

// ---------- app ----------

export function App() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => api.getDashboard({}) });
  const data = dash.data as Dashboard | undefined;

  const [month, setMonth] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("day");
  const [focus, setFocus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [markFilter, setMarkFilter] = useState<MarkFilter>("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const months = useMemo(() => (data ? monthsIn(data) : []), [data]);
  const active = month && months.includes(month) ? month : (months[months.length - 1] ?? "");
  const summaries = useMemo(
    () => new Map(data ? months.map((m) => [m, summarize(data, m)] as const) : []),
    [data, months],
  );
  const summary = summaries.get(active);
  const marks = useMemo(() => new Map((data?.marks ?? []).map((m) => [m.transaction_id, m])), [data]);

  const pickMonth = useCallback((m: string) => {
    setMonth(m);
    setFocus(null);
    setShowAll(false);
  }, []);
  const closeDrawer = useCallback(() => setEditing(null), []);

  if (dash.isPending) {
    return <Shell><p className="py-24 text-center text-[var(--dim)]">Loading your spending…</p></Shell>;
  }
  if (dash.isError || !data) {
    return (
      <Shell>
        <div className="py-24 text-center">
          <h1 className="text-[22px] font-extrabold">Can't load your spending</h1>
          <p className="mt-1 text-[var(--dim)]">{dash.error?.message ?? "Try again in a moment."}</p>
          <button type="button" onClick={() => void dash.refetch()} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-white">
            Try again
          </button>
        </div>
      </Shell>
    );
  }
  if (!summary) {
    return <Shell><p className="py-24 text-center text-[var(--dim)]">No transactions yet. They'll show up once your accounts sync.</p></Shell>;
  }

  const meta = data.meta;
  const i = months.indexOf(active);
  const prev = i > 0 ? summaries.get(months[i - 1]!) : undefined;

  // Chart
  const buckets = range === "day" ? dayBuckets(summary) : range === "week" ? weekBuckets(data) : monthBuckets(data);
  const chartFocus = range === "month" ? active : focus;
  const onChartFocus = (key: string | null) => {
    if (range === "month") {
      if (key) pickMonth(key);
      return;
    }
    setFocus(key);
    setShowAll(false);
  };

  // Transactions: the focused day or week, else the month; then category, marks and search.
  let base: Transaction[] = summary.transactions;
  let focusLabel: string | null = null;
  if (focus && range === "day") {
    base = summary.transactions.filter((t) => t.date === focus);
    focusLabel = dayShort(focus);
  } else if (focus && range === "week") {
    const start = addDays(focus, -6);
    base = data.transactions
      .filter((t) => t.date >= start && t.date <= focus)
      .sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? 1 : -1));
    focusLabel = `${dayShort(start)} – ${dayShort(focus)}`;
  }
  const q = query.trim().toLowerCase();
  const list = base.filter((t) => {
    if (category && t.category !== category) return false;
    if (markFilter === "marked" && !marks.has(t.id)) return false;
    if (markFilter === "unmarked" && marks.has(t.id)) return false;
    return !q || `${t.name} ${t.category} ${t.account}`.toLowerCase().includes(q);
  });
  const visible = showAll ? list : list.slice(0, 25);
  const unmarked = summary.transactions.filter((t) => t.category !== "Rent" && !marks.has(t.id)).length;

  return (
    <Shell>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar data={data} months={months} active={active} summaries={summaries} onPick={pickMonth} />

        <main className="min-w-0 flex-1 px-5 pb-16 pt-6 lg:px-8 lg:pt-8">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.6px]">{monthName(active)}</h1>
                <p className="text-[14px] text-[var(--dim)]">
                  {summary.isCurrent && meta
                    ? `Through ${dayLong(meta.asOf)} · ${summary.daysCovered} of ${daysInMonth(active)} days`
                    : `All of ${monthTitle(active)}`}
                </p>
              </div>
              <label className="flex h-[42px] w-full max-w-[340px] items-center gap-2 rounded-full bg-[var(--surface)] px-4 text-[var(--dim)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4-4" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search merchants, categories"
                  aria-label="Search transactions"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text)] outline-none"
                />
              </label>
            </header>

            <Hero summary={summary} prev={prev} unmarked={unmarked} onShowUnmarked={() => setMarkFilter("unmarked")} />

            <Card
              title="Everyday spending"
              aside={
                <Segmented
                  label="Chart range"
                  value={range}
                  onChange={(r) => {
                    setRange(r);
                    setFocus(null);
                  }}
                  options={[
                    { value: "day", label: "Day" },
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                  ]}
                />
              }
            >
              <p className="-mt-2 text-[13px] text-[var(--dim)]">
                Rent is left out of the bars; a house marks when it landed.{" "}
                {range === "day" && "The line is your 3-day average. "}
                {range === "month" ? "Click a month to open it." : "Click a bar to see its transactions."}
              </p>
              <SpendChart
                buckets={buckets}
                focus={chartFocus}
                category={category}
                onFocus={onChartFocus}
                ariaLabel={`${range === "day" ? `Daily spending in ${monthTitle(active)}` : range === "week" ? "Weekly spending" : "Monthly spending"}, rent left out`}
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                {summary.categories
                  .filter((c) => c.category !== "Rent")
                  .map((c) => (
                    <button
                      key={c.category}
                      type="button"
                      aria-pressed={category === c.category}
                      onClick={() => setCategory(category === c.category ? null : c.category)}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                        category === c.category ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--bg)] hover:brightness-95"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(c.category) }} />
                      {c.category}
                      <span className="num font-medium opacity-70">{money(c.total)}</span>
                    </button>
                  ))}
              </div>
            </Card>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card
                title="Transactions"
                className="px-3"
                aside={
                  <div className="flex flex-wrap items-center gap-2">
                    {focusLabel && (
                      <Chip onRemove={() => setFocus(null)} label={`Showing ${focusLabel} only. Show the whole month.`}>
                        {focusLabel}
                      </Chip>
                    )}
                    {category && (
                      <Chip onRemove={() => setCategory(null)} label={`Showing ${category} only. Show every category.`}>
                        {category}
                      </Chip>
                    )}
                    <Segmented
                      small
                      label="Show"
                      value={markFilter}
                      onChange={setMarkFilter}
                      options={[
                        { value: "all", label: "All" },
                        { value: "unmarked", label: "Not marked" },
                        { value: "marked", label: "Marked" },
                      ]}
                    />
                  </div>
                }
              >
                {list.length === 0 ? (
                  <p className="px-3 py-8 text-center text-[var(--dim)]">
                    {q ? `Nothing matches "${query.trim()}".` : markFilter === "marked" ? "Nothing marked here yet." : "No transactions here."}
                  </p>
                ) : (
                  <ul className="-mt-2 flex flex-col">
                    {visible.map((t) => (
                      <TxnRow key={t.id} txn={t} mark={marks.get(t.id)} onMark={setEditing} />
                    ))}
                  </ul>
                )}
                {list.length > visible.length && (
                  <button type="button" onClick={() => setShowAll(true)} className="mx-3 rounded-full bg-[var(--bg)] py-2.5 font-bold text-[var(--accent)]">
                    Show all {list.length}
                  </button>
                )}
              </Card>

              <div className="flex flex-col gap-5">
                <CategoriesCard summary={summary} category={category} onPick={(c) => setCategory(category === c ? null : c)} />
                <BrexCard data={data} summary={summary} />
                <BillsCard data={data} />
              </div>
            </div>

            <details className="calm-card text-[14px] text-[var(--dim)]">
              <summary className="cursor-pointer font-bold text-[var(--text)]">How these numbers work</summary>
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
                <li>Out of pocket is the month's spending minus Brex reimbursements that actually landed in checking, minus anything you marked as paid back, reimbursed or refunded.</li>
                <li>Rent is counted once, at your share, net of your roommate's transfer.</li>
                <li>Credit card payments and transfers between your own accounts are left out so nothing counts twice.</li>
                <li>Shared household bills (car insurance, electric, internet) are tracked under Bills and kept out of spending.</li>
                <li>Brex-eligible charges stay in out of pocket until the reimbursement lands.</li>
              </ul>
            </details>
          </div>
        </main>
      </div>

      {editing && <MarkDrawer txn={editing} existing={marks.get(editing.id)} onClose={closeDrawer} />}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      {children}
    </div>
  );
}

// ---------- sidebar ----------

function Sidebar({
  data,
  months,
  active,
  summaries,
  onPick,
}: {
  data: Dashboard;
  months: string[];
  active: string;
  summaries: Map<string, MonthSummary>;
  onPick: (m: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const refresh = useMutation({
    mutationFn: () => api.refreshFromPlaid({}),
    onSuccess: (r) =>
      setMsg(
        r.started
          ? "Refresh started. New transactions appear once it finishes."
          : "This copy runs on sample data, so there's nothing to refresh.",
      ),
    onError: () => setMsg("Couldn't start the refresh. Try again in a bit."),
  });

  return (
    <aside className="flex shrink-0 flex-col gap-6 bg-[var(--surface)] px-5 py-5 lg:sticky lg:top-0 lg:h-screen lg:w-[256px] lg:gap-8 lg:overflow-y-auto lg:py-8">
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex h-[34px] w-[34px] items-end justify-center gap-[3px] rounded-[11px] bg-[var(--accent)] pb-2" aria-hidden="true">
          <span className="h-[9px] w-1 rounded-sm bg-white" />
          <span className="h-4 w-1 rounded-sm bg-white" />
          <span className="h-3 w-1 rounded-sm bg-white/70" />
        </span>
        <span className="text-[18px] font-extrabold">Budget</span>
      </div>

      <nav aria-label="Months" className="flex flex-col gap-1">
        <h2 className="px-3 pb-1 text-[12px] font-bold text-[var(--dim)]">Months</h2>
        <div className="flex gap-1 overflow-x-auto lg:flex-col">
          {[...months].reverse().map((m) => (
            <button
              key={m}
              type="button"
              aria-current={m === active ? "page" : undefined}
              onClick={() => onPick(m)}
              className={`flex shrink-0 items-center justify-between gap-6 rounded-[14px] px-3 py-2.5 text-left ${
                m === active ? "bg-[var(--accent-soft)] font-extrabold text-[var(--accent)]" : "font-semibold hover:bg-[var(--bg)]"
              }`}
            >
              <span>{monthName(m)}</span>
              <span className="num text-[13px]">{money0(summaries.get(m)?.outOfPocket ?? 0)}</span>
            </button>
          ))}
        </div>
      </nav>

      {data.meta && data.meta.accounts.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 text-[12px] font-bold text-[var(--dim)]">Accounts</h2>
          {data.meta.accounts.map((a) => (
            <div key={a.label} className="flex justify-between gap-3 px-3 py-1.5 text-[14px]">
              <span>{a.label}</span>
              <span className={`num font-bold ${a.owed ? "text-[var(--rust)]" : ""}`}>
                {a.balance}
                {a.owed ? " owed" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 px-2 lg:mt-auto">
        {data.meta && <p className="text-[12px] text-[var(--dim)]">Data through {dayLong(data.meta.asOf)}</p>}
        <button
          type="button"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
          className="rounded-full bg-[var(--surface-2)] px-4 py-2.5 text-[14px] font-bold text-[var(--accent)] disabled:opacity-60"
        >
          {refresh.isPending ? "Starting…" : "Refresh from accounts"}
        </button>
        {msg && (
          <p role="status" className="text-[12px] text-[var(--dim)]">
            {msg}
          </p>
        )}
      </div>
    </aside>
  );
}

// ---------- hero ----------

function Hero({
  summary,
  prev,
  unmarked,
  onShowUnmarked,
}: {
  summary: MonthSummary;
  prev: MonthSummary | undefined;
  unmarked: number;
  onShowUnmarked: () => void;
}) {
  const everyday = Math.max(0, summary.outOfPocketExRent);
  const rentPct = summary.outOfPocket > 0 ? Math.min(100, (summary.rent / summary.outOfPocket) * 100) : 0;
  const [dollars, cents = "00"] = money(summary.outOfPocket).split(".");
  const pace = prev && prev.perDayExRent > 0 ? (summary.perDayExRent - prev.perDayExRent) / prev.perDayExRent : null;

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" aria-label={`${monthTitle(summary.month)} summary`}>
      <div className="calm-hero flex flex-col justify-between gap-5">
        <div>
          <p className="text-[14px] font-semibold opacity-85">Out of pocket</p>
          <p className="num text-[48px] font-extrabold leading-[1.05] tracking-[-1.5px]">
            {dollars}
            <span className="text-[26px] opacity-75">.{cents}</span>
          </p>
          <p className="mt-1 text-[13.5px] opacity-85">
            {money(summary.total)} spent
            {summary.brexReceived > 0 && ` − ${money(summary.brexReceived)} Brex received`}
            {summary.marksSum > 0 && ` − ${money(summary.marksSum)} paid back`}
          </p>
        </div>
        <div>
          <div className="flex h-[10px] overflow-hidden rounded-full bg-white/20" role="img" aria-label={`Rent ${money(summary.rent)}, everyday ${money(everyday)}`}>
            <span style={{ width: `${rentPct}%`, background: "rgba(255,255,255,0.55)" }} />
            <span style={{ flex: 1, background: "var(--hero-accent)" }} />
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-3 text-[14px]">
            <span className="inline-flex items-center gap-2">
              <i className="h-2 w-2 rounded-full" style={{ background: "rgba(255,255,255,0.55)" }} />
              Rent {money0(summary.rent)}
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="h-2 w-2 rounded-full" style={{ background: "var(--hero-accent)" }} />
              Everyday {money(everyday)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="calm-tile">
          <p className="num text-[22px] font-extrabold">{money(summary.perDayExRent)}</p>
          <p className="text-[13px] text-[var(--dim)]">a day, rent aside</p>
        </div>
        <div className="calm-tile">
          {pace === null ? (
            <>
              <p className="num text-[22px] font-extrabold">{summary.transactions.length}</p>
              <p className="text-[13px] text-[var(--dim)]">transactions</p>
            </>
          ) : (
            <>
              <p className="num text-[22px] font-extrabold">
                {pace > 0 ? "+" : pace < 0 ? "−" : ""}
                {Math.abs(Math.round(pace * 100))}%
              </p>
              <p className="text-[13px] text-[var(--dim)]">vs {monthShort(prev!.month)}'s daily pace</p>
            </>
          )}
        </div>
        <div className="calm-tile" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
          <p className="num text-[22px] font-extrabold">{money(summary.brexWaiting)}</p>
          <p className="text-[13px]">waiting on Brex</p>
        </div>
        <button
          type="button"
          onClick={onShowUnmarked}
          className="calm-tile text-left hover:brightness-95"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          aria-label={`${unmarked} transactions not marked yet. Show them.`}
        >
          <p className="num text-[22px] font-extrabold">{unmarked}</p>
          <p className="text-[13px]">not marked yet</p>
        </button>
      </div>
    </section>
  );
}

// ---------- side cards ----------

function CategoriesCard({
  summary,
  category,
  onPick,
}: {
  summary: MonthSummary;
  category: string | null;
  onPick: (c: string) => void;
}) {
  const [view, setView] = useState<"all" | "large">("all");
  const [threshold, setThreshold] = useState(200);
  const cats = summary.categories.filter((c) => c.category !== "Rent");
  const top = Math.max(1, ...cats.map((c) => c.total));
  const large = summary.transactions.filter((t) => t.category !== "Rent" && t.amount >= threshold);
  const largeSum = large.reduce((s, t) => s + t.amount, 0);
  const everyday = summary.total - summary.rent - largeSum;

  return (
    <Card
      title="Categories"
      aside={
        <Segmented
          small
          label="Categories view"
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: "All" },
            { value: "large", label: "Large-ticket" },
          ]}
        />
      }
    >
      {view === "all" ? (
        <>
          {cats.length === 0 && <p className="text-[14px] text-[var(--dim)]">Only rent so far this month.</p>}
          {cats.map((c) => (
            <button
              key={c.category}
              type="button"
              aria-pressed={category === c.category}
              onClick={() => onPick(c.category)}
              className={`-mx-2 flex flex-col gap-1.5 rounded-[12px] px-2 py-1 text-left ${category === c.category ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]"}`}
            >
              <span className="flex w-full justify-between text-[14px]">
                <span className="font-semibold">
                  {c.category} <span className="font-normal text-[var(--dim-2)]">×{c.count}</span>
                </span>
                <span className="num">{money(c.total)}</span>
              </span>
              <span className="h-1.5 w-full rounded-full bg-[var(--surface-2)]">
                <span className="block h-1.5 rounded-full" style={{ width: `${(c.total / top) * 100}%`, background: categoryColor(c.category) }} />
              </span>
            </button>
          ))}
          <p className="text-[12px] text-[var(--dim)]">Rent {money0(summary.rent)} is your share, net of your roommate's transfer.</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Large-ticket threshold">
            <span className="mr-1 text-[13px] text-[var(--dim)]">At or above</span>
            {[100, 150, 200, 300].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={threshold === v}
                onClick={() => setThreshold(v)}
                className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${threshold === v ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--surface-2)] text-[var(--dim)]"}`}
              >
                ${v}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px] text-[var(--dim)]">
            <div>
              <p className="num text-[18px] font-extrabold text-[var(--text)]">{money(everyday)}</p>
              everyday · {money(everyday / Math.max(1, summary.daysCovered))}/day
            </div>
            <div>
              <p className="num text-[18px] font-extrabold text-[var(--text)]">{money(largeSum)}</p>
              large-ticket · {large.length} {large.length === 1 ? "charge" : "charges"}
            </div>
          </div>
          {large.map((t) => (
            <div key={t.id} className="flex justify-between text-[14px]">
              <span>
                {t.name} <span className="text-[12px] text-[var(--dim)]">{dayShort(t.date)}</span>
              </span>
              <span className="num">{money(t.amount)}</span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

function BrexCard({ data, summary }: { data: Dashboard; summary: MonthSummary }) {
  const deposits = data.meta?.brexDeposits ?? [];
  const allTime = deposits.reduce((s, d) => s + d.amount, 0);
  const pct = summary.brexEligible > 0 ? Math.min(100, (summary.brexReceived / summary.brexEligible) * 100) : 0;
  return (
    <Card title="Brex" aside={<span className="text-[12px] text-[var(--dim)]">{money(allTime)} received all time</span>}>
      <div className="grid grid-cols-3 gap-2 text-[12px] text-[var(--dim)]">
        <div>
          <p className="num text-[17px] font-extrabold text-[var(--text)]">{money(summary.brexEligible)}</p>eligible
        </div>
        <div>
          <p className="num text-[17px] font-extrabold text-[var(--accent)]">{money(summary.brexReceived)}</p>received
        </div>
        <div>
          <p className="num text-[17px] font-extrabold text-[var(--amber)]">{money(summary.brexWaiting)}</p>waiting
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--amber-soft)]" role="img" aria-label={`${Math.round(pct)} percent received`}>
        <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-[var(--dim)]">Waiting charges stay in out of pocket until the reimbursement lands.</p>
      {deposits.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-bold text-[var(--accent)]">Reimbursements received</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {deposits.map((d, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {d.date} <span className="text-[var(--dim)]">· {d.payer}</span>
                </span>
                <span className="num">{money(d.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function BillsCard({ data }: { data: Dashboard }) {
  const bills = data.meta?.recurring ?? [];
  if (bills.length === 0) return null;
  return (
    <Card title="Bills" aside={<span className="text-[12px] text-[var(--dim)]">about {money0(bills.reduce((s, b) => s + b.amount, 0))} a month</span>}>
      <ul className="flex flex-col gap-2.5">
        {bills.map((b, i) => (
          <li key={i} className="flex justify-between gap-3 text-[14px]">
            <span className="min-w-0">
              <span className="block font-semibold">{b.name}</span>
              <span className="block text-[12px] text-[var(--dim)]">{b.cadence}</span>
            </span>
            <span className="num">{money(b.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-[var(--dim)]">Electric, internet and car insurance are shared with your roommate, so they stay out of spending.</p>
    </Card>
  );
}
