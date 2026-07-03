import { defineConfig } from "tsup";

// Bundle to ESM with a node shebang so `osls-mcp` runs directly. @orbitspatial/osls-core is
// inlined from the sibling source. src/view/server.ts is a second entry so the
// dynamic import("./view/server.js") in index.ts resolves to dist/view/server.js.
// splitting: true keeps the viewer server lazily loaded — ws/node:http are NOT
// bundled into dist/index.js; they stay in dist/view/server.js and its chunks.
export default defineConfig({
  entry: ["src/index.ts", "src/view/server.ts"],
  format: ["esm"],
  platform: "neutral",
  splitting: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  noExternal: ["@orbitspatial/osls-core"],
  alias: { "@orbitspatial/osls-core": "../ts/src/index.ts" },
});
