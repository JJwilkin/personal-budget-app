import { useState } from "react";
import { dayLong, money, monthName, type Dashboard, type Mark, type MonthSummary, type Transaction } from "./data";
import { Section, TxnRow } from "./ui";

type Filter = "all" | "marked" | "unmarked";

export function Activity({
  summary,
  marks,
  category,
  onOpen,
  onClearCategory,
}: {
  summary: MonthSummary;
  marks: Map<string, Mark>;
  category: string | null;
  onOpen: (txn: Transaction) => void;
  onClearCategory: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const list = summary.transactions.filter((t) => {
    if (category && t.category !== category) return false;
    const marked = marks.has(t.id);
    if (filter === "marked" && !marked) return false;
    if (filter === "unmarked" && marked) return false;
    return !q || `${t.name} ${t.category} ${t.account}`.toLowerCase().includes(q);
  });
  const days = new Map<string, Transaction[]>();
  for (const t of list) days.set(t.date, [...(days.get(t.date) ?? []), t]);

  return (
    <>
      <Section plain>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="group" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", minHeight: 36, background: "var(--fill)" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="dim" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              className="field left"
              type="search"
              placeholder="Merchant or category"
              aria-label="Search transactions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minHeight: 36 }}
            />
          </label>
          <div className="segmented" role="group" aria-label="Show">
            {(["all", "marked", "unmarked"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "marked" ? "Marked" : "Not marked"}
              </button>
            ))}
          </div>
          {category && (
            <div className="chips" style={{ marginTop: 0 }}>
              <button type="button" className="pill" onClick={onClearCategory} aria-label={`Showing ${category} only. Show all categories.`}>
                {category} ✕
              </button>
            </div>
          )}
        </div>
      </Section>

      {summary.marksSum > 0 && !q && !category && (
        <Section>
          <div className="row">
            <span className="row-main">Paid back to you</span>
            <span className="num green">{money(summary.marksSum)}</span>
          </div>
        </Section>
      )}

      {days.size === 0 && (
        <div className="center" style={{ minHeight: "30dvh" }}>
          <div>
            <h2>{q ? "No results" : filter === "marked" ? "Nothing marked" : "No transactions"}</h2>
            {filter === "marked" && !q && <p>Tap a transaction to mark money you got back.</p>}
          </div>
        </div>
      )}

      {[...days.entries()].map(([date, txns]) => (
        <Section key={date} header={dayLong(date)}>
          {txns.map((t) => (
            <TxnRow key={t.id} txn={t} mark={marks.get(t.id)} onOpen={onOpen} />
          ))}
        </Section>
      ))}
    </>
  );
}

export function Brex({
  data,
  summary,
  marks,
}: {
  data: Dashboard;
  summary: MonthSummary;
  marks: Map<string, Mark>;
}) {
  const eligible = summary.transactions.filter((t) => t.brex_eligible);
  const deposits = data.meta?.brexDeposits ?? [];
  const allTime = deposits.reduce((s, d) => s + d.amount, 0);
  const pct = summary.brexEligible > 0 ? Math.min(1, summary.brexReceived / summary.brexEligible) : 0;

  return (
    <>
      <Section footer="Charges waiting on Brex stay in your out-of-pocket total until the reimbursement lands in checking.">
        <div className="card">
          <div className="stats" style={{ marginTop: 0 }}>
            <Amount label="Eligible" value={summary.brexEligible} />
            <Amount label="Received" value={summary.brexReceived} className="green" />
            <Amount label="Waiting" value={summary.brexWaiting} className="orange" />
          </div>
          <div className="meter" style={{ marginTop: 14 }} role="img" aria-label={`Received ${money(summary.brexReceived)} of ${money(summary.brexEligible)}`}>
            <span style={{ width: `${pct * 100}%`, background: "var(--green)" }} />
          </div>
        </div>
      </Section>

      <Section header={`Eligible in ${monthName(summary.month)}`}>
        {eligible.length === 0 ? (
          <div className="row dim">No Brex-eligible charges this month.</div>
        ) : (
          eligible.map((t) => <TxnRow key={t.id} txn={t} mark={marks.get(t.id)} showDate />)
        )}
      </Section>

      {deposits.length > 0 && (
        <Section header="Reimbursements received" footer={`${money(allTime)} received all time.`}>
          {deposits.map((d, i) => (
            <div key={i} className="row">
              <span className="row-main">
                <span>{d.date}</span>
                <span className="row-sub">{d.payer}</span>
              </span>
              <span className="num green">{money(d.amount)}</span>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

function Amount({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="eyebrow" style={{ fontSize: 12 }}>{label}</div>
      <div className={`num ${className}`} style={{ fontSize: 20, fontWeight: 700 }}>{money(value)}</div>
    </div>
  );
}

export function Bills({ data }: { data: Dashboard }) {
  const bills = data.meta?.recurring ?? [];
  if (bills.length === 0) {
    return (
      <div className="center">
        <div>
          <h2>No recurring bills</h2>
          <p>Repeat charges will show up here once they're detected.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <Section footer="Amounts are the most recent charge. Electric, internet and car insurance are shared household bills, so they're kept out of your spending totals.">
        {bills.map((b, i) => (
          <div key={i} className="row" style={{ alignItems: "flex-start" }}>
            <span className="row-main">
              <span>{b.name}</span>
              <span className="row-sub">{b.detail}</span>
            </span>
            <span className="row-end">
              <span className="num">{money(b.amount)}</span>
              <span className="dim" style={{ fontSize: 12 }}>{b.cadence}</span>
            </span>
          </div>
        ))}
      </Section>
      <Section>
        <div className="row">
          <span className="row-main">Each month, about</span>
          <span className="num" style={{ fontWeight: 600 }}>{money(bills.reduce((s, b) => s + b.amount, 0))}</span>
        </div>
      </Section>
    </>
  );
}
