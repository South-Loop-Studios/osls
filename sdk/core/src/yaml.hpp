// Minimal YAML reader scoped to the .osls subset (SPEC §2): block mappings,
// block sequences, flow mappings/sequences, scalars, and comments. NOT a
// general YAML parser — it deliberately rejects constructs the format doesn't
// use, keeping osls-core dependency-free for clean WASM/iOS/Windows builds.
// The model layer maps Node -> Layout.
#pragma once

#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace osls::yaml {

struct Node {
    enum class Type { Null, Scalar, Seq, Map };

    Type type = Type::Null;
    std::string scalar;   // raw text for Scalar (quotes removed)
    bool quoted = false;  // scalar was quoted -> always a string
    int line = 0;         // 1-based source line (best effort)
    std::vector<Node> seq;
    std::vector<std::pair<std::string, Node>> map;

    bool isNull() const { return type == Type::Null; }
    bool isScalar() const { return type == Type::Scalar; }
    bool isSeq() const { return type == Type::Seq; }
    bool isMap() const { return type == Type::Map; }

    // Map lookup; returns nullptr when absent or not a map.
    const Node* find(const std::string& key) const;
};

struct ParseError : std::runtime_error {
    using std::runtime_error::runtime_error;
};

// Parse .osls/.yaml text into a Node tree. Throws ParseError on malformed input.
Node parse(const std::string& text);

}  // namespace osls::yaml
