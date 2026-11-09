import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { queryClient } from "./api";
import { App } from "./App";
import { LookProvider } from "./look";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LookProvider>
        <App />
      </LookProvider>
    </QueryClientProvider>
  </StrictMode>,
);
