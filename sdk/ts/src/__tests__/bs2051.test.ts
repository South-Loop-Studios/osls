import { describe, it, expect } from "vitest";
import { positionForLabel, defaultFriendlyLabel, nearestLabel } from "../bs2051";

describe("BS.2051 — positionForLabel", () => {
  it("returns nominal angles for known labels", () => {
    expect(positionForLabel("M+030")).toEqual({ az: 30, el: 0 });
    expect(positionForLabel("M-030")).toEqual({ az: -30, el: 0 });
    expect(positionForLabel("U+045")).toEqual({ az: 45, el: 30 });
    expect(positionForLabel("B+090")).toEqual({ az: 90, el: -30 });
    expect(positionForLabel("T+000")).toEqual({ az: 0, el: 90 });
  });

  it("returns null for non-positional and unknown labels", () => {
    expect(positionForLabel("LFE1")).toBeNull();
    expect(positionForLabel("M+SC")).toBeNull();
    expect(positionForLabel("nope")).toBeNull();
  });
});

describe("BS.2051 — defaultFriendlyLabel", () => {
  it("maps known SP-labels to curated friendly names", () => {
    expect(defaultFriendlyLabel("M+000")).toBe("C");
    expect(defaultFriendlyLabel("M+030")).toBe("L");
    expect(defaultFriendlyLabel("U+045")).toBe("Ltf");
    expect(defaultFriendlyLabel("LFE1")).toBe("LFE");
  });
  it("falls back to the SP-label when no curated default exists", () => {
    expect(defaultFriendlyLabel("B+022")).toBe("B+022");
  });
});

describe("BS.2051 — nearestLabel", () => {
  it("matches an exact nominal position within range", () => {
    const n = nearestLabel(30, 0)!;
    expect(n.sp).toBe("M+030");
    expect(n.friendly).toBe("L");
    expect(n.deltaDeg).toBeCloseTo(0, 6);
    expect(n.withinRange).toBe(true);
  });

  it("respects the tolerance", () => {
    expect(nearestLabel(33, 2)!.sp).toBe("M+030");
    expect(nearestLabel(33, 2)!.withinRange).toBe(true); // within default 5°
    expect(nearestLabel(33, 2, 1)!.withinRange).toBe(false); // not within 1°
  });

  it("handles the ±180 azimuth wrap (great-circle)", () => {
    expect(nearestLabel(179, 0)!.sp).toBe("M+180");
    expect(nearestLabel(-179, 0)!.sp).toBe("M+180");
  });

  it("matches T+000 near the top pole regardless of azimuth", () => {
    expect(nearestLabel(0, 89)!.sp).toBe("T+000");
    expect(nearestLabel(123, 88)!.sp).toBe("T+000");
  });

  it("reports the nearest with withinRange:false for an off-grid position", () => {
    const n = nearestLabel(0, 12)!; // between M+000 (el0) and U+000 (el30)
    expect(n.sp).toBe("M+000");
    expect(n.withinRange).toBe(false);
    expect(n.deltaDeg).toBeCloseTo(12, 1);
  });

  it("never suggests a non-positional label", () => {
    for (const [az, el] of [
      [30, 0],
      [90, 0],
      [0, 90],
      [200, 0],
    ] as const) {
      const sp = nearestLabel(az, el)!.sp;
      expect(["LFE1", "LFE2", "M+SC", "M-SC"]).not.toContain(sp);
    }
  });
});
