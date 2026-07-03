import { describe, it, expect } from "vitest";
import { PROFILES, profileOrder, formatsForLayout, spOf, labelOf } from "../profiles";

describe("profiles registry", () => {
  it("loads all four profiles", () => {
    expect(Object.keys(PROFILES).sort()).toEqual(["adm", "auro-3d", "iamf", "mpegh"]);
  });
  it("profileOrder returns the sp order for a known (format, layout)", () => {
    expect(profileOrder("iamf", "7.1.4")).toEqual(
      ["M+030", "M+000", "M-030", "M+090", "M-090", "M+135", "M-135", "U+045", "U-045", "U+135", "U-135", "LFE1"],
    );
    expect(profileOrder("adm", "stereo")).toEqual(["M+030", "M-030"]);
  });
  it("returns null for stub formats, unknown formats, and unknown layouts", () => {
    expect(profileOrder("mpegh", "7.1.4")).toBeNull();
    expect(profileOrder("nope", "7.1.4")).toBeNull();
    expect(profileOrder("iamf", "does-not-exist")).toBeNull();
  });
  it("formatsForLayout lists the normative formats that define a layout", () => {
    expect(formatsForLayout("7.1.4")).toEqual(["adm", "iamf"]);
    expect(formatsForLayout("quad")).toEqual(["adm"]);
    expect(formatsForLayout("7.1.2")).toEqual(["adm", "iamf"]);
  });
  it("spOf/labelOf handle bare and {sp,label} entries", () => {
    expect(spOf("M+090")).toBe("M+090");
    expect(spOf({ sp: "M+090", label: "SiL" })).toBe("M+090");
    expect(labelOf({ sp: "M+090", label: "SiL" })).toBe("SiL");
    expect(labelOf("M+090")).toBeUndefined();
  });
});
