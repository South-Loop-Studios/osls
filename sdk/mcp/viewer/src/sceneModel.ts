import { admToThreeTuple } from "./lib/coords";
import { SCENE } from "./lib/palette";
import type { LayoutData, Speaker } from "./types";

export interface SceneNode {
  id: string;
  label: string;
  position: [number, number, number];
  kind: "sphere" | "box";
  color: string;
}

function isHeight(s: Speaker): boolean {
  return s.cartesian.z > 0.1 || /^[UT]/.test(s.sp);
}

export function nodeColor(s: Speaker): string {
  if (s.isLFE) return SCENE.lfeNode;
  return isHeight(s) ? SCENE.heightNode : SCENE.floorNode;
}

export function layoutToNodes(layout: LayoutData | null): SceneNode[] {
  if (!layout) return [];
  return layout.speakers.map((s) => ({
    id: s.id,
    label: s.label,
    position: admToThreeTuple(s.cartesian),
    kind: s.isLFE ? "box" : "sphere",
    color: nodeColor(s),
  }));
}
