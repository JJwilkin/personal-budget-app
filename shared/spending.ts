// Shared by the desktop dashboard (client/) and the mobile app (mobile/):
// types for the server's getDashboard payload, plus all spending math.
// The iOS app (ios/BudgetApp/Models/MonthSummary.swift) mirrors these rules:
// out of pocket = spending − Brex reimbursements that landed − marked paybacks,
// and rent is your share only, net of your roommate's transfer.

export type MarkType = "paid_back" | "reimbursed" | "refunded";

export type Transaction = {
  id: string;
  date: string; // yyyy-MM-dd
  name: string;
  category: string;
  account: string;
  amount: number;
  pending: boolean;
  brex_eligible: boolean;
};

export type Mark = {
  transaction_id: string;
  mark_type: MarkType;
  amount: number;
  note: string;
  updated_at: string;
};

export type Meta = {
  asOf: string;
  accounts: { label: string; balance: string; owed: boolean }[];
  brexDeposits: { date: string; payer: string; amount: number }[];
  brexReceivedByMonth: Record<string, number>;
  recurring: { name: string; detail: string; amount: number; cadence: string }[];
};

export type Dashboard = {
  seeded: boolean;
  meta: Meta | null;
  transactions: Transaction[];
  marks: Mark[];
};

export const MARK_LABELS: Record<MarkType, string> = {
  paid_back: "Paid back",
  reimbursed: "Reimbursed",
  refunded: "Refunded",
};

// ---------- dates and money ----------

function parts(iso: string): [number, number, number] {
  const [y = 2026, m = 1, d = 1] = iso.split("-").map(Number);
  return [y, m, d];
}

export function dateOf(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d);
}

export function isoOf(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export const monthKey = (iso: string) => iso.slice(0, 7);
export const dayOfMonth = (iso: string) => parts(iso)[2];

export function daysInMonth(month: string): number {
  const [y, m] = parts(month);
  return new Date(y, m, 0).getDate();
}

export function addDays(iso: string, days: number): string {
  const dt = dateOf(iso);
  dt.setDate(dt.getDate() + days);
  return isoOf(dt);
}

/** The Sunday ending the Monday–Sunday week that contains `iso`. */
export function weekEnding(iso: string): string {
  return addDays(iso, (7 - dateOf(iso).getDay()) % 7);
}

export const monthName = (month: string) =>
  dateOf(month).toLocaleDateString("en-US", { month: "long" });
export const monthShort = (month: string) =>
  dateOf(month).toLocaleDateString("en-US", { month: "short" });
export const monthTitle = (month: string) =>
  dateOf(month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
export const dayShort = (iso: string) =>
  dateOf(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const dayLong = (iso: string) =>
  dateOf(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export function money(n: number, digits = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
export const money0 = (n: number) => money(Math.round(n), 0);

// ---------- summaries ----------

export type DailyPoint = { iso: string; day: number; total: number; rent: number; exRent: number; trend3: number };
export type Bucket = { key: string; label: string; title: string; total: number; rent: number; exRent: number };

export type MonthSummary = {
  month: string;
  transactions: Transaction[]; // newest first
  total: number;
  marksSum: number;
  brexReceived: number;
  brexEligible: number;
  brexWaiting: number;
  rent: number;
  outOfPocket: number;
  outOfPocketExRent: number;
  perDayExRent: number;
  isCurrent: boolean;
  daysCovered: number;
  categories: { category: string; count: number; total: number }[];
  daily: DailyPoint[];
};

const rentOf = (t: Transaction) => (t.category === "Rent" ? t.amount : 0);

export function monthsIn(data: Dashboard): string[] {
  return [...new Set(data.transactions.map((t) => monthKey(t.date)))].sort();
}

export function summarize(data: Dashboard, month: string): MonthSummary {
  const marks = new Map(data.marks.map((m) => [m.transaction_id, m]));
  const txns = data.transactions
    .filter((t) => monthKey(t.date) === month)
    .sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? 1 : -1));

  const total = txns.reduce((s, t) => s + t.amount, 0);
  const marksSum = txns.reduce((s, t) => s + (marks.get(t.id)?.amount ?? 0), 0);
  const brexReceived = data.meta?.brexReceivedByMonth[month] ?? 0;
  const brexEligible = txns.filter((t) => t.brex_eligible).reduce((s, t) => s + t.amount, 0);
  const rent = txns.reduce((s, t) => s + rentOf(t), 0);
  const outOfPocket = total - brexReceived - marksSum;

  const asOf = data.meta?.asOf ?? "";
  const isCurrent = asOf !== "" && monthKey(asOf) === month;
  const full = daysInMonth(month);
  const daysCovered = isCurrent ? Math.min(full, Math.max(1, dayOfMonth(asOf))) : full;

  const cats = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    const c = cats.get(t.category) ?? { count: 0, total: 0 };
    c.count += 1;
    c.total += t.amount;
    cats.set(t.category, c);
  }
  const categories = [...cats.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);

  const byDay = new Map<number, { total: number; rent: number }>();
  for (const t of txns) {
    const d = dayOfMonth(t.date);
    const v = byDay.get(d) ?? { total: 0, rent: 0 };
    v.total += t.amount;
    v.rent += rentOf(t);
    byDay.set(d, v);
  }
  const lastDay = Math.max(daysCovered, ...byDay.keys());
  const daily: DailyPoint[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const v = byDay.get(day) ?? { total: 0, rent: 0 };
    const exRent = v.total - v.rent;
    const window = [...daily.slice(-2).map((p) => p.exRent), exRent];
    daily.push({
      iso: `${month}-${String(day).padStart(2, "0")}`,
      day,
      total: v.total,
      rent: v.rent,
      exRent,
      trend3: window.reduce((s, x) => s + x, 0) / window.length,
    });
  }

  return {
    month,
    transactions: txns,
    total,
    marksSum,
    brexReceived,
    brexEligible,
    brexWaiting: Math.max(0, brexEligible - brexReceived),
    rent,
    outOfPocket,
    outOfPocketExRent: outOfPocket - rent,
    perDayExRent: (outOfPocket - rent) / Math.max(1, daysCovered),
    isCurrent,
    daysCovered,
    categories,
    daily,
  };
}

function bucket(
  txns: Transaction[],
  keyOf: (t: Transaction) => string,
  describe: (key: string) => { label: string; title: string },
): Bucket[] {
  const map = new Map<string, { total: number; rent: number }>();
  for (const t of txns) {
    const k = keyOf(t);
    const v = map.get(k) ?? { total: 0, rent: 0 };
    v.total += t.amount;
    v.rent += rentOf(t);
    map.set(k, v);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({ key, ...describe(key), ...v, exRent: v.total - v.rent }));
}

export function weeks(data: Dashboard): Bucket[] {
  return bucket(data.transactions, (t) => weekEnding(t.date), (end) => ({
    label: dayShort(end),
    title: `${dayShort(addDays(end, -6))} – ${dayShort(end)}`,
  }));
}

export function months(data: Dashboard): Bucket[] {
  return bucket(data.transactions, (t) => monthKey(t.date), (m) => ({
    label: monthShort(m),
    title: monthTitle(m),
  }));
}

// ---------- categories ----------

export const CATEGORY_COLORS: Record<string, string> = {
  Rent: "#0e6b4f",
  "Food & drink": "#d97c1e",
  Groceries: "#5e9e4a",
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
};

export const categoryColor = (c: string) => CATEGORY_COLORS[c] ?? "#8e8e93";
