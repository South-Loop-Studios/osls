import { describe, it, expect } from "vitest";
import { PRESETS, parseLayout } from "../index";

describe("PRESETS", () => {
  it("bundles the blessed layout set", () => {
    expect(Object.keys(PRESETS).length).toBeGreaterThanOrEqual(14);
    expect(PRESETS["7.1.4"]).toContain('id: "7.1.4"');
    expect(PRESETS["9.1.6-wide"]).toBeDefined(); // the renamed layout
    expect(PRESETS["dolby-9.1.6"]).toBeUndefined(); // old trademark name gone
  });

  it("every preset parses to a valid layout whose id matches its key", () => {
    for (const [id, text] of Object.entries(PRESETS)) {
      const l = parseLayout(text);
      expect(l.id).toBe(id);
    }
  });
});
