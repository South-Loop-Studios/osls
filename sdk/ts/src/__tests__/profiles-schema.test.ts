import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const here = dirname(fileURLToPath(import.meta.url));
const profilesDir = join(here, "../../../../profiles");
const schema = JSON.parse(readFileSync(join(here, "../../../../schema/osls-profile.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const files = readdirSync(profilesDir).filter((f) => f.endsWith(".json"));

describe("format profiles", () => {
  it("ships exactly the expected profile files", () => {
    expect(files.sort()).toEqual(["adm.json", "auro-3d.json", "iamf.json", "mpegh.json"]);
  });
  it.each(files)("%s is schema-valid", (file) => {
    const data = JSON.parse(readFileSync(join(profilesDir, file), "utf8"));
    validate(data);
    expect(validate.errors ?? []).toEqual([]);
  });
  it("normative profiles have layouts; stubs have none", () => {
    for (const file of files) {
      const p = JSON.parse(readFileSync(join(profilesDir, file), "utf8"));
      const n = Object.keys(p.layouts ?? {}).length;
      if (p.status === "normative") expect(n).toBeGreaterThan(0);
      else expect(n).toBe(0);
    }
  });
});
