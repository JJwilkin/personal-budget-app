import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api } from "./api";
import {
  addDays,
  dayLong,
  dayShort,
  daysInMonth,
  monthName,
  monthsIn,
  monthTitle,
  money,
  money0,
  summarize,
  type Dashboard,
  type Mark,
  type MonthSummary,
  type Transaction,
  isoOf,
  safeToSpend,
} from "../../shared/spending";
import { BudgetDrawer } from "./dash/Budget";
import { dayBuckets, monthBuckets, weekBuckets } from "./dash/buckets";
import { BillsCard, BrexCard, CategoriesCard, Hero } from "./dash/Cards";
import { MarkDrawer } from "./dash/MarkDrawer";
import { SpendChart, type Range } from "./dash/SpendChart";
import { Card, Chip, Segmented, TxnRow } from "./dash/ui";

type View = "overview" | "transactions" | "brex" | "bills";
type MarkFilter = "all" | "unmarked" | "marked";
/** A day or a Monday–Sunday week picked from the chart, used to filter transactions. */
type Focus = { kind: "day" | "week"; key: string };

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "M5 20V11M12 20V4M19 20v-7" },
  { id: "transactions", label: "Transactions", icon: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" },
  { id: "brex", label: "Brex", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { id: "bills", label: "Bills", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
];

function viewFromHash(): View {
  const h = window.location.hash.slice(1);
  return VIEWS.some((v) => v.id === h) ? (h as View) : "overview";
}

const PAGE = 60;

export function App() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => api.getDashboard({}) });
  const data = dash.data as Dashboard | undefined;

  const [view, setView] = useState<View>(viewFromHash);
  const [month, setMonth] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("day");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [markFilter, setMarkFilter] = useState<MarkFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const closeDrawer = useCallback(() => setEditing(null), []);
  const closeBudget = useCallback(() => setBudgetOpen(false), []);
  const today = isoOf(new Date());

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((next: View) => {
    history.replaceState(null, "", `#${next}`);
    setView(next);
    window.scrollTo(0, 0);
  }, []);

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
    setLimit(PAGE);
  }, []);

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

  const sts = data.budget ? safeToSpend(data, active, data.budget.monthly, today) : null;
  const unmarked = summary.transactions.filter((t) => t.category !== "Rent" && !marks.has(t.id)).length;
  const i = months.indexOf(active);
  const prevMonth = i > 0 ? months[i - 1]! : null;
  const nextMonth = i < months.length - 1 ? months[i + 1]! : null;

  const openTransactions = (opts: { focus?: Focus | null; category?: string | null; filter?: MarkFilter }) => {
    setFocus(opts.focus ?? null);
    setCategory(opts.category ?? null);
    setMarkFilter(opts.filter ?? "all");
    setLimit(PAGE);
    go("transactions");
  };

  let page: ReactNode;
  if (view === "overview") {
    page = (
      <OverviewPage
        data={data}
        summary={summary}
        sts={sts}
        marks={marks}
        unmarked={unmarked}
        range={range}
        onRange={setRange}
        onPickMonth={pickMonth}
        onEditBudget={() => setBudgetOpen(true)}
        onOpen={setEditing}
        onTransactions={openTransactions}
      />
    );
  } else if (view === "transactions") {
    page = (
      <TransactionsPage
        data={data}
        summary={summary}
        marks={marks}
        focus={focus}
        category={category}
        markFilter={markFilter}
        query={query}
        limit={limit}
        onFocus={setFocus}
        onCategory={setCategory}
        onMarkFilter={setMarkFilter}
        onQuery={setQuery}
        onMore={() => setLimit((l) => l + PAGE)}
        onOpen={setEditing}
      />
    );
  } else if (view === "brex") {
    page = <BrexPage data={data} summary={summary} marks={marks} onOpen={setEditing} />;
  } else {
    page = <BillsCard data={data} />;
  }

  return (
    <Shell>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar
          data={data}
          view={view}
          onView={go}
          unmarked={unmarked}
          brexWaiting={summary.brexWaiting}
        />

        <main className="min-w-0 flex-1 px-5 pb-16 pt-5 lg:px-8 lg:pt-7">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
            <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="flex items-center gap-3">
                <MonthButton month={prevMonth} dir="prev" onPick={pickMonth} />
                <div>
                  <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.5px]">{monthName(active)}</h1>
                  <p className="text-[13px] text-[var(--dim)]">
                    {summary.isCurrent && data.meta
                      ? `Through ${dayLong(data.meta.asOf)} · ${summary.daysCovered} of ${daysInMonth(active)} days`
                      : `All of ${monthTitle(active)}`}
                  </p>
                </div>
                <MonthButton month={nextMonth} dir="next" onPick={pickMonth} />
              </div>
              {view !== "bills" && (
                <label className="flex h-[40px] w-full max-w-[320px] items-center gap-2 rounded-full bg-[var(--surface)] px-4 text-[var(--dim)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-4-4" />
                  </svg>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setLimit(PAGE);
                      if (view !== "transactions" && e.target.value.trim()) go("transactions");
                    }}
                    placeholder="Search merchants, categories"
                    aria-label="Search transactions"
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text)] outline-none"
                  />
                </label>
              )}
            </header>

            {page}
          </div>
        </main>
      </div>

      {editing && <MarkDrawer txn={editing} existing={marks.get(editing.id)} onClose={closeDrawer} />}
      {budgetOpen && <BudgetDrawer data={data} month={active} todayIso={today} onClose={closeBudget} />}
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

function MonthButton({ month, dir, onPick }: { month: string | null; dir: "prev" | "next"; onPick: (m: string) => void }) {
  return (
    <button
      type="button"
      disabled={!month}
      onClick={() => month && onPick(month)}
      aria-label={month ? `Show ${monthName(month)}` : dir === "prev" ? "No earlier month" : "No later month"}
      className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface)] text-[var(--text)] hover:brightness-95 disabled:opacity-30"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

// ---------- sidebar ----------

function Sidebar({
  data,
  view,
  onView,
  unmarked,
  brexWaiting,
}: {
  data: Dashboard;
  view: View;
  onView: (v: View) => void;
  unmarked: number;
  brexWaiting: number;
}) {
  const [msg, setMsg] = useState("");
  const refresh = useMutation({
    mutationFn: () => api.refreshFromPlaid({}),
    onSuccess: (r) =>
      setMsg(r.started ? "Refresh started. New transactions appear once it finishes." : "This copy runs on sample data, so there's nothing to refresh."),
    onError: () => setMsg("Couldn't start the refresh. Try again in a bit."),
  });
  const badge = (v: View) =>
    v === "transactions" && unmarked > 0 ? String(unmarked) : v === "brex" && brexWaiting > 0 ? money0(brexWaiting) : null;

  return (
    <aside className="z-20 flex shrink-0 flex-col gap-4 bg-[var(--surface)] px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-[244px] lg:gap-7 lg:overflow-y-auto lg:py-7">
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex h-[32px] w-[32px] items-end justify-center gap-[3px] rounded-[10px] bg-[var(--accent)] pb-[7px]" aria-hidden="true">
          <span className="h-[8px] w-1 rounded-sm bg-white" />
          <span className="h-[15px] w-1 rounded-sm bg-white" />
          <span className="h-[11px] w-1 rounded-sm bg-white/70" />
        </span>
        <span className="text-[17px] font-extrabold">Budget</span>
      </div>

      <nav aria-label="Sections" className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col">
        {VIEWS.map((v) => {
          const b = badge(v.id);
          return (
            <button
              key={v.id}
              type="button"
              aria-current={view === v.id ? "page" : undefined}
              onClick={() => onView(v.id)}
              className={`flex shrink-0 items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14.5px] ${
                view === v.id ? "bg-[var(--accent-soft)] font-extrabold text-[var(--accent)]" : "font-semibold hover:bg-[var(--bg)]"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={v.icon} />
              </svg>
              <span className="flex-1">{v.label}</span>
              {b && <span className="num rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--dim)]">{b}</span>}
            </button>
          );
        })}
      </nav>

      {data.meta && data.meta.accounts.length > 0 && (
        <div className="hidden flex-col gap-0.5 lg:flex">
          <h2 className="px-3 pb-1 text-[12px] font-bold text-[var(--dim)]">Accounts</h2>
          {data.meta.accounts.map((a) => (
            <div key={a.label} className="flex items-baseline justify-between gap-2 px-3 py-1.5 text-[13px]" title={a.label}>
              <span className="min-w-0 truncate">{a.label.replace(/\s*··\d+$/, "")}</span>
              <span className={`num shrink-0 font-bold ${a.owed ? "text-[var(--rust)]" : ""}`}>{a.balance}</span>
            </div>
          ))}
          <p className="px-3 pt-1 text-[11.5px] text-[var(--dim-2)]">Red balances are owed on credit cards.</p>
        </div>
      )}

      <div className="hidden flex-col gap-2 px-2 lg:mt-auto lg:flex">
        {data.meta && <p className="text-[12px] text-[var(--dim)]">Data through {dayShort(data.meta.asOf)}</p>}
        <button
          type="button"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
          className="whitespace-nowrap rounded-full bg-[var(--surface-2)] px-4 py-2 text-[13px] font-bold text-[var(--accent)] disabled:opacity-60"
        >
          {refresh.isPending ? "Starting…" : "Refresh"}
        </button>
        {msg && <p role="status" className="text-[12px] text-[var(--dim)]">{msg}</p>}
      </div>
    </aside>
  );
}

// ---------- overview ----------

function OverviewPage({
  data,
  summary,
  sts,
  marks,
  unmarked,
  range,
  onRange,
  onPickMonth,
  onEditBudget,
  onOpen,
  onTransactions,
}: {
  data: Dashboard;
  summary: MonthSummary;
  sts: ReturnType<typeof safeToSpend> | null;
  marks: Map<string, Mark>;
  unmarked: number;
  range: Range;
  onRange: (r: Range) => void;
  onPickMonth: (m: string) => void;
  onEditBudget: () => void;
  onOpen: (t: Transaction) => void;
  onTransactions: (opts: { focus?: Focus | null; category?: string | null; filter?: MarkFilter }) => void;
}) {
  const buckets = range === "day" ? dayBuckets(summary, marks) : range === "week" ? weekBuckets(data, marks) : monthBuckets(data, marks);
  const recent = summary.transactions.slice(0, 6);

  return (
    <>
      <Hero summary={summary} sts={sts} unmarked={unmarked} onShowUnmarked={() => onTransactions({ filter: "unmarked" })} onEditBudget={onEditBudget} />

      <Card
        title="Everyday spending"
        aside={
          <Segmented
            label="Chart range"
            value={range}
            onChange={onRange}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        }
      >
        <p className="-mt-2 text-[13px] text-[var(--dim)]">
          Rent is left out of the bars; a house marks when it landed.{range === "day" && " The line is your 7-day average."}{" "}
          {range === "month" ? "Click a month to open it." : "Click a bar to see its transactions."}
        </p>
        <SpendChart
          buckets={buckets}
          focus={range === "month" ? summary.month : null}
          category={null}
          onFocus={(key) => {
            if (!key) return;
            if (range === "month") onPickMonth(key);
            else onTransactions({ focus: { kind: range, key } });
          }}
          ariaLabel={`${range === "day" ? `Daily spending in ${monthTitle(summary.month)}` : range === "week" ? "Weekly spending" : "Monthly spending"}, rent left out`}
        />
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <CategoriesCard summary={summary} category={null} onPick={(c) => onTransactions({ category: c })} />
        <Card
          title="Recent"
          aside={
            <button type="button" onClick={() => onTransactions({})} className="text-[13px] font-bold text-[var(--accent)] hover:underline">
              All {summary.transactions.length} transactions
            </button>
          }
        >
          <ul className="-mx-3 -mt-1 flex flex-col">
            {recent.map((t) => (
              <TxnRow key={t.id} txn={t} mark={marks.get(t.id)} onOpen={onOpen} showDate />
            ))}
          </ul>
        </Card>
      </div>

      <details className="calm-card text-[14px] text-[var(--dim)]">
        <summary className="cursor-pointer font-bold text-[var(--text)]">How these numbers work</summary>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
          <li>Out of pocket is the month's spending minus Brex reimbursements that actually landed in checking, minus anything you marked as paid back, reimbursed or refunded.</li>
          <li>Rent is counted once, at your share, net of your roommate's transfer. It's outside the budget.</li>
          <li>Safe to spend: what's left of the budget at the start of today, spread over the days left. Today's purchases come off "left today".</li>
          <li>Credit card payments and transfers between your own accounts are left out so nothing counts twice.</li>
          <li>Shared household bills (car insurance, electric, internet) are tracked under Bills and kept out of spending.</li>
        </ul>
      </details>
    </>
  );
}

// ---------- transactions ----------

function TransactionsPage({
  data,
  summary,
  marks,
  focus,
  category,
  markFilter,
  query,
  limit,
  onFocus,
  onCategory,
  onMarkFilter,
  onQuery,
  onMore,
  onOpen,
}: {
  data: Dashboard;
  summary: MonthSummary;
  marks: Map<string, Mark>;
  focus: Focus | null;
  category: string | null;
  markFilter: MarkFilter;
  query: string;
  limit: number;
  onFocus: (f: Focus | null) => void;
  onCategory: (c: string | null) => void;
  onMarkFilter: (f: MarkFilter) => void;
  onQuery: (q: string) => void;
  onMore: () => void;
  onOpen: (t: Transaction) => void;
}) {
  let base: Transaction[] = summary.transactions;
  let focusLabel: string | null = null;
  if (focus?.kind === "day") {
    base = summary.transactions.filter((t) => t.date === focus.key);
    focusLabel = dayShort(focus.key);
  } else if (focus?.kind === "week") {
    const start = addDays(focus.key, -6);
    base = data.transactions
      .filter((t) => t.date >= start && t.date <= focus.key)
      .sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? 1 : -1));
    focusLabel = `${dayShort(start)} – ${dayShort(focus.key)}`;
  }
  const q = query.trim().toLowerCase();
  const list = base.filter((t) => {
    if (category && t.category !== category) return false;
    if (markFilter === "marked" && !marks.has(t.id)) return false;
    if (markFilter === "unmarked" && marks.has(t.id)) return false;
    return !q || `${t.name} ${t.category} ${t.account}`.toLowerCase().includes(q);
  });
  const total = list.reduce((s, t) => s + t.amount - (marks.get(t.id)?.amount ?? 0), 0);
  const shown = list.slice(0, limit);
  const days: { date: string; txns: Transaction[]; total: number }[] = [];
  for (const t of shown) {
    const last = days[days.length - 1];
    const net = t.amount - (marks.get(t.id)?.amount ?? 0);
    if (last && last.date === t.date) {
      last.txns.push(t);
      last.total += net;
    } else days.push({ date: t.date, txns: [t], total: net });
  }
  const categories = summary.categories.map((c) => c.category);

  return (
    <section className="calm-card flex flex-col gap-3 px-3 pt-4" aria-label="Transactions">
      <div className="flex flex-wrap items-center gap-2 px-2">
        <Segmented
          small
          label="Show"
          value={markFilter}
          onChange={onMarkFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unmarked", label: "Not marked" },
            { value: "marked", label: "Marked" },
          ]}
        />
        <select
          value={category ?? ""}
          onChange={(e) => onCategory(e.target.value || null)}
          aria-label="Category"
          className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {focusLabel && (
          <Chip onRemove={() => onFocus(null)} label={`Showing ${focusLabel} only. Show the whole month.`}>
            {focusLabel}
          </Chip>
        )}
        {q && (
          <Chip onRemove={() => onQuery("")} label={`Clear the search for ${query.trim()}`}>
            “{query.trim()}”
          </Chip>
        )}
        <span className="num ml-auto text-[13px] text-[var(--dim)]">
          {list.length} {list.length === 1 ? "transaction" : "transactions"} · {money(total)}
        </span>
      </div>

      {list.length === 0 ? (
        <p className="px-3 py-10 text-center text-[var(--dim)]">
          {q ? `Nothing matches "${query.trim()}".` : markFilter === "marked" ? "Nothing marked here yet." : "No transactions here."}
        </p>
      ) : (
        <div className="flex flex-col pb-2">
          {days.map((d) => (
            <div key={d.date}>
              <div className="sticky top-0 z-10 flex justify-between bg-[var(--surface)] px-3 pb-1 pt-3 text-[12px] font-bold text-[var(--dim)]">
                <span>{dayLong(d.date)}</span>
                <span className="num">{money(d.total)}</span>
              </div>
              <ul className="flex flex-col">
                {d.txns.map((t) => (
                  <TxnRow key={t.id} txn={t} mark={marks.get(t.id)} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          ))}
          {list.length > shown.length && (
            <button type="button" onClick={onMore} className="mx-3 mt-2 rounded-full bg-[var(--bg)] py-2.5 text-[14px] font-bold text-[var(--accent)]">
              Show {Math.min(PAGE, list.length - shown.length)} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- brex ----------

function BrexPage({
  data,
  summary,
  marks,
  onOpen,
}: {
  data: Dashboard;
  summary: MonthSummary;
  marks: Map<string, Mark>;
  onOpen: (t: Transaction) => void;
}) {
  const eligible = summary.transactions.filter((t) => t.brex_eligible);
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <BrexCard data={data} summary={summary} />
      <Card title={`Brex-eligible in ${monthName(summary.month)}`} aside={<span className="num text-[13px] text-[var(--dim)]">{eligible.length} · {money(summary.brexEligible)}</span>}>
        {eligible.length === 0 ? (
          <p className="text-[14px] text-[var(--dim)]">No Brex-eligible charges this month.</p>
        ) : (
          <ul className="-mx-3 -mt-1 flex flex-col">
            {eligible.map((t) => (
              <TxnRow key={t.id} txn={t} mark={marks.get(t.id)} onOpen={onOpen} showDate />
            ))}
          </ul>
        )}
        <p className="text-[12px] text-[var(--dim)]">Uber, Lime and DoorDash charges count as Brex-eligible.</p>
      </Card>
    </div>
  );
}
