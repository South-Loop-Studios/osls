// Loads every blessed layout and checks each against its conformance fixture —
// the C++ mirror of tests/validate.py, exercising the reader on the real corpus.
#include <algorithm>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "check.hpp"
#include "osls/osls.hpp"
#include "yaml.hpp"

namespace fs = std::filesystem;

namespace {

std::vector<std::string> scalarList(const osls::yaml::Node* n) {
    std::vector<std::string> out;
    if (n && n->isSeq())
        for (const auto& e : n->seq) out.push_back(e.scalar);
    return out;
}

std::string readFile(const fs::path& p) {
    std::ifstream f(p, std::ios::binary);
    std::ostringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

}  // namespace

void run_blessed_tests() {
    using namespace osls;
    const fs::path root = OSLS_REPO_ROOT;

    // 1. Every blessed layout loads, validates, and round-trips its positions.
    int loaded = 0;
    for (const auto& e : fs::directory_iterator(root / "layouts")) {
        if (e.path().extension() != ".osls") continue;
        const std::string name = e.path().filename().string();
        try {
            Layout L = Layout::loadFile(e.path().string());
            CHECK_MSG(!L.validate().size(), name + ": should validate clean");
            CHECK_MSG(L.channelCount() == L.speakers.size(), name + ": channel count");

            // Round trip: serialise then reparse; identity, geometry, orderings survive.
            Layout R = Layout::loadString(L.toYAML());
            CHECK_MSG(R.channelCount() == L.channelCount(), name + ": round-trip channel count");
            for (std::size_t i = 0; i < L.speakers.size(); ++i) {
                const Speaker& a = L.speakers[i];
                const Speaker& b = R.speakers[i];
                bool same = a.id == b.id && a.sp == b.sp && a.lfe == b.lfe &&
                            std::fabs(a.cartesian.x - b.cartesian.x) < 1e-9 &&
                            std::fabs(a.cartesian.y - b.cartesian.y) < 1e-9 &&
                            std::fabs(a.cartesian.z - b.cartesian.z) < 1e-9;
                CHECK_MSG(same, name + ": round-trip speaker " + a.id);
            }
            for (const auto& spec : L.specs()) {
                std::vector<std::string> ao, bo;
                for (const auto& s : L.order(spec)) ao.push_back(s.sp);
                for (const auto& s : R.order(spec)) bo.push_back(s.sp);
                CHECK_MSG(ao == bo, name + ": round-trip ordering '" + spec + "'");
            }
            ++loaded;
        } catch (const std::exception& ex) {
            CHECK_MSG(false, name + ": load threw: " + ex.what());
        }
    }
    CHECK_MSG(loaded >= 14, "expected >= 14 blessed layouts, loaded " + std::to_string(loaded));

    // 2. Each fixture matches its layout: SP-label channel order, count, LFE set.
    int checked = 0;
    for (const auto& e : fs::directory_iterator(root / "tests" / "conformance")) {
        if (e.path().extension() != ".yaml") continue;
        const std::string fname = e.path().filename().string();
        osls::yaml::Node fx = osls::yaml::parse(readFile(e.path()));

        const std::string file = fx.find("file") ? fx.find("file")->scalar : "";
        Layout L = Layout::loadFile((root / file).string());

        const std::size_t channels = static_cast<std::size_t>(std::stoul(fx.find("channels")->scalar));
        CHECK_MSG(channels == L.channelCount(), fname + ": channel count vs fixture");

        // LFE SP-label set.
        std::vector<std::string> fxLfe = scalarList(fx.find("lfe"));
        std::vector<std::string> gotLfe;
        for (auto i : L.lfeIndices()) gotLfe.push_back(L.speakers[i].sp);
        std::sort(fxLfe.begin(), fxLfe.end());
        std::sort(gotLfe.begin(), gotLfe.end());
        CHECK_MSG(fxLfe == gotLfe, fname + ": LFE sp set vs fixture");

        // Each ordering, resolved to SP-labels, equals the fixture.
        const osls::yaml::Node* ord = fx.find("orderings");
        if (ord && ord->isMap()) {
            for (const auto& kv : ord->map) {
                std::vector<std::string> expected = scalarList(&kv.second);
                std::vector<std::string> got;
                for (auto idx : L.orderForSpec(kv.first)) got.push_back(L.speakers[idx].sp);
                CHECK_MSG(got == expected, fname + ": ordering '" + kv.first + "' vs fixture");
            }
        }
        ++checked;
    }
    CHECK_MSG(checked >= 14, "expected >= 14 conformance fixtures, checked " + std::to_string(checked));
}
