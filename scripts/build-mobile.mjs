// Builds the mobile web app (mobile/) into mobile/dist/, served at /m/ by
// `bun run dev`. It's a separate client from the desktop dashboard, styled
// like a native iOS app and installable from Safari's "Add to Home Screen".
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const OUTDIR = "./mobile/dist";

if (typeof Bun === "undefined" || typeof Bun.build !== "function") {
  throw new Error("the mobile build must run under Bun");
}

rmSync(OUTDIR, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./mobile/index.html"],
  outdir: OUTDIR,
  minify: true,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  naming: {
    asset: "assets/[name]-[hash].[ext]",
    chunk: "assets/[name]-[hash].[ext]",
    entry: "[name].[ext]",
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("mobile build failed; see logged diagnostics");
}

// Manifest and home-screen icons are served as-is next to index.html, and
// linked from it here so the bundler leaves them alone.
cpSync("./mobile/public", OUTDIR, { recursive: true });
const indexPath = `${OUTDIR}/index.html`;
const headLinks = [
  '<link rel="manifest" href="./manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="./icon-180.png">',
  '<link rel="icon" type="image/png" href="./icon-192.png">',
].join("");
const html = readFileSync(indexPath, "utf8");
if (!html.includes("</head>")) throw new Error("built index.html has no </head>");
writeFileSync(indexPath, html.replace("</head>", `${headLinks}</head>`));
console.log(`mobile app built -> ${OUTDIR}`);
