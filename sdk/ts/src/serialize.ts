import { semanticCheck } from "./validate";
import { OSLSError } from "./types";
import type { LayoutData, Polar, Speaker, Vec3, WriteFrame } from "./types";

// Emit a layout as canonical-house-style `.osls` YAML: flow-mapping speakers, one
// per line; flow-array orderings; specs sorted (adm before iamf). Validates first
// (SPEC §4) and throws OSLSError on any error — matching @orbitspatial/osls-core's toOSLS.
export function serializeLayout(layout: LayoutData, frame: WriteFrame = "asAuthored"): string {
  const issues = semanticCheck(layout);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new OSLSError(
      `cannot serialize an invalid layout: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
      issues,
    );
  }

  const lines: string[] = [];
  lines.push(`osls: ${layout.osls || 1}`);
  lines.push(`id: ${quote(layout.id)}`);
  lines.push(`name: ${quote(layout.name)}`);
  if (layout.description) lines.push(`description: ${quote(layout.description)}`);
  if (layout.vendor) lines.push(`vendor: ${scalar(layout.vendor)}`);
  if (layout.tags.length) lines.push(`tags: [${layout.tags.map(scalar).join(", ")}]`);
  if (layout.frame) lines.push(`frame: ${layout.frame}`);

  lines.push("speakers:");
  for (const s of layout.speakers) lines.push(`  - { ${speakerFields(s, frame).join(", ")} }`);

  const specs = Object.keys(layout.orderings).sort();
  if (specs.length) {
    lines.push("orderings:");
    for (const spec of specs) {
      const labels = layout.orderingLabels?.[spec];
      const entries = layout.orderings[spec].map((id) => {
        const override = labels?.[id];
        return override ? `{ speaker: ${id}, label: ${scalar(override)} }` : id;
      });
      lines.push(`  ${spec}: [${entries.join(", ")}]`);
    }
  }

  if (layout.arrays?.length) {
    lines.push("arrays:");
    for (const a of layout.arrays) {
      const parts = [`id: ${scalar(a.id)}`, `name: ${scalar(a.name)}`];
      if (a.sp) parts.push(`sp: ${scalar(a.sp)}`);
      parts.push(`speakers: [${a.speakers.map(scalar).join(", ")}]`);
      lines.push(`  - { ${parts.join(", ")} }`);
    }
  }

  return lines.join("\n") + "\n";
}

function speakerFields(s: Speaker, frame: WriteFrame): string[] {
  const parts = [`id: ${scalar(s.id)}`, `label: ${scalar(s.label)}`];
  if (s.sp) parts.push(`sp: ${scalar(s.sp)}`);
  parts.push(...positionFields(s, frame));
  if (s.isLFE) parts.push("lfe: true");
  if (s.aliases.length) parts.push(`aliases: [${s.aliases.map(scalar).join(", ")}]`);
  return parts;
}

function positionFields(s: Speaker, frame: WriteFrame): string[] {
  let cart: Vec3 | undefined;
  let pol: Polar | undefined;
  switch (frame) {
    case "cartesian":
      cart = s.cartesian;
      break;
    case "polar":
      pol = s.authoredPolar ?? s.polar;
      break;
    case "both":
      cart = s.cartesian;
      pol = s.polar;
      break;
    case "asAuthored":
    default:
      cart = s.authoredCartesian;
      pol = s.authoredPolar;
      if (!cart && !pol) cart = s.cartesian;
      break;
  }
  const parts: string[] = [];
  if (cart) parts.push(`x: ${cartStr(cart.x)}`, `y: ${cartStr(cart.y)}`, `z: ${cartStr(cart.z)}`);
  if (pol) {
    parts.push(`az: ${angStr(pol.az)}`, `el: ${angStr(pol.el)}`);
    if (Math.abs(pol.dist - 1) > 1e-9) parts.push(`dist: ${angStr(pol.dist)}`);
  }
  return parts;
}

// Cartesian values render with a decimal point (0 -> "0.0") to read as floats.
function cartStr(n: number): string {
  const r = round(n, 6);
  const s = (Object.is(r, -0) ? 0 : r).toString();
  return s.includes(".") || s.includes("e") ? s : `${s}.0`;
}

function angStr(n: number): string {
  const r = round(n, 4);
  return (Object.is(r, -0) ? 0 : r).toString();
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

// A plain scalar if it's safe bare, else a double-quoted string.
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
function scalar(v: string): string {
  return SAFE.test(v) ? v : quote(v);
}

function quote(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
