// Data source selection for the spending dashboard.
//
// The app has two modes:
//
// - "mock" (default): the seed dataset is the invented sample data in
//   ./seedData.ts, and refreshFromPlaid is disabled. This is the mode for
//   local development and for Claude Code: `bun run dev` serves the site
//   with sample data, no credentials, no bank connections. Nothing here
//   can reach a real account.
//
// - "plaid": the seed dataset is the real Plaid snapshot bundled with the
//   Muse-hosted build, and refreshFromPlaid re-reads the linked Plaid
//   accounts through Muse's Plaid connector.
//
// Set the mode with the DATA_SOURCE environment variable. A plain checkout
// defaults to "mock" so real account data is never pulled by accident.
// The hosted Muse build sets DATA_SOURCE=plaid (see "Data sources" in the
// README); the only other difference between the two builds is the
// seedData.ts file itself, which is sample data here and the real snapshot
// there. That file is never committed to this repo with real data in it.
//
// To pull real Plaid data outside Muse, you need your own Plaid API keys
// (see "Connecting Plaid" in the README) and an adapter that returns
// { transactions, meta } in the seed shape (txnSchema and metaSchema in
// actions.ts). Point getSeedDataset() at that adapter and set
// DATA_SOURCE=plaid.
import { SEED_META, SEED_TRANSACTIONS } from "./seedData";

export type DataSourceMode = "mock" | "plaid";

export const DATA_SOURCE: DataSourceMode =
  process.env.DATA_SOURCE === "plaid" ? "plaid" : "mock";

export const isMockData = DATA_SOURCE === "mock";
export const canRefreshFromPlaid = DATA_SOURCE === "plaid";

export function getSeedDataset() {
  // The bundled dataset: invented sample data in this repo, the real Plaid
  // snapshot in the Muse-hosted build. seedIfEmpty only ever reads it when
  // the transactions table is empty, so it never overwrites real data or
  // the user's marks.
  return { transactions: SEED_TRANSACTIONS, meta: SEED_META };
}
