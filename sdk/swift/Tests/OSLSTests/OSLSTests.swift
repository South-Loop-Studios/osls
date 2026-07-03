import XCTest

import OSLS

final class OSLSTests: XCTestCase {
    // Repo root, derived from this file's location: .../osls/sdk/swift/Tests/OSLSTests/OSLSTests.swift
    private var repoRoot: URL {
        var u = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { u.deleteLastPathComponent() }
        return u
    }

    func testReadBlessedLayout() throws {
        let url = repoRoot.appendingPathComponent("layouts/7.1.4.osls")
        let layout = try OSLS.load(contentsOf: url)
        XCTAssertEqual(layout.id, "7.1.4")
        XCTAssertEqual(layout.channelCount, 12)
        // IAMF moves C to channel index 1
        XCTAssertEqual(layout.order(.iamf)[1].id, "C")
        // ADM keeps L,R,C,LFE up front
        XCTAssertEqual(layout.order(.adm).first?.id, "L")
        XCTAssertEqual(layout.order(.adm)[3].id, "LFE")
        // alias + sp resolution
        XCTAssertEqual(layout.speaker("Ls")?.id, "Lss")
        XCTAssertEqual(layout.speaker("M+000")?.id, "C")
        XCTAssertEqual(layout.lfe.count, 1)
        // emit either frame from a Cartesian-stored speaker
        let c = layout.speaker("C")!
        XCTAssertEqual(c.cartesian.y, 1.0, accuracy: 1e-6)
        XCTAssertEqual(c.polar.az, 0.0, accuracy: 1e-3)
    }

    func testAllBlessedLayoutsLoad() throws {
        let dir = repoRoot.appendingPathComponent("layouts")
        let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "osls" }
        XCTAssertGreaterThanOrEqual(files.count, 14)
        for f in files {
            let l = try OSLS.load(contentsOf: f)
            XCTAssertEqual(l.channelCount, l.speakers.count, "\(f.lastPathComponent)")
        }
    }

    func testBuildEmitRoundTrip() throws {
        var l = Layout(id: "my-room", name: "My Room")
        l.vendor = "com.example"
        l.tags = ["custom"]
        l.speakers = [
            .cartesian("L", sp: "M+030", x: -0.5, y: 0.866, z: 0, aliases: ["FL"]),
            .polar("C", sp: "M+000", az: 0, el: 0),
            .lfe("LFE", sp: "LFE1", x: 0, y: 1, z: -0.5),
        ]
        l.orderings["adm"] = ["L", "C", "LFE"]

        let yaml = try l.toOSLS()
        let r = try OSLS.parse(yaml)
        XCTAssertEqual(r.id, "my-room")
        XCTAssertEqual(r.vendor, "com.example")
        XCTAssertEqual(r.channelCount, 3)
        XCTAssertEqual(r.speaker("C")?.id, "C")
        XCTAssertEqual(r.speaker("FL")?.id, "L")
        XCTAssertEqual(r.order(.adm).last?.id, "LFE")
        XCTAssertEqual(r.lfe.count, 1)
        // polar-authored C normalises to the right Cartesian point
        XCTAssertEqual(r.speaker("C")?.cartesian.y ?? 0, 1.0, accuracy: 1e-6)
    }

    func testInvalidLayoutThrows() {
        let l = Layout(id: "x", name: "x")  // no speakers
        XCTAssertThrowsError(try l.toOSLS())
    }
}
