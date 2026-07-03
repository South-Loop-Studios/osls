// The on-disk YAML shape, as produced by `yaml.parse` and validated by the JSON Schema.
// This is the pre-normalisation form: positions may be cartesian, polar, or both, and
// orderings entries may be bare ids or { speaker, label } overrides.
import type { Frame } from "./types";

export interface RawSpeaker {
  id: string;
  label: string;
  sp?: string;
  lfe?: boolean;
  aliases?: string[];
  x?: number;
  y?: number;
  z?: number;
  az?: number;
  el?: number;
  dist?: number;
}

export type RawOrderingEntry = string | { speaker: string; label?: string };

export interface RawOsls {
  osls: number;
  id: string;
  name: string;
  description?: string;
  vendor?: string;
  tags?: string[];
  frame?: Frame;
  speakers: RawSpeaker[];
  aliases?: Record<string, string[]>;
  orderings?: Record<string, RawOrderingEntry[]>;
}
