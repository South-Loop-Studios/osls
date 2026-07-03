import { polarToCartesian } from "./geometry";
import { BS2051_TABLE1, BS2051_FRIENDLY_DEFAULTS, type Bs2051Special } from "./bs2051.data";

// ITU-R BS.2051-3 SP-label lookup. Position <-> label, used both for manual labelling
// (the inspector's "suggest & apply") and as the vocabulary for AI layout generation.
//
// All angular comparison is great-circle distance on the unit sphere (not separate
// az/el deltas), so it behaves correctly across the ±180 azimuth wrap (M+180 ≡ M−180)
// and near the poles. Positions are converted to unit vectors with the SAME
// polarToCartesian the rest of the engine uses (az positive = left) — never re-rolled.
//
// v2 refinement (not implemented): BS.2051's per-system acceptable az/el ranges
// (Tables 3–12) and the rule that loudspeaker pairs with |az| > 45° must be placed
// symmetrically within 10°. v1 uses a single global tolerance.

/** Default global angular tolerance (degrees) for "within range". */
export const BS2051_TOLERANCE_DEG = 5;

const R2D = 180 / Math.PI;

/** Unit vector for an entry. Top (T+000) points straight up regardless of azimuth. */
function entryVector(az: number | null, el: number, special?: Bs2051Special) {
  if (special === "top") return { x: 0, y: 0, z: 1 };
  return polarToCartesian({ az: az ?? 0, el, dist: 1 });
}

function angleBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  return Math.acos(dot) * R2D;
}

/** Nominal {az, el} for a known SP-label. Returns null for unknown labels and for the
 *  non-positional ones (LFE, M±SC); T+000 reports straight up (az 0, el 90). */
export function positionForLabel(sp: string): { az: number; el: number } | null {
  const e = BS2051_TABLE1.find((x) => x.sp === sp);
  if (!e) return null;
  if (e.special === "lfe" || e.special === "screen-edge") return null;
  if (e.special === "top") return { az: 0, el: 90 };
  return { az: e.az as number, el: e.el };
}

/** Curated default friendly label for an SP-label (e.g. "M+030" -> "L"); the SP-label
 *  itself if we have no curated default. */
export function defaultFriendlyLabel(sp: string): string {
  return BS2051_FRIENDLY_DEFAULTS[sp] ?? sp;
}

export interface NearestLabel {
  sp: string;
  friendly: string;
  /** Great-circle angle (degrees) from the measured position to this nominal point. */
  deltaDeg: number;
  withinRange: boolean;
  special?: Bs2051Special;
}

/** Nearest BS.2051 SP-label to a measured (az, el). Non-positional entries (LFE, M±SC)
 *  are excluded from the candidate set; T+000 is matched on elevation. Returns null only
 *  if the table is empty (never in practice). */
export function nearestLabel(
  az: number,
  el: number,
  tol: number = BS2051_TOLERANCE_DEG,
): NearestLabel | null {
  const measured = polarToCartesian({ az, el, dist: 1 });
  let best: NearestLabel | null = null;
  for (const e of BS2051_TABLE1) {
    if (e.special === "lfe" || e.special === "screen-edge") continue;
    const deltaDeg = angleBetween(measured, entryVector(e.az, e.el, e.special));
    if (!best || deltaDeg < best.deltaDeg) {
      best = {
        sp: e.sp,
        friendly: defaultFriendlyLabel(e.sp),
        deltaDeg,
        withinRange: deltaDeg <= tol,
        special: e.special,
      };
    }
  }
  return best;
}
