import { parse as parseYaml } from "yaml";
import { Layout } from "./layout";
import { validateSchema, formatSchemaErrors } from "./schema";
import { semanticCheck } from "./validate";
import { OSLSError } from "./types";
import type { RawOsls } from "./raw";

// Parse `.osls` text into a Layout: YAML -> structural (schema) validation ->
// build -> semantic (SPEC §4) validation. Throws OSLSError on any failure.
// Synchronous so tests and the editor's I/O paths need no await.
export function parseLayout(text: string): Layout {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    throw new OSLSError(`YAML parse error: ${(e as Error).message}`);
  }

  if (!validateSchema(raw)) {
    throw new OSLSError(`invalid .osls: ${formatSchemaErrors(validateSchema.errors)}`);
  }

  const layout = Layout.fromRaw(raw as RawOsls);

  const issues = semanticCheck(layout.toData());
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new OSLSError(
      `invalid .osls: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
      issues,
    );
  }

  return layout;
}
