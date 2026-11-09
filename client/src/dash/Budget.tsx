import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import {
  budgetSuggestions,
  daysInMonth,
  money,
  money0,
  monthName,
  safeToSpend,
  type Dashboard,
  type SafeToSpend,
} from "../../../shared/spending";

/**
 * The budget tile in the summary: safe to spend today, and what's left for
 * the month. Without a budget it invites you to set one.
 */
export function BudgetTile({ sts, onEdit }: { sts: SafeToSpend | null; onEdit: () => void }) {
  if (!sts) {
    return (
      <div className="calm-tile col-span-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-extrabold">Set a monthly budget</p>
          <p className="text-[13px] text-[var(--dim)]">See what's safe to spend each day and what's left for the month.</p>
        </div>
        <button type="button" onClick={onEdit} className="rounded-full bg-[var(--accent)] px-4 py-2 text-[14px] font-bold text-white">
          Set budget
        </button>
      </div>
    );
  }

  const edit = (
    <button type="button" onClick={onEdit} className="text-[13px] font-bold text-[var(--accent)] hover:underline">
      Edit budget
    </button>
  );
  const usedPct = sts.flexible > 0 ? Math.min(100, Math.max(0, (sts.spent / sts.flexible) * 100)) : 100;
  const over = sts.left < 0;

  if (sts.status !== "current") {
    return (
      <div className="calm-tile col-span-2 flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-bold text-[var(--dim)]">{monthName(sts.month)} budget</p>
          {edit}
        </div>
        <p className="num text-[26px] font-extrabold" style={{ color: over ? "var(--rust)" : "var(--accent)" }}>
          {over ? `${money(-sts.left)} over` : `${money(sts.left)} under`}
        </p>
        <p className="text-[13px] text-[var(--dim)]">
          {money(sts.spent)} of {money(sts.flexible)} after rent · {money0(sts.budget)} budget
        </p>
      </div>
    );
  }

  return (
    <div className="calm-tile col-span-2 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[13px] font-bold text-[var(--dim)]">Safe to spend today</p>
          <p className="num text-[34px] font-extrabold leading-tight tracking-[-1px]" style={{ color: over ? "var(--rust)" : "var(--accent)" }}>
            {money(sts.safeToday)}
          </p>
          <p className="text-[13px] text-[var(--dim)]">
            {over
              ? `${money(-sts.left)} over for ${monthName(sts.month)}`
              : sts.spentToday > 0
                ? sts.leftToday >= 0
                  ? `${money(sts.leftToday)} left today`
                  : `${money(-sts.leftToday)} over today`
                : `about the same each day for ${sts.daysLeft} ${sts.daysLeft === 1 ? "day" : "days"}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-bold text-[var(--dim)]">Left this month</p>
          <p className="num text-[22px] font-extrabold">{over ? money(0) : money(sts.left)}</p>
          <p className="text-[13px] text-[var(--dim)]">of {money(sts.flexible)} after rent</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]" role="img" aria-label={`${Math.round(usedPct)} percent of the money after rent used`}>
        <div className="h-2 rounded-full" style={{ width: `${usedPct}%`, background: over ? "var(--rust)" : "var(--accent)" }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--dim)]">
        <span>
          {money0(sts.budget)} budget − {money0(sts.fixed)} rent{sts.rentPending ? " (expected)" : ""}
        </span>
        {edit}
      </div>
    </div>
  );
}

/** Side drawer for setting or changing the monthly budget. */
export function BudgetDrawer({
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
  const queryClient = useQueryClient();
  const current = data.budget?.monthly ?? null;
  const [text, setText] = useState(current ? String(current) : "");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = budgetSuggestions(data, todayIso);

  const save = useMutation({
    mutationFn: (monthly: number | null) => api.setBudget({ monthly }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: () => setError("Couldn't save the budget. Check your connection and try again."),
  });

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const amount = Number(text.replace(/[$,\s]/g, ""));
  const valid = text.trim() !== "" && Number.isFinite(amount) && amount > 0;
  // Rent to reserve is known even before a budget exists.
  const fixed = sts?.fixed ?? safeToSpend(data, month, 0, todayIso).fixed;
  const flexible = amount - fixed;
  const perDay = flexible / daysInMonth(month);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Enter a monthly amount, like 1500.");
      return;
    }
    save.mutate(Math.round(amount * 100) / 100);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/25" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-title"
        className="flex h-full w-full max-w-[420px] flex-col gap-5 overflow-y-auto bg-[var(--bg)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="budget-title" className="text-[20px] font-extrabold">
            Monthly budget
          </h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-[14px] font-semibold text-[var(--dim)] hover:bg-[var(--surface-2)]">
            Close
          </button>
        </div>

        <label className="calm-card flex items-baseline gap-1">
          <span className="text-[28px] font-extrabold text-[var(--dim)]">$</span>
          <input
            ref={inputRef}
            inputMode="decimal"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            placeholder="1500"
            aria-label="Monthly budget in dollars"
            className="num min-w-0 flex-1 bg-transparent text-[36px] font-extrabold outline-none"
          />
          <span className="text-[14px] text-[var(--dim)]">a month</span>
        </label>

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-bold text-[var(--dim)]">From your history</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setText(String(s.amount));
                    setError("");
                  }}
                  className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold hover:brightness-95"
                >
                  {s.label} <span className="num font-medium text-[var(--dim)]">{money0(s.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {valid && (
          <div
            className="rounded-[20px] px-5 py-4 text-[14px] leading-relaxed"
            style={{
              background: flexible > 0 ? "var(--accent-soft)" : "var(--amber-soft)",
              color: flexible > 0 ? "var(--accent)" : "var(--amber)",
            }}
          >
            {flexible > 0 ? (
              <>
                After rent ({money0(fixed)}), that leaves <b>{money0(flexible)}</b> for everything else, about{" "}
                <b>{money(perDay)} a day</b>.
              </>
            ) : (
              <>That's no more than rent ({money0(fixed)}), so there'd be nothing left to spend. Try a higher amount.</>
            )}
          </div>
        )}

        <div className="calm-card flex flex-col gap-2 text-[13px] text-[var(--dim)]">
          <p className="font-bold text-[var(--text)]">How safe to spend works</p>
          <p>Each morning: what's left after rent and what you've spent, divided by the days left. Spend less one day and the next days get a little more; spend more and it's spread over the rest of the month.</p>
          <p>Shared bills stay out. Money you mark as paid back, and Brex reimbursements once they land, go back into what's left.</p>
        </div>

        {error && (
          <p role="alert" className="text-[14px] font-semibold text-[var(--rust)]">
            {error}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <button type="submit" disabled={save.isPending} className="flex-1 rounded-full bg-[var(--accent)] px-5 py-3 font-bold text-white disabled:opacity-60">
            {save.isPending ? "Saving…" : current ? "Update budget" : "Save budget"}
          </button>
          {current && (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(null)}
              className="rounded-full bg-[var(--surface)] px-5 py-3 font-bold text-[var(--rust)] disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
