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

## Running it

This app was built to run inside the Muse artifact runtime, which provides
the `@hatch/space-sdk` package and the SQLite-backed action layer. The
`refreshFromPlaid` action is wired to Muse's Plaid connector and only works
there.

Outside that runtime, `bun install` and `bun run build` typecheck and bundle
the client and server, but the action layer needs a host that provides the
space SDK and a SQLite database.

## Out of pocket, precisely

- **Total spend** is the month's spending; **out of pocket** subtracts only
  reimbursements that actually landed as deposits that month. Eligible
  charges still waiting on reimbursement do not come off.
- Rent is shown at your share only, net of your roommate's transfer.
- Shared household bills (car insurance, electric, internet) are tracked
  separately and kept out of the spending totals.
