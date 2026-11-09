import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboard } from "./api";
import { dayLong, monthName, months as monthBuckets, monthsIn, monthTitle, summarize, weeks as weekBuckets, isoOf, safeToSpend, type Transaction } from "../../shared/spending";
import { BudgetSheet } from "./Budget";
import { MarkSheet } from "./MarkSheet";
import { Overview } from "./Overview";
import { Activity, Bills, Brex } from "./Screens";
import { Glyph, monthButtons, Screen } from "./ui";

type Tab = "overview" | "activity" | "brex" | "bills";

const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: "overview", label: "Overview", glyph: "M5 20V11M12 20V4M19 20v-7" },
  { id: "activity", label: "Activity", glyph: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" },
  { id: "brex", label: "Brex", glyph: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { id: "bills", label: "Bills", glyph: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
];

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as Tab) : "overview";
}

export function App() {
  const dash = useDashboard();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [month, setMonth] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: Tab) => {
    if (next === tab) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    history.replaceState(null, "", `#${next}`);
    setTab(next);
    window.scrollTo(0, 0);
  };

  const data = dash.data;
  const allMonths = useMemo(() => (data ? monthsIn(data) : []), [data]);
  const active = month && allMonths.includes(month) ? month : (allMonths[allMonths.length - 1] ?? null);
  const summary = useMemo(() => (data && active ? summarize(data, active) : null), [data, active]);
  const weeks = useMemo(() => (data ? weekBuckets(data) : []), [data]);
  const months = useMemo(() => (data ? monthBuckets(data) : []), [data]);
  const marks = useMemo(() => new Map((data?.marks ?? []).map((m) => [m.transaction_id, m])), [data]);
  const closeSheet = useCallback(() => setEditing(null), []);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const closeBudget = useCallback(() => setBudgetOpen(false), []);
  const today = isoOf(new Date());
  const sts = useMemo(
    () => (data?.budget && active ? safeToSpend(data, active, data.budget.monthly, today) : null),
    [data, active, today],
  );

  const i = active ? allMonths.indexOf(active) : -1;
  const previous = i > 0 ? (allMonths[i - 1] ?? null) : null;
  const next = i >= 0 && i < allMonths.length - 1 ? (allMonths[i + 1] ?? null) : null;
  const nav = monthButtons({
    previous,
    next,
    previousLabel: previous ? monthName(previous) : "",
    nextLabel: next ? monthName(next) : "",
    onChange: setMonth,
  });

  const title = tab === "overview" ? (active ? monthName(active) : "Spending") : TABS.find((t) => t.id === tab)!.label;
  const subtitle =
    summary && data?.meta
      ? summary.isCurrent
        ? `Through ${dayLong(data.meta.asOf)}`
        : `All of ${monthTitle(summary.month)}`
      : undefined;

  let body;
  if (dash.isPending) {
    body = <div className="center">Loading your spending…</div>;
  } else if (dash.isError) {
    body = (
      <div className="center">
        <div>
          <h2>Can't load your spending</h2>
          <p>{dash.error.message}</p>
          <button type="button" className="pill" onClick={() => void dash.refetch()}>Try Again</button>
        </div>
      </div>
    );
  } else if (!data || !summary) {
    body = (
      <div className="center">
        <div>
          <h2>No transactions yet</h2>
          <p>Spending will show up here once your accounts sync.</p>
        </div>
      </div>
    );
  } else if (tab === "overview") {
    body = (
      <Overview
        data={data}
        summary={summary}
        weeks={weeks}
        months={months}
        onOpenCategory={(c) => {
          setCategory(c);
          go("activity");
        }}
        sts={sts}
        onEditBudget={() => setBudgetOpen(true)}
      />
    );
  } else if (tab === "activity") {
    body = <Activity summary={summary} marks={marks} category={category} onOpen={setEditing} onClearCategory={() => setCategory(null)} />;
  } else if (tab === "brex") {
    body = <Brex data={data} summary={summary} marks={marks} />;
  } else {
    body = <Bills data={data} />;
  }

  const showMonthButtons = tab !== "bills" && summary != null;

  return (
    <>
      <Screen
        title={title}
        subtitle={tab === "bills" ? undefined : subtitle}
        leading={showMonthButtons ? nav.leading : null}
        trailing={showMonthButtons ? nav.trailing : null}
      >
        {body}
      </Screen>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => go(t.id)}
          >
            <Glyph d={t.glyph} strokeWidth={1.9} />
            {t.label}
          </button>
        ))}
      </nav>

      {editing && <MarkSheet txn={editing} existing={marks.get(editing.id)} onClose={closeSheet} />}
      {budgetOpen && data && active && (
        <BudgetSheet data={data} sts={sts} month={active} todayIso={today} onClose={closeBudget} />
      )}
    </>
  );
}
