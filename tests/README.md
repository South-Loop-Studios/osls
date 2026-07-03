# OSLS conformance fixtures

## Running the gate

```sh
pip install -r tests/requirements.txt
python tests/validate.py
```

[`validate.py`](validate.py) is the interim validation + conformance gate (until
`osls-core` lands at roadmap P1). It enforces the full SPEC §4 ruleset over every
layout in [`../layouts`](../layouts) — JSON-Schema validity, Cartesian/polar
consistency (ε = 0.01), unique ids, orderings that are permutations of the
speaker set, identity sanity — and checks each layout against its fixture below
(channel order by SP-label, channel count, LFE set). It exits non-zero with
`path: reason` errors on any failure. The [`conformance`](../.github/workflows/conformance.yml)
GitHub Actions workflow runs it on every push and PR that touches `layouts/`,
`schema/`, or `tests/`.

---


This directory holds the **conformance test fixtures** for the blessed layout
set in [`../layouts`](../layouts). They are the independent source of truth that
the future `osls-core` conformance test (roadmap **P1**) checks every blessed
`.osls` file against, so a file claiming e.g. `iamf` 7.1.4 with the wrong
channel order fails the build (SPEC §4 rule 6).

## Why SP-labels, not ids

Each fixture expresses the expected per-spec channel order as a list of
**ITU-R BS.2051 SP-labels** (`M+030`, `U+045`, `LFE1`, …) — the cross-vendor
identity (SPEC §1, §2.2) — *not* the layout-local `id`/`label`, which a file is
free to choose. The conformance test:

1. loads `layouts/<id>.osls`,
2. for each `spec` in the fixture's `orderings`, maps the file's
   `orderings[spec]` (a list of speaker `id`s) to each speaker's `sp`,
3. asserts the resulting SP-label sequence equals the fixture's, and
4. asserts `channels` and the `lfe` SP-label set match.

This validates **order, channel count, and physical identity** at once, and is
independent of how any individual file labels its speakers.

## Fixture format

```yaml
layout: "7.1.4"          # matches the .osls id and file name
file: layouts/7.1.4.osls # path, relative to repo root
channels: 12             # total channel/speaker count
lfe: [LFE1]              # SP-labels of LFE speakers (0..N)
orderings:               # spec -> expected channel order, as SP-labels
  adm:  [M+030, M-030, M+000, LFE1, ...]
  iamf: [M+030, M+000, M-030, ...]
```

`native` (the `speakers` list order) is covered by `adm` where they coincide;
fixtures pin the per-spec orderings a file declares. A layout that declares only
`adm` (e.g. the front-wide 9.x layouts) has only `adm` here.

## Coverage

One fixture per blessed layout in `../layouts`:
`mono`, `stereo`, `quad`, `classic-quad`, `3.1.2`, `5.1`, `5.1.2`, `5.1.4`,
`7.1`, `7.1.2`, `7.1.4`, `7.1.6`, `9.1.4`, `9.1.6-wide`.
