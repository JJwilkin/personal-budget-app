// Local preview build for the spending dashboard.
//
// This is the plain-Bun equivalent of the SDK's canonical client build
// (@hatch/space-sdk/build, `buildClient()`). It produces the same
// production-mode React bundle from client/index.html into client/dist/.
//
// It exists because buildClient() deliberately refuses to run by hand: a
// hand-built bundle cannot publish the hosted web artifact, and the SDK
// guards against that mistake. This script does not publish anything — it
// only builds the client so `bun run dev` can serve it locally for visual
// work. The hosted artifact keeps using client/build.mjs + buildClient()
// through the artifact tools, which run the full build-and-publish pipeline.
import { basename } from "node:path";
import tailwindPlugin from "bun-plugin-tailwind";

const ENTRY = "./client/index.html";
const OUTDIR = "./client/dist";

if (typeof Bun === "undefined" || typeof Bun.build !== "function") {
  throw new Error("local client build must run under Bun");
}

await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUTDIR,
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  naming: {
    asset: "assets/[name]-[hash].[ext]",
    chunk: "assets/[name]-[hash].[ext]",
    entry: "[name].[ext]",
  },
  plugins: [tailwindPlugin],
}).then(async (result) => {
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("local client build failed; see logged diagnostics");
  }
  // Bun writes imported assets to `assets/<name>-<hash>.<ext>` but emits
  // the JS/CSS import URL as a bare `./<name>-<hash>.<ext>`. Re-prefix only
  // the bare imported-asset URLs to `./assets/...`, matching the SDK build.
  const assetFiles = result.outputs
    .filter((output) => output.kind === "asset")
    .map((output) => basename(output.path));
  for (const output of result.outputs) {
    if (!/\.(js|css|html)$/.test(output.path)) {
      continue;
    }
    let text = await output.text();
    let changed = false;
    for (const name of assetFiles) {
      const bare = `./${name}`;
      if (text.includes(bare)) {
        text = text.split(bare).join(`./assets/${name}`);
        changed = true;
      }
    }
    if (changed) {
      await Bun.write(output.path, text);
    }
  }
  console.log(`client built -> ${OUTDIR}`);
});
