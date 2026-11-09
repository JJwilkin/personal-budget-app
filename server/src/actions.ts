import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
import * as schema from "./schema";
import { canRefreshFromPlaid, getSeedDataset } from "./dataSource";

const txnSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1),
  category: z.string().min(1),
  account: z.string().min(1),
  amount: z.number(),
  pending: z.boolean(),
  brex_eligible: z.boolean(),
});

const metaSchema = z.object({
  asOf: z.string(),
  accounts: z.array(
    z.object({ label: z.string(), balance: z.string(), owed: z.boolean() }),
  ),
  brexDeposits: z.array(
    z.object({ date: z.string(), payer: z.string(), amount: z.number() }),
  ),
  brexReceivedByMonth: z.record(z.string(), z.number()),
  recurring: z.array(
    z.object({
      name: z.string(),
      detail: z.string(),
      amount: z.number(),
      cadence: z.string(),
    }),
  ),
});

const budgetSchema = z.object({
  /** Monthly everyday-spending budget in dollars. Rent is outside the budget. */
  monthly: z.number().positive(),
});

const dashboardResponse = z.object({
  seeded: z.boolean(),
  meta: metaSchema.nullable(),
  budget: budgetSchema.nullable(),
  transactions: z.array(txnSchema),
  marks: z.array(
    z.object({
      transaction_id: z.string(),
      mark_type: z.enum(["paid_back", "reimbursed", "refunded"]),
      amount: z.number(),
      note: z.string(),
      updated_at: z.string(),
    }),
  ),
});

type Dashboard = z.infer<typeof dashboardResponse>;

async function loadDashboard(ctx: Ctx): Promise<Dashboard> {
  const db = ctx.db<typeof schema>();
  const [txnRows, markRows, metaRows, budgetRows] = await Promise.all([
    db.select().from(schema.transactions).orderBy(asc(schema.transactions.txnDate)),
    db.select().from(schema.marks),
    db.select().from(schema.meta).where(eq(schema.meta.key, "dashboard")),
    db.select().from(schema.meta).where(eq(schema.meta.key, "budget")),
  ]);
  const metaRow = metaRows[0];
  let meta: Dashboard["meta"] = null;
  if (metaRow) {
    const parsed = metaSchema.safeParse(JSON.parse(metaRow.value));
    meta = parsed.success ? parsed.data : null;
  }
  let budget: Dashboard["budget"] = null;
  const budgetRow = budgetRows[0];
  if (budgetRow) {
    const parsed = budgetSchema.safeParse(JSON.parse(budgetRow.value));
    budget = parsed.success ? parsed.data : null;
  }
  return {
    seeded: txnRows.length > 0,
    meta,
    budget,
    transactions: txnRows.map((r) => ({
      id: r.id,
      date: r.txnDate,
      name: r.name,
      category: r.category,
      account: r.account,
      amount: r.amount,
      pending: r.pending === 1,
      brex_eligible: r.brexEligible === 1,
    })),
    marks: markRows.map((r) => ({
      transaction_id: r.transactionId,
      mark_type: r.markType,
      amount: r.amount,
      note: r.note,
      updated_at: r.updatedAt.toISOString(),
    })),
  };
}

export const Actions = {
  getDashboard: defineAction({
    description:
      "Returns all stored spending transactions, the user's payback marks, and dashboard metadata (balances, Brex history, recurring bills).",
    request: z.object({}),
    response: dashboardResponse,
    async handler(ctx) {
      return loadDashboard(ctx);
    },
  }),

  seedIfEmpty: defineAction({
    description:
      "Seeds the spending transactions and dashboard metadata from the bundled dataset for the current data source (sample data in mock mode, the Plaid snapshot in the hosted build), only when the transactions table is empty. Never overwrites marks or existing rows.",
    request: z.object({}),
    response: z.object({ seeded: z.boolean(), count: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select({ id: schema.transactions.id })
        .from(schema.transactions);
      if (existing.length > 0) {
        return { seeded: false, count: existing.length };
      }
      const { transactions, meta } = getSeedDataset();
      for (const t of transactions) {
        await db.insert(schema.transactions).values({
          id: t.id,
          txnDate: t.date,
          name: t.name,
          category: t.category,
          account: t.account,
          amount: t.amount,
          pending: t.pending ? 1 : 0,
          brexEligible: t.brex_eligible ? 1 : 0,
        });
      }
      await db.insert(schema.meta).values({
        key: "dashboard",
        value: JSON.stringify(meta),
      });
      ctx.invalidateQueries();
      return { seeded: true, count: transactions.length };
    },
  }),

  saveMark: defineAction({
    description:
      "Saves or updates the user's payback mark (paid back by others, reimbursed, or refunded) for one transaction, so it syncs to every device.",
    request: z.object({
      transaction_id: z.string().min(1),
      mark_type: z.enum(["paid_back", "reimbursed", "refunded"]),
      amount: z.number().min(0),
      note: z.string().max(200).default(""),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      await db
        .insert(schema.marks)
        .values({
          transactionId: args.transaction_id,
          markType: args.mark_type,
          amount: args.amount,
          note: args.note,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.marks.transactionId,
          set: {
            markType: args.mark_type,
            amount: args.amount,
            note: args.note,
            updatedAt: now,
          },
        });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setBudget: defineAction({
    description:
      "Sets the user's monthly everyday-spending budget (rent excluded), or removes it when monthly is null. Safe to spend is worked out from it on the client.",
    request: z.object({ monthly: z.number().positive().max(1_000_000).nullable() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      if (args.monthly === null) {
        await db.delete(schema.meta).where(eq(schema.meta.key, "budget"));
      } else {
        const value = JSON.stringify({ monthly: Math.round(args.monthly * 100) / 100 });
        await db
          .insert(schema.meta)
          .values({ key: "budget", value })
          .onConflictDoUpdate({ target: schema.meta.key, set: { value } });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  clearMark: defineAction({
    description: "Removes the user's payback mark from one transaction.",
    request: z.object({ transaction_id: z.string().min(1) }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.marks)
        .where(eq(schema.marks.transactionId, args.transaction_id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  saveRefreshedTransactions: defineAction({
    description:
      "Upserts refreshed spending transactions (by transaction id) and updated dashboard metadata, preserving all existing marks. Used by the Plaid refresh task.",
    request: z.object({
      transactions: z.array(txnSchema).max(2000),
      meta: metaSchema,
    }),
    response: z.object({ saved: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      for (const t of args.transactions) {
        await db
          .insert(schema.transactions)
          .values({
            id: t.id,
            txnDate: t.date,
            name: t.name,
            category: t.category,
            account: t.account,
            amount: t.amount,
            pending: t.pending ? 1 : 0,
            brexEligible: t.brex_eligible ? 1 : 0,
          })
          .onConflictDoUpdate({
            target: schema.transactions.id,
            set: {
              txnDate: t.date,
              name: t.name,
              category: t.category,
              account: t.account,
              amount: t.amount,
              pending: t.pending ? 1 : 0,
              brexEligible: t.brex_eligible ? 1 : 0,
            },
          });
      }
      await db
        .insert(schema.meta)
        .values({ key: "dashboard", value: JSON.stringify(args.meta) })
        .onConflictDoUpdate({
          target: schema.meta.key,
          set: { value: JSON.stringify(args.meta) },
        });
      ctx.invalidateQueries();
      return { saved: args.transactions.length };
    },
  }),

  refreshFromPlaid: defineAction({
    description:
      "Starts a background task that re-reads the user's linked accounts via Plaid and saves any new spending transactions, preserving marks. Only available when the data source is Plaid (the Muse-hosted build); in mock mode it returns started: false.",
    request: z.object({}),
    response: z.object({ started: z.boolean(), taskId: z.string().nullable() }),
    async handler(ctx) {
      if (!canRefreshFromPlaid) {
        // Mock mode (local dev / Claude Code): there is no Plaid connection
        // here, so there is nothing to refresh from. The client shows a
        // message for this instead of pretending a refresh started.
        return { started: false, taskId: null };
      }
      const message = [
        "Refresh the spending dashboard from the user's linked Plaid accounts.",
        "Read the Plaid connector doc at /opt/hatch/connectors/plaid/CONNECTOR.md and run `plaid status` first; if any institution needs reauth, stop and report that instead of saving partial data.",
        "Pull transactions from the last three months through today with `plaid transactions-get`, plus `plaid accounts` for balances.",
        "Build the spending set exactly as the existing dashboard does: positive outflows only; exclude credit-card payments and transfers between the user's own accounts, and exclude any duplicate rent pass-through; count rent once from the checking-account housing debit, shown net of the roommate's transfers for that rent cycle; exclude shared household bills (car insurance, electric and internet charges, tracked separately). Categories: map Plaid personal_finance_category to Food & drink, Groceries, Shopping, Transport & rides, Travel, Entertainment, Donations & fees, Health, Home, Personal care, People & transfers, Rent, Other (groceries detail maps to Groceries). Brex-eligible means the merchant is Uber, Lime or DoorDash. Brex received per month is the sum of actual BREX REIMB deposits landing in checking that month — never the eligible charges.",
        "Then save the full transaction list (id = Plaid transaction_id, rent rows use ids rent-YYYY-MM) and updated meta (asOf as YYYY-MM-DD, account balances, full Brex deposit history, brexReceivedByMonth, recurring bills) via the save action named in your instructions. Do not touch marks; the save action preserves them.",
      ].join("\n");
      const result = await ctx.agent.spawnTask(message, {
        expectsAction: "saveRefreshedTransactions",
        dedupeKey: "plaid-refresh",
      });
      return {
        started: result.ok,
        taskId: result.ok ? result.taskId : null,
      };
    },
  }),
} satisfies ActionsModule;
