// @orbitspatial/osls-core-wasm — WebAssembly build of osls-core with a small typed facade.
//
//   import { OSLS, Layout, speaker } from "@orbitspatial/osls-core-wasm";
//   const layout = await OSLS.parse(text);          // or OSLS.load(url) in a browser
//   for (const s of layout.order("iamf")) { s.label; s.sp; s.cartesian; s.polar }
//   const room = new Layout({ id: "my-room", name: "My Room" });
//   room.speakers = [speaker.cartesian("L", { sp: "M+030", x: -0.5, y: 0.866, z: 0 }), ...];
//   const yaml = await room.toOSLS();                // validates (SPEC §4); throws on invalid
//
// A Layout is a plain value: parse copies it out of the core and frees the
// handle, so reads (`order`, `speaker`, `lfe`) are synchronous and need no wasm.
import createOSLSModule, { type OSLSModule } from "./osls-core.mjs";

let modulePromise: Promise<OSLSModule> | null = null;
function osmod(): Promise<OSLSModule> {
    return (modulePromise ??= createOSLSModule());
}

// MARK: Geometry

export interface Vec3 { x: number; y: number; z: number; }
export interface Polar { az: number; el: number; dist: number; }

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

export function polarToCartesian(p: Polar): Vec3 {
    const az = p.az * D2R, el = p.el * D2R;
    return { x: -p.dist * Math.cos(el) * Math.sin(az), y: p.dist * Math.cos(el) * Math.cos(az), z: p.dist * Math.sin(el) };
}
export function cartesianToPolar(c: Vec3): Polar {
    const dist = Math.hypot(c.x, c.y, c.z);
    if (dist <= 1e-12) return { az: 0, el: 0, dist: 0 };
    const s = Math.max(-1, Math.min(1, c.z / dist));
    return { az: Math.atan2(-c.x, c.y) * R2D, el: Math.asin(s) * R2D, dist };
}

// MARK: Spec / write frame

export type Spec = "native" | "adm" | "iamf" | "mpegh" | (string & {});
export type WriteFrame = "asAuthored" | "cartesian" | "polar" | "both";
const WRITE_FRAME: Record<WriteFrame, number> = { asAuthored: 0, cartesian: 1, polar: 2, both: 3 };

export class OSLSError extends Error {
    constructor(message: string) { super(message); this.name = "OSLSError"; }
}

// MARK: Speaker

export interface Speaker {
    id: string;
    label: string;
    sp: string;
    isLFE: boolean;
    aliases: string[];
    cartesian: Vec3;
    polar: Polar;
    /** Set when authored in polar, so toOSLS() preserves that frame. */
    authoredPolar?: Polar;
}

export const speaker = {
    cartesian(id: string, o: { sp?: string; x: number; y: number; z: number; label?: string; aliases?: string[] }): Speaker {
        const cartesian = { x: o.x, y: o.y, z: o.z };
        return { id, label: o.label ?? id, sp: o.sp ?? "", isLFE: false, aliases: o.aliases ?? [], cartesian, polar: cartesianToPolar(cartesian) };
    },
    polar(id: string, o: { sp?: string; az: number; el: number; dist?: number; label?: string; aliases?: string[] }): Speaker {
        const p = { az: o.az, el: o.el, dist: o.dist ?? 1 };
        return { id, label: o.label ?? id, sp: o.sp ?? "", isLFE: false, aliases: o.aliases ?? [], cartesian: polarToCartesian(p), polar: p, authoredPolar: p };
    },
    lfe(id: string, o: { sp?: string; x: number; y: number; z: number; label?: string }): Speaker {
        const cartesian = { x: o.x, y: o.y, z: o.z };
        return { id, label: o.label ?? id, sp: o.sp ?? "", isLFE: true, aliases: [], cartesian, polar: cartesianToPolar(cartesian) };
    },
};

// MARK: Layout

export class Layout {
    osls = 1;
    id = "";
    name = "";
    description = "";
    vendor = "";
    tags: string[] = [];
    speakers: Speaker[] = [];
    /** spec name -> channel order as speaker ids ("native" is implied by `speakers`). */
    orderings: Record<string, string[]> = {};

    constructor(init?: { id?: string; name?: string; vendor?: string; description?: string }) {
        if (init) Object.assign(this, init);
    }

    get channelCount(): number { return this.speakers.length; }
    get lfe(): Speaker[] { return this.speakers.filter((s) => s.isLFE); }
    get specs(): string[] { return ["native", ...Object.keys(this.orderings).sort()]; }

    /** Speakers in a spec's channel order ("native" = the `speakers` order). */
    order(spec: Spec): Speaker[] {
        const ids = spec === "native" ? this.speakers.map((s) => s.id) : (this.orderings[spec] ?? []);
        return ids.map((id) => this.speakers.find((s) => s.id === id)).filter((s): s is Speaker => !!s);
    }

    /** Resolve a token to a speaker: id, then sp, then label, then alias. */
    speaker(token: string): Speaker | undefined {
        return this.speakers.find((s) => s.id === token)
            ?? this.speakers.find((s) => s.sp !== "" && s.sp === token)
            ?? this.speakers.find((s) => s.label === token)
            ?? this.speakers.find((s) => s.aliases.includes(token));
    }

    static async parse(text: string): Promise<Layout> {
        const m = await osmod();
        const errPtr = m._malloc(1024);
        try {
            const h = m.ccall("osls_load_string", "number", ["string", "number", "number"], [text, errPtr, 1024]) as number;
            if (h === 0) throw new OSLSError(m.UTF8ToString(errPtr));
            try { return readLayout(m, h); }
            finally { m.ccall("osls_free", null, ["number"], [h]); }
        } finally { m._free(errPtr); }
    }

    static async load(url: string): Promise<Layout> {
        const res = await fetch(url);
        if (!res.ok) throw new OSLSError(`failed to fetch ${url}: ${res.status}`);
        return Layout.parse(await res.text());
    }

    /** Serialise to `.osls` YAML. Validates first (SPEC §4); throws on invalid. */
    async toOSLS(frame: WriteFrame = "asAuthored"): Promise<string> {
        const m = await osmod();
        const h = m.ccall("osls_new", "number", [], []) as number;
        try {
            m.ccall("osls_set_id", null, ["number", "string"], [h, this.id]);
            m.ccall("osls_set_name", null, ["number", "string"], [h, this.name]);
            if (this.description) m.ccall("osls_set_description", null, ["number", "string"], [h, this.description]);
            if (this.vendor) m.ccall("osls_set_vendor", null, ["number", "string"], [h, this.vendor]);
            for (const t of this.tags) m.ccall("osls_add_tag", null, ["number", "string"], [h, t]);

            const addSpeaker = ["number", "string", "string", "string", "number", "number", "number", "number", "number"];
            for (const s of this.speakers) {
                const idx = (s.authoredPolar
                    ? m.ccall("osls_add_speaker", "number", addSpeaker, [h, s.id, s.label, s.sp, s.isLFE ? 1 : 0, 1, s.authoredPolar.az, s.authoredPolar.el, s.authoredPolar.dist])
                    : m.ccall("osls_add_speaker", "number", addSpeaker, [h, s.id, s.label, s.sp, s.isLFE ? 1 : 0, 0, s.cartesian.x, s.cartesian.y, s.cartesian.z])) as number;
                for (const a of s.aliases) m.ccall("osls_speaker_add_alias", null, ["number", "number", "string"], [h, idx, a]);
            }
            for (const spec of Object.keys(this.orderings).sort())
                for (const id of this.orderings[spec]) m.ccall("osls_ordering_add", null, ["number", "string", "string"], [h, spec, id]);

            const errPtr = m._malloc(1024);
            try {
                const out = m.ccall("osls_to_yaml", "number", ["number", "number", "number", "number"], [h, WRITE_FRAME[frame], errPtr, 1024]) as number;
                if (out === 0) throw new OSLSError(m.UTF8ToString(errPtr));
                const yaml = m.UTF8ToString(out);
                m.ccall("osls_string_free", null, ["number"], [out]);
                return yaml;
            } finally { m._free(errPtr); }
        } finally { m.ccall("osls_free", null, ["number"], [h]); }
    }
}

function readLayout(m: OSLSModule, h: number): Layout {
    const L = new Layout();
    L.id = m.ccall("osls_id", "string", ["number"], [h]) as string;
    L.name = m.ccall("osls_name", "string", ["number"], [h]) as string;
    L.description = m.ccall("osls_description", "string", ["number"], [h]) as string;
    L.vendor = m.ccall("osls_vendor", "string", ["number"], [h]) as string;

    const tagN = m.ccall("osls_tag_count", "number", ["number"], [h]) as number;
    for (let i = 0; i < tagN; i++) L.tags.push(m.ccall("osls_tag", "string", ["number", "number"], [h, i]) as string);

    const n = m.ccall("osls_channel_count", "number", ["number"], [h]) as number;
    const pos = m._malloc(24);
    try {
        for (let i = 0; i < n; i++) {
            m.ccall("osls_speaker_position", "number", ["number", "number", "number", "number", "number", "number"], [h, i, 0, pos, pos + 8, pos + 16]);
            const cartesian = { x: m.getValue(pos, "double"), y: m.getValue(pos + 8, "double"), z: m.getValue(pos + 16, "double") };
            const s: Speaker = {
                id: m.ccall("osls_speaker_id", "string", ["number", "number"], [h, i]) as string,
                label: m.ccall("osls_speaker_label", "string", ["number", "number"], [h, i]) as string,
                sp: m.ccall("osls_speaker_sp", "string", ["number", "number"], [h, i]) as string,
                isLFE: (m.ccall("osls_speaker_is_lfe", "number", ["number", "number"], [h, i]) as number) !== 0,
                aliases: [],
                cartesian,
                polar: cartesianToPolar(cartesian),
            };
            const aN = m.ccall("osls_speaker_alias_count", "number", ["number", "number"], [h, i]) as number;
            for (let j = 0; j < aN; j++) s.aliases.push(m.ccall("osls_speaker_alias", "string", ["number", "number", "number"], [h, i, j]) as string);
            L.speakers.push(s);
        }
    } finally { m._free(pos); }

    const specN = m.ccall("osls_spec_count", "number", ["number"], [h]) as number;
    if (specN > 0) {
        const cap = Math.max(n, 1);
        const idxPtr = m._malloc(cap * 4);
        try {
            for (let k = 0; k < specN; k++) {
                const spec = m.ccall("osls_spec_name", "string", ["number", "number"], [h, k]) as string;
                const count = m.ccall("osls_order_for_spec", "number", ["number", "string", "number", "number"], [h, spec, idxPtr, cap]) as number;
                if (count > 0) {
                    const ids: string[] = [];
                    for (let t = 0; t < count; t++) {
                        const si = m.getValue(idxPtr + t * 4, "i32");
                        ids.push(m.ccall("osls_speaker_id", "string", ["number", "number"], [h, si]) as string);
                    }
                    L.orderings[spec] = ids;
                }
            }
        } finally { m._free(idxPtr); }
    }
    return L;
}

export const OSLS = {
    parse: (text: string): Promise<Layout> => Layout.parse(text),
    load: (url: string): Promise<Layout> => Layout.load(url),
    Layout,
    speaker,
    polarToCartesian,
    cartesianToPolar,
};
