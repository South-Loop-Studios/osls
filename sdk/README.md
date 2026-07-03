# OSLS SDK

Reference implementations that read `.osls` layouts. Apache-2.0 (see
[`../LICENSE`](../LICENSE)).

| Dir | What | Status |
|---|---|---|
| [`core/`](core) | `osls-core` — C++17 parser / validator / normaliser / query + C ABI | **available** |
| [`swift/`](swift) | Swift wrapper over the C ABI (value-type `Layout`, read + author) | **available** |
| `wasm/` | Emscripten build for the browser (browser designer) | planned (P3) |

## osls-core (C++17)

A small, dependency-free core: it parses an `.osls` file, validates it against
the SPEC §4 rules, normalises every speaker to one internal Cartesian frame (ADM
object frame) while still being able to **emit either frame on query**, and
answers layout questions (channel count, per-spec channel order, identity/alias
lookup, LFE set). The YAML reader is a tiny `.osls`-scoped subset parser — no
third-party dependencies — so it builds clean for WASM/iOS/Windows.

### Build & test

```sh
cmake -S sdk/core -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

The test suite loads every blessed layout in [`../layouts`](../layouts) and
checks each against its [conformance fixture](../tests/conformance) — the C++
mirror of `tests/validate.py`. CI (`.github/workflows/sdk.yml`) runs this with
GCC and Clang.

### Reading a layout

```cpp
#include <osls/osls.hpp>
using namespace osls;

Layout layout = Layout::loadFile("layouts/7.1.4.osls");   // throws on invalid

layout.id;              // "7.1.4"
layout.channelCount();  // 12

for (const Speaker& s : layout.order(Spec::IAMF)) {   // speakers, in channel order
    s.label;            // "C"
    s.sp;               // "M+000"
    s.lfe;              // false
    s.cartesian;        // Vec3{0, 1, 0}
    s.polar();          // Polar{az, el, dist} — even if the file stored Cartesian
}

layout.speaker("Ls");   // id / sp / label / alias -> const Speaker* (nullptr if none)
```

`order(Spec::ADM | IAMF | MPEGH | Native)` (or `order("custom-spec")`) returns the
speakers **already in channel order**. `orderForSpec(...)` returns indices for the
zero-copy/router case.

### Building & saving a layout

Build the same `Layout` type and serialise it. `toYAML()`/`save()` validate first
(SPEC §4) and throw — you cannot emit a broken file.

```cpp
Layout layout;
layout.id     = "my-room";
layout.name   = "My Room";
layout.vendor = "com.example";
layout.speakers = {
    Speaker::cartesianAt("L", "M+030", {-0.5, 0.866, 0}),
    Speaker::polarAt    ("C", "M+000", /*az*/ 0, /*el*/ 0),   // author in either frame
    Speaker::lfeAt      ("LFE", "LFE1", {0, 1, -0.5}),
};
layout.orderings["adm"] = {"L", "C", "LFE"};

std::string yaml = layout.toYAML();                  // WriteFrame::Both to emit both frames
layout.save("layouts/com.example.my-room.osls");
```

### C ABI

[`include/osls/osls.h`](core/include/osls/osls.h) is the stable surface every
non-C++ consumer binds (Swift, WASM/JS, swift-winrt). Read: `osls_load_file` /
`osls_load_string`, `osls_channel_count`, `osls_order_for_spec`,
`osls_speaker_*`, `osls_resolve`. Author: `osls_new`, `osls_set_*`,
`osls_add_speaker`, `osls_ordering_add`, `osls_to_yaml` / `osls_save`. Free with
`osls_free` (and `osls_string_free` for returned strings). Each new symbol
carries a bridge-parity obligation across the bindings.

## Swift (`sdk/swift`)

A value-type `Layout` over the C ABI — `load` copies it out of the core and
frees the handle, so there's no memory to manage. Add the package and `import
OSLS`:

```swift
import OSLS

let layout = try OSLS.load(contentsOf: url)
for s in layout.order(.iamf) { s.label; s.sp; s.cartesian; s.polar }
layout.speaker("Ls")                       // id / sp / label / alias -> Speaker?

var room = Layout(id: "my-room", name: "My Room")
room.vendor = "com.example"
room.speakers = [
    .cartesian("L", sp: "M+030", x: -0.5, y: 0.866, z: 0),
    .polar    ("C", sp: "M+000", az: 0, el: 0),
    .lfe      ("LFE", sp: "LFE1", x: 0, y: 1, z: -0.5),
]
room.orderings["adm"] = ["L", "C", "LFE"]
try room.save(to: url)                     // validates (SPEC §4); throws on invalid
```

Build/test: `swift build` / `swift test` (CI runs both in the Swift container).
