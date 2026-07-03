import { approxEqualCartesian, polarToCartesian } from "./geometry";
import { detectFrame } from "./frame";
import type { LayoutData, ValidationIssue } from "./types";

// Semantic rules from SPEC §4 that JSON Schema can't express. Returns a flat list
// of issues; callers decide whether to throw (parse/serialize throw on any `error`)
// or surface them live (the inspector shows them non-throwingly).
export function semanticCheck(layout: LayoutData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (path: string, message: string) =>
    issues.push({ path, message, severity: "error" });
  const warn = (path: string, message: string) =>
    issues.push({ path, message, severity: "warning" });

  // Rule 3a — at least one speaker, unique ids.
  if (layout.speakers.length === 0) err("speakers", "a layout must have at least one speaker");

  const seen = new Set<string>();
  for (const s of layout.speakers) {
    if (seen.has(s.id)) err(`speakers.${s.id}`, `duplicate speaker id "${s.id}"`);
    seen.add(s.id);

    // Rule 2 — when both frames are authored, they must agree within ε.
    if (s.authoredCartesian && s.authoredPolar) {
      const fromPolar = polarToCartesian(s.authoredPolar);
      if (!approxEqualCartesian(fromPolar, s.authoredCartesian)) {
        err(
          `speakers.${s.id}`,
          `cartesian and polar positions disagree (polar implies ` +
            `${fmt(fromPolar.x)}, ${fmt(fromPolar.y)}, ${fmt(fromPolar.z)})`,
        );
      }
    }
  }

  // Rule 5 — identity sanity: a non-empty sp must map to one physical point;
  // aliases must be unique and not collide with another speaker's id/label.
  const bySp = new Map<string, typeof layout.speakers>();
  for (const s of layout.speakers) {
    if (!s.sp) continue;
    const group = bySp.get(s.sp) ?? [];
    group.push(s);
    bySp.set(s.sp, group);
  }
  for (const [sp, group] of bySp) {
    for (let i = 1; i < group.length; i++) {
      if (!approxEqualCartesian(group[0].cartesian, group[i].cartesian)) {
        err(`speakers.${group[i].id}`, `SP-label "${sp}" used for two different positions`);
      }
    }
  }

  const idLabelSet = new Set<string>();
  for (const s of layout.speakers) {
    idLabelSet.add(s.id);
    idLabelSet.add(s.label);
  }
  const aliasSeen = new Set<string>();
  for (const s of layout.speakers) {
    for (const a of s.aliases) {
      if (idLabelSet.has(a) && a !== s.id && a !== s.label) {
        err(`speakers.${s.id}`, `alias "${a}" collides with another speaker's id/label`);
      }
      if (aliasSeen.has(a)) err(`speakers.${s.id}`, `alias "${a}" is used more than once`);
      aliasSeen.add(a);
    }
  }

  // Rules 3b/4 — every ordering is a complete permutation of the speaker set
  // (which also guarantees LFE channels appear in each ordering).
  const ids = new Set(layout.speakers.map((s) => s.id));
  for (const [spec, order] of Object.entries(layout.orderings)) {
    const inOrder = new Set<string>();
    for (const id of order) {
      if (!ids.has(id)) err(`orderings.${spec}`, `references unknown speaker "${id}"`);
      if (inOrder.has(id)) err(`orderings.${spec}`, `speaker "${id}" listed more than once`);
      inOrder.add(id);
    }
    for (const id of ids) {
      if (!inOrder.has(id)) err(`orderings.${spec}`, `omits speaker "${id}"`);
    }
  }

  // Soft warning — an LFE carrying height is unusual (not an error).
  for (const s of layout.speakers) {
    if (s.isLFE && Math.abs(s.cartesian.z) > 0.2) {
      warn(`speakers.${s.id}`, `LFE channel has a non-trivial height (z=${fmt(s.cartesian.z)})`);
    }
  }

  // Soft warning — a declared frame that contradicts the geometry (declaration always wins,
  // but flag the likely mistake). See detectFrame().
  if (layout.frame && layout.speakers.length) {
    const detected = detectFrame(layout.speakers);
    if (layout.frame !== detected) {
      warn(
        "frame",
        `declared frame "${layout.frame}" but the geometry looks ${detected} ` +
          `(${detected === "egocentric" ? "speakers lie on a sphere" : "speakers fill a volume"})`,
      );
    }
  }

  return issues;
}

function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}
