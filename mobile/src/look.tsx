import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** The app's two visual styles: iOS-native (default) and calm fintech. */
export type Look = "ios" | "calm";

const KEY = "budget-look";
const LookContext = createContext<{ look: Look; setLook: (look: Look) => void }>({
  look: "ios",
  setLook: () => {},
});

function stored(): Look {
  try {
    return localStorage.getItem(KEY) === "calm" ? "calm" : "ios";
  } catch {
    return "ios";
  }
}

export function LookProvider({ children }: { children: ReactNode }) {
  const [look, setLookState] = useState<Look>(stored);

  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);

  const setLook = (next: Look) => {
    setLookState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
  };

  return <LookContext.Provider value={{ look, setLook }}>{children}</LookContext.Provider>;
}

export const useLook = () => useContext(LookContext);
