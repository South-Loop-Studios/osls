import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLayout } from "../index";
import { formatsForLayout } from "../profiles";

const here = dirname(fileURLToPath(import.meta.url));
const layoutsDir = join(here, "../../../../layouts");
const files = readdirSync(layoutsDir).filter((f) => f.endsWith(".osls"));

describe("profile conformance", () => {
  it.each(files)("%s: inline orderings removed; every profile format projects to a complete permutation", (file) => {
    const l = parseLayout(readFileSync(join(layoutsDir, file), "utf8"));
    expect(Object.keys(l.orderings)).toEqual([]); // migration removed inline orderings
    for (const fmt of formatsForLayout(l.id)) {
      const o = l.ordering(fmt);
      expect(o.source).toBe("profile");
      expect(o.complete).toBe(true);
      expect(o.missing).toEqual([]);
      expect(o.ids.length).toBe(l.channelCount);
      expect(new Set(o.ids).size).toBe(l.channelCount);
    }
  });

  it("pins the 7.1.4 adm and iamf orders", () => {
    const l = parseLayout(readFileSync(join(layoutsDir, "7.1.4.osls"), "utf8"));
    expect(l.ordering("adm").ids).toEqual(["L", "R", "C", "LFE", "Lss", "Rss", "Lrs", "Rrs", "Ltf", "Rtf", "Ltb", "Rtb"]);
    expect(l.ordering("iamf").ids).toEqual(["L", "C", "R", "Lss", "Rss", "Lrs", "Rrs", "Ltf", "Rtf", "Ltb", "Rtb", "LFE"]);
  });
});
