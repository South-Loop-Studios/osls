import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@orbitspatial/osls-core": resolve(import.meta.dirname, "../ts/src/index.ts") } },
  test: { environment: "node" },
});
