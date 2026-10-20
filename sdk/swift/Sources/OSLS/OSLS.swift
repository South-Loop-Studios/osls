// OSLS — idiomatic Swift binding over osls-core (via its C ABI).
//
// Read:  let layout = try OSLS.load(contentsOf: url)
//        for s in layout.order(.iamf) { s.label; s.sp; s.cartesian; s.polar }
// Build: var l = Layout(id: "my-room", name: "My Room")
//        l.speakers = [.cartesian("L", sp: "M+030", x: -0.5, y: 0.866, z: 0), ...]
//        try l.save(to: url)
//
// A Layout is a plain Swift value: load copies it out of the core and frees the
// handle, so there is no memory to manage. Loading and saving both run the
// SPEC §4 validator in the core and throw OSLSError on invalid input.

import COSLSCore
import Foundation

// MARK: - Geometry

public struct Vec3: Equatable, Sendable {
    public var x: Double, y: Double, z: Double
    public init(_ x: Double, _ y: Double, _ z: Double) { self.x = x; self.y = y; self.z = z }
}

public struct Polar: Equatable, Sendable {
    public var az: Double, el: Double, dist: Double
    public init(az: Double, el: Double, dist: Double = 1.0) { self.az = az; self.el = el; self.dist = dist }
}

public enum Frame: Sendable { case cartesian, polar }

/// SPEC §2.2 conversions (ITU-R BS.2127; az positive = listener's left).
public func polarToCartesian(_ p: Polar) -> Vec3 {
    let az = p.az * .pi / 180, el = p.el * .pi / 180
    return Vec3(-p.dist * cos(el) * sin(az), p.dist * cos(el) * cos(az), p.dist * sin(el))
}
public func cartesianToPolar(_ c: Vec3) -> Polar {
    let dist = (c.x * c.x + c.y * c.y + c.z * c.z).squareRoot()
    if dist <= 1e-12 { return Polar(az: 0, el: 0, dist: 0) }
    let s = max(-1.0, min(1.0, c.z / dist))
    return Polar(az: atan2(-c.x, c.y) * 180 / .pi, el: asin(s) * 180 / .pi, dist: dist)
}

// MARK: - Spec / write frame

public enum Spec: Sendable {
    case native, adm, iamf, mpegh
    case custom(String)
    public var name: String {
        switch self {
        case .native: return "native"
        case .adm: return "adm"
        case .iamf: return "iamf"
        case .mpegh: return "mpegh"
        case .custom(let s): return s
        }
    }
}

public enum WriteFrame: Sendable {
    case asAuthored, cartesian, polar, both
    var raw: osls_write_frame {
        switch self {
        case .asAuthored: return OSLS_AS_AUTHORED
        case .cartesian: return OSLS_WRITE_CARTESIAN
        case .polar: return OSLS_WRITE_POLAR
        case .both: return OSLS_WRITE_BOTH
        }
    }
}

public struct OSLSError: Error, CustomStringConvertible {
    public let message: String
    public var description: String { message }
}

// MARK: - Speaker

public struct Speaker: Equatable, Sendable {
    public var id: String
    public var label: String
    public var sp: String
    public var isLFE: Bool
    public var aliases: [String]
    public var cartesian: Vec3
    /// Set when the speaker was authored in polar, so save() preserves that frame.
    internal var authoredPolar: Polar?

    public init(id: String, label: String? = nil, sp: String = "", isLFE: Bool = false,
                aliases: [String] = [], cartesian: Vec3) {
        self.id = id
        self.label = label ?? id
        self.sp = sp
        self.isLFE = isLFE
        self.aliases = aliases
        self.cartesian = cartesian
        self.authoredPolar = nil
    }

    /// Position in either frame (Cartesian is canonical; polar derived on request).
    public var polar: Polar { authoredPolar ?? cartesianToPolar(cartesian) }
    public func position(_ frame: Frame) -> Vec3 {
        switch frame {
        case .cartesian: return cartesian
        case .polar: let p = polar; return Vec3(p.az, p.el, p.dist)
        }
    }

    // Authoring conveniences (author in either frame).
    public static func cartesian(_ id: String, sp: String = "", x: Double, y: Double, z: Double,
                                 label: String? = nil, aliases: [String] = []) -> Speaker {
        Speaker(id: id, label: label, sp: sp, isLFE: false, aliases: aliases, cartesian: Vec3(x, y, z))
    }
    public static func polar(_ id: String, sp: String = "", az: Double, el: Double, dist: Double = 1.0,
                             label: String? = nil, aliases: [String] = []) -> Speaker {
        let p = Polar(az: az, el: el, dist: dist)
        var s = Speaker(id: id, label: label, sp: sp, isLFE: false, aliases: aliases,
                        cartesian: polarToCartesian(p))
        s.authoredPolar = p
        return s
    }
    public static func lfe(_ id: String, sp: String = "", x: Double, y: Double, z: Double,
                           label: String? = nil) -> Speaker {
        Speaker(id: id, label: label, sp: sp, isLFE: true, aliases: [], cartesian: Vec3(x, y, z))
    }
}

// MARK: - Arrays

/// Speakers that together stand in for one position — e.g. a cinema side-surround
/// array (SPEC §2.4). Grouping only; what plays through it is the renderer's business.
public struct SpeakerArray: Equatable, Sendable {
    public var id: String
    public var name: String
    /// ITU-R BS.2051 SP-label of the position the array stands in for; may be empty.
    public var sp: String
    /// Member speaker ids.
    public var speakers: [String]
    public init(id: String, name: String, sp: String = "", speakers: [String]) {
        self.id = id; self.name = name; self.sp = sp; self.speakers = speakers
    }
}

// MARK: - Layout

public struct Layout: Equatable, Sendable {
    public var version: Int = 1
    public var id: String = ""
    public var name: String = ""
    public var description: String = ""
    public var vendor: String = ""
    public var tags: [String] = []
    public var speakers: [Speaker] = []
    /// spec name -> channel order as speaker ids ("native" is implied by `speakers`).
    public var orderings: [String: [String]] = [:]
    /// Optional speaker groupings (SPEC §2.4).
    public var arrays: [SpeakerArray] = []

    public init() {}
    public init(id: String, name: String) { self.id = id; self.name = name }

    // MARK: Loading

    public static func parse(_ text: String) throws -> Layout {
        try fromHandle { errbuf, errlen in osls_load_string(text, errbuf, errlen) }
    }
    public static func load(path: String) throws -> Layout {
        try fromHandle { errbuf, errlen in osls_load_file(path, errbuf, errlen) }
    }
    public static func load(contentsOf url: URL) throws -> Layout { try load(path: url.path) }

    private static func fromHandle(_ make: (UnsafeMutablePointer<CChar>, Int) -> OpaquePointer?) throws -> Layout {
        var err = [CChar](repeating: 0, count: 1024)
        guard let h = make(&err, err.count) else { throw OSLSError(message: String(cString: err)) }
        defer { osls_free(h) }
        return Layout(reading: h)
    }

    private init(reading h: OpaquePointer) {
        id = String(cString: osls_id(h))
        name = String(cString: osls_name(h))
        description = String(cString: osls_description(h))
        vendor = String(cString: osls_vendor(h))
        for i in 0..<osls_tag_count(h) { tags.append(String(cString: osls_tag(h, i))) }

        let n = osls_channel_count(h)
        for i in 0..<n {
            var x = 0.0, y = 0.0, z = 0.0
            _ = osls_speaker_position(h, i, OSLS_CARTESIAN, &x, &y, &z)
            var s = Speaker(id: String(cString: osls_speaker_id(h, i)),
                            label: String(cString: osls_speaker_label(h, i)),
                            sp: String(cString: osls_speaker_sp(h, i)),
                            isLFE: osls_speaker_is_lfe(h, i) != 0,
                            cartesian: Vec3(x, y, z))
            for j in 0..<osls_speaker_alias_count(h, i) {
                s.aliases.append(String(cString: osls_speaker_alias(h, i, j)))
            }
            speakers.append(s)
        }

        for k in 0..<osls_spec_count(h) {
            let spec = String(cString: osls_spec_name(h, k))
            var idx = [Int32](repeating: 0, count: Int(max(n, 1)))
            let count = idx.withUnsafeMutableBufferPointer { osls_order_for_spec(h, spec, $0.baseAddress, Int32($0.count)) }
            if count > 0 {
                orderings[spec] = (0..<Int(count)).map { String(cString: osls_speaker_id(h, idx[$0])) }
            }
        }

        for a in 0..<osls_array_count(h) {
            let members = (0..<osls_array_speaker_count(h, a)).map {
                String(cString: osls_speaker_id(h, osls_array_speaker(h, a, $0)))
            }
            arrays.append(SpeakerArray(id: String(cString: osls_array_id(h, a)),
                                       name: String(cString: osls_array_name(h, a)),
                                       sp: String(cString: osls_array_sp(h, a)),
                                       speakers: members))
        }
    }

    // MARK: Queries

    public var channelCount: Int { speakers.count }
    public var lfe: [Speaker] { speakers.filter { $0.isLFE } }

    /// Speakers in a spec's channel order (`.native` = the `speakers` order).
    public func order(_ spec: Spec) -> [Speaker] {
        let ids = spec.name == "native" ? speakers.map { $0.id } : (orderings[spec.name] ?? [])
        return ids.compactMap { id in speakers.first { $0.id == id } }
    }

    /// Resolve a token to a speaker: id, then sp, then label, then alias.
    public func speaker(_ token: String) -> Speaker? {
        if let s = speakers.first(where: { $0.id == token }) { return s }
        if let s = speakers.first(where: { !$0.sp.isEmpty && $0.sp == token }) { return s }
        if let s = speakers.first(where: { $0.label == token }) { return s }
        return speakers.first { $0.aliases.contains(token) }
    }

    public var specs: [String] { ["native"] + orderings.keys.sorted() }

    /// The array a speaker (by id) belongs to — a speaker is in one at most.
    public func array(for speakerId: String) -> SpeakerArray? {
        arrays.first { $0.speakers.contains(speakerId) }
    }

    // MARK: Authoring

    /// Serialise to `.osls` YAML. Validates first (SPEC §4); throws on invalid.
    public func toOSLS(_ frame: WriteFrame = .asAuthored) throws -> String {
        guard let h = osls_new() else { throw OSLSError(message: "out of memory") }
        defer { osls_free(h) }
        osls_set_id(h, id)
        osls_set_name(h, name)
        if !description.isEmpty { osls_set_description(h, description) }
        if !vendor.isEmpty { osls_set_vendor(h, vendor) }
        for t in tags { osls_add_tag(h, t) }
        for s in speakers {
            // Empty sp is treated as "no sp" by the core, so pass a plain String
            // (avoids fragile String? -> const char* bridging).
            let idx: Int32
            if let p = s.authoredPolar {
                idx = osls_add_speaker(h, s.id, s.label, s.sp, s.isLFE ? 1 : 0, OSLS_POLAR, p.az, p.el, p.dist)
            } else {
                idx = osls_add_speaker(h, s.id, s.label, s.sp, s.isLFE ? 1 : 0, OSLS_CARTESIAN,
                                       s.cartesian.x, s.cartesian.y, s.cartesian.z)
            }
            for a in s.aliases { osls_speaker_add_alias(h, idx, a) }
        }
        for spec in orderings.keys.sorted() {
            for id in orderings[spec] ?? [] { osls_ordering_add(h, spec, id) }
        }
        for a in arrays {
            let ai = osls_add_array(h, a.id, a.name, a.sp)
            for m in a.speakers { osls_array_add_speaker(h, ai, m) }
        }
        var err = [CChar](repeating: 0, count: 1024)
        guard let cstr = osls_to_yaml(h, frame.raw, &err, err.count) else {
            throw OSLSError(message: String(cString: err))
        }
        defer { osls_string_free(cstr) }
        return String(cString: cstr)
    }

    public func save(to url: URL, _ frame: WriteFrame = .asAuthored) throws {
        try toOSLS(frame).write(to: url, atomically: true, encoding: .utf8)
    }
}

// MARK: - Top-level entry points (OSLS.load / OSLS.parse)

public enum OSLS {
    public static func load(contentsOf url: URL) throws -> Layout { try Layout.load(contentsOf: url) }
    public static func load(path: String) throws -> Layout { try Layout.load(path: path) }
    public static func parse(_ text: String) throws -> Layout { try Layout.parse(text) }
}
