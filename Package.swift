// swift-tools-version:5.9
import PackageDescription

// OSLS Swift binding. Wraps osls-core (C++17) through its C ABI; the C++ sources
// are compiled directly so there is nothing to prebuild.
let package = Package(
    name: "OSLS",
    products: [
        .library(name: "OSLS", targets: ["OSLS"]),
    ],
    targets: [
        // The C++ core, exposed to Swift through its C ABI (see module.modulemap).
        .target(
            name: "COSLSCore",
            path: "sdk/core",
            exclude: ["CMakeLists.txt", "tests", "README.md", "scripts"],
            sources: ["src/yaml.cpp", "src/layout.cpp", "src/c_api.cpp", "src/profiles.generated.cpp"],
            publicHeadersPath: "include"
        ),
        .target(
            name: "OSLS",
            dependencies: ["COSLSCore"],
            path: "sdk/swift/Sources/OSLS",
            linkerSettings: [
                .linkedLibrary("c++", .when(platforms: [.macOS, .iOS, .tvOS, .watchOS, .visionOS])),
                .linkedLibrary("stdc++", .when(platforms: [.linux])),
            ]
        ),
        .testTarget(
            name: "OSLSTests",
            dependencies: ["OSLS"],
            path: "sdk/swift/Tests/OSLSTests"
        ),
    ],
    cxxLanguageStandard: .cxx17
)
