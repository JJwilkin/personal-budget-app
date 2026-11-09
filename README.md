# Personal Budget App

A spending dashboard: monthly totals, day-by-day and week-by-week stacked
charts, a 3-day moving average of daily spend (rent excluded), category and
merchant breakdowns, and a Brex panel that tracks total spend vs out of pocket
using only reimbursements that have actually landed. Every transaction can be
marked as paid back by others, reimbursed, or refunded — with partial amounts
— and marks are saved server-side.

## Data

This repo ships with **invented sample data only** (`server/src/seedData.ts`).
No real transactions, balances, or personal details are committed. To use it
for real, replace `seedData.ts` with your own transactions in the same shape
and update the metadata (accounts, Brex deposits, recurring bills).

## Stack

- React 19 + TypeScript client (`client/`)
- Server actions + Drizzle ORM + SQLite (`server/`, `drizzle/`)
- Tailwind CSS, Recharts, TanStack Query
- Bun

## Layout

- `client/src/App.tsx` — the whole dashboard UI
- `client/src/api.ts` — typed RPC client for the server actions
- `server/src/actions.ts` — `getDashboard`, `saveMark`, `clearMark`,
  `seedIfEmpty`, `saveRefreshedTransactions`, `refreshFromPlaid`
- `server/src/schema.ts` — Drizzle tables: `transactions`, `marks`, `meta`
- `server/src/seedData.ts` — sample seed data (replace with your own)
- `drizzle/` — SQL migrations

## Local preview (mock data)

```text
bun install
bun run dev
```

This builds the client and serves the dashboard at http://localhost:5173,
backed by a local SQLite file (`dev.db`, gitignored) seeded from the sample
data. The build step uses `scripts/build-client.mjs`, the plain-Bun
equivalent of the SDK's client build — the SDK's own `build:client` refuses
to run by hand, since a hand-built bundle cannot publish the hosted
artifact. Marks you make save to `dev.db` and survive restarts; delete it to
reset to a clean sample slate. This is how to work on the site visually —
no credentials, no bank connections.

## Data sources

The data layer has one switch: `DATA_SOURCE`, defined in
`server/src/dataSource.ts`.

- `mock` (default): the seed dataset is the invented sample data in
  `server/src/seedData.ts`, and Refresh is disabled — it answers
  `started: false` and the UI says so. A plain checkout never touches a
  real account.
- `plaid`: the seed dataset is the real Plaid snapshot bundled with the
  Muse-hosted build, and Refresh re-reads the linked Plaid accounts.
  Set it with `DATA_SOURCE=plaid`. In this repo `seedData.ts` is sample
  data only, so plaid mode here has nothing real to seed from — real data
  lives in the hosted build.

The dashboard always reads from its SQLite database, never directly from
Plaid. Plaid is only ever a source for seeding and refreshing that database.

## Connecting Plaid

Real data flows through the Muse-hosted version:

1. Connect your bank accounts to Muse through Plaid (Chase, Capital One,
   Bilt, or any Plaid-supported institution).
2. The hosted dashboard seeds once from that Plaid snapshot.
3. The Refresh button calls `refreshFromPlaid`, which re-reads the linked
   accounts through Muse's Plaid connector and saves new transactions
   without touching your marks.

To pull real Plaid data outside Muse, you need your own Plaid API keys:
create an app in the Plaid Dashboard to get a client ID and secret, then
create an access token for each account (Plaid Link in development mode).
Set `PLAID_CLIENT_ID`, `PLAID_SECRET`, and the access token(s) in your
environment, implement an adapter in `server/src/dataSource.ts` that returns
`{ transactions, meta }` in the seed shape (`txnSchema` and `metaSchema` in
`server/src/actions.ts`), point `getSeedDataset()` at it, and run with
`DATA_SOURCE=plaid`. The adapter is intentionally a stub here — the
supported real-data path is the Muse-hosted version above.

## Running it

This app was built to run inside the Muse artifact runtime, which provides
the `@hatch/space-sdk` package and the SQLite-backed action layer. The
`refreshFromPlaid` action is wired to Muse's Plaid connector and only works
there.

Outside that runtime, `bun install` and `bun run build` typecheck and bundle
the client and server, and `bun run dev` serves the whole dashboard locally
on mock data as described above.

## Out of pocket, precisely

- **Total spend** is the month's spending; **out of pocket** subtracts only
  reimbursements that actually landed as deposits that month. Eligible
  charges still waiting on reimbursement do not come off.
- Rent is shown at your share only, net of your roommate's transfer.
- Shared household bills (car insurance, electric, internet) are tracked
  separately and kept out of the spending totals.
