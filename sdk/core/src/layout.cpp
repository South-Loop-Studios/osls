#include "osls/osls.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <ostream>
#include <set>
#include <sstream>

#include "profiles.generated.hpp"
#include "yaml.hpp"

namespace osls {

namespace {
constexpr double kPi = 3.14159265358979323846;
double deg2rad(double d) { return d * kPi / 180.0; }
double rad2deg(double r) { return r * 180.0 / kPi; }
}  // namespace

Vec3 polarToCartesian(const Polar& p) {
    double az = deg2rad(p.az), el = deg2rad(p.el);
    return Vec3{
        -p.dist * std::cos(el) * std::sin(az),
        p.dist * std::cos(el) * std::cos(az),
        p.dist * std::sin(el),
    };
}

Polar cartesianToPolar(const Vec3& c) {
    double dist = std::sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
    Polar p;
    p.dist = dist;
    if (dist <= 1e-12) return p;  // origin: az/el undefined, leave 0
    p.az = rad2deg(std::atan2(-c.x, c.y));
    double s = c.z / dist;
    s = s < -1.0 ? -1.0 : (s > 1.0 ? 1.0 : s);
    p.el = rad2deg(std::asin(s));
    return p;
}

Vec3 Speaker::position(Frame f) const {
    if (f == Frame::Cartesian) return cartesian;
    Polar p = polar();
    return Vec3{p.az, p.el, p.dist};  // pack polar into Vec3 fields az,el,dist
}

std::string specName(Spec s) {
    switch (s) {
        case Spec::Native: return "native";
        case Spec::ADM: return "adm";
        case Spec::IAMF: return "iamf";
        case Spec::MPEGH: return "mpegh";
    }
    return "native";
}

Speaker Speaker::cartesianAt(std::string id, std::string sp, Vec3 p) {
    Speaker s;
    s.label = id;
    s.id = std::move(id);
    s.sp = std::move(sp);
    s.rawCartesian = p;
    s.cartesian = p;
    return s;
}

Speaker Speaker::polarAt(std::string id, std::string sp, double az, double el, double dist) {
    Speaker s;
    s.label = id;
    s.id = std::move(id);
    s.sp = std::move(sp);
    Polar p{az, el, dist};
    s.rawPolar = p;
    s.cartesian = polarToCartesian(p);
    return s;
}

Speaker Speaker::lfeAt(std::string id, std::string sp, Vec3 p) {
    Speaker s = cartesianAt(std::move(id), std::move(sp), p);
    s.lfe = true;
    return s;
}

// ---- Node -> model helpers ------------------------------------------------

namespace {
using yaml::Node;

[[noreturn]] void bad(const std::string& msg) { throw ParseError(msg); }

const Node& require(const Node& m, const std::string& key, const std::string& ctx) {
    const Node* n = m.find(key);
    if (!n) bad(ctx + ": missing required field '" + key + "'");
    return *n;
}

std::string asString(const Node& n, const std::string& ctx) {
    if (!n.isScalar()) bad(ctx + ": expected a scalar string");
    return n.scalar;
}

double asNumber(const Node& n, const std::string& ctx) {
    if (!n.isScalar()) bad(ctx + ": expected a number");
    try {
        size_t used = 0;
        double v = std::stod(n.scalar, &used);
        if (used != n.scalar.size()) throw std::invalid_argument("trailing");
        return v;
    } catch (...) {
        bad(ctx + ": invalid number '" + n.scalar + "'");
    }
}

bool asBool(const Node& n, const std::string& ctx) {
    if (n.isScalar() && (n.scalar == "true" || n.scalar == "false")) return n.scalar == "true";
    bad(ctx + ": expected true/false");
}

std::vector<std::string> asStringList(const Node& n, const std::string& ctx) {
    if (!n.isSeq()) bad(ctx + ": expected a list");
    std::vector<std::string> out;
    for (const auto& e : n.seq) out.push_back(asString(e, ctx + " item"));
    return out;
}
}  // namespace

Layout Layout::parseUnchecked(const std::string& text) {
    Node root = yaml::parse(text);
    if (!root.isMap()) bad("document root must be a mapping");

    Layout L;
    L.version = static_cast<int>(asNumber(require(root, "osls", "root"), "osls"));
    L.id = asString(require(root, "id", "root"), "id");
    L.name = asString(require(root, "name", "root"), "name");
    if (const Node* n = root.find("description")) L.description = asString(*n, "description");
    if (const Node* n = root.find("vendor")) L.vendor = asString(*n, "vendor");
    if (const Node* n = root.find("tags")) L.tags = asStringList(*n, "tags");
    if (const Node* n = root.find("frame")) {
        std::string f = asString(*n, "frame");
        if (f == "allocentric") L.frame = ReferenceFrame::Allocentric;
        else if (f == "egocentric") L.frame = ReferenceFrame::Egocentric;
        else bad("frame: must be 'allocentric' or 'egocentric'");
    }

    const Node* spN = root.find("speakers");
    if (!spN) bad("root: missing required field 'speakers'");
    const Node& sp = *spN;
    if (!sp.isSeq() || sp.seq.empty()) bad("speakers: must be a non-empty list");
    for (const auto& sn : sp.seq) {
        if (!sn.isMap()) bad("speakers: each item must be a mapping");
        std::string ctx = "speaker";
        Speaker s;
        s.id = asString(require(sn, "id", ctx), "speaker.id");
        ctx = "speaker '" + s.id + "'";
        s.label = asString(require(sn, "label", ctx), ctx + ".label");
        if (const Node* n = sn.find("sp")) s.sp = asString(*n, ctx + ".sp");
        if (const Node* n = sn.find("lfe")) s.lfe = asBool(*n, ctx + ".lfe");
        if (const Node* n = sn.find("aliases")) s.aliases = asStringList(*n, ctx + ".aliases");

        bool hasX = sn.find("x"), hasY = sn.find("y"), hasZ = sn.find("z");
        bool hasAz = sn.find("az"), hasEl = sn.find("el");
        if (hasX || hasY || hasZ) {
            if (!(hasX && hasY && hasZ)) bad(ctx + ": x, y, z are required together");
            s.rawCartesian = Vec3{asNumber(*sn.find("x"), ctx + ".x"),
                                  asNumber(*sn.find("y"), ctx + ".y"),
                                  asNumber(*sn.find("z"), ctx + ".z")};
        }
        if (hasAz || hasEl) {
            if (!(hasAz && hasEl)) bad(ctx + ": az and el are required together");
            Polar p;
            p.az = asNumber(*sn.find("az"), ctx + ".az");
            p.el = asNumber(*sn.find("el"), ctx + ".el");
            if (const Node* n = sn.find("dist")) p.dist = asNumber(*n, ctx + ".dist");
            s.rawPolar = p;
        }
        if (!s.rawCartesian && !s.rawPolar) bad(ctx + ": no position (need x,y,z or az,el)");
        s.cartesian = s.rawCartesian ? *s.rawCartesian : polarToCartesian(*s.rawPolar);
        L.speakers.push_back(std::move(s));
    }

    if (const Node* al = root.find("aliases")) {
        if (!al->isMap()) bad("aliases: must be a mapping");
        for (const auto& kv : al->map) L.layoutAliases[kv.first] = asStringList(kv.second, "aliases");
    }

    if (const Node* ord = root.find("orderings")) {
        if (!ord->isMap()) bad("orderings: must be a mapping");
        for (const auto& kv : ord->map) {
            if (!kv.second.isSeq()) bad("orderings." + kv.first + ": must be a list");
            std::vector<OrderingEntry> entries;
            for (const auto& e : kv.second.seq) {
                OrderingEntry oe;
                if (e.isScalar()) {
                    oe.speaker = e.scalar;
                } else if (e.isMap()) {  // { speaker: X, label: Y }
                    oe.speaker = asString(require(e, "speaker", "ordering entry"), "ordering.speaker");
                    if (const Node* l = e.find("label")) oe.label = asString(*l, "ordering.label");
                } else {
                    bad("orderings." + kv.first + ": entry must be an id or { speaker, label }");
                }
                entries.push_back(std::move(oe));
            }
            L.orderings[kv.first] = std::move(entries);
        }
    }

    if (const Node* ar = root.find("arrays")) {
        if (!ar->isSeq()) bad("arrays: must be a list");
        for (const auto& an : ar->seq) {
            if (!an.isMap()) bad("arrays: each item must be a mapping");
            Array a;
            a.id = asString(require(an, "id", "array"), "array.id");
            std::string ctx = "array '" + a.id + "'";
            a.name = asString(require(an, "name", ctx), ctx + ".name");
            if (const Node* n = an.find("sp")) a.sp = asString(*n, ctx + ".sp");
            a.speakers = asStringList(require(an, "speakers", ctx), ctx + ".speakers");
            L.arrays.push_back(std::move(a));
        }
    }
    return L;
}

// ---- Validation (SPEC §4) -------------------------------------------------

std::vector<ValidationError> Layout::validate() const {
    std::vector<ValidationError> errs;
    auto add = [&](std::string path, std::string reason) { errs.push_back({std::move(path), std::move(reason)}); };

    if (version != 1) add("osls", "must be 1, got " + std::to_string(version));
    if (id.empty()) add("id", "must not be empty");
    if (name.empty()) add("name", "must not be empty");
    if (speakers.empty()) add("speakers", "must not be empty");

    std::set<std::string> ids;
    std::map<std::string, std::string> spOwner;
    for (const auto& s : speakers) {
        std::string p = "speakers[" + s.id + "]";
        if (s.id.empty()) add("speakers", "a speaker has an empty id");
        if (!ids.insert(s.id).second) add(p, "duplicate speaker id");
        if (s.label.empty()) add(p, "empty label");
        // Rule 2 — position present & consistent.
        if (!s.rawCartesian && !s.rawPolar) add(p, "no position");
        if (s.rawCartesian && s.rawPolar) {
            Vec3 fromPolar = polarToCartesian(*s.rawPolar);
            double d = std::max({std::fabs(fromPolar.x - s.rawCartesian->x),
                                 std::fabs(fromPolar.y - s.rawCartesian->y),
                                 std::fabs(fromPolar.z - s.rawCartesian->z)});
            if (d > kEpsilon)
                add(p, "Cartesian/polar disagree by " + std::to_string(d) + " > ε=0.01");
        }
        // Rule 5 — identity sanity: no two speakers share an sp.
        if (!s.sp.empty()) {
            auto it = spOwner.find(s.sp);
            if (it != spOwner.end()) add(p, "sp '" + s.sp + "' already used by speaker '" + it->second + "'");
            else spOwner[s.sp] = s.id;
        }
    }

    // Rule 3 — orderings are permutations of the speaker set.
    for (const auto& kv : orderings) {
        std::string p = "orderings." + kv.first;
        std::multiset<std::string> seen;
        for (const auto& e : kv.second) {
            if (!ids.count(e.speaker)) add(p, "references unknown speaker id '" + e.speaker + "'");
            seen.insert(e.speaker);
        }
        if (kv.second.size() != speakers.size())
            add(p, "has " + std::to_string(kv.second.size()) + " entries, expected " +
                       std::to_string(speakers.size()));
        for (const auto& s : speakers)
            if (seen.count(s.id) != 1)
                add(p, "speaker '" + s.id + "' appears " + std::to_string(seen.count(s.id)) + " times (expected 1)");
    }

    // Rule 7 — arrays group existing speakers, all LFE (a sub array) or none; one array per speaker and per sp;
    // a speaker at the array's sp (its principal) is a member.
    std::set<std::string> arrayIds;
    std::map<std::string, std::string> memberOf, arraySp;
    for (const auto& a : arrays) {
        std::string p = "arrays[" + a.id + "]";
        if (a.id.empty()) add("arrays", "an array has an empty id");
        if (!arrayIds.insert(a.id).second) add(p, "duplicate array id");
        if (a.name.empty()) add(p, "empty name");
        if (a.speakers.size() < 2) add(p, "needs at least 2 speakers");
        int lfeMembers = 0, known = 0;
        for (const auto& m : a.speakers) {
            const Speaker* s = speakerById(m);
            if (!s) add(p, "references unknown speaker id '" + m + "'");
            else { ++known; lfeMembers += s->lfe ? 1 : 0; }
            auto it = memberOf.find(m);
            if (it == memberOf.end()) memberOf[m] = a.id;
            else if (it->second == a.id) add(p, "lists speaker '" + m + "' twice");
            else add(p, "speaker '" + m + "' is already in array '" + it->second + "'");
        }
        if (lfeMembers > 0 && lfeMembers < known) add(p, "mixes LFE and non-LFE speakers (a sub array is all LFE)");
        if (a.sp.empty()) add(p, "needs an sp — the position it stands in for");
        else {
            auto it = arraySp.find(a.sp);
            if (it != arraySp.end()) add(p, "sp '" + a.sp + "' already used by array '" + it->second + "'");
            else arraySp[a.sp] = a.id;
            // The principal: a speaker at the array's position is one of its members.
            for (const auto& s : speakers)
                if (s.sp == a.sp && std::find(a.speakers.begin(), a.speakers.end(), s.id) == a.speakers.end())
                    add(p, "speaker '" + s.id + "' is at the array's position " + a.sp + ", so it must be a member");
        }
    }
    return errs;
}

Layout Layout::loadString(const std::string& text) {
    Layout L = parseUnchecked(text);
    auto errs = L.validate();
    if (!errs.empty()) {
        std::ostringstream os;
        os << "validation failed (" << errs.size() << " error(s)):";
        for (const auto& e : errs) os << "\n  - " << e.str();
        throw ParseError(os.str());
    }
    return L;
}

Layout Layout::loadFile(const std::string& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) throw ParseError("cannot open file: " + path);
    std::ostringstream ss;
    ss << f.rdbuf();
    try {
        return loadString(ss.str());
    } catch (const ParseError& e) {
        throw ParseError(path + ": " + e.what());
    }
}

// ---- Queries --------------------------------------------------------------

const Speaker* Layout::speakerById(const std::string& q) const {
    for (const auto& s : speakers)
        if (s.id == q) return &s;
    return nullptr;
}
const Speaker* Layout::speakerByLabel(const std::string& q) const {
    for (const auto& s : speakers)
        if (s.label == q) return &s;
    return nullptr;
}
const Speaker* Layout::speakerBySp(const std::string& q) const {
    for (const auto& s : speakers)
        if (!s.sp.empty() && s.sp == q) return &s;
    return nullptr;
}

const Speaker* Layout::resolve(const std::string& token) const {
    if (const Speaker* s = speakerById(token)) return s;
    if (const Speaker* s = speakerBySp(token)) return s;
    if (const Speaker* s = speakerByLabel(token)) return s;
    for (const auto& s : speakers)
        for (const auto& a : s.aliases)
            if (a == token) return &s;
    for (const auto& kv : layoutAliases)
        for (const auto& a : kv.second)
            if (a == token) return speakerById(kv.first);
    return nullptr;
}

std::vector<std::string> Layout::orderingSpecs() const {
    std::set<std::string> set;
    for (const auto& kv : orderings) set.insert(kv.first);
    for (const auto& f : profiles::formatsForLayout(id)) set.insert(f);
    return std::vector<std::string>(set.begin(), set.end());
}

bool Layout::hasSpec(const std::string& spec) const {
    if (spec == "native" || orderings.count(spec) > 0) return true;
    return profiles::orderForLayout(spec, id) != nullptr;
}

std::vector<std::string> Layout::specs() const {
    std::vector<std::string> out{"native"};
    for (const auto& s : orderingSpecs()) out.push_back(s);
    return out;
}

std::vector<std::size_t> Layout::orderForSpec(const std::string& spec) const {
    std::vector<std::size_t> out;
    if (spec == "native") {
        for (std::size_t i = 0; i < speakers.size(); ++i) out.push_back(i);
        return out;
    }
    // 1. inline override (custom escape hatch)
    auto it = orderings.find(spec);
    if (it != orderings.end()) {
        for (const auto& e : it->second) {
            const Speaker* s = speakerById(e.speaker);
            if (!s) throw std::out_of_range("ordering '" + spec + "' references unknown id '" + e.speaker + "'");
            out.push_back(static_cast<std::size_t>(s - &speakers[0]));
        }
        return out;
    }
    // 2. profile projection by sp
    if (const std::vector<std::string>* order = profiles::orderForLayout(spec, id)) {
        for (const std::string& sp : *order) {
            const Speaker* s = speakerBySp(sp);
            if (s) out.push_back(static_cast<std::size_t>(s - &speakers[0]));  // skip sp the rig lacks
        }
        return out;
    }
    // 3. unknown
    throw std::out_of_range("unknown spec ordering: " + spec);
}

std::vector<std::size_t> Layout::lfeIndices() const {
    std::vector<std::size_t> out;
    for (std::size_t i = 0; i < speakers.size(); ++i)
        if (speakers[i].lfe) out.push_back(i);
    return out;
}

const Array* Layout::arrayById(const std::string& q) const {
    for (const auto& a : arrays)
        if (a.id == q) return &a;
    return nullptr;
}

const Array* Layout::arrayForSpeaker(const std::string& speakerId) const {
    for (const auto& a : arrays)
        for (const auto& m : a.speakers)
            if (m == speakerId) return &a;
    return nullptr;
}

std::vector<Speaker> Layout::order(const std::string& spec) const {
    std::vector<Speaker> out;
    for (std::size_t i : orderForSpec(spec)) out.push_back(speakers[i]);
    return out;
}

std::vector<Speaker> Layout::order(Spec spec) const { return order(specName(spec)); }

// ---- Serialisation --------------------------------------------------------

namespace {

// Shortest clean decimal (avoids "-0", trailing zeros); round-trips our values.
std::string num(double v) {
    if (v == 0.0) return "0";
    char buf[32];
    std::snprintf(buf, sizeof buf, "%g", v);
    return buf;
}

// YAML double-quote a string if it isn't a safe bare scalar.
std::string scalar(const std::string& s) {
    bool safe = !s.empty();
    for (char c : s)
        if (!(std::isalnum(static_cast<unsigned char>(c)) || c == '+' || c == '-' || c == '.' || c == '_'))
            safe = false;
    if (safe) return s;
    std::string out = "\"";
    for (char c : s) {
        if (c == '"' || c == '\\') out += '\\';
        out += c;
    }
    return out + "\"";
}

void writeSpeaker(std::ostream& os, const Speaker& s, WriteFrame frame) {
    bool cart = false, polar = false;
    switch (frame) {
        case WriteFrame::AsAuthored: cart = s.rawCartesian.has_value(); polar = s.rawPolar.has_value(); break;
        case WriteFrame::Cartesian: cart = true; break;
        case WriteFrame::Polar: polar = true; break;
        case WriteFrame::Both: cart = polar = true; break;
    }
    if (!cart && !polar) cart = true;  // always emit at least one frame

    os << "  - { id: " << scalar(s.id) << ", label: " << scalar(s.label);
    if (!s.sp.empty()) os << ", sp: " << scalar(s.sp);
    if (s.lfe) os << ", lfe: true";
    if (cart) {
        Vec3 c = s.rawCartesian.value_or(s.cartesian);
        os << ", x: " << num(c.x) << ", y: " << num(c.y) << ", z: " << num(c.z);
    }
    if (polar) {
        Polar p = s.rawPolar.value_or(s.polar());
        os << ", az: " << num(p.az) << ", el: " << num(p.el);
        if (std::fabs(p.dist - 1.0) > 1e-9) os << ", dist: " << num(p.dist);
    }
    if (!s.aliases.empty()) {
        os << ", aliases: [";
        for (std::size_t i = 0; i < s.aliases.size(); ++i)
            os << (i ? ", " : "") << scalar(s.aliases[i]);
        os << "]";
    }
    os << " }\n";
}

}  // namespace

std::string Layout::toYAML(WriteFrame frame) const {
    auto errs = validate();
    if (!errs.empty()) {
        std::ostringstream e;
        e << "refusing to serialise invalid layout (" << errs.size() << " error(s)):";
        for (const auto& v : errs) e << "\n  - " << v.str();
        throw ParseError(e.str());
    }

    std::ostringstream os;
    os << "osls: " << version << "\n";
    os << "id: " << scalar(id) << "\n";
    os << "name: " << scalar(name) << "\n";
    if (!description.empty()) os << "description: " << scalar(description) << "\n";
    if (!vendor.empty()) os << "vendor: " << scalar(vendor) << "\n";
    if (!tags.empty()) {
        os << "tags: [";
        for (std::size_t i = 0; i < tags.size(); ++i) os << (i ? ", " : "") << scalar(tags[i]);
        os << "]\n";
    }
    if (this->frame) os << "frame: " << (*this->frame == ReferenceFrame::Allocentric ? "allocentric" : "egocentric") << "\n";

    os << "speakers:\n";
    for (const auto& s : speakers) writeSpeaker(os, s, frame);

    if (!layoutAliases.empty()) {
        os << "aliases:\n";
        for (const auto& kv : layoutAliases) {
            os << "  " << scalar(kv.first) << ": [";
            for (std::size_t i = 0; i < kv.second.size(); ++i) os << (i ? ", " : "") << scalar(kv.second[i]);
            os << "]\n";
        }
    }

    if (!orderings.empty()) {
        os << "orderings:\n";
        for (const auto& kv : orderings) {
            os << "  " << kv.first << ": [";
            for (std::size_t i = 0; i < kv.second.size(); ++i) {
                const OrderingEntry& e = kv.second[i];
                os << (i ? ", " : "");
                if (e.label) os << "{ speaker: " << scalar(e.speaker) << ", label: " << scalar(*e.label) << " }";
                else os << scalar(e.speaker);
            }
            os << "]\n";
        }
    }

    if (!arrays.empty()) {
        os << "arrays:\n";
        for (const auto& a : arrays) {
            os << "  - { id: " << scalar(a.id) << ", name: " << scalar(a.name);
            if (!a.sp.empty()) os << ", sp: " << scalar(a.sp);
            os << ", speakers: [";
            for (std::size_t i = 0; i < a.speakers.size(); ++i) os << (i ? ", " : "") << scalar(a.speakers[i]);
            os << "] }\n";
        }
    }
    return os.str();
}

void Layout::save(const std::string& path, WriteFrame frame) const {
    std::string text = toYAML(frame);
    std::ofstream f(path, std::ios::binary);
    if (!f) throw ParseError("cannot write file: " + path);
    f << text;
}

}  // namespace osls
