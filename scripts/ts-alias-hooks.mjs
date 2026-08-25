/**
 * Lets plain `node` import this project's TypeScript modules directly, so the
 * money logic in src/lib can be tested without adding a test framework.
 *
 * Node 24 strips TypeScript types on its own; what it cannot do is resolve the
 * `@/` path alias from tsconfig, extensionless relative imports, or a bare JSON
 * import. These hooks fill those three gaps. Nothing here is used at runtime by
 * the app — it exists only so `node --import ./scripts/ts-alias-hooks.mjs ...`
 * works. See scripts/test-free-item-offer.mjs.
 */
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src") + "/";

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;
    if (specifier.startsWith("@/")) target = SRC + specifier.slice(2);
    else if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const base = new URL(specifier, context.parentURL);
      if (!/\.(ts|js|json|mjs)$/.test(base.pathname)) {
        const asTs = base.pathname.replace(/^\//, "") + ".ts";
        if (existsSync(asTs)) target = asTs;
      }
    }
    if (!target) return nextResolve(specifier, context);

    if (!/\.(ts|js|json|mjs)$/.test(target) && existsSync(target + ".ts")) target += ".ts";
    const url = pathToFileURL(target).href;
    // JSON needs an explicit import attribute in Node ESM; TS/bundler config
    // does it implicitly, so add it here rather than editing the source.
    if (url.endsWith(".json")) {
      return { url, format: "json", importAttributes: { type: "json" }, shortCircuit: true };
    }
    return { url, shortCircuit: true };
  },
});
