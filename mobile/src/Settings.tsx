import { useEffect } from "react";
import { dayLong, type Dashboard } from "../../shared/spending";
import { useLook } from "./look";
import { Section } from "./ui";

/** Accounts and app look, out of the way of the day-to-day screens. */
export function SettingsSheet({ data, onClose }: { data: Dashboard; onClose: () => void }) {
  const { look, setLook } = useLook();

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

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="sheet-bar">
          <span />
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="bar-button" onClick={onClose}>Done</button>
        </div>
        <div className="content">
          {data.meta && data.meta.accounts.length > 0 && (
            <Section header="Accounts" footer={`Balances are the banks' last reported figures, through ${dayLong(data.meta.asOf)}.`}>
              {data.meta.accounts.map((a) => (
                <div key={a.label} className="row">
                  <span className="row-main">{a.label}</span>
                  <span className="num" style={{ color: a.owed ? "var(--red)" : "var(--label-2)" }}>
                    {a.owed ? `${a.balance} owed` : a.balance}
                  </span>
                </div>
              ))}
            </Section>
          )}

          <Section header="Look" plain footer="Changes how the app looks on this device only.">
            <div className="segmented" role="group" aria-label="Look">
              <button type="button" aria-pressed={look === "ios"} onClick={() => setLook("ios")}>iOS</button>
              <button type="button" aria-pressed={look === "calm"} onClick={() => setLook("calm")}>Calm</button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
