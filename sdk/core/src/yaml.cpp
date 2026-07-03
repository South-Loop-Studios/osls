#include "yaml.hpp"

#include <cctype>
#include <string>

namespace osls::yaml {

const Node* Node::find(const std::string& key) const {
    if (type != Type::Map) return nullptr;
    for (const auto& kv : map)
        if (kv.first == key) return &kv.second;
    return nullptr;
}

namespace {

[[noreturn]] void fail(int line, const std::string& msg) {
    throw ParseError("line " + std::to_string(line) + ": " + msg);
}

std::string rtrim(std::string s) {
    while (!s.empty() && std::isspace(static_cast<unsigned char>(s.back()))) s.pop_back();
    return s;
}
std::string ltrim(const std::string& s) {
    size_t i = 0;
    while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) ++i;
    return s.substr(i);
}
std::string trim(const std::string& s) { return rtrim(ltrim(s)); }

// Remove a trailing "# comment", honouring quotes. A '#' starts a comment only
// at line start or after whitespace (so "M+030" or "a#b" stay intact).
std::string strip_comment(const std::string& s) {
    bool sq = false, dq = false;
    for (size_t i = 0; i < s.size(); ++i) {
        char c = s[i];
        if (c == '\'' && !dq) sq = !sq;
        else if (c == '"' && !sq) dq = !dq;
        else if (c == '#' && !sq && !dq && (i == 0 || std::isspace(static_cast<unsigned char>(s[i - 1]))))
            return s.substr(0, i);
    }
    return s;
}

std::string unquote(const std::string& s, bool& quoted) {
    quoted = false;
    if (s.size() >= 2 && ((s.front() == '"' && s.back() == '"') ||
                          (s.front() == '\'' && s.back() == '\''))) {
        quoted = true;
        std::string inner = s.substr(1, s.size() - 2);
        if (s.front() == '"') {  // minimal escape handling for double quotes
            std::string out;
            for (size_t i = 0; i < inner.size(); ++i) {
                if (inner[i] == '\\' && i + 1 < inner.size()) { out += inner[++i]; }
                else out += inner[i];
            }
            return out;
        }
        return inner;
    }
    return s;
}

// ---- Flow parser: { ... } / [ ... ] / scalar -----------------------------

void skip_ws(const std::string& s, size_t& i) {
    while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) ++i;
}

Node parse_flow(const std::string& s, size_t& i, int line);

Node parse_flow_scalar(const std::string& s, size_t& i, int line) {
    skip_ws(s, i);
    Node n;
    n.type = Node::Type::Scalar;
    n.line = line;
    if (i < s.size() && (s[i] == '"' || s[i] == '\'')) {
        char q = s[i++];
        std::string raw;
        raw += q;
        while (i < s.size() && s[i] != q) {
            if (s[i] == '\\' && q == '"' && i + 1 < s.size()) raw += s[i++];
            raw += s[i++];
        }
        if (i >= s.size()) fail(line, "unterminated quoted scalar");
        raw += s[i++];  // closing quote
        n.scalar = unquote(raw, n.quoted);
        return n;
    }
    size_t start = i;
    while (i < s.size() && s[i] != ',' && s[i] != '}' && s[i] != ']') ++i;
    n.scalar = trim(s.substr(start, i - start));
    return n;
}

Node parse_flow(const std::string& s, size_t& i, int line) {
    skip_ws(s, i);
    if (i >= s.size()) fail(line, "unexpected end of flow");
    if (s[i] == '{') {
        ++i;
        Node n;
        n.type = Node::Type::Map;
        n.line = line;
        skip_ws(s, i);
        if (i < s.size() && s[i] == '}') { ++i; return n; }
        while (true) {
            skip_ws(s, i);
            size_t ks = i;
            while (i < s.size() && s[i] != ':' && s[i] != '}' && s[i] != ',') ++i;
            if (i >= s.size() || s[i] != ':') fail(line, "expected ':' in flow mapping");
            std::string key = trim(s.substr(ks, i - ks));
            ++i;  // ':'
            Node v = parse_flow(s, i, line);
            n.map.emplace_back(key, std::move(v));
            skip_ws(s, i);
            if (i < s.size() && s[i] == ',') { ++i; continue; }
            if (i < s.size() && s[i] == '}') { ++i; break; }
            fail(line, "expected ',' or '}' in flow mapping");
        }
        return n;
    }
    if (s[i] == '[') {
        ++i;
        Node n;
        n.type = Node::Type::Seq;
        n.line = line;
        skip_ws(s, i);
        if (i < s.size() && s[i] == ']') { ++i; return n; }
        while (true) {
            Node v = parse_flow(s, i, line);
            n.seq.push_back(std::move(v));
            skip_ws(s, i);
            if (i < s.size() && s[i] == ',') { ++i; continue; }
            if (i < s.size() && s[i] == ']') { ++i; break; }
            fail(line, "expected ',' or ']' in flow sequence");
        }
        return n;
    }
    return parse_flow_scalar(s, i, line);
}

Node parse_inline(const std::string& text, int line) {
    size_t i = 0;
    Node n = parse_flow(text, i, line);
    skip_ws(text, i);
    if (i != text.size()) fail(line, "trailing content after value: '" + text.substr(i) + "'");
    return n;
}

// ---- Block parser --------------------------------------------------------

struct Line {
    int indent;
    std::string content;  // left-trimmed, comment-stripped, right-trimmed
    int no;               // 1-based
};

bool is_seq_item(const std::string& c) { return c == "-" || (c.size() >= 2 && c[0] == '-' && c[1] == ' '); }

std::string after_dash(const std::string& c) { return c == "-" ? "" : ltrim(c.substr(1)); }

// Split "key: rest" at the first ':' that is followed by space/EOL and sits
// outside quotes. Keys in the .osls subset are always unquoted and ':'-free.
std::pair<std::string, std::string> split_key(const std::string& c, int line) {
    bool sq = false, dq = false;
    for (size_t i = 0; i < c.size(); ++i) {
        char ch = c[i];
        if (ch == '\'' && !dq) sq = !sq;
        else if (ch == '"' && !sq) dq = !dq;
        else if (ch == ':' && !sq && !dq && (i + 1 == c.size() || c[i + 1] == ' '))
            return {trim(c.substr(0, i)), trim(c.substr(i + 1))};
    }
    fail(line, "expected 'key: value' mapping, got: '" + c + "'");
}

Node parse_block(const std::vector<Line>& lines, size_t& pos, int indent) {
    Node n;
    n.line = lines[pos].no;
    if (is_seq_item(lines[pos].content)) {
        n.type = Node::Type::Seq;
        while (pos < lines.size() && lines[pos].indent == indent && is_seq_item(lines[pos].content)) {
            std::string item = after_dash(lines[pos].content);
            int ln = lines[pos].no;
            ++pos;
            if (item.empty()) {
                if (pos < lines.size() && lines[pos].indent > indent)
                    n.seq.push_back(parse_block(lines, pos, lines[pos].indent));
                else
                    n.seq.push_back(Node{});
            } else {
                n.seq.push_back(parse_inline(item, ln));
            }
        }
        return n;
    }
    n.type = Node::Type::Map;
    while (pos < lines.size() && lines[pos].indent == indent && !is_seq_item(lines[pos].content)) {
        auto [key, rest] = split_key(lines[pos].content, lines[pos].no);
        ++pos;
        if (rest.empty()) {
            if (pos < lines.size() && lines[pos].indent > indent)
                n.map.emplace_back(key, parse_block(lines, pos, lines[pos].indent));
            else
                n.map.emplace_back(key, Node{});
        } else {
            n.map.emplace_back(key, parse_inline(rest, lines[pos - 1].no));
        }
    }
    return n;
}

}  // namespace

Node parse(const std::string& text) {
    std::vector<Line> lines;
    int no = 0;
    size_t start = 0;
    while (start <= text.size()) {
        size_t nl = text.find('\n', start);
        std::string raw = text.substr(start, nl == std::string::npos ? std::string::npos : nl - start);
        ++no;
        if (!raw.empty() && raw.back() == '\r') raw.pop_back();
        std::string stripped = rtrim(strip_comment(raw));
        if (!trim(stripped).empty()) {
            int indent = 0;
            while (indent < static_cast<int>(stripped.size()) && stripped[indent] == ' ') ++indent;
            lines.push_back({indent, stripped.substr(indent), no});
        }
        if (nl == std::string::npos) break;
        start = nl + 1;
    }

    if (lines.empty()) return Node{};  // empty document
    size_t pos = 0;
    int base = lines[0].indent;
    Node root = parse_block(lines, pos, base);
    if (pos != lines.size())
        fail(lines[pos].no, "unexpected indentation or trailing content");
    return root;
}

}  // namespace osls::yaml
