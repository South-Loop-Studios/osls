import { Vector3 } from "three";
import type { Vec3 } from "../types";

// Vendored verbatim from the osls-designer repo (src/scene/coords.ts) — THE single ADM <-> Three.js
// conversion. ADM frame: X = left−/right+, Y = back−/front+, Z = down−/up+.
//
//     three = ( x, z, −y )        adm = ( x, −z, y )
//
// A +90° rotation about X (determinant +1) — PRESERVES handedness, never mirrors
// L/R. Guarded by coords.test.ts.

export function admToThree(v: Vec3): Vector3 {
  return new Vector3(v.x, v.z, -v.y);
}

export function admToThreeTuple(v: Vec3): [number, number, number] {
  return [v.x, v.z, -v.y];
}

export function threeToAdm(v: { x: number; y: number; z: number }): Vec3 {
  return { x: v.x, y: -v.z, z: v.y };
}
