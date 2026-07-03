import { describe, it, expect } from "vitest";
import { Matrix3 } from "three";
import { admToThree, admToThreeTuple, threeToAdm } from "./coords";

describe("ADM <-> Three coords", () => {
  it("maps (x, z, -y)", () => {
    expect(admToThreeTuple({ x: 1, y: 2, z: 3 })).toEqual([1, 3, -2]);
  });
  it("front (+Y adm) goes into the screen (-Z three)", () => {
    expect(admToThree({ x: 0, y: 1, z: 0 }).toArray()).toEqual([0, 0, -1]);
  });
  it("up (+Z adm) goes to up (+Y three)", () => {
    const [x, y, z] = admToThree({ x: 0, y: 0, z: 1 }).toArray();
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
  });
  it("preserves handedness (det +1 — never mirrors L/R)", () => {
    const c0 = admToThree({ x: 1, y: 0, z: 0 }).toArray();
    const c1 = admToThree({ x: 0, y: 1, z: 0 }).toArray();
    const c2 = admToThree({ x: 0, y: 0, z: 1 }).toArray();
    const m = new Matrix3().set(
      c0[0], c1[0], c2[0],
      c0[1], c1[1], c2[1],
      c0[2], c1[2], c2[2],
    );
    expect(m.determinant()).toBeCloseTo(1, 9);
  });
  it("round-trips through threeToAdm", () => {
    expect(threeToAdm(admToThree({ x: 0.3, y: -0.5, z: 0.8 }))).toEqual({ x: 0.3, y: -0.5, z: 0.8 });
  });
});
