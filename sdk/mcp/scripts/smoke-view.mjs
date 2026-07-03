// E2e smoke for the built --view artifact: drive MCP over stdio + check the live view.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocket } from "ws";

const PORT = "7788";
const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js", "--view", "--port", PORT] });
const client = new Client({ name: "smoke", version: "0" });
await client.connect(transport);

const call = (name, args = {}) => client.callTool({ name, arguments: args });
await call("new_layout", { id: "smoke", name: "Smoke" });
await call("add_speaker", { label: "L", sp: "M+030" });
await call("add_speaker", { label: "R", sp: "M-030" });

// Give the viewer a moment to bind, then check the static page.
await new Promise((r) => setTimeout(r, 400));
const page = await fetch(`http://127.0.0.1:${PORT}/`);
const html = await page.text();
if (page.status !== 200 || !html.includes('id="root"')) throw new Error("viewer page did not serve");

// Check the /live snapshot reflects the layout built over MCP.
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/live`);
const snapshot = await new Promise((resolve, reject) => {
  ws.once("message", (d) => resolve(JSON.parse(d.toString())));
  ws.once("error", reject);
  setTimeout(() => reject(new Error("no snapshot within 2s")), 2000);
});
const ids = (snapshot.layout?.speakers ?? []).map((s) => s.id);
if (snapshot.type !== "layout" || ids.join(",") !== "L,R") throw new Error(`unexpected snapshot: ${JSON.stringify(ids)}`);

ws.close();
await client.close();
console.log("smoke-view OK: page served + /live snapshot =", ids.join(","));
