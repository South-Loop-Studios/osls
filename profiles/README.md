# OSLS format profiles

Spec-mandated channel orders, one file per delivery format, keyed by ITU-R BS.2051 `sp` label.
A layout file (`layouts/*.osls`) describes the *rig* (geometry + identity + native order); a profile
describes how a *format* orders that rig's channels. `@orbitspatial/osls-core`'s `layout.ordering(format)` projects
a profile onto a layout by matching `sp`.

## Files
- `iamf.json` — IAMF loudspeaker_layout orders (LFE last). Normative.
- `adm.json` — ITU-R BS.2076 bed write-orders (LFE early). ADM is self-describing on read; these are
  the standard WRITE orders. Normative.
- `mpegh.json`, `auro-3d.json` — stubs (`status: "stub"`); the format is recognised but unsupported.

## Shape
`{ format, status, encodes?, layouts: { <layout-id>: { order: (sp | {sp,label})[] } } }`.
An `order` entry is a bare `sp` string, or `{ "sp": "M+090", "label": "SiL" }` when a format renames a
channel. Keys in `layouts` are OSLS layout ids; a custom rig with a non-blessed id uses an inline
`orderings` block in its `.osls` instead.

## Adding a format
Add `profiles/<format>.json` (schema: `schema/osls-profile.schema.json`), transcribe the orders from the
format spec by `sp`, cite the spec in `encodes`/`note`, and add pins to the conformance tests.
