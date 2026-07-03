import iamf from "../../../profiles/iamf.json";
import adm from "../../../profiles/adm.json";
import mpegh from "../../../profiles/mpegh.json";
import auro from "../../../profiles/auro-3d.json";
import type { OrderEntry, Profile } from "./types";

// The format registry. JSON is inlined by esbuild at build (same as src/schema.ts),
// so the published package is self-contained.
export const PROFILES: Record<string, Profile> = {
  iamf: iamf as Profile,
  adm: adm as Profile,
  mpegh: mpegh as Profile,
  "auro-3d": auro as Profile,
};

/** The order entries a format defines for a layout id, or null (unknown/stub). */
export function profileOrder(format: string, layoutId: string): OrderEntry[] | null {
  const p = PROFILES[format];
  if (!p || p.status === "stub") return null;
  return p.layouts?.[layoutId]?.order ?? null;
}

/** Normative formats (sorted) whose profile defines an order for this layout id. */
export function formatsForLayout(layoutId: string): string[] {
  return Object.keys(PROFILES)
    .filter((f) => PROFILES[f].status !== "stub" && !!PROFILES[f].layouts?.[layoutId]?.order)
    .sort();
}

export const spOf = (e: OrderEntry): string => (typeof e === "string" ? e : e.sp);
export const labelOf = (e: OrderEntry): string | undefined => (typeof e === "string" ? undefined : e.label);
