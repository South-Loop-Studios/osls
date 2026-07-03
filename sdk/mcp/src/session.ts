import {
  parseLayout, serializeLayout, semanticCheck,
  polarToCartesian, cartesianToPolar, positionForLabel,
  type LayoutData, type Speaker, type ValidationIssue, type WriteFrame, type Vec3, type Polar,
} from "@orbitspatial/osls-core";
import { PRESETS } from "./assets.generated";

export interface AddInput {
  label: string; sp?: string; az?: number; el?: number; dist?: number;
  x?: number; y?: number; z?: number; lfe?: boolean; aliases?: string[]; id?: string;
}

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, "") || "S";
}

function bothFrames(cartesian: Vec3): Pick<Speaker, "cartesian" | "polar" | "authoredCartesian" | "authoredPolar"> {
  const polar = cartesianToPolar(cartesian);
  return { cartesian, polar, authoredCartesian: cartesian, authoredPolar: polar };
}

export class Session {
  private layout: LayoutData;

  private listeners = new Set<(layout: LayoutData) => void>();

  onChange(listener: (layout: LayoutData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    for (const listener of this.listeners) listener(this.layout);
  }

  constructor() {
    this.layout = { osls: 1, id: "untitled", name: "Untitled", description: "", vendor: "", tags: [], speakers: [], orderings: {} };
  }

  newLayout(meta: { id?: string; name?: string; vendor?: string; description?: string }): void {
    this.layout = {
      osls: 1, id: meta.id ?? "untitled", name: meta.name ?? "Untitled",
      description: meta.description ?? "", vendor: meta.vendor ?? "", tags: [], speakers: [], orderings: {},
    };
    this.emitChange();
  }

  loadPreset(key: string): void {
    const text = PRESETS[key];
    if (!text) throw new Error(`unknown preset "${key}"`);
    this.layout = parseLayout(text).toData();
    this.emitChange();
  }

  import(text: string): void {
    this.layout = parseLayout(text).toData();
    this.emitChange();
  }

  private uniqueId(base: string): string {
    const ids = new Set(this.layout.speakers.map((s) => s.id));
    if (!ids.has(base)) return base;
    let n = 2; while (ids.has(`${base}${n}`)) n++; return `${base}${n}`;
  }

  addSpeaker(input: AddInput): Speaker {
    const id = this.uniqueId(slug(input.id ?? input.label));
    let cartesian: Vec3;
    if (input.x !== undefined && input.y !== undefined && input.z !== undefined) {
      cartesian = { x: input.x, y: input.y, z: input.z };
    } else if (input.az !== undefined && input.el !== undefined) {
      cartesian = polarToCartesian({ az: input.az, el: input.el, dist: input.dist ?? 1 });
    } else if (input.sp) {
      const pos = positionForLabel(input.sp);
      if (!pos) throw new Error(`"${input.sp}" has no nominal position; give az/el or x/y/z`);
      cartesian = polarToCartesian({ az: pos.az, el: pos.el, dist: 1 });
    } else {
      cartesian = { x: 0, y: 1, z: 0 };
    }
    const s: Speaker = {
      id, label: input.label, sp: input.sp ?? "",
      isLFE: input.lfe ?? (input.sp === "LFE1"), aliases: input.aliases ?? [],
      ...bothFrames(cartesian),
    };
    this.layout = {
      ...this.layout,
      speakers: [...this.layout.speakers, s],
      orderings: Object.fromEntries(Object.entries(this.layout.orderings).map(([k, ids]) => [k, [...ids, id]])),
    };
    this.emitChange();
    return s;
  }

  private mapSpeaker(id: string, fn: (s: Speaker) => Speaker): Speaker {
    const found = this.layout.speakers.find((s) => s.id === id);
    if (!found) throw new Error(`no speaker "${id}"`);
    const next = fn(found);
    this.layout = { ...this.layout, speakers: this.layout.speakers.map((s) => (s.id === id ? next : s)) };
    return next;
  }

  moveSpeaker(id: string, pos: { az?: number; el?: number; dist?: number; x?: number; y?: number; z?: number }): Speaker {
    const r = this.mapSpeaker(id, (s) => {
      let cartesian: Vec3;
      if (pos.x !== undefined || pos.y !== undefined || pos.z !== undefined) {
        cartesian = { x: pos.x ?? s.cartesian.x, y: pos.y ?? s.cartesian.y, z: pos.z ?? s.cartesian.z };
      } else {
        const p: Polar = { az: pos.az ?? s.polar.az, el: pos.el ?? s.polar.el, dist: pos.dist ?? s.polar.dist };
        cartesian = polarToCartesian(p);
      }
      return { ...s, ...bothFrames(cartesian) };
    });
    this.emitChange();
    return r;
  }

  updateSpeaker(id: string, identity: { id?: string; label?: string; sp?: string; lfe?: boolean; aliases?: string[] }): Speaker {
    const renameTo =
      identity.id && identity.id !== id && !this.layout.speakers.some((s) => s.id === identity.id)
        ? slug(identity.id) : undefined;
    const updated = this.mapSpeaker(id, (s) => ({
      ...s,
      id: renameTo ?? s.id,
      label: identity.label ?? s.label,
      sp: identity.sp ?? s.sp,
      isLFE: identity.lfe ?? s.isLFE,
      aliases: identity.aliases ?? s.aliases,
    }));
    if (renameTo) {
      this.layout = {
        ...this.layout,
        orderings: Object.fromEntries(
          Object.entries(this.layout.orderings).map(([k, ids]) => [k, ids.map((x) => (x === id ? renameTo : x))]),
        ),
      };
    }
    this.emitChange();
    return updated;
  }

  removeSpeaker(id: string): void {
    this.layout = {
      ...this.layout,
      speakers: this.layout.speakers.filter((s) => s.id !== id),
      orderings: Object.fromEntries(Object.entries(this.layout.orderings).map(([k, ids]) => [k, ids.filter((x) => x !== id)])),
    };
    this.emitChange();
  }

  reorderSpeakers(ids: string[]): void {
    const byId = new Map(this.layout.speakers.map((s) => [s.id, s]));
    const next = ids.map((id) => byId.get(id)).filter((s): s is Speaker => !!s);
    if (next.length === this.layout.speakers.length) this.layout = { ...this.layout, speakers: next };
    this.emitChange();
  }

  setOrdering(spec: string, ids: string[]): void {
    this.layout = { ...this.layout, orderings: { ...this.layout.orderings, [spec]: ids } };
    this.emitChange();
  }

  get(): LayoutData { return this.layout; }
  validate(): ValidationIssue[] { return semanticCheck(this.layout); }
  export(frame: WriteFrame = "asAuthored"): string { return serializeLayout(this.layout, frame); }
}
