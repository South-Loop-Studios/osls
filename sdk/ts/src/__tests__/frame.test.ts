import { describe, it, expect } from "vitest";
import { parseLayout, PRESETS, detectFrame, semanticCheck } from "../index";

// A speaker pushed beyond the unit sphere (toward the room-cube's corners) → allocentric.
const CUBE = `osls: 1
id: cube
name: cube
speakers:
  - { id: A, label: A, x: 0, y: 1, z: 0 }
  - { id: B, label: B, x: 1, y: 1, z: 0 }
  - { id: C, label: C, x: 1, y: 1, z: 1 }
`;

// Varying distances, but every speaker still inside the unit sphere → egocentric.
const NEARFIELD = `osls: 1
id: nearfield
name: nearfield
speakers:
  - { id: A, label: A, x: 0,   y: 0.5, z: 0 }
  - { id: B, label: B, x: 0.7, y: 0.7, z: 0 }
  - { id: C, label: C, x: 0,   y: 1.0, z: 0 }
`;

describe("reference frame — field, detection, and mismatch", () => {
  it("blessed layouts declare frame: egocentric and the geometry agrees", () => {
    const l = parseLayout(PRESETS["7.1.4"]);
    expect(l.frame).toBe("egocentric");
    expect(l.detectedFrame).toBe("egocentric");
  });

  it("detectFrame: within the unit sphere = egocentric, beyond it = allocentric", () => {
    expect(detectFrame(parseLayout(PRESETS["5.1"]).speakers)).toBe("egocentric");
    expect(parseLayout(CUBE).detectedFrame).toBe("allocentric"); // radii up to √3
  });

  it("egocentric allows varying distances *within* the sphere, not one fixed radius", () => {
    // radii 0.5, ~0.99, 1.0 — all ≤ 1, so still directional/egocentric
    expect(parseLayout(NEARFIELD).detectedFrame).toBe("egocentric");
  });

  it("effectiveFrame falls back to the detected frame when frame is absent", () => {
    const cube = parseLayout(CUBE);
    expect(cube.frame).toBeUndefined();
    expect(cube.effectiveFrame).toBe("allocentric");
  });

  it("warns (non-throwing) when the declared frame contradicts the geometry", () => {
    const text = PRESETS["7.1.4"].replace("frame: egocentric", "frame: allocentric");
    const l = parseLayout(text); // does not throw — a mismatch is a warning, not an error
    expect(l.frame).toBe("allocentric");
    const issues = semanticCheck(l.toData());
    const mismatch = issues.find((i) => i.path === "frame");
    expect(mismatch?.severity).toBe("warning");
    expect(mismatch?.message).toContain("egocentric");
  });
});
