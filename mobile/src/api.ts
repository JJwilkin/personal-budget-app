// Talks to the same server actions as the web dashboard: POST ./actions with
// { action, args }, answered by { data } or { error }. Marks saved here show
// up on the web dashboard and in the iOS app.
import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import type { Dashboard, MarkType } from "../../shared/spending";

async function call<T>(action: string, args: object = {}): Promise<T> {
  const res = await fetch("./actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  let body: { data?: T; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // Fall through to the status check below.
  }
  if (body.error) throw new Error(body.error);
  if (!res.ok || body.data === undefined) throw new Error(`The server answered with status ${res.status}.`);
  return body.data;
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
});

const DASHBOARD = ["dashboard"] as const;

export function useDashboard() {
  return useQuery({ queryKey: DASHBOARD, queryFn: () => call<Dashboard>("getDashboard") });
}

export function useSaveMark() {
  return useMutation({
    mutationFn: (args: { transaction_id: string; mark_type: MarkType; amount: number; note: string }) =>
      call<{ ok: true }>("saveMark", args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DASHBOARD }),
  });
}

export function useClearMark() {
  return useMutation({
    mutationFn: (transaction_id: string) => call<{ ok: true }>("clearMark", { transaction_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DASHBOARD }),
  });
}

export function useRefreshFromAccounts() {
  return useMutation({
    mutationFn: () => call<{ started: boolean; taskId: string | null }>("refreshFromPlaid"),
  });
}
