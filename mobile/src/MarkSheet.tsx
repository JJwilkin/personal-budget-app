import { useEffect, useState, type FormEvent } from "react";
import { useClearMark, useSaveMark } from "./api";
import { dayLong, MARK_LABELS, money, type Mark, type MarkType, type Transaction } from "./data";
import { CategoryIcon, Section } from "./ui";

/** Bottom sheet for recording money that came back on a transaction. */
export function MarkSheet({
  txn,
  existing,
  onClose,
}: {
  txn: Transaction;
  existing: Mark | undefined;
  onClose: () => void;
}) {
  const [type, setType] = useState<MarkType>(existing?.mark_type ?? "paid_back");
  const [amountText, setAmountText] = useState(existing ? existing.amount.toFixed(2) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");
  const save = useSaveMark();
  const clear = useClearMark();
  const busy = save.isPending || clear.isPending;

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

  const cleaned = amountText.replace(/[$\s]/g, "");
  const amount = Number(cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned.replace(/,/g, ""));
  const valid = cleaned !== "" && Number.isFinite(amount) && amount > 0 && amount <= txn.amount + 0.001;

  const setTo = (v: number) => {
    setAmountText((Math.round(v * 100) / 100).toFixed(2));
    setError("");
  };

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!valid) {
      setError(`Enter an amount between $0.01 and ${money(txn.amount)}.`);
      return;
    }
    save.mutate(
      { transaction_id: txn.id, mark_type: type, amount: Math.round(amount * 100) / 100, note: note.trim().slice(0, 200) },
      { onSuccess: onClose, onError: () => setError("Couldn't save. Check your connection and try again.") },
    );
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="mark-title" onSubmit={submit}>
        <div className="sheet-bar">
          <button type="button" className="bar-button" onClick={onClose}>Cancel</button>
          <h2 id="mark-title">{existing ? "Edit Mark" : "Mark Transaction"}</h2>
          <button type="submit" className="bar-button" disabled={!valid || busy}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="content">
          <Section>
            <div className="row">
              <CategoryIcon category={txn.category} />
              <span className="row-main">
                <span style={{ fontWeight: 600 }}>{txn.name}</span>
                <span className="row-sub">{dayLong(txn.date)} · {txn.account}</span>
              </span>
              <span className="num" style={{ fontWeight: 600 }}>{money(txn.amount)}</span>
            </div>
          </Section>

          <Section header="What happened" plain>
            <div className="segmented" role="group" aria-label="Mark type">
              {(Object.keys(MARK_LABELS) as MarkType[]).map((t) => (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
                  {MARK_LABELS[t]}
                </button>
              ))}
            </div>
          </Section>

          <Section
            header="Amount"
            footer={`Anything from $0.01 up to ${money(txn.amount)}. Splitting evenly counts everyone else's share as paid back.`}
          >
            <label className="row">
              <span className="row-main">Amount back</span>
              <input
                className="field num"
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Amount back in dollars"
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  setError("");
                }}
                style={{ maxWidth: 140 }}
              />
            </label>
            <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
              <div className="pill-row" aria-label="Quick amounts">
                {[25, 50, 75, 100].map((p) => (
                  <button key={p} type="button" className="pill" style={{ flex: 1 }} onClick={() => setTo((txn.amount * p) / 100)}>
                    {p}%
                  </button>
                ))}
              </div>
              <div className="pill-row" aria-label="Split evenly">
                <span className="dim" style={{ fontSize: 15, alignSelf: "center" }}>Split</span>
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="pill"
                    onClick={() => setTo((txn.amount * (n - 1)) / n)}
                    aria-label={`Split between ${n} people, ${money(txn.amount / n)} each`}
                  >
                    {n} people
                  </button>
                ))}
              </div>
            </div>
            {valid && (
              <div className="row">
                <span className="row-main">Your share</span>
                <span className="num" style={{ fontWeight: 600 }}>{money(txn.amount - amount)}</span>
              </div>
            )}
          </Section>

          <Section header="Note">
            <label className="row">
              <input
                className="field left"
                placeholder="e.g. Roommate paid their half"
                aria-label="Note"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </Section>

          {error && (
            <Section plain>
              <p role="alert" style={{ margin: "0 16px", color: "var(--red)", fontSize: 15 }}>{error}</p>
            </Section>
          )}

          {existing && (
            <Section>
              <button
                type="button"
                className="text-button destructive"
                disabled={busy}
                onClick={() =>
                  clear.mutate(txn.id, {
                    onSuccess: onClose,
                    onError: () => setError("Couldn't remove the mark. Try again."),
                  })
                }
              >
                {clear.isPending ? "Removing…" : "Remove Mark"}
              </button>
            </Section>
          )}
        </div>
      </form>
    </div>
  );
}
