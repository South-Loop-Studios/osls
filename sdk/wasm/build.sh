#!/usr/bin/env bash
# Compile osls-core (C++) to WebAssembly + an ES module, exposing the C ABI.
# Requires the Emscripten toolchain (emcc) — CI runs this in emscripten/emsdk.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
out="$here/dist"
mkdir -p "$out"

# C ABI symbols the JS facade calls (extern "C", so no name mangling) + malloc/free.
exports='_osls_load_string,_osls_free,_osls_id,_osls_name,_osls_description,_osls_vendor,_osls_tag_count,_osls_tag,_osls_channel_count,_osls_speaker_id,_osls_speaker_label,_osls_speaker_sp,_osls_speaker_is_lfe,_osls_speaker_position,_osls_speaker_alias_count,_osls_speaker_alias,_osls_spec_count,_osls_spec_name,_osls_order_for_spec,_osls_resolve,_osls_new,_osls_set_id,_osls_set_name,_osls_set_description,_osls_set_vendor,_osls_add_tag,_osls_add_speaker,_osls_speaker_add_alias,_osls_ordering_add,_osls_to_yaml,_osls_string_free,_malloc,_free'

emcc \
  "$root/sdk/core/src/yaml.cpp" \
  "$root/sdk/core/src/layout.cpp" \
  "$root/sdk/core/src/c_api.cpp" \
  "$root/sdk/core/src/profiles.generated.cpp" \
  -I "$root/sdk/core/include" \
  -std=c++17 -O2 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createOSLSModule \
  -sALLOW_MEMORY_GROWTH=1 \
  -sENVIRONMENT=web,node \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,getValue,setValue \
  -sEXPORTED_FUNCTIONS="$exports" \
  -o "$out/osls-core.mjs"

echo "built $out/osls-core.mjs (+ .wasm)"
