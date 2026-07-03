import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { parseLayout } from "@orbitspatial/osls-core";
import { createServer } from "../server";

async function connect() {
  const { server } = createServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}
const text = (r: any) => r.content.find((c: any) => c.type === "text").text;

describe("@orbitspatial/osls-mcp server", () => {
  it("lists the expected tools and resources", async () => {
    const c = await connect();
    const tools = (await c.listTools()).tools.map((t) => t.name);
    for (const t of ["new_layout", "add_speaker", "set_ordering", "export_osls", "label_position", "list_presets"])
      expect(tools).toContain(t);
    const res = (await c.listResources()).resources.map((r) => r.uri);
    expect(res).toContain("osls://schema");
  });

  it("builds a layout and exports valid .osls", async () => {
    const c = await connect();
    await c.callTool({ name: "new_layout", arguments: { id: "t", name: "T" } });
    await c.callTool({ name: "add_speaker", arguments: { label: "L", sp: "M+030" } });
    await c.callTool({ name: "add_speaker", arguments: { label: "R", sp: "M-030" } });
    await c.callTool({ name: "set_ordering", arguments: { spec: "adm", ids: ["L", "R"] } });
    const out = await c.callTool({ name: "export_osls", arguments: {} });
    expect(out.isError).toBeFalsy();
    expect(() => parseLayout(text(out))).not.toThrow();
  });

  it("label_position returns the nearest SP-label", async () => {
    const c = await connect();
    const r = await c.callTool({ name: "label_position", arguments: { az: 30, el: 0 } });
    expect((r as any).structuredContent.sp).toBe("M+030");
  });

  it("export on an empty layout returns isError, not a throw", async () => {
    const c = await connect();
    await c.callTool({ name: "new_layout", arguments: { id: "x", name: "X" } });
    const r = await c.callTool({ name: "export_osls", arguments: {} });
    expect(r.isError).toBe(true);
  });

  it("update_speaker rename cascades into orderings", async () => {
    // Blessed presets carry no inline orderings (profiles are the source).
    // Use a custom layout with an explicit inline ordering to test cascade logic.
    const c = await connect();
    await c.callTool({ name: "new_layout", arguments: { id: "custom", name: "Custom" } });
    await c.callTool({ name: "add_speaker", arguments: { label: "L", sp: "M+030" } });
    await c.callTool({ name: "add_speaker", arguments: { label: "R", sp: "M-030" } });
    await c.callTool({ name: "set_ordering", arguments: { spec: "adm", ids: ["L", "R"] } });
    await c.callTool({ name: "update_speaker", arguments: { id: "L", newId: "Left" } });
    const r = await c.callTool({ name: "get_layout", arguments: {} });
    const layout = JSON.parse(text(r)).layout;
    // The adm ordering should reference "Left" and not "L"
    const adm = layout.orderings?.adm ?? [];
    expect(adm).toContain("Left");
    expect(adm).not.toContain("L");
  });
});
