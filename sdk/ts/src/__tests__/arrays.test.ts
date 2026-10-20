import { describe, it, expect } from "vitest";
import { parseLayout } from "../parse";
import { OSLSError } from "../types";

// A 4-speaker rig with a rear array of three: the SPEC §2.4 example shape.
const RIG = `osls: 1
id: dub
name: Dub
speakers:
  - { id: Lrs1, label: Lrs1, x: -1, y: -0.5, z: 0 }
  - { id: Lrs2, label: Lrs2, x: -0.8, y: -1, z: 0 }
  - { id: Lrs3, label: Lrs3, x: -0.3, y: -1, z: 0 }
  - { id: LFE, label: LFE, x: 0, y: 1, z: -0.5, lfe: true }
`;

const withArrays = (block: string) => `${RIG}arrays:\n${block}`;

describe("arrays (SPEC §2.4)", () => {
  it("parses, queries and round-trips an array", async () => {
    const l = parseLayout(
      withArrays(`  - { id: left-rear, name: "Left rear", sp: M+135, speakers: [Lrs1, Lrs2, Lrs3] }\n`),
    );
    expect(l.arrays).toEqual([
      { id: "left-rear", name: "Left rear", sp: "M+135", speakers: ["Lrs1", "Lrs2", "Lrs3"] },
    ]);
    expect(l.arrayFor("Lrs2")?.id).toBe("left-rear");
    expect(l.arrayFor("LFE")).toBeUndefined();

    const again = parseLayout(await l.toOSLS());
    expect(again.arrays).toEqual(l.arrays);
  });

  it("emits no arrays block when there are none", async () => {
    expect(await parseLayout(RIG).toOSLS()).not.toMatch(/arrays/);
  });

  it.each([
    ["unknown speaker", `  - { id: a, name: A, speakers: [Lrs1, Nope] }\n`],
    ["LFE member", `  - { id: a, name: A, speakers: [Lrs1, LFE] }\n`],
    ["one member", `  - { id: a, name: A, speakers: [Lrs1] }\n`],
    ["speaker in two arrays", `  - { id: a, name: A, speakers: [Lrs1, Lrs2] }\n  - { id: b, name: B, speakers: [Lrs2, Lrs3] }\n`],
    ["listed twice", `  - { id: a, name: A, speakers: [Lrs1, Lrs1] }\n`],
    ["duplicate id", `  - { id: a, name: A, speakers: [Lrs1, Lrs2] }\n  - { id: a, name: B, speakers: [Lrs3, Lrs2] }\n`],
    ["missing name", `  - { id: a, speakers: [Lrs1, Lrs2] }\n`],
  ])("rejects %s", (_what, block) => {
    expect(() => parseLayout(withArrays(block))).toThrow(OSLSError);
  });

  it("rejects two arrays standing in for the same sp", () => {
    const text = `osls: 1
id: x
name: x
speakers:
  - { id: A, label: A, x: -1, y: 0, z: 0 }
  - { id: B, label: B, x: -1, y: 0.2, z: 0 }
  - { id: C, label: C, x: -1, y: -0.5, z: 0 }
  - { id: D, label: D, x: -1, y: -0.7, z: 0 }
arrays:
  - { id: a, name: A, sp: M+090, speakers: [A, B] }
  - { id: b, name: B, sp: M+090, speakers: [C, D] }
`;
    expect(() => parseLayout(text)).toThrow(OSLSError);
  });
});
