import { cartesianToPolar, polarToCartesian } from "./geometry";
import { serializeLayout } from "./serialize";
import { profileOrder, formatsForLayout, spOf, labelOf } from "./profiles";
import { detectFrame } from "./frame";
import type { Frame, LayoutData, Ordering, Spec, Speaker, SpeakerArray, WriteFrame } from "./types";
import type { RawOsls, RawSpeaker } from "./raw";

// The Layout class — mirrors @orbitspatial/osls-core's Layout (sdk/wasm/src/osls.ts:78).
// It is a thin, immutable-by-convention holder of LayoutData plus convenience
// queries. The store works with the plain LayoutData (via toData/fromData); the
// class is used at the parse/serialize boundary.
export class Layout implements LayoutData {
  osls = 1;
  id = "";
  name = "";
  description = "";
  vendor = "";
  tags: string[] = [];
  frame?: Frame;
  speakers: Speaker[] = [];
  orderings: Record<string, string[]> = {};
  orderingLabels?: Record<string, Record<string, string>>;
  arrays: SpeakerArray[] = [];

  constructor(init?: { id?: string; name?: string; vendor?: string; description?: string }) {
    if (init) Object.assign(this, init);
  }

  get channelCount(): number {
    return this.speakers.length;
  }

  /** The reference frame inferred from the geometry alone (ignores the declared `frame`). */
  get detectedFrame(): Frame {
    return detectFrame(this.speakers);
  }

  /** The declared `frame` if present, otherwise the frame inferred from the geometry. */
  get effectiveFrame(): Frame {
    return this.frame ?? detectFrame(this.speakers);
  }

  get lfe(): Speaker[] {
    return this.speakers.filter((s) => s.isLFE);
  }

  get specs(): string[] {
    const set = new Set([...Object.keys(this.orderings), ...formatsForLayout(this.id)]);
    return ["native", ...[...set].sort()];
  }

  /** Speakers in a spec's channel order ("native" = the speaker-list order). */
  order(spec: Spec): Speaker[] {
    const ids = spec === "native" ? this.speakers.map((s) => s.id) : this.ordering(spec).ids;
    return ids
      .map((id) => this.speakers.find((s) => s.id === id))
      .filter((s): s is Speaker => !!s);
  }

  /** Project a delivery format's channel order onto this rig.
   *  Precedence: inline orderings[format] (custom override) -> profile by sp -> none. */
  ordering(format: string): Ordering {
    const inline = this.orderings[format];
    if (inline && inline.length) {
      const ids = inline.filter((id) => this.speakers.some((s) => s.id === id));
      return { format, ids, missing: [], complete: ids.length === inline.length, source: "inline" };
    }
    const entries = profileOrder(format, this.id);
    if (entries) {
      const ids: string[] = [];
      const missing: string[] = [];
      const labels: Record<string, string> = {};
      for (const e of entries) {
        const sp = spOf(e);
        const s = this.speakers.find((sp2) => sp2.sp !== "" && sp2.sp === sp);
        if (s) {
          ids.push(s.id);
          const lbl = labelOf(e);
          if (lbl) labels[s.id] = lbl;
        } else {
          missing.push(sp);
        }
      }
      const out: Ordering = { format, ids, missing, complete: missing.length === 0, source: "profile" };
      if (Object.keys(labels).length) out.labels = labels;
      return out;
    }
    return { format, ids: [], missing: [], complete: false, source: "none" };
  }

  /** Resolve a token to a speaker: id, then sp, then label, then alias. */
  speaker(token: string): Speaker | undefined {
    return (
      this.speakers.find((s) => s.id === token) ??
      this.speakers.find((s) => s.sp !== "" && s.sp === token) ??
      this.speakers.find((s) => s.label === token) ??
      this.speakers.find((s) => s.aliases.includes(token))
    );
  }

  /** The array a speaker (by id) belongs to — a speaker is in one at most. */
  arrayFor(speakerId: string): SpeakerArray | undefined {
    return this.arrays.find((a) => a.speakers.includes(speakerId));
  }

  /** A plain, deep-cloned snapshot for the store / history. */
  toData(): LayoutData {
    return structuredClone({
      osls: this.osls,
      id: this.id,
      name: this.name,
      description: this.description,
      vendor: this.vendor,
      tags: this.tags,
      frame: this.frame,
      speakers: this.speakers,
      orderings: this.orderings,
      orderingLabels: this.orderingLabels,
      arrays: this.arrays,
    });
  }

  static fromData(data: LayoutData): Layout {
    const l = new Layout();
    const clone = structuredClone(data);
    l.osls = clone.osls;
    l.id = clone.id;
    l.name = clone.name;
    l.description = clone.description;
    l.vendor = clone.vendor;
    l.tags = clone.tags;
    l.frame = clone.frame;
    l.speakers = clone.speakers;
    l.orderings = clone.orderings;
    l.orderingLabels = clone.orderingLabels;
    l.arrays = clone.arrays ?? [];
    return l;
  }

  /** Build a Layout from a schema-validated raw object. */
  static fromRaw(raw: RawOsls): Layout {
    const l = new Layout();
    l.osls = raw.osls;
    l.id = raw.id;
    l.name = raw.name;
    l.description = raw.description ?? "";
    l.vendor = raw.vendor ?? "";
    l.tags = raw.tags ? [...raw.tags] : [];
    l.frame = raw.frame;
    l.speakers = raw.speakers.map(buildSpeaker);

    // Merge any layout-level alias map (canonical id -> [alias, ...]).
    if (raw.aliases) {
      for (const [id, aliases] of Object.entries(raw.aliases)) {
        const s = l.speakers.find((sp) => sp.id === id);
        if (s) for (const a of aliases) if (!s.aliases.includes(a)) s.aliases.push(a);
      }
    }

    if (raw.orderings) {
      for (const [spec, entries] of Object.entries(raw.orderings)) {
        l.orderings[spec] = entries.map((e) => (typeof e === "string" ? e : e.speaker));
        for (const e of entries) {
          if (typeof e !== "string" && e.label) {
            (l.orderingLabels ??= {})[spec] ??= {};
            l.orderingLabels[spec][e.speaker] = e.label;
          }
        }
      }
    }

    l.arrays = (raw.arrays ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      sp: a.sp ?? "",
      speakers: [...a.speakers],
    }));

    return l;
  }

  /** Serialise to `.osls` YAML (validates first; throws OSLSError on invalid).
   *  Async to stay a drop-in for the @orbitspatial/osls-core WASM facade. */
  toOSLS(frame: WriteFrame = "asAuthored"): Promise<string> {
    return Promise.resolve(serializeLayout(this.toData(), frame));
  }
}

function buildSpeaker(r: RawSpeaker): Speaker {
  const hasCart = r.x !== undefined && r.y !== undefined && r.z !== undefined;
  const hasPolar = r.az !== undefined && r.el !== undefined;

  const authoredCartesian = hasCart ? { x: r.x!, y: r.y!, z: r.z! } : undefined;
  const authoredPolar = hasPolar ? { az: r.az!, el: r.el!, dist: r.dist ?? 1 } : undefined;

  // Cartesian is authoritative; derive it from polar if only polar was authored.
  const cartesian = authoredCartesian ?? polarToCartesian(authoredPolar!);
  // For display, prefer the authored angles; otherwise derive them.
  const polar = authoredPolar ?? cartesianToPolar(cartesian);

  return {
    id: r.id,
    label: r.label,
    sp: r.sp ?? "",
    isLFE: r.lfe ?? false,
    aliases: r.aliases ? [...r.aliases] : [],
    cartesian,
    polar,
    authoredCartesian,
    authoredPolar,
  };
}
