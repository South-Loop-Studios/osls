import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nearestLabel, positionForLabel } from "@orbitspatial/osls-core";
import type { Session } from "./session";
import { PRESETS } from "./assets.generated";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> };
}
function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}
const issues = (s: Session) => s.validate();

export function registerTools(server: McpServer, s: Session) {
  const POS = { az: z.number().optional(), el: z.number().optional(), dist: z.number().optional(), x: z.number().optional(), y: z.number().optional(), z: z.number().optional() };

  server.registerTool("new_layout", { description: "Start a fresh working layout.", inputSchema: { id: z.string().optional(), name: z.string().optional(), vendor: z.string().optional(), description: z.string().optional() } },
    async (a) => { s.newLayout(a); return ok({ layout: s.get(), issues: issues(s) }); });

  server.registerTool("load_preset", { description: "Load a blessed layout by key (see list_presets).", inputSchema: { key: z.string() } },
    async ({ key }) => { try { s.loadPreset(key); } catch (e) { return fail((e as Error).message); } return ok({ layout: s.get() }); });

  server.registerTool("import_osls", { description: "Parse .osls text into the working layout.", inputSchema: { text: z.string() } },
    async ({ text }) => { try { s.import(text); } catch (e) { return fail((e as Error).message); } return ok({ layout: s.get() }); });

  server.registerTool("add_speaker", { description: "Add a speaker. Prefer an `sp` SP-label (e.g. M+030) for standard positions; else az/el or x/y/z.", inputSchema: { label: z.string(), sp: z.string().optional(), lfe: z.boolean().optional(), aliases: z.array(z.string()).optional(), id: z.string().optional(), ...POS } },
    async (a) => { let sp; try { sp = s.addSpeaker(a); } catch (e) { return fail((e as Error).message); } return ok({ speaker: sp, issues: issues(s) }); });

  server.registerTool("move_speaker", { description: "Update a speaker's position (az/el/dist or x/y/z).", inputSchema: { id: z.string(), ...POS } },
    async ({ id, ...pos }) => { let sp; try { sp = s.moveSpeaker(id, pos); } catch (e) { return fail((e as Error).message); } return ok({ speaker: sp, issues: issues(s) }); });

  server.registerTool("update_speaker", { description: "Update a speaker's identity (id renames cascade into orderings).", inputSchema: { id: z.string(), newId: z.string().optional(), label: z.string().optional(), sp: z.string().optional(), lfe: z.boolean().optional(), aliases: z.array(z.string()).optional() } },
    async ({ id, newId, ...rest }) => { let sp; try { sp = s.updateSpeaker(id, { id: newId, ...rest }); } catch (e) { return fail((e as Error).message); } return ok({ speaker: sp, issues: issues(s) }); });

  server.registerTool("remove_speaker", { description: "Remove a speaker.", inputSchema: { id: z.string() } },
    async ({ id }) => { try { s.removeSpeaker(id); } catch (e) { return fail((e as Error).message); } return ok({ layout: s.get() }); });

  server.registerTool("reorder_speakers", { description: "Set the native (speaker-list) order. ids must be the full set.", inputSchema: { ids: z.array(z.string()) } },
    async ({ ids }) => { s.reorderSpeakers(ids); return ok({ layout: s.get(), issues: issues(s) }); });

  server.registerTool("set_ordering", { description: "Set a spec's channel order (a permutation of the speaker ids), e.g. spec=adm or iamf.", inputSchema: { spec: z.string(), ids: z.array(z.string()) } },
    async ({ spec, ids }) => { s.setOrdering(spec, ids); return ok({ orderings: s.get().orderings, issues: issues(s) }); });

  server.registerTool("get_layout", { description: "Return the current working layout + validation issues.", inputSchema: {} },
    async () => ok({ layout: s.get(), issues: issues(s) }));

  server.registerTool("validate_layout", { description: "Run the SPEC §4 semantic checks on the working layout.", inputSchema: {} },
    async () => ok({ issues: issues(s) }));

  server.registerTool("label_position", { description: "Nearest ITU-R BS.2051 SP-label for an az/el position.", inputSchema: { az: z.number(), el: z.number() } },
    async ({ az, el }) => ok(nearestLabel(az, el)));

  server.registerTool("position_for_label", { description: "Nominal az/el for a BS.2051 SP-label (e.g. U+045).", inputSchema: { sp: z.string() } },
    async ({ sp }) => ok({ sp, position: positionForLabel(sp) }));

  server.registerTool("list_presets", { description: "List the blessed layouts (keys) available to load_preset.", inputSchema: {} },
    async () => ok({ presets: Object.keys(PRESETS).sort() }));

  server.registerTool("export_osls", { description: "Serialize the working layout to .osls text (validates first).", inputSchema: { frame: z.enum(["asAuthored", "cartesian", "polar", "both"]).optional() } },
    async ({ frame }) => { try { return { content: [{ type: "text" as const, text: s.export(frame ?? "asAuthored") }] }; } catch (e) { return fail((e as Error).message); } });
}
