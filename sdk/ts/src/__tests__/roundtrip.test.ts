import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLayout, serializeLayout } from "../index";
import type { Layout } from "../layout";

// Read the 14 blessed layouts straight from the sibling ../layouts dir (the test
// runs in a node env). This proves the engine round-trips every shipped layout.
const here = dirname(fileURLToPath(import.meta.url));
const layoutsDir = join(here, "../../../../layouts");
const files = readdirSync(layoutsDir).filter((f) => f.endsWith(".osls"));

// A normalised view: only the load-bearing semantics, with floats rounded so
// derived-vs-authored precision noise doesn't matter. Authored-frame bookkeeping
// is intentionally excluded — we assert no *semantic* information is lost.
function normalize(l: Layout) {
  return {
    id: l.id,
    name: l.name,
    vendor: l.vendor,
    description: l.description,
    tags: l.tags,
    frame: l.frame ?? null,
    orderings: l.orderings,
    speakers: l.speakers.map((s) => ({
      id: s.id,
      label: s.label,
      sp: s.sp,
      isLFE: s.isLFE,
      aliases: [...s.aliases].sort(),
      x: round(s.cartesian.x),
      y: round(s.cartesian.y),
      z: round(s.cartesian.z),
    })),
  };
}

const round = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return r === 0 ? 0 : r; // coalesce -0 -> 0 so deep-equality isn't fooled by sign
};

describe("round-trip — all blessed layouts", () => {
  it("found the blessed layout set", () => {
    expect(files.length).toBeGreaterThanOrEqual(14);
  });

  it.each(files)("%s parses, serialises, and re-parses identically", (file) => {
    const text = readFileSync(join(layoutsDir, file), "utf8");

    const a = parseLayout(text);
    const yaml = serializeLayout(a.toData(), "asAuthored");
    const b = parseLayout(yaml);

    expect(normalize(b)).toEqual(normalize(a));
  });

  it("re-frames 7.1.4 to cartesian and polar without semantic loss", () => {
    const text = readFileSync(join(layoutsDir, "7.1.4.osls"), "utf8");
    const a = parseLayout(text);

    for (const frame of ["cartesian", "polar", "both"] as const) {
      const b = parseLayout(serializeLayout(a.toData(), frame));
      expect(normalize(b)).toEqual(normalize(a));
    }
  });
});
