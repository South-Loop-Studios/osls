import { describe, it, expect } from "vitest";
import { layoutToNodes, nodeColor } from "./sceneModel";
import { SCENE } from "./lib/palette";
import type { Speaker } from "./types";

const sp = (o: Partial<Speaker> & { id: string }): Speaker => ({
  id: o.id, label: o.label ?? o.id, sp: o.sp ?? "", isLFE: o.isLFE ?? false,
  cartesian: o.cartesian ?? { x: 0, y: 1, z: 0 },
});

describe("layoutToNodes", () => {
  it("maps a floor speaker to a slate sphere at (x, z, -y)", () => {
    const n = layoutToNodes({ id: "t", name: "T", speakers: [sp({ id: "L", sp: "M+030", cartesian: { x: -0.5, y: 0.866, z: 0 } })] })[0];
    expect(n).toEqual({ id: "L", label: "L", position: [-0.5, 0, -0.866], kind: "sphere", color: SCENE.floorNode });
  });
  it("LFE -> dim box (full node shape)", () => {
    const n = layoutToNodes({ id: "t", name: "T", speakers: [sp({ id: "LFE", sp: "LFE1", isLFE: true })] })[0];
    expect(n).toEqual({ id: "LFE", label: "LFE", position: [0, 0, -1], kind: "box", color: SCENE.lfeNode });
  });
  it("upper speaker -> height blue, by sp OR by z", () => {
    expect(nodeColor(sp({ id: "Ltf", sp: "U+045", cartesian: { x: -0.5, y: 0.5, z: 0.707 } }))).toBe(SCENE.heightNode);
    expect(nodeColor(sp({ id: "x", sp: "", cartesian: { x: 0, y: 0, z: 0.9 } }))).toBe(SCENE.heightNode);
  });
  it("null layout -> []", () => {
    expect(layoutToNodes(null)).toEqual([]);
  });
});
