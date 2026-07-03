import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Built assets are served by the MCP server from dist/viewer over any host:port,
// so base must be relative.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "../dist/viewer", emptyOutDir: true },
});
