#include "osls/osls.h"

#include <cstdlib>
#include <cstring>
#include <iterator>
#include <string>
#include <utility>
#include <vector>

#include "osls/osls.hpp"

namespace {
void copy_err(char* errbuf, size_t errlen, const std::string& msg) {
    if (!errbuf || errlen == 0) return;
    size_t n = msg.size() < errlen - 1 ? msg.size() : errlen - 1;
    std::memcpy(errbuf, msg.data(), n);
    errbuf[n] = '\0';
}
const osls::Layout* as_cpp(const osls_layout* h) { return reinterpret_cast<const osls::Layout*>(h); }
osls::Layout* as_mut(osls_layout* h) { return reinterpret_cast<osls::Layout*>(h); }
bool in_range(const osls::Layout* L, int i) { return L && i >= 0 && i < static_cast<int>(L->speakers.size()); }

osls::WriteFrame to_write_frame(osls_write_frame f) {
    switch (f) {
        case OSLS_WRITE_CARTESIAN: return osls::WriteFrame::Cartesian;
        case OSLS_WRITE_POLAR: return osls::WriteFrame::Polar;
        case OSLS_WRITE_BOTH: return osls::WriteFrame::Both;
        case OSLS_AS_AUTHORED: default: return osls::WriteFrame::AsAuthored;
    }
}
char* dup_string(const std::string& s) {
    char* out = static_cast<char*>(std::malloc(s.size() + 1));
    if (out) std::memcpy(out, s.c_str(), s.size() + 1);
    return out;
}
}  // namespace

extern "C" {

osls_layout* osls_load_string(const char* text, char* errbuf, size_t errlen) {
    try {
        return reinterpret_cast<osls_layout*>(new osls::Layout(osls::Layout::loadString(text ? text : "")));
    } catch (const std::exception& e) {
        copy_err(errbuf, errlen, e.what());
        return nullptr;
    }
}

osls_layout* osls_load_file(const char* path, char* errbuf, size_t errlen) {
    try {
        return reinterpret_cast<osls_layout*>(new osls::Layout(osls::Layout::loadFile(path ? path : "")));
    } catch (const std::exception& e) {
        copy_err(errbuf, errlen, e.what());
        return nullptr;
    }
}

void osls_free(osls_layout* layout) { delete reinterpret_cast<osls::Layout*>(layout); }

const char* osls_id(const osls_layout* h) { return h ? as_cpp(h)->id.c_str() : nullptr; }
const char* osls_name(const osls_layout* h) { return h ? as_cpp(h)->name.c_str() : nullptr; }

int osls_channel_count(const osls_layout* h) {
    return h ? static_cast<int>(as_cpp(h)->channelCount()) : 0;
}

const char* osls_speaker_id(const osls_layout* h, int i) {
    return in_range(as_cpp(h), i) ? as_cpp(h)->speakers[i].id.c_str() : nullptr;
}
const char* osls_speaker_label(const osls_layout* h, int i) {
    return in_range(as_cpp(h), i) ? as_cpp(h)->speakers[i].label.c_str() : nullptr;
}
const char* osls_speaker_sp(const osls_layout* h, int i) {
    return in_range(as_cpp(h), i) ? as_cpp(h)->speakers[i].sp.c_str() : nullptr;
}
int osls_speaker_is_lfe(const osls_layout* h, int i) {
    return in_range(as_cpp(h), i) && as_cpp(h)->speakers[i].lfe ? 1 : 0;
}

int osls_speaker_position(const osls_layout* h, int i, osls_frame frame, double* a, double* b, double* c) {
    const osls::Layout* L = as_cpp(h);
    if (!in_range(L, i) || !a || !b || !c) return 0;
    const osls::Speaker& s = L->speakers[i];
    if (frame == OSLS_POLAR) {
        osls::Polar p = s.polar();
        *a = p.az; *b = p.el; *c = p.dist;
    } else {
        *a = s.cartesian.x; *b = s.cartesian.y; *c = s.cartesian.z;
    }
    return 1;
}

int osls_order_for_spec(const osls_layout* h, const char* spec, int* out, int cap) {
    const osls::Layout* L = as_cpp(h);
    if (!L || !spec) return -1;
    try {
        auto order = L->orderForSpec(spec);
        int n = static_cast<int>(order.size());
        if (out && cap >= n)
            for (int i = 0; i < n; ++i) out[i] = static_cast<int>(order[i]);
        return n;
    } catch (const std::out_of_range&) {
        return -1;
    }
}

int osls_resolve(const osls_layout* h, const char* token) {
    const osls::Layout* L = as_cpp(h);
    if (!L || !token) return -1;
    const osls::Speaker* s = L->resolve(token);
    return s ? static_cast<int>(s - &L->speakers[0]) : -1;
}

/* ---- Introspection ------------------------------------------------------- */

const char* osls_description(const osls_layout* h) { return h ? as_cpp(h)->description.c_str() : nullptr; }
const char* osls_vendor(const osls_layout* h) { return h ? as_cpp(h)->vendor.c_str() : nullptr; }

int osls_tag_count(const osls_layout* h) { return h ? static_cast<int>(as_cpp(h)->tags.size()) : 0; }
const char* osls_tag(const osls_layout* h, int i) {
    const osls::Layout* L = as_cpp(h);
    return (L && i >= 0 && i < static_cast<int>(L->tags.size())) ? L->tags[i].c_str() : nullptr;
}

int osls_speaker_alias_count(const osls_layout* h, int i) {
    return in_range(as_cpp(h), i) ? static_cast<int>(as_cpp(h)->speakers[i].aliases.size()) : 0;
}
const char* osls_speaker_alias(const osls_layout* h, int i, int j) {
    const osls::Layout* L = as_cpp(h);
    if (!in_range(L, i)) return nullptr;
    const auto& a = L->speakers[i].aliases;
    return (j >= 0 && j < static_cast<int>(a.size())) ? a[j].c_str() : nullptr;
}

int osls_spec_count(const osls_layout* h) {
    return h ? static_cast<int>(as_cpp(h)->orderingSpecs().size()) : 0;
}
const char* osls_spec_name(const osls_layout* h, int i) {
    const osls::Layout* L = as_cpp(h);
    if (!L) return nullptr;
    // Hold the names alive until the next call; the count→name→use loop copies each
    // name immediately (Swift/WASM bindings), so single-call lifetime is sufficient.
    static thread_local std::vector<std::string> cache;
    cache = L->orderingSpecs();
    if (i < 0 || i >= static_cast<int>(cache.size())) return nullptr;
    return cache[i].c_str();
}

/* ---- Authoring ----------------------------------------------------------- */

osls_layout* osls_new(void) { return reinterpret_cast<osls_layout*>(new osls::Layout()); }

void osls_set_id(osls_layout* h, const char* v) { if (h && v) as_mut(h)->id = v; }
void osls_set_name(osls_layout* h, const char* v) { if (h && v) as_mut(h)->name = v; }
void osls_set_description(osls_layout* h, const char* v) { if (h && v) as_mut(h)->description = v; }
void osls_set_vendor(osls_layout* h, const char* v) { if (h && v) as_mut(h)->vendor = v; }
void osls_add_tag(osls_layout* h, const char* v) { if (h && v) as_mut(h)->tags.push_back(v); }

int osls_add_speaker(osls_layout* h, const char* id, const char* label, const char* sp,
                     int is_lfe, osls_frame frame, double a, double b, double c) {
    osls::Layout* L = as_mut(h);
    if (!L || !id) return -1;
    std::string spStr = sp ? sp : "";
    osls::Speaker s = (frame == OSLS_POLAR) ? osls::Speaker::polarAt(id, spStr, a, b, c)
                                            : osls::Speaker::cartesianAt(id, spStr, {a, b, c});
    if (label) s.label = label;
    s.lfe = is_lfe != 0;
    L->speakers.push_back(std::move(s));
    return static_cast<int>(L->speakers.size() - 1);
}

void osls_speaker_add_alias(osls_layout* h, int i, const char* alias) {
    osls::Layout* L = as_mut(h);
    if (L && alias && i >= 0 && i < static_cast<int>(L->speakers.size()))
        L->speakers[i].aliases.push_back(alias);
}

void osls_set_ordering(osls_layout* h, const char* spec, const char* const* ids, int count) {
    osls::Layout* L = as_mut(h);
    if (!L || !spec || (!ids && count > 0)) return;
    std::vector<osls::OrderingEntry> entries;
    for (int i = 0; i < count; ++i)
        if (ids[i]) entries.emplace_back(std::string(ids[i]));
    L->orderings[spec] = std::move(entries);
}

void osls_ordering_add(osls_layout* h, const char* spec, const char* id) {
    osls::Layout* L = as_mut(h);
    if (L && spec && id) L->orderings[spec].emplace_back(std::string(id));
}

char* osls_to_yaml(const osls_layout* h, osls_write_frame frame, char* errbuf, size_t errlen) {
    if (!h) {
        copy_err(errbuf, errlen, "null layout");
        return nullptr;
    }
    try {
        return dup_string(as_cpp(h)->toYAML(to_write_frame(frame)));
    } catch (const std::exception& e) {
        copy_err(errbuf, errlen, e.what());
        return nullptr;
    }
}

void osls_string_free(char* s) { std::free(s); }

int osls_save(const osls_layout* h, const char* path, osls_write_frame frame, char* errbuf, size_t errlen) {
    if (!h || !path) {
        copy_err(errbuf, errlen, "null layout or path");
        return -1;
    }
    try {
        as_cpp(h)->save(path, to_write_frame(frame));
        return 0;
    } catch (const std::exception& e) {
        copy_err(errbuf, errlen, e.what());
        return -1;
    }
}

}  // extern "C"
