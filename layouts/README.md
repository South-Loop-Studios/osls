# Blessed layouts

The **blessed core set** — spec-verified `.osls` layouts that ship with OSLS as
the normative reference for standard formats. Licensed under
[Apache-2.0](../LICENSE), so anyone can redistribute or build on them (with attribution).

Each file is validated against [`../schema/osls.schema.json`](../schema/osls.schema.json)
and its per-spec channel order is pinned by a conformance fixture in
[`../tests/conformance`](../tests/conformance) (SPEC §4 rule 6). Custom layouts
live anywhere your app looks; these are just the curated standards.

## Catalogue

| Layout | Name | Ear-level | LFE | Overhead | Total | Orderings |
|---|---|--:|--:|--:|--:|---|
| [`mono`](./mono.osls) | Mono | 1 | 0 | 0 | **1** | adm, iamf |
| [`stereo`](./stereo.osls) | Stereo (2.0) | 2 | 0 | 0 | **2** | adm, iamf |
| [`quad`](./quad.osls) | Quad (4.0) | 4 | 0 | 0 | **4** | adm |
| [`classic-quad`](./classic-quad.osls) | Quad (classic corner square) | 4 | 0 | 0 | **4** | adm |
| [`3.1.2`](./3.1.2.osls) | 3.1.2 | 3 | 1 | 2 | **6** | adm, iamf |
| [`5.1`](./5.1.osls) | 5.1 | 5 | 1 | 0 | **6** | adm, iamf |
| [`5.1.2`](./5.1.2.osls) | 5.1.2 | 5 | 1 | 2 | **8** | adm, iamf |
| [`5.1.4`](./5.1.4.osls) | 5.1.4 | 5 | 1 | 4 | **10** | adm, iamf |
| [`7.1`](./7.1.osls) | 7.1 | 7 | 1 | 0 | **8** | adm, iamf |
| [`7.1.2`](./7.1.2.osls) | 7.1.2 | 7 | 1 | 2 | **10** | adm, iamf |
| [`7.1.4`](./7.1.4.osls) | 7.1.4 | 7 | 1 | 4 | **12** | adm, iamf |
| [`7.1.6`](./7.1.6.osls) | 7.1.6 | 7 | 1 | 6 | **14** | adm, iamf |
| [`9.1.4`](./9.1.4.osls) | 9.1.4 | 9 | 1 | 4 | **14** | adm |
| [`9.1.6-wide`](./9.1.6-wide.osls) | 9.1.6 (wide) | 9 | 1 | 6 | **16** | adm |
| [`22.2`](./22.2.osls) | 22.2 (BS.2051 System H; 3 below ear level) | 10 | 2 | 9 | **24** | native |

*Ear-level / Overhead* count non-LFE speakers at and above the listening plane
(`z > 0`). *Total* is the channel count. *Orderings* lists the delivery specs
each file pins a channel order for (`native` = the `speakers` list order, always
implied).

## Conventions used here

- **ADM** orderings follow ITU-R BS.2051 channel order; **IAMF** moves C to
  index 1 and LFE to last (see each file and SPEC §2.3).
- **Height pairs:** `.2` = top-middle (U±90); `.4` = top-front + top-back
  (U±45, U±135); `.6` = top-front + top-middle + top-back. `3.1.2` is the
  exception — a front-oriented soundbar layout, so its pair is top-front.
- **Front-wide 9.x** (`9.1.4`, `9.1.6-wide`) add front wides (Lw/Rw, M±60) and carry
  an ADM ordering only. IAMF's expanded 9.1.6 uses a different speaker set
  (centre-fill FLc/FRc) and would be a separate file.

## Not yet here

`22.2`, IAMF `9.1.6` (centre-fill), Auro-3D (9.1/10.1/11.1), and `11.1.4`/`11.1.6`
(floor speaker set TBC). Contributions welcome — see
[`../CONTRIBUTING.md`](../CONTRIBUTING.md).
