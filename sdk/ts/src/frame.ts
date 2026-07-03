import type { Frame, Speaker } from "./types";

/** How far past the unit sphere a speaker may sit before it counts as leaving it. */
export const FRAME_SPHERE_TOLERANCE = 0.05;

/** Infer a layout's reference frame from geometry alone. Non-LFE speakers that all sit
 *  **within (or on) the unit sphere** are directional → **egocentric** (listener-relative;
 *  distances may vary inside the sphere). A speaker pushed **beyond** it — toward the room
 *  cube's edges/corners, radius > 1 — means the rig fills a volume → **allocentric**
 *  (room-anchored). Only leaving the sphere flips the frame. A heuristic fallback — a declared
 *  `frame` always wins; this is what `detectedFrame` / the mismatch warning use. */
export function detectFrame(speakers: Speaker[]): Frame {
  const beyondSphere = speakers.some(
    (s) =>
      !s.isLFE &&
      Math.hypot(s.cartesian.x, s.cartesian.y, s.cartesian.z) > 1 + FRAME_SPHERE_TOLERANCE,
  );
  return beyondSphere ? "allocentric" : "egocentric";
}
