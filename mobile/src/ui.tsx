import { useEffect, useState, type ReactNode } from "react";
import { categoryColor, dayShort, MARK_LABELS, money, type Mark, type Transaction } from "./data";

// ---------- glyphs ----------

const CATEGORY_GLYPHS: Record<string, string> = {
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
const OTHER_GLYPH = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";

export function Glyph({ d, strokeWidth = 2 }: { d: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function CategoryIcon({ category }: { category: string }) {
  return (
    <span className="icon" style={{ ["--cat" as string]: categoryColor(category) }} aria-hidden="true">
      <Glyph d={CATEGORY_GLYPHS[category] ?? OTHER_GLYPH} strokeWidth={2.2} />
    </span>
  );
}

export function Chevron({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg className="row-chevron" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "right" ? "M1 1l6 6-6 6" : "M7 1L1 7l6 6"} />
    </svg>
  );
}

// ---------- layout ----------

function useScrolled(threshold = 36): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

/** Translucent bar with a large title underneath that collapses into it on scroll. */
export function Screen({
  title,
  subtitle,
  leading,
  trailing,
  children,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const scrolled = useScrolled();
  return (
    <main className="screen">
      <header className={`navbar${scrolled ? " scrolled" : ""}`}>
        <div className="navbar-row">
          <div>{leading}</div>
          <div className="navbar-title" aria-hidden="true">{title}</div>
          <div>{trailing}</div>
        </div>
      </header>
      <h1 className="large-title">{title}</h1>
      {subtitle && <p className="large-subtitle">{subtitle}</p>}
      <div className="content">{children}</div>
    </main>
  );
}

export function Section({
  header,
  footer,
  children,
  plain = false,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <section className="section">
      {header && <h2 className="section-header">{header}</h2>}
      {plain ? children : <div className="group">{children}</div>}
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  );
}

/** Bar buttons for the previous and next month ("‹ Oct", "Dec ›"). */
export function monthButtons({
  previous,
  next,
  previousLabel,
  nextLabel,
  onChange,
}: {
  previous: string | null;
  next: string | null;
  previousLabel: string;
  nextLabel: string;
  onChange: (month: string) => void;
}): { leading: ReactNode; trailing: ReactNode } {
  return {
    leading: (
      <button
        type="button"
        className="bar-button"
        disabled={!previous}
        onClick={() => previous && onChange(previous)}
        aria-label={previous ? `Show ${previousLabel}` : "No earlier month"}
      >
        <Chevron direction="left" />
        {previous ? previousLabel.slice(0, 3) : ""}
      </button>
    ),
    trailing: (
      <button
        type="button"
        className="bar-button"
        disabled={!next}
        onClick={() => next && onChange(next)}
        aria-label={next ? `Show ${nextLabel}` : "No later month"}
      >
        {next ? nextLabel.slice(0, 3) : ""}
        <Chevron />
      </button>
    ),
  };
}

// ---------- rows ----------

export function TxnRow({
  txn,
  mark,
  showDate = false,
  onOpen,
}: {
  txn: Transaction;
  mark: Mark | undefined;
  showDate?: boolean;
  onOpen?: (txn: Transaction) => void;
}) {
  const sub = mark
    ? `${MARK_LABELS[mark.mark_type]} ${money(mark.amount)}`
    : `${showDate ? `${dayShort(txn.date)} · ` : ""}${txn.category} · ${txn.account}`;
  const body = (
    <>
      <CategoryIcon category={txn.category} />
      <span className="row-main">
        <span className="row-title">
          <span>{txn.name}</span>
          {txn.brex_eligible && <span className="badge orange">Brex</span>}
          {txn.pending && <span className="badge gray">Pending</span>}
        </span>
        <span className={`row-sub${mark ? " green" : ""}`}>{sub}</span>
      </span>
      <span className="row-end">
        <span className={`num${mark ? " strike" : ""}`}>{money(txn.amount)}</span>
        {mark && <span className="num" style={{ fontWeight: 600, fontSize: 15 }}>{money(Math.max(0, txn.amount - mark.amount))}</span>}
      </span>
    </>
  );
  if (!onOpen) {
    return <div className="row" style={{ ["--inset" as string]: "58px" }}>{body}</div>;
  }
  return (
    <button
      type="button"
      className="row"
      style={{ ["--inset" as string]: "58px" }}
      onClick={() => onOpen(txn)}
      aria-label={`${txn.name}, ${money(txn.amount)}${mark ? `, ${sub}` : ""}. Mark money back.`}
    >
      {body}
    </button>
  );
}
