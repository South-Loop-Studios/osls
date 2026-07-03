import { describe, it, expect } from "vitest";
import { SCENE } from "./palette";

describe("scene palette (pinned to the designer's values)", () => {
  it("pins the speaker colours", () => {
    expect(SCENE.floorNode).toBe("#9AA0AB");
    expect(SCENE.heightNode).toBe("#3F73FF");
    expect(SCENE.lfeNode).toBe("#6b7280");
  });
});
