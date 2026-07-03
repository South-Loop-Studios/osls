import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "./session";
import { registerTools } from "./tools";
import { registerResources } from "./resources";
import { registerPrompts } from "./prompts";

export function createServer(): { server: McpServer; session: Session } {
  const server = new McpServer({ name: "osls", version: "0.1.0" });
  const session = new Session();
  registerTools(server, session);
  registerResources(server, session);
  registerPrompts(server);
  return { server, session };
}
