import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer) {
  server.registerPrompt("build-osls-layout", { description: "Build an .osls layout from a natural-language description.", argsSchema: { description: z.string() } },
    async ({ description }) => ({
      messages: [{ role: "user", content: { type: "text", text:
        `Build an OSLS speaker layout for this description, then export it.\n\nDescription: ${description}\n\n` +
        `Read the resources osls://schema and osls://bs2051 first. Use new_layout, then add_speaker for each ` +
        `speaker (prefer an \`sp\` BS.2051 SP-label like M+030/U+045 for standard positions; use az/el for ` +
        `non-standard ones). Set an \`adm\` ordering. Finally call export_osls and show the .osls. If ` +
        `validate_layout reports errors, fix them before exporting.` } }],
    }));
}
