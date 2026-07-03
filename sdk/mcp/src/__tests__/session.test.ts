import { describe, it, expect } from "vitest";
import { parseLayout } from "@orbitspatial/osls-core";
import { Session } from "../session";

describe("Session", () => {
  it("builds a layout and exports valid .osls", () => {
    const s = new Session();
    s.newLayout({ id: "test", name: "Test" });
    s.addSpeaker({ label: "L", sp: "M+030" });     // sp resolves to az 30/el 0
    s.addSpeaker({ label: "R", sp: "M-030" });
    s.setOrdering("adm", ["L", "R"]);
    const text = s.export("asAuthored");
    const reparsed = parseLayout(text);            // must be valid
    expect(reparsed.channelCount).toBe(2);
    expect(reparsed.speaker("L")!.cartesian.x).toBeCloseTo(-0.5, 3); // az 30 -> x -0.5
  });

  it("authors both frames on add (export carries az/el AND x/y/z)", () => {
    const s = new Session();
    s.newLayout({ id: "t", name: "T" });
    const sp = s.addSpeaker({ label: "C", az: 0, el: 0 });
    expect(sp.authoredCartesian).toBeDefined();
    expect(sp.authoredPolar).toBeDefined();
  });

  it("loads a preset and round-trips it", () => {
    const s = new Session();
    s.loadPreset("7.1.4");
    expect(s.get().speakers.length).toBe(12);
    expect(() => parseLayout(s.export("asAuthored"))).not.toThrow();
  });

  it("cascades an id rename into orderings", () => {
    // Blessed presets carry no inline orderings (profiles are the source).
    // This test uses a custom layout with an explicit inline ordering so that
    // the cascade logic (updateSpeaker renames ids in orderings) is exercised.
    const s = new Session();
    s.newLayout({ id: "custom", name: "Custom" });
    s.addSpeaker({ label: "L", sp: "M+030" });
    s.addSpeaker({ label: "R", sp: "M-030" });
    s.setOrdering("adm", ["L", "R"]);
    s.updateSpeaker("L", { id: "Left" });
    expect(s.get().orderings.adm).toContain("Left");
    expect(s.get().orderings.adm).not.toContain("L");
  });

  it("validate() reports issues without throwing", () => {
    const s = new Session();
    s.newLayout({ id: "x", name: "X" });
    s.addSpeaker({ label: "A", sp: "M+090" });
    s.addSpeaker({ label: "B", sp: "M+090", az: 90, el: 0 }); // dup sp+pos ok; make a real issue:
    s.setOrdering("adm", ["A"]); // omits B -> not a permutation
    const issues = s.validate();
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("export throws OSLSError on an invalid layout", () => {
    const s = new Session();
    s.newLayout({ id: "x", name: "X" }); // zero speakers
    expect(() => s.export("asAuthored")).toThrow();
  });

  it("notifies onChange after each mutation with the current layout", () => {
    const s = new Session();
    const counts: number[] = [];
    s.onChange((l) => counts.push(l.speakers.length));
    s.newLayout({ id: "t", name: "T" });        // -> 0
    s.addSpeaker({ label: "L", sp: "M+030" });  // -> 1
    s.addSpeaker({ label: "R", sp: "M-030" });  // -> 2
    expect(counts).toEqual([0, 1, 2]);
  });

  it("onChange unsubscribe stops delivery, and reads never fire it", () => {
    const s = new Session();
    let n = 0;
    const off = s.onChange(() => { n++; });
    s.newLayout({ id: "t", name: "T" });         // fires -> 1
    s.get(); s.validate();                        // reads: no fire
    off();
    s.addSpeaker({ label: "L", sp: "M+030" });    // unsubscribed: no fire
    expect(n).toBe(1);
  });
});
