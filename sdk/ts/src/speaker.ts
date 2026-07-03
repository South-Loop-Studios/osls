import { cartesianToPolar, polarToCartesian } from "./geometry";
import type { Speaker } from "./types";

// Speaker factory — mirrors @orbitspatial/osls-core's `speaker` helper (sdk/wasm/src/osls.ts:61–74).
// Tracks the authored frame so `toOSLS("asAuthored")` round-trips faithfully.

export const speaker = {
  cartesian(
    id: string,
    o: { sp?: string; x: number; y: number; z: number; label?: string; aliases?: string[] },
  ): Speaker {
    const cartesian = { x: o.x, y: o.y, z: o.z };
    return {
      id,
      label: o.label ?? id,
      sp: o.sp ?? "",
      isLFE: false,
      aliases: o.aliases ?? [],
      cartesian,
      polar: cartesianToPolar(cartesian),
      authoredCartesian: { ...cartesian },
    };
  },

  polar(
    id: string,
    o: { sp?: string; az: number; el: number; dist?: number; label?: string; aliases?: string[] },
  ): Speaker {
    const p = { az: o.az, el: o.el, dist: o.dist ?? 1 };
    return {
      id,
      label: o.label ?? id,
      sp: o.sp ?? "",
      isLFE: false,
      aliases: o.aliases ?? [],
      cartesian: polarToCartesian(p),
      polar: p,
      authoredPolar: { ...p },
    };
  },

  lfe(
    id: string,
    o: { sp?: string; x: number; y: number; z: number; label?: string },
  ): Speaker {
    const cartesian = { x: o.x, y: o.y, z: o.z };
    return {
      id,
      label: o.label ?? id,
      sp: o.sp ?? "",
      isLFE: true,
      aliases: [],
      cartesian,
      polar: cartesianToPolar(cartesian),
      authoredCartesian: { ...cartesian },
    };
  },
};
