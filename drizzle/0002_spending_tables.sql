DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  txn_date TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  account TEXT NOT NULL,
  amount REAL NOT NULL,
  pending INTEGER NOT NULL DEFAULT 0,
  brex_eligible INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE marks (
  transaction_id TEXT PRIMARY KEY,
  mark_type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
