import { useEffect, useState, type FormEvent } from "react";
import { useSetBudget } from "./api";
import {
  budgetSuggestions,
  daysInMonth,
  money,
  money0,
  monthName,
  type Dashboard,
  type SafeToSpend,
} from "../../shared/spending";
import { Section } from "./ui";

/** The line under "Safe to spend today": what's left today, how far over, or how many days it covers. */
export function budgetLine(sts: SafeToSpend): string {
  if (sts.left < 0) return `${money(-sts.left)} over for ${monthName(sts.month)}`;
  if (sts.spentToday > 0) {
    return sts.leftToday >= 0 ? `${money(sts.leftToday)} left today` : `${money(-sts.leftToday)} over today`;
  }
  return `About the same each day for ${sts.daysLeft} ${sts.daysLeft === 1 ? "day" : "days"}`;
}

/** Bottom sheet for setting or changing the monthly budget. */
export function BudgetSheet({
  data,
  month,
  todayIso,
  onClose,
}: {
  data: Dashboard;
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
          <Section footer="Rent is outside this budget. Shared bills stay out, as in your spending totals.">
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
              <p style={{ margin: "0 16px", fontSize: 15, color: "var(--green)" }}>
                {`That leaves ${money0(amount)} for everyday spending, about ${money(amount / daysInMonth(month))} a day.`}
              </p>
            </Section>
          )}

          <Section header="How it works" plain>
            <p style={{ margin: "0 16px", fontSize: 15, color: "var(--label-2)" }}>
              Each morning, what's left of your budget after your spending is divided by the days left. Quiet days give the
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
