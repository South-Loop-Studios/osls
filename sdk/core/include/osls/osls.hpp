// osls-core — the C++17 reference reader for OSLS (.osls) speaker layouts.
// Parses, validates (SPEC §4), normalises positions to one internal frame, and
// answers layout queries. See docs/SPEC.md.
#pragma once

#include <cstddef>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace osls {

constexpr double kEpsilon = 0.01;  // SPEC §2.2/§4: Cartesian/polar agreement

enum class Frame { Cartesian, Polar };

// The layout's semantic reference frame: allocentric (room-anchored, a cube) or
// egocentric (listener-relative, a sphere). Independent of the position representation.
enum class ReferenceFrame { Allocentric, Egocentric };

// Known delivery specs for the friendly order() overload. Anything else (custom
// or future) is addressed by the string overload, e.g. order("mpegh2").
enum class Spec { Native, ADM, IAMF, MPEGH };
std::string specName(Spec s);

// Which position representation(s) toYAML() writes per speaker.
enum class WriteFrame { AsAuthored, Cartesian, Polar, Both };

struct Vec3 {
    double x = 0, y = 0, z = 0;
};

struct Polar {
    double az = 0, el = 0, dist = 1.0;
};

// SPEC §2.2 conversions (ITU-R BS.2127 handedness; az positive = listener left).
Vec3 polarToCartesian(const Polar& p);
Polar cartesianToPolar(const Vec3& c);

struct Speaker {
    std::string id;
    std::string label;
    std::string sp;  // ITU-R BS.2051 SP-label; may be empty
    bool lfe = false;
    std::vector<std::string> aliases;

    // Canonical position: normalised Cartesian, ADM object frame (always set).
    Vec3 cartesian;
    // Raw authored representations, kept for validation/round-trip fidelity.
    std::optional<Vec3> rawCartesian;
    std::optional<Polar> rawPolar;

    Polar polar() const { return cartesianToPolar(cartesian); }
    Vec3 position(Frame f = Frame::Cartesian) const;  // emit either frame on request

    // Authoring helpers — construct a speaker in either frame (label defaults to
    // id; set .label/.aliases afterwards as needed).
    static Speaker cartesianAt(std::string id, std::string sp, Vec3 p);
    static Speaker polarAt(std::string id, std::string sp, double az, double el, double dist = 1.0);
    static Speaker lfeAt(std::string id, std::string sp, Vec3 p);
};

struct OrderingEntry {
    std::string speaker;                 // speaker id
    std::optional<std::string> label;    // spec-specific label override (SPEC §2.3)

    OrderingEntry() = default;
    OrderingEntry(std::string s) : speaker(std::move(s)) {}       // orderings["adm"] = {"L", ...}
    OrderingEntry(const char* s) : speaker(s) {}
    OrderingEntry(std::string s, std::string l) : speaker(std::move(s)), label(std::move(l)) {}
};

// A group of speakers that together stand in for one position (SPEC §2.4) —
// e.g. a cinema side-surround array. Grouping only: what plays through it, and
// at what level, is the consuming renderer's business.
struct Array {
    std::string id;
    std::string name;
    std::string sp;                     // BS.2051 position the array stands in for; may be empty
    std::vector<std::string> speakers;  // member speaker ids
};

struct ValidationError {
    std::string path;
    std::string reason;
    std::string str() const { return path + ": " + reason; }
};

struct ParseError : std::runtime_error {
    using std::runtime_error::runtime_error;
};

class Layout {
public:
    int version = 1;
    std::string id;
    std::string name;
    std::string description;
    std::string vendor;
    std::vector<std::string> tags;
    std::optional<ReferenceFrame> frame;  // advisory reference frame (allocentric/egocentric)
    std::vector<Speaker> speakers;     // list order = native channel order
    std::map<std::string, std::vector<std::string>> layoutAliases;
    std::map<std::string, std::vector<OrderingEntry>> orderings;
    std::vector<Array> arrays;  // optional speaker groupings (SPEC §2.4)

    // Load + validate. Throws ParseError on malformed YAML or validation failure
    // (message lists every problem). Use parseUnchecked()+validate() to inspect.
    static Layout loadFile(const std::string& path);
    static Layout loadString(const std::string& text);
    static Layout parseUnchecked(const std::string& text);  // no validation

    std::vector<ValidationError> validate() const;  // SPEC §4

    // ---- Queries -----------------------------------------------------------
    std::size_t channelCount() const { return speakers.size(); }

    const Speaker* speakerById(const std::string& id) const;
    const Speaker* speakerByLabel(const std::string& label) const;
    const Speaker* speakerBySp(const std::string& sp) const;
    // Resolve by id, then sp, then label, then alias (layout- or speaker-level).
    const Speaker* resolve(const std::string& token) const;
    // Friendly alias of resolve() — layout.speaker("Ls").
    const Speaker* speaker(const std::string& token) const { return resolve(token); }

    bool hasSpec(const std::string& spec) const;
    std::vector<std::string> specs() const;  // declared orderings + "native"
    std::vector<std::string> orderingSpecs() const;  // non-native specs: inline keys ∪ profile formats (sorted)
    // Channel order for a spec as speaker indices. "native" = speaker order.
    // Throws std::out_of_range for an unknown spec.
    std::vector<std::size_t> orderForSpec(const std::string& spec) const;

    // Channel order as speakers (the common case): for (auto& s : layout.order(Spec::IAMF)).
    std::vector<Speaker> order(Spec spec) const;
    std::vector<Speaker> order(const std::string& spec) const;

    std::vector<std::size_t> lfeIndices() const;

    const Array* arrayById(const std::string& id) const;
    // The array a speaker (by id) belongs to, or nullptr — a speaker is in one at most.
    const Array* arrayForSpeaker(const std::string& speakerId) const;

    // ---- Authoring -------------------------------------------------------
    // Serialise to .osls YAML. Validates first (SPEC §4) and throws ParseError
    // if the layout is invalid — you cannot emit a broken file.
    std::string toYAML(WriteFrame frame = WriteFrame::AsAuthored) const;
    void save(const std::string& path, WriteFrame frame = WriteFrame::AsAuthored) const;
};

}  // namespace osls
