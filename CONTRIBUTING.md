# Contributing to OSLS

Thanks for helping build an open speaker-layout standard. Contributions are welcome — new layouts, spec refinements, SDK code, and docs.

## How PRs are merged

Anyone can fork OSLS, open a pull request, and have it reviewed. **Only South Loop Studios maintainers merge to `main`.** External contributors don't have write access, and `main` is branch-protected — every change lands via a reviewed pull request (no direct pushes, no force-pushes, stale approvals dismissed on new commits). A maintainer reviews each PR — against the source standard for blessed layouts — before merging, which keeps the blessed set and the channel-order interchange contracts authoritative.

## Developer Certificate of Origin (DCO)

We use the [DCO](https://developercertificate.org/) rather than a CLA. By signing off your commits you certify you wrote the contribution (or have the right to submit it under the project's licenses). Add a `Signed-off-by` line to each commit:

```
git commit -s -m "Add Auro 9.1 layout"
```

which appends `Signed-off-by: Your Name <you@example.com>`.

## Licensing of contributions

By contributing you agree your work is licensed under the project's terms:
- **Everything** — the spec, JSON Schema, `.osls` layout files, SDK, and tools → Apache-2.0.

## Adding a layout

1. Add `layouts/<id>.osls` (or `<vendor>.<id>.osls` for namespaced custom layouts).
2. It must validate against [`schema/osls.schema.json`](schema/osls.schema.json) **and** the semantic rules in [`docs/SPEC.md`](docs/SPEC.md) §4.
3. For a **blessed** layout claiming a normative spec (ADM/IAMF/MPEG-H), the channel `orderings` must match the standard exactly — CI runs a conformance check, and a maintainer reviews against the source standard.
4. Use the **ITU-R BS.2051 SP-label** (`sp:`) for any speaker at a standard position, and add only **true** aliases (never alias distinct positions — e.g. side `Lss` is not wide `Lw`).
5. Add a matching fixture in [`tests/conformance/<id>.yaml`](tests/conformance) pinning each ordering by SP-label (see [`tests/README.md`](tests/README.md)). Every layout must have one.

## Continuous integration

The **`conformance`** workflow ([`.github/workflows/conformance.yml`](.github/workflows/conformance.yml)) is a **required check** — it must be green before a PR can merge into `main`. It runs [`tests/validate.py`](tests/validate.py), which enforces the full SPEC §4 ruleset (schema validity, Cartesian/polar consistency, unique ids, permutation orderings, identity sanity) and checks every layout against its conformance fixture (channel order by SP-label, channel count, LFE set). Run it locally before pushing:

```sh
pip install -r tests/requirements.txt
python tests/validate.py
```

It exits non-zero with `path: reason` errors on any failure, so a wrong channel order or a missing fixture fails fast.

## Spec / schema changes

Open an issue first for anything touching the schema or the spec model — the JSON Schema is the shared contract for the SDK and the web designer, so changes ripple. Additive fields are easy; breaking changes bump `osls:` major.

## Quality bar

OSLS is a public South Loop open standard. Match the polish of the existing spec, schema, and layouts; keep it modular (one file per layout, one small SDK); be precise (these channel orders are interchange contracts).
