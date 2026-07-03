import { describe, it, expect } from "vitest";
import { cartesianToPolar, polarToCartesian, EPSILON } from "../geometry";

describe("geometry", () => {
  it("matches the known 7.1.4 front pair (az ±30)", () => {
    // L: az 30 -> x -0.5, y 0.866; R: az -30 -> x 0.5
    const L = polarToCartesian({ az: 30, el: 0, dist: 1 });
    expect(L.x).toBeCloseTo(-0.5, 3);
    expect(L.y).toBeCloseTo(0.866, 3);
    expect(L.z).toBeCloseTo(0, 6);

    const R = polarToCartesian({ az: -30, el: 0, dist: 1 });
    expect(R.x).toBeCloseTo(0.5, 3);
  });

  it("puts +az on the listener's left (−x) and +el up (+z)", () => {
    expect(polarToCartesian({ az: 90, el: 0, dist: 1 }).x).toBeCloseTo(-1, 6);
    expect(polarToCartesian({ az: 0, el: 90, dist: 1 }).z).toBeCloseTo(1, 6);
    expect(polarToCartesian({ az: 0, el: 0, dist: 1 }).y).toBeCloseTo(1, 6);
  });

  it("round-trips cartesian -> polar -> cartesian within ε", () => {
    const samples = [
      { x: -0.5, y: 0.866, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: -0.5, y: 0.5, z: 0.707 },
      { x: 0.707, y: -0.707, z: 0 },
    ];
    for (const c of samples) {
      const back = polarToCartesian(cartesianToPolar(c));
      expect(back.x).toBeCloseTo(c.x, 6);
      expect(back.y).toBeCloseTo(c.y, 6);
      expect(back.z).toBeCloseTo(c.z, 6);
    }
  });

  it("exports the SPEC §4 agreement tolerance", () => {
    expect(EPSILON).toBe(0.01);
  });
});
