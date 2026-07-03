#!/usr/bin/env python3
"""OSLS conformance + validation gate.

Runs the full SPEC §4 ruleset over every blessed layout in ../layouts and checks
each against its conformance fixture in ./conformance. Interim reference checker
until osls-core (roadmap P1) lands; the rules mirror SPEC §4 so the two cannot
drift. Exits non-zero with structured "path: reason" errors on any failure.

Usage:  python3 tests/validate.py        (from the repo root or anywhere)
Deps:   PyYAML, jsonschema               (see tests/requirements.txt)
"""

from __future__ import annotations

import glob
import json
import math
import os
import sys

import yaml
from jsonschema import Draft202012Validator

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LAYOUTS_DIR = os.path.join(ROOT, "layouts")
FIXTURES_DIR = os.path.join(HERE, "conformance")
SCHEMA_PATH = os.path.join(ROOT, "schema", "osls.schema.json")
PROFILES_DIR = os.path.join(ROOT, "profiles")


def load_profiles() -> dict:
    """format -> profile doc (normative + stub)."""
    out = {}
    for path in sorted(glob.glob(os.path.join(PROFILES_DIR, "*.json"))):
        with open(path, "r", encoding="utf-8") as fh:
            p = json.load(fh)
        out[p["format"]] = p
    return out


def profile_order(profiles: dict, fmt: str, layout_id: str) -> list[str] | None:
    """The format's channel order (sp labels) for a layout id, or None (stub/unknown)."""
    p = profiles.get(fmt)
    if not p or p.get("status") == "stub":
        return None
    entry = (p.get("layouts") or {}).get(layout_id)
    if not entry:
        return None
    return [e if isinstance(e, str) else e["sp"] for e in entry["order"]]

EPSILON = 0.01  # SPEC §2.2 / §4: Cartesian/polar agreement in the normalised frame


class Errors:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, path: str, reason: str) -> None:
        self.items.append(f"{path}: {reason}")

    def __bool__(self) -> bool:
        return bool(self.items)


def polar_to_cartesian(az: float, el: float, dist: float = 1.0):
    """ADM polar -> Orbit/ADM object-frame Cartesian (SPEC §2.2, BS.2127)."""
    azr, elr = math.radians(az), math.radians(el)
    x = -dist * math.cos(elr) * math.sin(azr)
    y = dist * math.cos(elr) * math.cos(azr)
    z = dist * math.sin(elr)
    return x, y, z


def load_yaml(path: str):
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def ordering_ids(order: list) -> list[str]:
    """An ordering entry is a bare id or {speaker, label} (SPEC §2.3)."""
    return [o["speaker"] if isinstance(o, dict) else o for o in order]


def validate_layout(path: str, schema_validator: Draft202012Validator, errs: Errors) -> dict | None:
    name = os.path.relpath(path, ROOT)
    doc = load_yaml(path)

    # Rule 1 — schema-valid.
    schema_errors = sorted(schema_validator.iter_errors(doc), key=lambda e: list(e.path))
    if schema_errors:
        for e in schema_errors:
            loc = "/".join(str(p) for p in e.path) or "<root>"
            errs.add(f"{name} [{loc}]", f"schema: {e.message}")
        return None

    speakers = doc["speakers"]
    ids = [s["id"] for s in speakers]

    # Rule 3 — unique speaker ids.
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        errs.add(name, f"duplicate speaker id(s): {', '.join(dupes)}")

    for s in speakers:
        sid = s["id"]
        has_cart = all(k in s for k in ("x", "y", "z"))
        has_polar = all(k in s for k in ("az", "el"))
        # Rule 2 — position present (schema enforces too; kept explicit).
        if not has_cart and not has_polar:
            errs.add(f"{name}:{sid}", "no complete position (need x,y,z or az,el)")
        # Rule 2 — Cartesian/polar consistency when both are present.
        if has_cart and has_polar:
            px, py, pz = polar_to_cartesian(s["az"], s["el"], s.get("dist", 1.0))
            d = max(abs(px - s["x"]), abs(py - s["y"]), abs(pz - s["z"]))
            if d > EPSILON:
                errs.add(
                    f"{name}:{sid}",
                    f"Cartesian/polar disagree by {d:.4f} > ε={EPSILON} "
                    f"(polar→cart = {px:.3f},{py:.3f},{pz:.3f}; file = {s['x']},{s['y']},{s['z']})",
                )

    # Rule 5 — identity sanity: distinct speakers must not share an sp.
    sp_map: dict[str, list[str]] = {}
    for s in speakers:
        if s.get("sp"):
            sp_map.setdefault(s["sp"], []).append(s["id"])
    for sp, owners in sp_map.items():
        if len(owners) > 1:
            errs.add(name, f"sp {sp} shared by distinct speakers: {', '.join(owners)}")

    # Rule 3 — every ordering is a permutation covering every speaker exactly once.
    idset = sorted(ids)
    for spec, order in (doc.get("orderings") or {}).items():
        oids = ordering_ids(order)
        unknown = [i for i in oids if i not in ids]
        if unknown:
            errs.add(f"{name}:orderings:{spec}", f"references unknown id(s): {', '.join(unknown)}")
        if sorted(oids) != idset:
            errs.add(
                f"{name}:orderings:{spec}",
                f"not a permutation of the speaker set ({len(oids)} entries vs {len(ids)} speakers)",
            )

    return doc


def validate_fixture(path: str, layouts: dict[str, tuple[str, dict]], profiles: dict, errs: Errors) -> str | None:
    name = os.path.relpath(path, ROOT)
    fx = load_yaml(path)

    for key in ("layout", "file", "channels", "orderings"):
        if key not in fx:
            errs.add(name, f"fixture missing required key '{key}'")
            return None

    lid = fx["layout"]
    if lid not in layouts:
        errs.add(name, f"no layout with id '{lid}'")
        return lid

    layout_path, doc = layouts[lid]
    id2sp = {s["id"]: s.get("sp") for s in doc["speakers"]}

    # file: path points at the real layout.
    expected_file = os.path.relpath(layout_path, ROOT)
    if fx["file"] != expected_file:
        errs.add(name, f"file '{fx['file']}' should be '{expected_file}'")

    # channel count.
    if fx["channels"] != len(doc["speakers"]):
        errs.add(name, f"channels {fx['channels']} != {len(doc['speakers'])} speakers in {lid}")

    # LFE SP-label set.
    file_lfe = sorted(s.get("sp") for s in doc["speakers"] if s.get("lfe"))
    if sorted(fx.get("lfe", [])) != file_lfe:
        errs.add(name, f"lfe {fx.get('lfe', [])} != layout LFE set {file_lfe}")

    # Rule 6 — each fixture-pinned ordering, sourced from the format PROFILE and
    # projected onto the layout by sp, matches the fixture's expected sp order.
    sp_set = {s.get("sp") for s in doc["speakers"]}
    for spec, expected in fx["orderings"].items():
        order = profile_order(profiles, spec, lid)
        if order is None:
            errs.add(name, f"profile '{spec}' has no order for layout '{lid}'")
            continue
        missing = [sp for sp in order if sp not in sp_set]
        if missing:
            errs.add(name, f"profile '{spec}' references sp not in layout {lid}: {', '.join(missing)}")
        elif order != expected:
            errs.add(
                name,
                f"ordering '{spec}' mismatch\n      fixture:  {expected}\n      profile:  {order}",
            )

    return lid


def main() -> int:
    errs = Errors()

    # The schema itself must be a valid Draft 2020-12 schema.
    with open(SCHEMA_PATH, "r", encoding="utf-8") as fh:
        schema = json.load(fh)
    Draft202012Validator.check_schema(schema)
    schema_validator = Draft202012Validator(schema)

    layout_paths = sorted(glob.glob(os.path.join(LAYOUTS_DIR, "*.osls")))
    fixture_paths = sorted(glob.glob(os.path.join(FIXTURES_DIR, "*.yaml")))
    if not layout_paths:
        print("no layouts found", file=sys.stderr)
        return 2

    layouts: dict[str, tuple[str, dict]] = {}
    for path in layout_paths:
        doc = validate_layout(path, schema_validator, errs)
        if doc is not None:
            lid = doc["id"]
            if lid in layouts:
                errs.add(os.path.relpath(path, ROOT), f"duplicate layout id '{lid}'")
            layouts[lid] = (path, doc)

    profiles = load_profiles()
    covered: set[str] = set()
    for path in fixture_paths:
        lid = validate_fixture(path, layouts, profiles, errs)
        if lid:
            covered.add(lid)

    # Every blessed layout must have a conformance fixture.
    for lid in sorted(layouts):
        if lid not in covered:
            errs.add(layouts[lid][0].replace(ROOT + "/", ""), f"no conformance fixture for layout '{lid}'")

    if errs:
        print(f"FAIL — {len(errs.items)} problem(s):\n", file=sys.stderr)
        for item in errs.items:
            print(f"  ✗ {item}", file=sys.stderr)
        return 1

    print(
        f"OK — {len(layouts)} layouts, {len(fixture_paths)} fixtures: "
        f"schema-valid, positions consistent (ε={EPSILON}), orderings are permutations, "
        f"fixtures match (SP-label channel order, channel count, LFE set)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
