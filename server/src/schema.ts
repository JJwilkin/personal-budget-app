import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  txnDate: text("txn_date").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  account: text("account").notNull(),
  amount: real("amount").notNull(),
  pending: integer("pending").notNull().default(0),
  brexEligible: integer("brex_eligible").notNull().default(0),
});

export const marks = sqliteTable("marks", {
  transactionId: text("transaction_id").primaryKey(),
  markType: text("mark_type", {
    enum: ["paid_back", "reimbursed", "refunded"],
  }).notNull(),
  amount: real("amount").notNull(),
  note: text("note").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
