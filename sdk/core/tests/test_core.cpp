// Unit tests: conversions, parsing, queries, and validation rejection.
#include <cmath>
#include <string>

#include "check.hpp"
#include "osls/osls.h"
#include "osls/osls.hpp"

void run_blessed_tests();  // defined in test_blessed.cpp

namespace {

bool approx(double a, double b, double eps = 1e-3) { return std::fabs(a - b) <= eps; }

void test_conversions() {
    using namespace osls;
    Vec3 c = polarToCartesian({30, 0, 1});
    CHECK(approx(c.x, -0.5) && approx(c.y, 0.866) && approx(c.z, 0.0));
    c = polarToCartesian({90, 0, 1});
    CHECK(approx(c.x, -1.0) && approx(c.y, 0.0));
    c = polarToCartesian({45, 45, 1});
    CHECK(approx(c.x, -0.5) && approx(c.y, 0.5) && approx(c.z, 0.707));
    // round trip
    Polar p = cartesianToPolar({-0.5, 0.866, 0.0});
    CHECK(approx(p.az, 30) && approx(p.el, 0) && approx(p.dist, 1.0));
}

void test_parse() {
    using namespace osls;
    const char* text =
        "osls: 1\n"
        "id: \"demo\"\n"
        "name: \"Demo\"\n"
        "tags: [a, b]\n"
        "speakers:\n"
        "  - { id: L, label: L, sp: M+030, x: -0.5, y: 0.866, z: 0.0, az: 30, el: 0 }\n"
        "  - { id: C, label: C, sp: M+000, az: 0, el: 0 }\n"
        "  - { id: LFE, label: LFE, sp: LFE1, x: 0.0, y: 1.0, z: -0.5, lfe: true }\n"
        "orderings:\n"
        "  adm:  [L, C, LFE]\n"
        "  iamf: [L, LFE, C]\n";
    Layout L = Layout::loadString(text);
    CHECK(L.id == "demo" && L.name == "Demo");
    CHECK(L.tags.size() == 2 && L.tags[0] == "a");
    CHECK(L.channelCount() == 3);
    CHECK(L.speakers[2].lfe);
    CHECK(L.lfeIndices().size() == 1 && L.lfeIndices()[0] == 2);
    // C carried polar only -> Cartesian normalised in.
    CHECK(approx(L.speakers[1].cartesian.y, 1.0) && approx(L.speakers[1].cartesian.x, 0.0));
    // emit polar for an x/y/z-only speaker
    Polar p = L.speakers[0].polar();
    CHECK(approx(p.az, 30) && approx(p.el, 0));
    auto adm = L.orderForSpec("adm");
    CHECK(adm.size() == 3 && adm[0] == 0 && adm[1] == 1 && adm[2] == 2);
    auto iamf = L.orderForSpec("iamf");
    CHECK(iamf[1] == 2 && iamf[2] == 1);
    auto nat = L.orderForSpec("native");
    CHECK(nat.size() == 3 && nat[0] == 0);
}

void test_queries() {
    using namespace osls;
    Layout L = Layout::loadFile(std::string(OSLS_REPO_ROOT) + "/layouts/7.1.4.osls");
    CHECK(L.channelCount() == 12);
    // alias resolution: "Ls" is an alias of Lss
    const Speaker* s = L.resolve("Ls");
    CHECK_MSG(s && s->id == "Lss", "resolve alias Ls -> Lss");
    // resolve by sp
    CHECK(L.resolve("M+000") && L.resolve("M+000")->id == "C");
    // IAMF moves C to index 1
    auto iamf = L.orderForSpec("iamf");
    CHECK(L.speakers[iamf[1]].id == "C");
    // ADM keeps L,R,C,LFE up front
    auto adm = L.orderForSpec("adm");
    CHECK(L.speakers[adm[0]].id == "L" && L.speakers[adm[3]].id == "LFE");
    CHECK(L.specs().size() >= 3);  // native + adm + iamf
}

void test_c_abi() {
    char err[256] = {0};
    osls_layout* h = osls_load_file((std::string(OSLS_REPO_ROOT) + "/layouts/5.1.osls").c_str(), err, sizeof err);
    CHECK_MSG(h != nullptr, std::string("C ABI load 5.1: ") + err);
    if (h) {
        CHECK(osls_channel_count(h) == 6);
        CHECK(std::string(osls_id(h)) == "5.1");
        int order[16];
        int n = osls_order_for_spec(h, "iamf", order, 16);
        CHECK(n == 6);
        CHECK(std::string(osls_speaker_id(h, order[5])) == "LFE");  // IAMF: LFE last
        CHECK(osls_order_for_spec(h, "nope", order, 16) == -1);
        int li = osls_resolve(h, "M+110");
        CHECK(li >= 0 && std::string(osls_speaker_id(h, li)) == "Ls");
        double a, b, c;
        CHECK(osls_speaker_position(h, 0, OSLS_CARTESIAN, &a, &b, &c) == 1);
        osls_free(h);
    }
}

void test_c_abi_build() {
    char err[256] = {0};
    osls_layout* b = osls_new();
    osls_set_id(b, "c-built");
    osls_set_name(b, "C Built");
    osls_set_vendor(b, "com.example");
    osls_add_tag(b, "custom");
    int i0 = osls_add_speaker(b, "L", "L", "M+030", 0, OSLS_CARTESIAN, -0.5, 0.866, 0);
    osls_add_speaker(b, "C", nullptr, "M+000", 0, OSLS_POLAR, 0, 0, 1);  // label defaults to id
    osls_add_speaker(b, "LFE", "LFE", "LFE1", 1, OSLS_CARTESIAN, 0, 1, -0.5);
    osls_speaker_add_alias(b, i0, "FL");
    const char* ids[] = {"L", "C", "LFE"};
    osls_set_ordering(b, "adm", ids, 3);

    char* yaml = osls_to_yaml(b, OSLS_AS_AUTHORED, err, sizeof err);
    CHECK_MSG(yaml != nullptr, std::string("C ABI to_yaml: ") + err);
    if (yaml) {
        osls_layout* r = osls_load_string(yaml, err, sizeof err);  // round-trips + validates
        CHECK_MSG(r != nullptr, std::string("reload built yaml: ") + err);
        if (r) {
            CHECK(osls_channel_count(r) == 3);
            CHECK(std::string(osls_vendor(r)) == "com.example");
            CHECK(osls_tag_count(r) == 1 && std::string(osls_tag(r, 0)) == "custom");
            CHECK(osls_spec_count(r) == 1 && std::string(osls_spec_name(r, 0)) == "adm");
            CHECK(osls_speaker_alias_count(r, 0) == 1 && std::string(osls_speaker_alias(r, 0, 0)) == "FL");
            CHECK(std::string(osls_speaker_label(r, 1)) == "C");  // defaulted from id
            osls_free(r);
        }
        osls_string_free(yaml);
    }
    // invalid build (no speakers) -> to_yaml fails cleanly
    osls_layout* bad = osls_new();
    osls_set_id(bad, "x");
    osls_set_name(bad, "x");
    CHECK(osls_to_yaml(bad, OSLS_AS_AUTHORED, err, sizeof err) == nullptr);
    osls_free(bad);
    osls_free(b);
}

void test_order_api() {
    using namespace osls;
    Layout L = Layout::loadFile(std::string(OSLS_REPO_ROOT) + "/layouts/7.1.4.osls");
    // order() returns speakers in channel order
    auto iamf = L.order(Spec::IAMF);
    CHECK(iamf.size() == 12 && iamf[1].id == "C");        // IAMF: C at index 1
    auto adm = L.order("adm");                            // string overload
    CHECK(adm[0].id == "L" && adm[3].id == "LFE");
    // friendly resolver
    CHECK(L.speaker("Ls") && L.speaker("Ls")->id == "Lss");
    CHECK(L.order(Spec::Native).size() == 12);
}

void test_build_and_emit() {
    using namespace osls;
    Layout L;
    L.id = "my-room";
    L.name = "My Room";
    L.vendor = "com.example";
    L.speakers = {
        Speaker::cartesianAt("L", "M+030", {-0.5, 0.866, 0}),
        Speaker::polarAt("C", "M+000", 0, 0),
        Speaker::lfeAt("LFE", "LFE1", {0, 1, -0.5}),
    };
    L.orderings["adm"] = {"L", "C", "LFE"};  // ids -> OrderingEntry

    // Serialise (validates) then parse back: lossless round trip.
    Layout R = Layout::loadString(L.toYAML());
    CHECK(R.id == "my-room" && R.vendor == "com.example");
    CHECK(R.channelCount() == 3);
    CHECK(R.speaker("C") && R.speaker("C")->id == "C");
    CHECK(approx(R.speaker("C")->cartesian.y, 1.0));  // polar-authored normalised
    CHECK(R.lfeIndices().size() == 1);
    auto adm = R.order(Spec::ADM);
    CHECK(adm.size() == 3 && adm[2].id == "LFE");

    // Emitting an invalid layout throws instead of writing junk.
    Layout bad;
    bad.id = "x";
    bad.name = "x";  // no speakers
    bool threw = false;
    try {
        bad.toYAML();
    } catch (const ParseError&) {
        threw = true;
    }
    CHECK_MSG(threw, "toYAML must reject invalid layouts");
}

void expect_reject(const std::string& what, const char* text) {
    using namespace osls;
    bool threw = false;
    try {
        Layout::loadString(text);
    } catch (const ParseError&) {
        threw = true;
    }
    CHECK_MSG(threw, "expected rejection: " + what);
}

void test_negative() {
    expect_reject("missing speakers",
                  "osls: 1\nid: x\nname: x\n");
    expect_reject("duplicate id",
                  "osls: 1\nid: x\nname: x\nspeakers:\n"
                  "  - { id: L, label: L, x: 0, y: 1, z: 0 }\n"
                  "  - { id: L, label: L2, x: 1, y: 0, z: 0 }\n");
    expect_reject("cartesian/polar disagree",
                  "osls: 1\nid: x\nname: x\nspeakers:\n"
                  "  - { id: L, label: L, x: -1.0, y: 0.0, z: 0.0, az: 30, el: 0 }\n");
    expect_reject("ordering not a permutation",
                  "osls: 1\nid: x\nname: x\nspeakers:\n"
                  "  - { id: L, label: L, x: -0.5, y: 0.866, z: 0 }\n"
                  "  - { id: R, label: R, x: 0.5, y: 0.866, z: 0 }\n"
                  "orderings:\n  adm: [L, L]\n");
    expect_reject("shared sp",
                  "osls: 1\nid: x\nname: x\nspeakers:\n"
                  "  - { id: A, label: A, sp: M+030, x: -0.5, y: 0.866, z: 0 }\n"
                  "  - { id: B, label: B, sp: M+030, x: 0.5, y: 0.866, z: 0 }\n");
    expect_reject("no position",
                  "osls: 1\nid: x\nname: x\nspeakers:\n  - { id: L, label: L }\n");
}

// A 4-speaker rig with a rear array of three: the SPEC §2.4 example shape.
const char* kArrayRig =
    "osls: 1\nid: dub\nname: Dub\nspeakers:\n"
    "  - { id: Lrs1, label: Lrs1, x: -1, y: -0.5, z: 0 }\n"
    "  - { id: Lrs2, label: Lrs2, x: -0.8, y: -1, z: 0 }\n"
    "  - { id: Lrs3, label: Lrs3, x: -0.3, y: -1, z: 0 }\n"
    "  - { id: LFE, label: LFE, x: 0, y: 1, z: -0.5, lfe: true }\n";

void test_arrays() {
    using namespace osls;
    std::string text = std::string(kArrayRig) +
        "arrays:\n  - { id: left-rear, name: \"Left rear\", sp: M+135, speakers: [Lrs1, Lrs2, Lrs3] }\n";
    Layout L = Layout::loadString(text);
    CHECK(L.arrays.size() == 1);
    CHECK(L.arrays[0].name == "Left rear" && L.arrays[0].sp == "M+135" && L.arrays[0].speakers.size() == 3);
    CHECK(L.arrayById("left-rear") == &L.arrays[0]);
    CHECK(L.arrayForSpeaker("Lrs2") == &L.arrays[0]);
    CHECK(L.arrayForSpeaker("LFE") == nullptr);

    // Round trip keeps the block.
    Layout R = Layout::loadString(L.toYAML());
    CHECK(R.arrays.size() == 1 && R.arrays[0].speakers == L.arrays[0].speakers && R.arrays[0].sp == "M+135");

    // A layout without arrays emits none.
    CHECK(Layout::loadString(kArrayRig).toYAML().find("arrays") == std::string::npos);

    // C ABI.
    char err[256] = {0};
    osls_layout* h = osls_load_string(text.c_str(), err, sizeof err);
    CHECK(h != nullptr);
    CHECK(osls_array_count(h) == 1);
    CHECK(std::string(osls_array_id(h, 0)) == "left-rear");
    CHECK(std::string(osls_array_sp(h, 0)) == "M+135");
    CHECK(osls_array_speaker_count(h, 0) == 3);
    CHECK(osls_array_speaker(h, 0, 2) == 2);
    CHECK(osls_array_speaker(h, 0, 3) == -1);
    CHECK(osls_speaker_array(h, 1) == 0);
    CHECK(osls_speaker_array(h, 3) == -1);
    CHECK(osls_array_id(h, 1) == nullptr);
    osls_free(h);

    // Authoring through the C ABI validates on emit.
    osls_layout* b = osls_load_string(kArrayRig, err, sizeof err);
    int a = osls_add_array(b, "left-rear", "Left rear", "M+135");
    osls_array_add_speaker(b, a, "Lrs1");
    osls_array_add_speaker(b, a, "Lrs2");
    char* y = osls_to_yaml(b, OSLS_AS_AUTHORED, err, sizeof err);
    CHECK(y != nullptr && std::string(y).find("speakers: [Lrs1, Lrs2]") != std::string::npos);
    osls_string_free(y);
    osls_array_add_speaker(b, a, "LFE");
    CHECK(osls_to_yaml(b, OSLS_AS_AUTHORED, err, sizeof err) == nullptr);
    osls_free(b);

    std::string rig(kArrayRig);
    expect_reject("array: unknown speaker", (rig + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs1, Nope] }\n").c_str());
    expect_reject("array: LFE mixed with mains", (rig + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs1, LFE] }\n").c_str());
    // A sub array: every member an LFE.
    Layout subs = Layout::loadString(
        "osls: 1\nid: s\nname: S\nspeakers:\n"
        "  - { id: L, label: L, x: -0.5, y: 0.866, z: 0 }\n"
        "  - { id: Sub1, label: Sub1, x: -0.5, y: 1, z: -0.5, lfe: true }\n"
        "  - { id: Sub2, label: Sub2, x: 0.5, y: 1, z: -0.5, lfe: true }\n"
        "arrays:\n  - { id: subs, name: Subs, sp: LFE1, speakers: [Sub1, Sub2] }\n");
    CHECK(subs.arrays.size() == 1 && subs.arrayForSpeaker("Sub2") == &subs.arrays[0]);
    expect_reject("array: one member", (rig + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs1] }\n").c_str());
    expect_reject("array: speaker in two arrays",
                  (rig + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs1, Lrs2] }\n"
                         "  - { id: b, name: B, sp: M-135, speakers: [Lrs2, Lrs3] }\n").c_str());
    expect_reject("array: listed twice", (rig + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs1, Lrs1] }\n").c_str());
    expect_reject("array: duplicate id",
                  (rig + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs1, Lrs2] }\n"
                         "  - { id: a, name: B, sp: M+135, speakers: [Lrs3, Lrs2] }\n").c_str());
    expect_reject("array: shared sp",
                  "osls: 1\nid: x\nname: x\nspeakers:\n"
                  "  - { id: A, label: A, x: -1, y: 0, z: 0 }\n  - { id: B, label: B, x: -1, y: 0.2, z: 0 }\n"
                  "  - { id: C, label: C, x: -1, y: -0.5, z: 0 }\n  - { id: D, label: D, x: -1, y: -0.7, z: 0 }\n"
                  "arrays:\n  - { id: a, name: A, sp: M+090, speakers: [A, B] }\n"
                  "  - { id: b, name: B, sp: M+090, speakers: [C, D] }\n");
    expect_reject("array: missing name", (rig + "arrays:\n  - { id: a, sp: M+135, speakers: [Lrs1, Lrs2] }\n").c_str());
    expect_reject("array: no sp", (rig + "arrays:\n  - { id: a, name: A, speakers: [Lrs1, Lrs2] }\n").c_str());
    // A speaker at the array's position (its principal) must be a member.
    std::string withPrincipal = rig + "  - { id: Lrs, label: Lrs, sp: M+135, x: -0.7, y: -0.7, z: 0 }\n";
    expect_reject("array: principal left out",
                  (withPrincipal + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs1, Lrs2] }\n").c_str());
    Layout principal = Layout::loadString(
        withPrincipal + "arrays:\n  - { id: a, name: A, sp: M+135, speakers: [Lrs, Lrs1, Lrs2] }\n");
    CHECK(principal.arrayForSpeaker("Lrs") == &principal.arrays[0]);
}

}  // namespace

int main() {
    test_conversions();
    test_parse();
    test_queries();
    test_order_api();
    test_build_and_emit();
    test_c_abi();
    test_c_abi_build();
    test_negative();
    test_arrays();
    run_blessed_tests();
    if (check::failures) {
        std::cerr << check::failures << " check(s) failed\n";
        return 1;
    }
    std::cout << "all checks passed\n";
    return 0;
}
