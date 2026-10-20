/* osls-core C ABI — the stable surface every non-C++ consumer binds (Swift,
 * WASM/JS, swift-winrt). Mirrors the C++ API in osls.hpp. All strings are
 * UTF-8; returned const char* point into the layout and stay valid until
 * osls_free(). */
#ifndef OSLS_H
#define OSLS_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct osls_layout osls_layout;

/* Coordinate frames for osls_speaker_position(). */
typedef enum { OSLS_CARTESIAN = 0, OSLS_POLAR = 1 } osls_frame;

/* Load + validate a layout. On failure return NULL and, if errbuf != NULL,
 * write a NUL-terminated message (truncated to errlen). Free with osls_free. */
osls_layout* osls_load_file(const char* path, char* errbuf, size_t errlen);
osls_layout* osls_load_string(const char* text, char* errbuf, size_t errlen);
void osls_free(osls_layout* layout);

/* Layout identity. */
const char* osls_id(const osls_layout* layout);
const char* osls_name(const osls_layout* layout);

/* Speakers (native order). Indices are 0-based; out-of-range -> NULL / 0 / -1. */
int osls_channel_count(const osls_layout* layout);
const char* osls_speaker_id(const osls_layout* layout, int index);
const char* osls_speaker_label(const osls_layout* layout, int index);
const char* osls_speaker_sp(const osls_layout* layout, int index); /* "" if none */
int osls_speaker_is_lfe(const osls_layout* layout, int index);

/* Position of speaker `index` in the requested frame.
 * Cartesian -> (x,y,z); Polar -> (az,el,dist). Returns 1 on success, 0 on
 * bad index/null out pointers. */
int osls_speaker_position(const osls_layout* layout, int index, osls_frame frame,
                          double* a, double* b, double* c);

/* Channel order for `spec` ("native", "adm", "iamf", ...) as speaker indices
 * written into out[0..cap). Returns the channel count, or -1 if the spec is
 * unknown. If the count exceeds cap, nothing is written and the count is still
 * returned (call again with a large enough buffer). */
int osls_order_for_spec(const osls_layout* layout, const char* spec, int* out, int cap);

/* Resolve a token (id / sp / label / alias) to a speaker index, or -1. */
int osls_resolve(const osls_layout* layout, const char* token);

/* ---- Introspection (for bindings that copy the layout out) --------------- */
const char* osls_description(const osls_layout* layout); /* "" if none */
const char* osls_vendor(const osls_layout* layout);      /* "" if none */
int osls_tag_count(const osls_layout* layout);
const char* osls_tag(const osls_layout* layout, int index);
int osls_speaker_alias_count(const osls_layout* layout, int speaker_index);
const char* osls_speaker_alias(const osls_layout* layout, int speaker_index, int alias_index);
int osls_spec_count(const osls_layout* layout); /* declared orderings, excluding "native" */
const char* osls_spec_name(const osls_layout* layout, int index);

/* ---- Arrays (SPEC §2.4) -------------------------------------------------- */
int osls_array_count(const osls_layout* layout);
const char* osls_array_id(const osls_layout* layout, int array_index);
const char* osls_array_name(const osls_layout* layout, int array_index);
const char* osls_array_sp(const osls_layout* layout, int array_index); /* "" if none */
int osls_array_speaker_count(const osls_layout* layout, int array_index);
/* Native speaker index of member `member_index`, or -1. */
int osls_array_speaker(const osls_layout* layout, int array_index, int member_index);
/* The array index speaker `speaker_index` belongs to, or -1. */
int osls_speaker_array(const osls_layout* layout, int speaker_index);

/* ---- Authoring (build + serialise) --------------------------------------- */
/* Which position frame(s) osls_to_yaml/osls_save write per speaker. */
typedef enum {
    OSLS_AS_AUTHORED = 0,
    OSLS_WRITE_CARTESIAN,
    OSLS_WRITE_POLAR,
    OSLS_WRITE_BOTH
} osls_write_frame;

osls_layout* osls_new(void); /* empty, mutable layout; free with osls_free */
void osls_set_id(osls_layout* layout, const char* id);
void osls_set_name(osls_layout* layout, const char* name);
void osls_set_description(osls_layout* layout, const char* description);
void osls_set_vendor(osls_layout* layout, const char* vendor);
void osls_add_tag(osls_layout* layout, const char* tag);

/* Add a speaker. label NULL -> defaults to id. frame OSLS_CARTESIAN reads
 * (a,b,c)=(x,y,z); OSLS_POLAR reads (a,b,c)=(az,el,dist). Returns its index. */
int osls_add_speaker(osls_layout* layout, const char* id, const char* label, const char* sp,
                     int is_lfe, osls_frame frame, double a, double b, double c);
void osls_speaker_add_alias(osls_layout* layout, int speaker_index, const char* alias);
void osls_set_ordering(osls_layout* layout, const char* spec, const char* const* ids, int count);
/* Append one speaker id to a spec's ordering (creating it if absent) — the
 * per-id form, easier to drive from a binding than the array form above. */
void osls_ordering_add(osls_layout* layout, const char* spec, const char* id);
/* Add an array (sp NULL or "" for none) and return its index; then add members
 * by speaker id. Validation runs at osls_to_yaml/osls_save, as for orderings. */
int osls_add_array(osls_layout* layout, const char* id, const char* name, const char* sp);
void osls_array_add_speaker(osls_layout* layout, int array_index, const char* speaker_id);

/* Serialise to .osls YAML. Validates first; on failure returns NULL and writes
 * errbuf. The returned string is heap-allocated — free it with osls_string_free. */
char* osls_to_yaml(const osls_layout* layout, osls_write_frame frame, char* errbuf, size_t errlen);
void osls_string_free(char* str);
/* Save to path. Returns 0 on success, -1 on failure (writes errbuf). */
int osls_save(const osls_layout* layout, const char* path, osls_write_frame frame,
              char* errbuf, size_t errlen);

#ifdef __cplusplus
}
#endif

#endif /* OSLS_H */
