import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { dayLong, MARK_LABELS, money, type Mark, type MarkType, type Transaction } from "../../../shared/spending";
import { CategoryIcon } from "./ui";

/** Side drawer for recording money that came back on a transaction. */
export function MarkDrawer({
  txn,
  existing,
  onClose,
}: {
  txn: Transaction;
  existing: Mark | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<MarkType>(existing?.mark_type ?? "paid_back");
  const [amountText, setAmountText] = useState(existing ? existing.amount.toFixed(2) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: (args: { transaction_id: string; mark_type: MarkType; amount: number; note: string }) => api.saveMark(args),
    onSuccess: done,
    onError: () => setError("Couldn't save. Check your connection and try again."),
  });
  const clear = useMutation({
    mutationFn: () => api.clearMark({ transaction_id: txn.id }),
    onSuccess: done,
    onError: () => setError("Couldn't remove the mark. Try again."),
  });
  const busy = save.isPending || clear.isPending;

  useEffect(() => {
    amountRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cleaned = amountText.replace(/[$\s]/g, "");
  const amount = Number(cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned.replace(/,/g, ""));
  const valid = cleaned !== "" && Number.isFinite(amount) && amount > 0 && amount <= txn.amount + 0.001;
  const setTo = (v: number) => {
    setAmountText((Math.round(v * 100) / 100).toFixed(2));
    setError("");
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError(`Enter an amount between $0.01 and ${money(txn.amount)}.`);
      return;
    }
    save.mutate({
      transaction_id: txn.id,
      mark_type: type,
      amount: Math.round(amount * 100) / 100,
      note: note.trim().slice(0, 200),
    });
  }

  const pill = "rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[13px] font-bold text-[var(--accent)] hover:brightness-95";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/25" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-title"
        className="flex h-full w-full max-w-[420px] flex-col gap-5 overflow-y-auto bg-[var(--bg)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="mark-title" className="text-[20px] font-extrabold">
            {existing ? "Edit mark" : "Mark money back"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-[14px] font-semibold text-[var(--dim)] hover:bg-[var(--surface-2)]">
            Close
          </button>
        </div>

        <div className="calm-card flex items-center gap-3">
          <CategoryIcon category={txn.category} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{txn.name}</div>
            <div className="text-[13px] text-[var(--dim)]">
              {dayLong(txn.date)} · {txn.account}
            </div>
          </div>
          <div className="num font-bold">{money(txn.amount)}</div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-bold text-[var(--dim)]">What happened</legend>
          <div className="grid grid-cols-3 rounded-full bg-[var(--surface-2)] p-[3px]">
            {(Object.keys(MARK_LABELS) as MarkType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`rounded-full py-2 text-[13px] font-bold ${type === t ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--dim)]"}`}
              >
                {MARK_LABELS[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="calm-card flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3">
            <span className="font-semibold">Amount back</span>
            <input
              ref={amountRef}
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                setError("");
              }}
              className="num w-36 rounded-[12px] bg-[var(--surface-2)] px-3 py-2 text-right text-[16px] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Quick amounts">
            {[25, 50, 75, 100].map((p) => (
              <button key={p} type="button" className={pill} onClick={() => setTo((txn.amount * p) / 100)}>
                {p}%
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Split evenly">
            <span className="text-[13px] text-[var(--dim)]">Split evenly</span>
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={pill}
                onClick={() => setTo((txn.amount * (n - 1)) / n)}
                aria-label={`Split between ${n} people, ${money(txn.amount / n)} each`}
              >
                {n} people
              </button>
            ))}
          </div>
          {valid && (
            <div className="flex justify-between border-t border-[var(--border)] pt-3">
              <span>Your share</span>
              <span className="num font-extrabold">{money(txn.amount - amount)}</span>
            </div>
          )}
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-[var(--dim)]">Note</span>
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Roommate paid their half"
            className="rounded-[14px] bg-[var(--surface)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </label>

        {error && (
          <p role="alert" className="text-[14px] font-semibold text-[var(--rust)]">
            {error}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-full bg-[var(--accent)] px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : existing ? "Update mark" : "Save mark"}
          </button>
          {existing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => clear.mutate()}
              className="rounded-full bg-[var(--surface)] px-5 py-3 font-bold text-[var(--rust)] disabled:opacity-60"
            >
              {clear.isPending ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
        <p className="text-[12px] text-[var(--dim-2)]">Saved on the server, so it syncs to the mobile app and your other devices.</p>
      </form>
    </div>
  );
}
