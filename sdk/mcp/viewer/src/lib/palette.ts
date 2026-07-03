// Vendored from the osls-designer repo (src/lib/palette.ts) — scene colours pinned by palette.test.ts
// so they stay identical to the designer.
export const BRAND = {
  ink: "#16181D",
  electricBlue: "#2B62F0",
  brightBlue: "#3F73FF",
  paper: "#FFFFFF",
  slate: "#9AA0AB",
  cloud: "#E6E8EC",
} as const;

export const SCENE = {
  /** Ear-level / floor speakers. */
  floorNode: "#9AA0AB",
  /** Height / overhead speakers — the OSLS mark's blue accent. */
  heightNode: "#3F73FF",
  /** LFE — dim, non-directional. */
  lfeNode: "#6b7280",
  selected: "#3F73FF",
} as const;
