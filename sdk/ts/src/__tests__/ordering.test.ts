import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLayout } from "../index";

const here = dirname(fileURLToPath(import.meta.url));
const layoutsDir = join(here, "../../../../layouts");
const load = (f: string) => parseLayout(readFileSync(join(layoutsDir, f), "utf8"));

describe("Layout.ordering(format)", () => {
  it("projects a format order from the profile by sp", () => {
    const l = load("7.1.4.osls");
    l.orderings = {}; // simulate the migrated (inline-free) blessed file
    const o = l.ordering("iamf");
    expect(o.source).toBe("profile");
    expect(o.complete).toBe(true);
    expect(o.missing).toEqual([]);
    expect(o.ids).toEqual(["L", "C", "R", "Lss", "Rss", "Lrs", "Rrs", "Ltf", "Rtf", "Ltb", "Rtb", "LFE"]);
  });

  it("inline orderings override the profile (custom escape hatch)", () => {
    const l = load("7.1.4.osls");
    // an explicit custom order — different from the profile — must win, and must not
    // depend on the blessed file's own inline block (which Task 4 removes)
    l.orderings = { iamf: ["LFE", "C", "L", "R", "Lss", "Rss", "Lrs", "Rrs", "Ltf", "Rtf", "Ltb", "Rtb"] };
    const o = l.ordering("iamf");
    expect(o.source).toBe("inline");
    expect(o.ids[0]).toBe("LFE");
  });

  it("reports missing positions (the render-vs-permute signal)", () => {
    const l = parseLayout(
      `osls: 1\nid: "7.1.4"\nname: t\nspeakers:\n` +
        `  - { id: L, label: L, sp: M+030, az: 30, el: 0 }\n` +
        `  - { id: C, label: C, sp: M+000, az: 0, el: 0 }\n` +
        `  - { id: R, label: R, sp: M-030, az: -30, el: 0 }\n`,
    );
    const o = l.ordering("iamf");
    expect(o.source).toBe("profile");
    expect(o.complete).toBe(false);
    expect(o.ids).toEqual(["L", "C", "R"]);
    expect(o.missing).toContain("M+090");
    expect(o.missing).toContain("LFE1");
  });

  it("returns source 'none' for stub/unknown formats and non-profiled custom layouts", () => {
    const l = load("7.1.4.osls");
    l.orderings = {};
    expect(l.ordering("mpegh").source).toBe("none");
    const custom = parseLayout(`osls: 1\nid: "my-room"\nname: t\nspeakers:\n  - { id: A, label: A, sp: M+030, az: 30, el: 0 }\n`);
    expect(custom.ordering("iamf").source).toBe("none");
  });

  it("order(spec) and specs are profile-aware", () => {
    const l = load("5.1.osls");
    l.orderings = {};
    expect(l.order("iamf").map((s) => s.id)).toEqual(["L", "C", "R", "Ls", "Rs", "LFE"]);
    expect(l.specs).toEqual(["native", "adm", "iamf"]);
  });
});
