// Local preview server for the spending dashboard.
//
// Serves the built client (client/dist) and answers the same ./actions
// endpoint the Muse-hosted version uses, backed by a local SQLite file
// (dev.db, gitignored) seeded from the current data source. Run it with:
//
//   bun run dev
//
// It calls the real action handlers from ./actions.ts with a local stand-in
// for the Muse runtime context, so what you see here is the same logic the
// hosted version runs — only the data source differs. In mock mode (the
// default) the data is the invented sample set in ./seedData.ts and
// refreshFromPlaid answers started: false, because there is no Plaid
// connection here. Marks you make are saved in dev.db and survive restarts;
// delete dev.db to start from a clean sample slate.
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "@hatch/space-sdk";
import { Actions } from "./actions";
import * as schema from "./schema";
import { DATA_SOURCE, isMockData } from "./dataSource";

const ROOT = join(import.meta.dir, "..", "..");
const DIST = join(ROOT, "client", "dist");
const DB_PATH = join(ROOT, "dev.db");
const PORT = Number(process.env.PORT ?? 5173);

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  txn_date TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  account TEXT NOT NULL,
  amount REAL NOT NULL,
  pending INTEGER NOT NULL DEFAULT 0,
  brex_eligible INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS marks (
  transaction_id TEXT PRIMARY KEY,
  mark_type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

const sqlite = new Database(DB_PATH);
sqlite.exec(CREATE_TABLES);
const db = drizzle(sqlite, { schema });

// Stand-in for the Muse runtime context: the handlers only touch db(),
// invalidateQueries() and (in plaid mode) agent.spawnTask().
const ctx = {
  slug: "personal-budget-app",
  invocationId: "dev",
  spaceDir: ROOT,
  db: () => db,
  invalidateQueries: () => {},
  agent: {
    spawnTask: async () => ({ ok: false as const, taskId: null as string | null }),
  },
} as unknown as Ctx;

await Actions.seedIfEmpty.handler(ctx, {});

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function contentType(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/actions") {
      const { action, args } = (await req.json()) as {
        action: string;
        args?: Record<string, unknown>;
      };
      const def = (Actions as Record<string, { handler: (ctx: Ctx, args: unknown) => Promise<unknown> }>)[action];
      if (!def) {
        return Response.json({ error: `unknown action: ${action}` }, { status: 404 });
      }
      try {
        const data = await def.handler(ctx, args ?? {});
        return Response.json({ data });
      } catch (e) {
        return Response.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 500 },
        );
      }
    }
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    let file = join(DIST, path);
    if (!existsSync(file) || !file.startsWith(DIST)) {
      file = join(DIST, "index.html");
    }
    if (!existsSync(file)) {
      return new Response(
        "Client not built yet. Run `bun run build:client:local` first.",
        { status: 500 },
      );
    }
    return new Response(readFileSync(file), {
      headers: { "content-type": contentType(file) },
    });
  },
});

console.log(`Spending dashboard (data source: ${DATA_SOURCE}${isMockData ? " — sample data" : ""})`);
console.log(`Open http://localhost:${server.port}`);
console.log("Marks save to dev.db; delete it to reset to a clean sample slate.");
