import type { ReactNode } from "react";
import { categoryColor, dayShort, MARK_LABELS, money, shortAccount, type Mark, type Transaction } from "../../../shared/spending";

const GLYPHS: Record<string, string> = {
  Rent: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  "Food & drink": "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 4-3 7h3v11",
  Groceries: "M3 4h2l2 11h11l2-8H6M9 20h.01M17 20h.01",
  Shopping: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
  "Transport & rides": "M5 16h14M6 16l1.5-6h9L18 16M5 16v3M19 16v3",
  Travel: "M2 13l20-7-7 14-3-6z",
  Entertainment: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z",
  "Utilities & bills": "M13 2L4 14h7l-1 8 9-12h-7z",
  Health: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
  Home: "M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 12h18v5H3zM5 17v2M19 17v2",
  "Personal care": "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z",
  "Donations & fees": "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  "People & transfers": "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6",
};

export function CategoryIcon({ category, size = 40 }: { category: string; size?: number }) {
  const color = categoryColor(category);
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{ width: size, height: size, borderRadius: size * 0.34, color, background: `color-mix(in srgb, ${color} 15%, var(--surface))` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size / 2} height={size / 2} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={GLYPHS[category] ?? "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"} />
      </svg>
    </span>
  );
}

export function Card({ title, aside, children, className = "" }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`calm-card flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  small = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="inline-flex rounded-full bg-[var(--surface-2)] p-[3px]" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full font-bold ${small ? "px-3 py-1 text-[12px]" : "px-4 py-1.5 text-[13px]"} ${
            value === o.value ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--dim)] hover:text-[var(--text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, onRemove, label }: { children: ReactNode; onRemove: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] py-1.5 pl-3 pr-2.5 text-[13px] font-bold text-[var(--accent)]"
    >
      {children}
      <span aria-hidden="true" className="text-[15px] leading-none">×</span>
    </button>
  );
}

/**
 * One transaction as a dense, fully clickable row; clicking opens the mark
 * drawer. Marked rows show what came back and your share.
 */
export function TxnRow({
  txn,
  mark,
  onOpen,
  showDate = false,
}: {
  txn: Transaction;
  mark: Mark | undefined;
  onOpen: (txn: Transaction) => void;
  showDate?: boolean;
}) {
  const sub = [showDate ? dayShort(txn.date) : null, txn.category, shortAccount(txn.account, true)].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(txn)}
        className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] px-3 py-2 text-left hover:bg-[var(--bg)] focus-visible:bg-[var(--bg)]"
        aria-label={`${txn.name}, ${money(txn.amount)}, ${sub}${mark ? `, ${MARK_LABELS[mark.mark_type]} ${money(mark.amount)}` : ""}. Open to mark money back.`}
      >
        <CategoryIcon category={txn.category} size={32} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-bold">{txn.name}</span>
            {txn.brex_eligible && (
              <span className="shrink-0 rounded-full bg-[var(--amber-soft)] px-1.5 py-px text-[10.5px] font-bold text-[var(--amber)]">Brex</span>
            )}
            {txn.pending && (
              <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-1.5 py-px text-[10.5px] font-bold text-[var(--dim)]">Pending</span>
            )}
          </span>
          <span className="block truncate text-[12.5px] text-[var(--dim)]">{sub}</span>
        </span>
        <span className="num flex flex-col items-end">
          <span className={`text-[14.5px] font-bold ${mark ? "text-[12.5px] text-[var(--dim-2)] line-through" : ""}`}>{money(txn.amount)}</span>
          {mark && (
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-px text-[10.5px] font-bold text-[var(--accent)]">
                {MARK_LABELS[mark.mark_type]}
              </span>
              <span className="text-[14.5px] font-bold">{money(Math.max(0, txn.amount - mark.amount))}</span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
