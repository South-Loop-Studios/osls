import type { Polar, Vec3 } from "./types";

// Coordinate conversions — copied VERBATIM from the @orbitspatial/osls-core SDK
// (sdk/wasm/src/osls.ts:21–35) so the web app and the future WASM build can
// never drift on the math. Per ITU-R BS.2127:
//   az 0 = front, positive = listener's LEFT (note the negated x).
//   Do not "correct" the signs.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function polarToCartesian(p: Polar): Vec3 {
  const az = p.az * D2R;
  const el = p.el * D2R;
  return {
    x: -p.dist * Math.cos(el) * Math.sin(az),
    y: p.dist * Math.cos(el) * Math.cos(az),
    z: p.dist * Math.sin(el),
  };
}

export function cartesianToPolar(c: Vec3): Polar {
  const dist = Math.hypot(c.x, c.y, c.z);
  if (dist <= 1e-12) return { az: 0, el: 0, dist: 0 };
  const s = Math.max(-1, Math.min(1, c.z / dist));
  return { az: Math.atan2(-c.x, c.y) * R2D, el: Math.asin(s) * R2D, dist };
}

/** Agreement tolerance for "both"-authored speakers, in the normalised Cartesian frame
 *  (SPEC §4). ~0.01 ≈ 1°. Shared by the validator and the editor's re-sync logic. */
export const EPSILON = 0.01;

export function approxEqualCartesian(a: Vec3, b: Vec3, eps: number = EPSILON): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps && Math.abs(a.z - b.z) <= eps;
}
