// Core data types for the OSLS format. These mirror the public surface of the
// `@orbitspatial/osls-core` WASM SDK (sdk/wasm/src/osls.ts) so this pure-TS engine is a drop-in.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Polar {
  /** Azimuth in degrees: 0 = front, positive = listener's LEFT. */
  az: number;
  /** Elevation in degrees: positive = up. */
  el: number;
  /** Distance; 1.0 = unit sphere. */
  dist: number;
}

/** A channel-ordering spec name. `native` is implied by the speaker list order. */
export type Spec = "native" | "adm" | "iamf" | "mpegh" | (string & {});

/** Which coordinate frame(s) `toOSLS` should emit. */
export type WriteFrame = "asAuthored" | "cartesian" | "polar" | "both";

/** The layout's reference frame: allocentric (room-anchored, a cube) or egocentric
 *  (listener-relative, a sphere). Independent of the storage representation (x/y/z or
 *  az/el) — a layout stored in Cartesian can still be egocentric. See SPEC §2.2. */
export type Frame = "allocentric" | "egocentric";

export interface Speaker {
  id: string;
  label: string;
  /** ITU-R BS.2051 SP-label (e.g. "M+030", "U+045", "LFE1"); may be empty. */
  sp: string;
  isLFE: boolean;
  aliases: string[];
  /** Authoritative position, always present (derived if the file authored polar only). */
  cartesian: Vec3;
  /** Display position, always present (derived if the file authored cartesian only). */
  polar: Polar;
  /** Set when x/y/z were present in the source — preserved for `asAuthored` round-trip. */
  authoredCartesian?: Vec3;
  /** Set when az/el were present in the source — preserved for `asAuthored` round-trip. */
  authoredPolar?: Polar;
}

/** A plain, serialisable layout — the shape held by the zustand store and zundo history. */
export interface LayoutData {
  osls: number;
  id: string;
  name: string;
  description: string;
  vendor: string;
  tags: string[];
  /** The layout's reference frame (allocentric/egocentric); advisory — sets the initial
   *  view mode but is never a constraint. */
  frame?: Frame;
  speakers: Speaker[];
  /** spec name -> channel order as speaker ids. */
  orderings: Record<string, string[]>;
  /** Optional spec-specific label overrides: spec -> (speaker id -> label). Rare. */
  orderingLabels?: Record<string, Record<string, string>>;
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export class OSLSError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = "OSLSError";
    this.issues = issues;
  }
}

/** A profile order entry: a bare sp, or an sp with a format-specific channel label. */
export type OrderEntry = string | { sp: string; label?: string };

export interface ProfileLayout {
  order: OrderEntry[];
  code?: Record<string, unknown>;
  since?: string;
}

export interface Profile {
  format: string;
  name?: string;
  status: "normative" | "stub";
  encodes?: { spec: string; version?: string }[];
  layouts?: Record<string, ProfileLayout>;
}

/** Result of projecting a delivery format's channel order onto a layout. */
export interface Ordering {
  format: string;
  /** Speaker ids in the format's channel order (the part that resolved). */
  ids: string[];
  /** sp labels the format's order expects but this rig lacks — the render-vs-permute signal. */
  missing: string[];
  /** Per-format channel label overrides (speaker id -> label), from {sp,label} entries. */
  labels?: Record<string, string>;
  complete: boolean;
  source: "inline" | "profile" | "none";
}
