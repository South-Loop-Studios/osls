import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "node:child_process";
import { createServer } from "./server";

// Best-effort browser open; failure is non-fatal (the URL is already on stderr).
function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* ignore */
  }
}

const argv = process.argv.slice(2);
const wantView = argv.includes("--view");
const portIdx = argv.indexOf("--port");
const port = portIdx >= 0 ? Number(argv[portIdx + 1]) : 7777;
const wantOpen = argv.includes("--open");

const { server, session } = createServer();
await server.connect(new StdioServerTransport());

if (wantView) {
  // Dynamically imported so plain stdio usage never loads the HTTP/WS code or ws.
  const { startViewer } = await import("./view/server.js");
  const viewer = await startViewer(session, { port });
  process.stderr.write(`OSLS live view: ${viewer.url}\n`);
  if (wantOpen) openBrowser(viewer.url);
}
