// Chart buckets for the spending chart: by day, Monday–Sunday week, or month.
// Bars are net of marks and leave rent out (it's drawn as a pin instead).
import {
  addDays,
  dayLong,
  dayShort,
  daysInMonth,
  monthKey,
  monthShort,
  monthTitle,
  money,
  weekEnding,
  type Dashboard,
  type Mark,
  type MonthSummary,
  type Transaction,
} from "../../../shared/spending";
import type { ChartBucket } from "./SpendChart";


function bucketOf(txns: Transaction[], marks: Map<string, Mark>): Pick<ChartBucket, "segs" | "rent" | "top"> {
  const byCat = new Map<string, number>();
  let rent = 0;
  for (const t of txns) {
    const net = t.amount - (marks.get(t.id)?.amount ?? 0);
    if (t.category === "Rent") rent += t.amount;
    else byCat.set(t.category, (byCat.get(t.category) ?? 0) + net);
  }
  const top = txns
    .filter((t) => t.category !== "Rent")
    .map((t) => ({ name: t.name, net: t.amount - (marks.get(t.id)?.amount ?? 0) }))
    .sort((a, b) => b.net - a.net)
    .slice(0, 2)
    .map(({ name, net }) => `${name} ${money(net)}`);
  return { segs: [...byCat.entries()].map(([cat, v]) => ({ cat, v })), rent, top };
}

export function group(txns: Transaction[], keyOf: (t: Transaction) => string): Map<string, Transaction[]> {
  const m = new Map<string, Transaction[]>();
  for (const t of txns) m.set(keyOf(t), [...(m.get(keyOf(t)) ?? []), t]);
  return m;
}

export function dayBuckets(s: MonthSummary, marks: Map<string, Mark>): ChartBucket[] {
  const byDay = group(s.transactions, (t) => t.date);
  const out: ChartBucket[] = [];
  for (let d = 1; d <= daysInMonth(s.month); d++) {
    const iso = `${s.month}-${String(d).padStart(2, "0")}`;
    out.push({
      key: iso,
      label: d === 1 || d % 5 === 0 ? String(d) : "",
      title: dayLong(iso),
      ...bucketOf(byDay.get(iso) ?? [], marks),
      future: s.isCurrent && d > s.daysCovered && !byDay.has(iso),
      trend: s.daily[d - 1]?.trend7,
    });
  }
  return out;
}

export function weekBuckets(data: Dashboard, marks: Map<string, Mark>): ChartBucket[] {
  const byWeek = group(data.transactions, (t) => weekEnding(t.date));
  return [...byWeek.keys()].sort().map((end) => ({
    key: end,
    label: dayShort(end),
    title: `${dayShort(addDays(end, -6))} – ${dayShort(end)}`,
    ...bucketOf(byWeek.get(end) ?? [], marks),
  }));
}

export function monthBuckets(data: Dashboard, marks: Map<string, Mark>): ChartBucket[] {
  const byMonth = group(data.transactions, (t) => monthKey(t.date));
  return [...byMonth.keys()].sort().map((m) => ({
    key: m,
    label: monthShort(m),
    title: monthTitle(m),
    ...bucketOf(byMonth.get(m) ?? [], marks),
  }));
}

