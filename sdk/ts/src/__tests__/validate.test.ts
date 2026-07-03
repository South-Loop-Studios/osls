import { describe, it, expect } from "vitest";
import { semanticCheck } from "../validate";
import { parseLayout } from "../parse";
import { speaker } from "../speaker";
import { Layout } from "../layout";
import { OSLSError } from "../types";

function errors(issues: ReturnType<typeof semanticCheck>) {
  return issues.filter((i) => i.severity === "error");
}

describe("semanticCheck (SPEC §4)", () => {
  it("accepts a valid layout", () => {
    const l = new Layout({ id: "r", name: "R" });
    l.speakers = [
      speaker.cartesian("L", { sp: "M+030", x: -0.5, y: 0.866, z: 0 }),
      speaker.cartesian("R", { sp: "M-030", x: 0.5, y: 0.866, z: 0 }),
    ];
    l.orderings.adm = ["L", "R"];
    expect(errors(semanticCheck(l.toData()))).toHaveLength(0);
  });

  it("flags duplicate speaker ids", () => {
    const l = new Layout({ id: "r", name: "R" });
    l.speakers = [
      speaker.cartesian("L", { x: -0.5, y: 0.866, z: 0 }),
      speaker.cartesian("L", { x: 0.5, y: 0.866, z: 0 }),
    ];
    expect(errors(semanticCheck(l.toData())).some((e) => /duplicate/.test(e.message))).toBe(true);
  });

  it("flags orderings that are not a permutation of the speaker set", () => {
    const l = new Layout({ id: "r", name: "R" });
    l.speakers = [
      speaker.cartesian("L", { x: -0.5, y: 0.866, z: 0 }),
      speaker.cartesian("R", { x: 0.5, y: 0.866, z: 0 }),
    ];
    l.orderings.adm = ["L", "X"]; // unknown + omits R
    const errs = errors(semanticCheck(l.toData()));
    expect(errs.some((e) => /unknown speaker "X"/.test(e.message))).toBe(true);
    expect(errs.some((e) => /omits speaker "R"/.test(e.message))).toBe(true);
  });

  it("flags cartesian/polar disagreement beyond ε", () => {
    const l = new Layout({ id: "r", name: "R" });
    const s = speaker.cartesian("L", { x: 1, y: 0, z: 0 });
    s.authoredPolar = { az: 0, el: 0, dist: 1 }; // implies (0, 1, 0) — disagrees
    l.speakers = [s];
    expect(errors(semanticCheck(l.toData())).some((e) => /disagree/.test(e.message))).toBe(true);
  });

  it("flags one SP-label used for two different positions", () => {
    const l = new Layout({ id: "r", name: "R" });
    l.speakers = [
      speaker.cartesian("A", { sp: "M+030", x: -0.5, y: 0.866, z: 0 }),
      speaker.cartesian("B", { sp: "M+030", x: 0.5, y: 0.866, z: 0 }),
    ];
    expect(
      errors(semanticCheck(l.toData())).some((e) => /two different positions/.test(e.message)),
    ).toBe(true);
  });

  it("rejects structurally-invalid .osls (missing required field)", () => {
    expect(() => parseLayout("osls: 1\nid: x\nspeakers: []\n")).toThrow(OSLSError);
  });
});
