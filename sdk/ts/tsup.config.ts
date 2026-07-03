import { defineConfig } from "tsup";

// Bundles src/index.ts to ESM + .d.ts. The JSON Schema imported by src/schema.ts
// is inlined into the bundle by esbuild, so the published package is self-contained.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
