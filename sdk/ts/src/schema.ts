import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
import schema from "../../../schema/osls.schema.json";

// Structural validation against the project's authoritative JSON Schema
// (../schema/osls.schema.json), pulled in by relative path and inlined into the
// build by tsup/esbuild, so the canonical schema stays the single source of truth.
//
// The schema declares draft 2020-12, so we use Ajv's 2020 build (the default
// `ajv` export is draft-07). `strict: false` tolerates the schema's non-standard
// "comment" annotation key on the speaker $def.
const ajv = new Ajv2020({ allErrors: true, strict: false });

export const validateSchema = ajv.compile(schema as object);

export function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return "schema validation failed";
  return errors
    .map((e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim())
    .join("; ");
}
