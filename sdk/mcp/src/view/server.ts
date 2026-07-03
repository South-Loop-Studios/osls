import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { Session } from "../session";
import type { LayoutData } from "@orbitspatial/osls-core";

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".woff2": "font/woff2",
};

// In the built artifact this module is dist/view/server.js, so ../viewer/ -> dist/viewer/.
const VIEWER_DIR = fileURLToPath(new URL("../viewer/", import.meta.url));

async function serveStatic(req: IncomingMessage, res: ServerResponse, dir: string): Promise<void> {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let rel = normalize(urlPath).replace(/^([/\\]|\.\.[/\\])+/, ""); // strip leading / and ../
  if (!rel || rel === "/" || rel === "\\") rel = "index.html";
  let file = join(dir, rel);
  let info = await stat(file).catch(() => null);
  if (!info?.isFile()) { file = join(dir, "index.html"); info = await stat(file).catch(() => null); }
  if (!info?.isFile()) { res.statusCode = 404; res.end("not found"); return; }
  res.setHeader("content-type", MIME[extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(res);
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (e: Error) => { server.removeListener("listening", onOk); reject(e); };
    const onOk = () => { server.removeListener("error", onError); resolve(); };
    server.once("error", onError);
    server.once("listening", onOk);
    server.listen(port, host);
  });
}

export interface Viewer { url: string; close(): Promise<void>; }

export async function startViewer(session: Session, opts: { port: number; staticDir?: string }): Promise<Viewer> {
  const dir = opts.staticDir ?? VIEWER_DIR;
  const httpServer = createHttpServer((req, res) => { void serveStatic(req, res, dir); });

  let bound = false;
  for (let p = opts.port; p <= opts.port + 10; p++) {
    try { await listen(httpServer, "127.0.0.1", p); bound = true; break; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EADDRINUSE" || p === opts.port + 10) throw e; }
  }
  if (!bound) throw new Error("could not bind a port for the OSLS live viewer");

  const addr = httpServer.address();
  const port = typeof addr === "object" && addr ? addr.port : opts.port;
  const url = `http://127.0.0.1:${port}`;

  const wss = new WebSocketServer({ server: httpServer, path: "/live" });
  const snapshot = (layout: LayoutData) => JSON.stringify({ type: "layout", layout });
  wss.on("connection", (ws) => ws.send(snapshot(session.get())));
  const unsub = session.onChange((layout) => {
    const msg = snapshot(layout);
    for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(msg);
  });

  return {
    url,
    close: () => new Promise<void>((resolve) => {
      unsub();
      for (const client of wss.clients) client.terminate();
      wss.close(() => httpServer.close(() => resolve()));
    }),
  };
}
