// Public surface of the pure-TS OSLS engine. Mirrors @orbitspatial/osls-core so consumers
// (and a future swap to the WASM build) see an identical API.

export type {
  Vec3,
  Polar,
  Speaker,
  Spec,
  WriteFrame,
  LayoutData,
  ValidationIssue,
  OrderEntry,
  Profile,
  ProfileLayout,
  Ordering,
  Frame,
  SpeakerArray,
} from "./types";
export { OSLSError } from "./types";
export {
  polarToCartesian,
  cartesianToPolar,
  EPSILON,
  approxEqualCartesian,
} from "./geometry";
export { speaker } from "./speaker";
export {
  BS2051_TOLERANCE_DEG,
  positionForLabel,
  defaultFriendlyLabel,
  nearestLabel,
  type NearestLabel,
} from "./bs2051";
export { BS2051_TABLE1, type Bs2051Entry } from "./bs2051.data";
export { PROFILES, profileOrder, formatsForLayout, spOf, labelOf } from "./profiles";
export { Layout } from "./layout";
export { parseLayout } from "./parse";
export { serializeLayout } from "./serialize";
export { semanticCheck } from "./validate";
export { detectFrame, FRAME_SPHERE_TOLERANCE } from "./frame";
export { PRESETS } from "./presets.generated";

import { Layout } from "./layout";
import { parseLayout } from "./parse";
import { speaker } from "./speaker";
import { cartesianToPolar, polarToCartesian } from "./geometry";

export const OSLS = {
  /** Parse `.osls` text. Async to mirror the WASM facade (resolves immediately here). */
  parse: (text: string): Promise<Layout> => Promise.resolve(parseLayout(text)),
  /** Fetch and parse a `.osls` file by URL. */
  load: async (url: string): Promise<Layout> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
    return parseLayout(await res.text());
  },
  Layout,
  speaker,
  polarToCartesian,
  cartesianToPolar,
};
