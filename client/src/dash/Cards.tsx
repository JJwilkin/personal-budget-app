import { useState } from "react";
import {
  categoryColor,
  dayShort,
  money,
  money0,
  monthTitle,
  type Dashboard,
  type MonthSummary,
  type SafeToSpend,
} from "../../../shared/spending";
import { BudgetTile } from "./Budget";
import { Card, Segmented } from "./ui";

// ---------- hero ----------

export function Hero({
  summary,
  sts,
  unmarked,
  onShowUnmarked,
  onEditBudget,
}: {
  summary: MonthSummary;
  sts: SafeToSpend | null;
  unmarked: number;
  onShowUnmarked: () => void;
  onEditBudget: () => void;
}) {
  const everyday = Math.max(0, summary.outOfPocketExRent);
  const rentPct = summary.outOfPocket > 0 ? Math.min(100, (summary.rent / summary.outOfPocket) * 100) : 0;
  const [dollars, cents = "00"] = money(summary.outOfPocket).split(".");

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
        <BudgetTile sts={sts} onEdit={onEditBudget} />
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

export function CategoriesCard({
  summary,
  category,
  onPick,
}: {
  summary: MonthSummary;
  category: string | null;
  onPick: (c: string) => void;
}) {
  const [view, setView] = useState<"all" | "large">("all");
  const [expanded, setExpanded] = useState(false);
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
          {(expanded ? cats : cats.slice(0, 5)).map((c) => (
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
          {cats.length > 5 && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="self-start text-[13px] font-bold text-[var(--accent)] hover:underline">
              {expanded ? "Show top 5" : `Show all ${cats.length}`}
            </button>
          )}
          <p className="text-[12px] text-[var(--dim)]">Rent {money0(summary.rent)} is your share, net of your roommate's transfer. Click a category to see its transactions.</p>
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

export function BrexCard({ data, summary }: { data: Dashboard; summary: MonthSummary }) {
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

export function BillsCard({ data }: { data: Dashboard }) {
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
