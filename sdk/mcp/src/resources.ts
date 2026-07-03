import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BS2051_TABLE1 } from "@orbitspatial/osls-core";
import type { Session } from "./session";
import { PRESETS, SCHEMA, SPEC_MD } from "./assets.generated";

export function registerResources(server: McpServer, s: Session) {
  server.registerResource("schema", "osls://schema", { title: "OSLS JSON Schema", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(SCHEMA, null, 2) }] }));

  server.registerResource("spec", "osls://spec", { title: "OSLS format specification", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, text: SPEC_MD }] }));

  server.registerResource("bs2051", "osls://bs2051", { title: "ITU-R BS.2051 SP-labels", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(BS2051_TABLE1, null, 2) }] }));

  server.registerResource("working-layout", "osls://working-layout", { title: "Current working layout (.osls)", mimeType: "text/yaml" },
    async (uri) => { let text: string; try { text = s.export("asAuthored"); } catch { text = "# (working layout is currently invalid or empty)"; } return { contents: [{ uri: uri.href, text }] }; });

  server.registerResource("preset", new ResourceTemplate("osls://presets/{key}", { list: undefined }), { title: "Blessed preset (.osls)", mimeType: "text/yaml" },
    async (uri, { key }) => { const text = PRESETS[String(key)]; if (!text) throw new Error(`unknown preset "${key}"`); return { contents: [{ uri: uri.href, text }] }; });
}
