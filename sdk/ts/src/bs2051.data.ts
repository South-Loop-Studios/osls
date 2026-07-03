// ITU-R BS.2051-3 (05/2022) "Advanced sound system for programme production", Table 1
// (pp. 5–7): the master list of loudspeaker SP-labels and their nominal positions.
//
// Convention (matches geometry.ts): azimuth positive = listener's LEFT; elevation
// positive = up. Layers: M = middle (ear level, el 0), U = upper (el +30),
// B = bottom (el −30), plus T+000 (top / voice-of-god, el +90), UH+180 (el +45),
// the M±SC screen-edge pair, and LFE1/LFE2. `az: null` marks positions with no fixed
// azimuth (top, LFE, screen-edge — the latter depend on screen width).
//
// This is the committed, authoritative dataset. The friendly-label defaults below are
// our own curation (BS.2051's per-system Tables 3–12 give different friendly names per
// system); they match the names used in the blessed layouts/*.osls.

export type Bs2051Layer = "M" | "U" | "B" | "T" | "UH" | "LFE";
export type Bs2051Special = "screen-edge" | "top" | "lfe";

export interface Bs2051Entry {
  sp: string;
  az: number | null;
  el: number;
  layer: Bs2051Layer;
  special?: Bs2051Special;
}

export const BS2051_TABLE1: readonly Bs2051Entry[] = [
  // Middle layer (el 0)
  { sp: "M+000", az: 0, el: 0, layer: "M" },
  { sp: "M+022", az: 22.5, el: 0, layer: "M" },
  { sp: "M-022", az: -22.5, el: 0, layer: "M" },
  { sp: "M+SC", az: null, el: 0, layer: "M", special: "screen-edge" },
  { sp: "M-SC", az: null, el: 0, layer: "M", special: "screen-edge" },
  { sp: "M+030", az: 30, el: 0, layer: "M" },
  { sp: "M-030", az: -30, el: 0, layer: "M" },
  { sp: "M+045", az: 45, el: 0, layer: "M" },
  { sp: "M-045", az: -45, el: 0, layer: "M" },
  { sp: "M+060", az: 60, el: 0, layer: "M" },
  { sp: "M-060", az: -60, el: 0, layer: "M" },
  { sp: "M+090", az: 90, el: 0, layer: "M" },
  { sp: "M-090", az: -90, el: 0, layer: "M" },
  { sp: "M+110", az: 110, el: 0, layer: "M" },
  { sp: "M-110", az: -110, el: 0, layer: "M" },
  { sp: "M+135", az: 135, el: 0, layer: "M" },
  { sp: "M-135", az: -135, el: 0, layer: "M" },
  { sp: "M+180", az: 180, el: 0, layer: "M" },

  // Upper layer (el +30)
  { sp: "U+000", az: 0, el: 30, layer: "U" },
  { sp: "U+022", az: 22.5, el: 30, layer: "U" },
  { sp: "U-022", az: -22.5, el: 30, layer: "U" },
  { sp: "U+030", az: 30, el: 30, layer: "U" },
  { sp: "U-030", az: -30, el: 30, layer: "U" },
  { sp: "U+045", az: 45, el: 30, layer: "U" },
  { sp: "U-045", az: -45, el: 30, layer: "U" },
  { sp: "U+060", az: 60, el: 30, layer: "U" },
  { sp: "U-060", az: -60, el: 30, layer: "U" },
  { sp: "U+090", az: 90, el: 30, layer: "U" },
  { sp: "U-090", az: -90, el: 30, layer: "U" },
  { sp: "U+110", az: 110, el: 30, layer: "U" },
  { sp: "U-110", az: -110, el: 30, layer: "U" },
  { sp: "U+135", az: 135, el: 30, layer: "U" },
  { sp: "U-135", az: -135, el: 30, layer: "U" },
  { sp: "U+180", az: 180, el: 30, layer: "U" },
  { sp: "UH+180", az: 180, el: 45, layer: "UH" },
  { sp: "T+000", az: null, el: 90, layer: "T", special: "top" },

  // Bottom layer (el −30)
  { sp: "B+000", az: 0, el: -30, layer: "B" },
  { sp: "B+022", az: 22.5, el: -30, layer: "B" },
  { sp: "B-022", az: -22.5, el: -30, layer: "B" },
  { sp: "B+030", az: 30, el: -30, layer: "B" },
  { sp: "B-030", az: -30, el: -30, layer: "B" },
  { sp: "B+045", az: 45, el: -30, layer: "B" },
  { sp: "B-045", az: -45, el: -30, layer: "B" },
  { sp: "B+060", az: 60, el: -30, layer: "B" },
  { sp: "B-060", az: -60, el: -30, layer: "B" },
  { sp: "B+090", az: 90, el: -30, layer: "B" },
  { sp: "B-090", az: -90, el: -30, layer: "B" },
  { sp: "B+110", az: 110, el: -30, layer: "B" },
  { sp: "B-110", az: -110, el: -30, layer: "B" },
  { sp: "B+135", az: 135, el: -30, layer: "B" },
  { sp: "B-135", az: -135, el: -30, layer: "B" },
  { sp: "B+180", az: 180, el: -30, layer: "B" },

  // LFE (non-positional)
  { sp: "LFE1", az: null, el: 0, layer: "LFE", special: "lfe" },
  { sp: "LFE2", az: null, el: 0, layer: "LFE", special: "lfe" },
];

// Curated default friendly labels — aligned with the names used in the blessed
// layouts/*.osls (immersive-layout vocabulary). SP-labels not listed here fall back to the
// SP-label itself in defaultFriendlyLabel().
export const BS2051_FRIENDLY_DEFAULTS: Readonly<Record<string, string>> = {
  "M+000": "C",
  "M+030": "L",
  "M-030": "R",
  "M+022": "Lc",
  "M-022": "Rc",
  "M+060": "Lw",
  "M-060": "Rw",
  "M+090": "Lss",
  "M-090": "Rss",
  "M+110": "Ls",
  "M-110": "Rs",
  "M+135": "Lrs",
  "M-135": "Rrs",
  "U+045": "Ltf",
  "U-045": "Rtf",
  "U+090": "Ltm",
  "U-090": "Rtm",
  "U+135": "Ltb",
  "U-135": "Rtb",
  "T+000": "Tp",
  LFE1: "LFE",
  LFE2: "LFE2",
};
