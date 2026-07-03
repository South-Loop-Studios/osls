# OSLS — Orbit Speaker Layout System

**Specification v1 (draft).** 2026-06-24.

OSLS is an open, format-agnostic way to describe a loudspeaker layout as a single human-readable file (`.osls`, YAML). One file = one layout (the *rig*: where the speakers are, what they're called, and how their channels are ordered in each delivery spec). The format does not care whether a layout already exists in some standard — 7.1.4, 9.1.6, 22.2, Auro, an arbitrary 8-speaker rig — they are all just files.

A consuming SDK reads an `.osls` file and the layout is immediately defined: positions, labels, channel order per spec, and LFE handling. Apps build panners, meters, routing matrices, and binaural virtual-speaker sets directly from it.

> **What OSLS is *not*.** It is not a routing/patch map (which physical output a channel goes to is app/session state), and it is not a renderer (down-mix coefficients, panning math, and HRTF processing live in the consuming engine). OSLS is **pure layout description** — geometry, identity, ordering. Keeping it that small is the point.

---

## 1. Core model

A layout has three layers:

1. **Geometry (universal).** The speakers and where they physically are. A 7.1.4 rig is the same physical thing regardless of delivery spec.
2. **Identity.** Each speaker carries a stable cross-vendor identity (an ITU-R BS.2051 SP-label) plus a short display label and any true aliases — so consumers route by *identity*, never by a fragile display string.
3. **Spec orderings.** How the geometry maps to a named **channel order** in each delivery spec (ADM, IAMF, MPEG-H…). This is where specs differ — e.g. IAMF moves C to index 1 and LFE to last — and is exactly what a flat "channel list" gets wrong. For blessed layouts the orders live in the **profiles registry** (`profiles/<format>.json`), keyed by ITU-R BS.2051 `sp` label, not inline in the layout file.

A purely custom layout may carry only geometry + a `native` ordering (inline `orderings`). A blessed preset (e.g. normative ADM/IAMF 7.1.4) carries no inline orderings — its per-spec order is resolved from the profiles registry via `layout.ordering(format)`.

---

## 2. File format

`.osls` is **YAML** conforming to `schema/osls.schema.json`. (`.osls` is the canonical extension and the schema is the contract; the underlying encoding is plain YAML so files are hand-authorable and diffable.)

### 2.1 Top-level fields

| Field | Req | Type | Meaning |
|---|---|---|---|
| `osls` | ✓ | int | Spec major version (`1`). |
| `id` | ✓ | string | Stable layout identifier, kebab/dotted, unique within a namespace (e.g. `7.1.4`, `9.1.6`, `my-room`). |
| `name` | ✓ | string | Human display name (`"7.1.4"`). |
| `description` | – | string | Free text. |
| `vendor` | – | string | Reverse-DNS namespace for custom layouts to avoid collisions (e.g. `io.orbitspatial`, `com.example`). Blessed layouts use `io.orbitspatial`. |
| `tags` | – | string[] | Discovery/filtering (`[home, immersive]`). |
| `frame` | – | enum | *Advisory* — the layout's **reference frame**: `egocentric` (listener-relative — speakers on a sphere at BS.2051 angles) or `allocentric` (room-anchored — positions in a normalized cube). Independent of the storage representation (§2.2); sets a visual editor's default view; **not a constraint**. |
| `speakers` | ✓ | Speaker[] | The geometry. **The list order is the layout's native channel order.** |
| `aliases` | – | map | Layout-level true-alias map (`{ Lss: [Ls], Lrs: [Lsr] }`). May also be set per speaker. |
| `orderings` | – | map | `spec → [speaker id…]`. `native` is implied by the `speakers` order; add `adm`, `iamf`, `mpegh`, etc. as needed. |

### 2.2 Speaker

| Field | Req | Type | Meaning |
|---|---|---|---|
| `id` | ✓ | string | Layout-local stable key, referenced by `orderings` (usually equals the canonical short label, e.g. `Lss`). Unique within the file. |
| `label` | ✓ | string | Short display label in the layout's canonical vocabulary (spec vocabulary recommended: `Lss`/`Rss` side, `Lw`/`Rw` wide, `Lrs`/`Rrs` rear). |
| `sp` | – | string | **ITU-R BS.2051 SP-label** — the cross-vendor canonical identity (`M+090`, `U+045`, `T+000`, `B+000`, `LFE1`). Strongly recommended for any speaker that maps to a standard position; this is what enables reliable cross-tool interop and alias resolution. |
| `lfe` | – | bool | `true` for an LFE/sub channel (excluded from positional panning). Default `false`. |
| **position** | ✓ | — | **At least one** of the two representations below; a speaker MAY carry **both** (consistency rule below). |
| `x` `y` `z` | cart | number | Cartesian, **ADM object frame**: X left −1 → right +1, Y back −1 → front +1, Z bottom −1 → top +1; unit-cube normalised. The three are required *together*. |
| `az` `el` | polar | number | ADM polar: `az` 0° = front, **positive = listener's LEFT** (anti-clockwise from above); `el` positive = up. `az`+`el` required *together*; optional `dist` (default `1.0`, unit sphere). |
| `aliases` | – | string[] | True aliases for *this* speaker (`["Ls"]`). |

**Coordinate rule (both allowed; the consumer picks).** A speaker MUST carry **at least one** position representation and **MAY carry both** Cartesian (`x,y,z`) and polar (`az,el[,dist]`) on the same speaker — mixed freely across a file. When both are present, each consumer reads whichever frame it works in natively (a polar renderer reads `az/el`; a Cartesian engine reads `x/y/z`) with **no conversion at the consumer**. The two are equivalent representations of the **same point**, never two independent positions: if both are present the validator converts polar → Cartesian and **rejects the file** if they disagree by more than **ε = 0.01** in the normalised Cartesian frame (≈ 1°), so "pick either" is guaranteed to give the same position. The SDK normalises to one internal frame (Cartesian, ADM object frame) and can **emit either on query**, so a consumer can always request its preferred frame even when the file stored only the other.

**Reference frames — allocentric vs egocentric (`frame`).** A layout's `frame` names its **reference frame** (the ITU-R BS.2076 / ADM distinction) and is **independent of how positions are stored**. `egocentric` means listener-relative — speakers sit on a sphere at fixed angles from the listener (the ITU-R BS.2051 norm; **all the blessed layouts are egocentric**, their positional speakers on the unit sphere). `allocentric` means room-anchored — positions given in a normalized room cube (e.g. a measured room, or a Dolby bed). Crucially this is **not** the Cartesian/polar representation split: a rig stored as Cartesian `x/y/z` on the unit sphere is still *egocentric*. `frame` lets rendering software pick the correct presentation — a listener/sphere view for egocentric, a room/cube view for allocentric. `@orbitspatial/osls-core` exposes it as `layout.frame`. When `frame` is omitted, a consumer can **infer** it from the geometry — non-LFE speakers all within the unit sphere ⇒ egocentric (distances may vary inside it), a speaker pushed beyond it toward the room cube ⇒ allocentric (`@orbitspatial/osls-core`'s `detectFrame` / `layout.detectedFrame`). A declared `frame` that contradicts the geometry raises a validation **warning** (not an error — the declaration still wins).

Polar ↔ Cartesian conversion (ITU-R BS.2127 handedness; `az` positive = listener's left, angles in degrees):

```
x = −dist · cos(el) · sin(az)        az   = atan2(−x, y)
y =  dist · cos(el) · cos(az)        el   = asin(z / dist)
z =  dist · sin(el)                  dist = √(x² + y² + z²)
```

### 2.3 Orderings

`orderings` maps a spec name to the **channel order** as a list of speaker `id`s. Channel *N* of that spec carries the speaker at index *N*. The `speakers` list itself defines `native`.

**Blessed layouts carry no inline `orderings`.** Their per-spec channel orders are defined in the **format profiles** (`profiles/<format>.json`, see §Profiles) and resolved at runtime via `layout.ordering(format)`, which matches by `sp`. Inline `orderings` in an `.osls` file are **custom-layout-only** — valid and supported for any rig whose id has no profile entry, and take precedence over the profile when present (the escape hatch for non-standard or room-specific rigs). Example of an inline custom ordering (7.1.4 used for illustration only; in practice the file carries none):

```yaml
orderings:
  adm:  [L, R, C, LFE, Lss, Rss, Lrs, Rrs, Ltf, Rtf, Ltb, Rtb]
  iamf: [L, C, R, Lss, Rss, Lrs, Rrs, Ltf, Rtf, Ltb, Rtb, LFE]   # C→1, LFE last
```

**Orderings vs separate layouts (important).** `orderings` express the *same physical speaker set* in different channel orders — e.g. ADM 7.1.4 and IAMF 7.1.4 are the identical rig, only reordered. When two specs' same-*named* layout use a **different speaker set** (not just a different order), they are **different OSLS layouts in different files**, not orderings of one. The clearest example: a front-wide 9.1.6 uses front **wides** (`Lw/Rw`), while IAMF's expanded 9.1.6 uses **centre-fill** (`FLc/FRc`) and a different overhead set — different speakers, so `9.1.6-wide.osls` and `iamf-9.1.6.osls` are distinct files. Use `orderings` only when the speaker set is identical.

**Spec-specific labels (edge case).** Some same-set layouts merely rename channels per spec (e.g. IAMF labels sides `SiL/SiR` where ADM uses `Lss/Rss`). For those, an ordering entry (inline or in a profile's `order` array) may be an object instead of a bare sp: `{ sp: "M+090", label: "SiL" }`. v1 keeps the bare-sp/id form as the common case and the object form as the documented escape hatch.

## Profiles (per-format channel orders)

Spec-mandated channel orders live in `profiles/<format>.json`, one file per delivery format, keyed by
ITU-R BS.2051 `sp` label — **not** inline in each layout. A profile maps `layout-id → { order: [sp…] }`;
`@orbitspatial/osls-core`'s `layout.ordering(format)` projects it onto a rig by matching `sp`, returning the speaker
ids in channel order plus a `missing` list (positions the format expects that the rig lacks — the signal
that a consumer must render/pan rather than reindex). Inline `orderings` in an `.osls` remain valid for
**custom** rigs whose id has no profile entry (and override the profile when present). The registry is the
single, conformance-checked source of format order; see `profiles/README.md`.

---

## 3. Naming convention

- **File name:** `<id>.osls` (e.g. `7.1.4.osls`, `9.1.6.osls`, `stereo.osls`, `mono.osls`).
- **Custom layouts:** namespace with `vendor` reverse-DNS inside the file; the file may be `<vendor>.<id>.osls` to avoid collisions (e.g. `com.example.room-a.osls`). Blessed layouts use `vendor: io.orbitspatial` and the bare `<id>.osls` name.
- **Blessed set** lives in `layouts/` in this repo, is version-pinned, validated against the standards, and is the normative reference for ADM/IAMF/MPEG-H layouts. Custom files live anywhere the consuming app looks.

---

## 4. Validation (what makes "drop a file and it works" trustworthy)

The SDK MUST validate before accepting a layout. Rules:

1. **Schema-valid** against `osls.schema.json`.
2. **Position present & consistent** — every speaker carries at least one complete representation (`x,y,z` or `az,el`). A speaker may carry **both**; if it does, they MUST resolve to the same point within **ε = 0.01** in the normalised Cartesian frame (≈ 1°). See §2.2.
3. **Unique speaker `id`s**; every `orderings` entry references an existing `id` exactly once and covers every speaker (orderings are permutations of the speaker set).
4. **LFE rules** — `lfe` speakers carry no positional contribution to panning; a layout may have 0..N LFEs; LFEs still appear in orderings (specs place them differently).
5. **Identity sanity** — distinct physical positions must not collapse to the same `sp` (e.g. side `M+090` ≠ wide `M+060`); aliases must be true aliases, never cross-position.
6. **Profiles** are checked against the standard orders, and every blessed layout must project completely (`missing === []`) for each format that defines it (the conformance test in CI). A profile entry whose `order` array omits a speaker that the rig carries — or adds a position the rig lacks — fails the build, so the profiles are the always-correct, conformance-gated source of format order.

Validation failures return structured errors (path + reason), never silent acceptance.

---

## 5. Worked example — `7.1.4.osls`

```yaml
osls: 1
id: "7.1.4"
name: "7.1.4"
description: "7.1.4 home immersive layout (7 ear-level + LFE + 4 overhead)."
vendor: io.orbitspatial
tags: [home, immersive]
frame: egocentric   # listener-relative (speakers on the unit sphere at BS.2051 angles)
speakers:   # both representations carried; az positive = left. Cartesian and polar are the SAME point (validator-checked).
  - { id: L,   label: L,   sp: M+030, x: -0.5,   y:  0.866, z: 0.0,   az:   30, el:  0 }
  - { id: R,   label: R,   sp: M-030, x:  0.5,   y:  0.866, z: 0.0,   az:  -30, el:  0 }
  - { id: C,   label: C,   sp: M+000, x:  0.0,   y:  1.0,   z: 0.0,   az:    0, el:  0 }
  - { id: LFE, label: LFE, sp: LFE1,  x:  0.0,   y:  1.0,   z: -0.5,  lfe: true }   # Cartesian only — both is optional per speaker
  - { id: Lss, label: Lss, sp: M+090, x: -1.0,   y:  0.0,   z: 0.0,   az:   90, el:  0, aliases: [Ls] }
  - { id: Rss, label: Rss, sp: M-090, x:  1.0,   y:  0.0,   z: 0.0,   az:  -90, el:  0, aliases: [Rs] }
  - { id: Lrs, label: Lrs, sp: M+135, x: -0.707, y: -0.707, z: 0.0,   az:  135, el:  0, aliases: [Lsr] }
  - { id: Rrs, label: Rrs, sp: M-135, x:  0.707, y: -0.707, z: 0.0,   az: -135, el:  0, aliases: [Rsr] }
  - { id: Ltf, label: Ltf, sp: U+045, x: -0.5,   y:  0.5,   z: 0.707, az:   45, el: 45 }
  - { id: Rtf, label: Rtf, sp: U-045, x:  0.5,   y:  0.5,   z: 0.707, az:  -45, el: 45 }
  - { id: Ltb, label: Ltb, sp: U+135, x: -0.5,   y: -0.5,   z: 0.707, az:  135, el: 45, aliases: [Ltr] }
  - { id: Rtb, label: Rtb, sp: U-135, x:  0.5,   y: -0.5,   z: 0.707, az: -135, el: 45, aliases: [Rtr] }
```

The same geometry, one file, **and both coordinate frames** — a Cartesian engine reads `x/y/z`, a polar renderer reads `az/el`, and the validator guarantees they're the same rig. No drift. The ADM and IAMF channel orders are not inline here; they are resolved from `profiles/adm.json` and `profiles/iamf.json` at runtime via `layout.ordering("adm")` / `layout.ordering("iamf")`.

---

## 6. Versioning & stability

- `osls: <major>` gates breaking schema changes. Additive fields don't bump the major.
- Blessed layout files are stable identifiers; a corrected blessed file is a patch, never a renamed id.
- The JSON Schema (`schema/osls.schema.json`) is the single contract shared by every consumer (the C++ SDK and the browser designer) — they all validate against it so they cannot drift.

## 7. Licensing

- The **entire project** — the spec, JSON Schema, the blessed `.osls` layout files, the reference SDK, and the tools — is licensed under **Apache-2.0** (permissive + explicit patent grant). Redistributing the spec or layout files requires preserving the license and attribution notices; implementing the format in your own code is unrestricted (formats and ideas aren't copyrightable).
- "OSLS", "Orbit Speaker Layout System", and the `.osls` extension are South Loop Studios marks; implement the format freely, but don't ship a fork *called* OSLS.

## References

OSLS is defined in terms of these published standards; they are **referenced and implemented, not redistributed**, and each remains the copyright of its publisher.

- **ITU-R BS.2051** — *Advanced sound system for programme production*. Loudspeaker positions, the SP-label vocabulary (`M+030`, `U+045`, `T+000`, `LFE1`, …), and the named Systems (A–J) — the basis for the `sp` identity and the blessed layouts. (International Telecommunication Union.)
- **ITU-R BS.2076** — *Audio Definition Model (ADM)*. The Cartesian (allocentric) and polar (egocentric) coordinate frames of §2.2 and the ADM channel model. (ITU.)
- **ITU-R BS.2127** — *Audio Definition Model renderer for advanced sound systems*. The polar ↔ Cartesian conversion and handedness used in §2.2. (ITU.)
- **AOM IAMF** — *Immersive Audio Model and Formats* (Alliance for Open Media). The IAMF channel orderings in `profiles/iamf.json`.
- **ISO/IEC 23008-3 (MPEG-H 3D Audio)** — referenced for the `mpegh` profile (stub).
