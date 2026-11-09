import { useEffect, useState, type FormEvent } from "react";
import { useSetBudget } from "./api";
import {
  budgetSuggestions,
  daysInMonth,
  money,
  money0,
  monthName,
  safeToSpend,
  type Dashboard,
  type SafeToSpend,
} from "../../shared/spending";
import { Section } from "./ui";

/** Safe to spend today plus what's left this month; a prompt to set a budget when there isn't one. */
export function BudgetCard({ sts, onEdit }: { sts: SafeToSpend | null; onEdit: () => void }) {
  if (!sts) {
    return (
      <Section footer="See what's safe to spend each day and what's left for the month.">
        <button type="button" className="text-button" onClick={onEdit}>
          Set a monthly budget
        </button>
      </Section>
    );
  }

  const over = sts.left < 0;
  const usedPct = sts.flexible > 0 ? Math.min(100, Math.max(0, (sts.spent / sts.flexible) * 100)) : 100;
  const footer = `${money0(sts.budget)} budget − ${money0(sts.fixed)} rent${sts.rentPending ? " (expected)" : ""}`;

  if (sts.status !== "current") {
    return (
      <Section header={`${monthName(sts.month)} budget`} footer={footer}>
        <div className="row">
          <span className="row-main">{over ? "Over budget" : "Under budget"}</span>
          <span className="num" style={{ fontWeight: 700, color: over ? "var(--red)" : "var(--green)" }}>
            {money(Math.abs(sts.left))}
          </span>
        </div>
        <button type="button" className="text-button" onClick={onEdit}>Edit Budget</button>
      </Section>
    );
  }

  const todayLine = over
    ? `${money(-sts.left)} over for ${monthName(sts.month)}`
    : sts.spentToday > 0
      ? sts.leftToday >= 0
        ? `${money(sts.leftToday)} left today`
        : `${money(-sts.leftToday)} over today`
      : `About the same each day for ${sts.daysLeft} ${sts.daysLeft === 1 ? "day" : "days"}`;

  return (
    <Section header="Budget" footer={footer}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", gap: 12 }}>
          <div>
            <div className="eyebrow">Safe to spend today</div>
            <div className="big-number num" style={{ color: over ? "var(--red)" : "var(--green)", fontSize: 32 }}>{money(sts.safeToday)}</div>
            <div className="dim" style={{ fontSize: 14 }}>{todayLine}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow">Left this month</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{money(Math.max(0, sts.left))}</div>
            <div className="dim" style={{ fontSize: 13 }}>of {money(sts.flexible)} after rent</div>
          </div>
        </div>
        <div className="meter" role="img" aria-label={`${Math.round(usedPct)} percent of the money after rent used`}>
          <span style={{ width: `${usedPct}%`, background: over ? "var(--red)" : "var(--green)" }} />
        </div>
      </div>
      <button type="button" className="text-button" onClick={onEdit}>Edit Budget</button>
    </Section>
  );
}

/** Bottom sheet for setting or changing the monthly budget. */
export function BudgetSheet({
  data,
  sts,
  month,
  todayIso,
  onClose,
}: {
  data: Dashboard;
  sts: SafeToSpend | null;
  month: string;
  todayIso: string;
  onClose: () => void;
}) {
  const current = data.budget?.monthly ?? null;
  const [text, setText] = useState(current ? String(current) : "");
  const [error, setError] = useState("");
  const save = useSetBudget();
  const suggestions = budgetSuggestions(data, todayIso);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const amount = Number(text.replace(/[$,\s]/g, ""));
  const valid = text.trim() !== "" && Number.isFinite(amount) && amount > 0;
  // Rent to reserve is known even before a budget exists.
  const fixed = sts?.fixed ?? safeToSpend(data, month, 0, todayIso).fixed;
  const flexible = amount - fixed;

  const commit = (monthly: number | null) =>
    save.mutate(monthly, { onSuccess: onClose, onError: () => setError("Couldn't save the budget. Try again.") });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Enter a monthly amount, like 1500.");
      return;
    }
    commit(Math.round(amount * 100) / 100);
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="budget-title" onSubmit={submit}>
        <div className="sheet-bar">
          <button type="button" className="bar-button" onClick={onClose}>Cancel</button>
          <h2 id="budget-title">Monthly Budget</h2>
          <button type="submit" className="bar-button" disabled={!valid || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="content">
          <Section footer="Rent included. Shared bills stay out, as in your spending totals.">
            <label className="row">
              <span className="row-main">Each month</span>
              <input
                className="field num"
                inputMode="decimal"
                placeholder="1500"
                aria-label="Monthly budget in dollars"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError("");
                }}
                style={{ maxWidth: 160, fontSize: 20, fontWeight: 700 }}
              />
            </label>
          </Section>

          {suggestions.length > 0 && (
            <Section header="From your history" plain>
              <div className="pill-row">
                {suggestions.map((s) => (
                  <button key={s.label} type="button" className="pill" onClick={() => setText(String(s.amount))}>
                    {s.label} {money0(s.amount)}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {valid && (
            <Section plain>
              <p style={{ margin: "0 16px", fontSize: 15, color: flexible > 0 ? "var(--green)" : "var(--orange)" }}>
                {flexible > 0
                  ? `After rent (${money0(fixed)}), that leaves ${money0(flexible)} for everything else, about ${money(flexible / daysInMonth(month))} a day.`
                  : `That's no more than rent (${money0(fixed)}), so nothing would be left to spend.`}
              </p>
            </Section>
          )}

          <Section header="How it works" plain>
            <p style={{ margin: "0 16px", fontSize: 15, color: "var(--label-2)" }}>
              Each morning, what's left after rent and your spending is divided by the days left. Quiet days give the
              rest of the month a little more; a big day is spread over what remains.
            </p>
          </Section>

          {error && (
            <Section plain>
              <p role="alert" style={{ margin: "0 16px", color: "var(--red)", fontSize: 15 }}>{error}</p>
            </Section>
          )}

          {current && (
            <Section>
              <button type="button" className="text-button destructive" disabled={save.isPending} onClick={() => commit(null)}>
                Remove Budget
              </button>
            </Section>
          )}
        </div>
      </form>
    </div>
  );
}
