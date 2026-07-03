import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Layout, OSLS, speaker } from "../dist/osls.js";

// repo root: sdk/wasm/test -> wasm -> sdk -> osls
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const layoutsDir = join(root, "layouts");

test("read a blessed layout", async () => {
    const text = readFileSync(join(layoutsDir, "7.1.4.osls"), "utf8");
    const layout = await OSLS.parse(text);
    assert.equal(layout.id, "7.1.4");
    assert.equal(layout.channelCount, 12);
    assert.equal(layout.order("iamf")[1].id, "C"); // IAMF moves C to index 1
    assert.equal(layout.order("adm")[3].id, "LFE");
    assert.equal(layout.speaker("Ls")?.id, "Lss"); // alias
    assert.equal(layout.speaker("M+000")?.id, "C"); // sp
    assert.equal(layout.lfe.length, 1);
    assert.ok(Math.abs(layout.speaker("C").cartesian.y - 1) < 1e-6);
});

test("load every blessed layout", async () => {
    const files = readdirSync(layoutsDir).filter((f) => f.endsWith(".osls"));
    assert.ok(files.length >= 14);
    for (const f of files) {
        const layout = await OSLS.parse(readFileSync(join(layoutsDir, f), "utf8"));
        assert.equal(layout.channelCount, layout.speakers.length, f);
    }
});

test("build, emit, and reparse", async () => {
    const room = new Layout({ id: "my-room", name: "My Room", vendor: "com.example" });
    room.tags = ["custom"];
    room.speakers = [
        speaker.cartesian("L", { sp: "M+030", x: -0.5, y: 0.866, z: 0, aliases: ["FL"] }),
        speaker.polar("C", { sp: "M+000", az: 0, el: 0 }),
        speaker.lfe("LFE", { sp: "LFE1", x: 0, y: 1, z: -0.5 }),
    ];
    room.orderings["adm"] = ["L", "C", "LFE"];

    const yaml = await room.toOSLS();
    const r = await OSLS.parse(yaml);
    assert.equal(r.id, "my-room");
    assert.equal(r.vendor, "com.example");
    assert.equal(r.channelCount, 3);
    assert.equal(r.speaker("FL")?.id, "L");
    assert.equal(r.order("adm").at(-1).id, "LFE");
    assert.ok(Math.abs(r.speaker("C").cartesian.y - 1) < 1e-6);
});

test("emitting an invalid layout rejects", async () => {
    const bad = new Layout({ id: "x", name: "x" }); // no speakers
    await assert.rejects(() => bad.toOSLS());
});
