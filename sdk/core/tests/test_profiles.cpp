// Unit test for the generated profile table.
#include "profiles.generated.hpp"
#include <cassert>
#include <iostream>
#include <string>
#include <vector>

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { std::cerr << "FAIL: " #cond " (" __FILE__ ":" << __LINE__ << ")\n"; ++failures; } } while (0)

int main() {
    using namespace osls::profiles;

    const auto* iamf714 = orderForLayout("iamf", "7.1.4");
    CHECK(iamf714 != nullptr);
    CHECK(*iamf714 == std::vector<std::string>({"M+030","M+000","M-030","M+090","M-090","M+135","M-135","U+045","U-045","U+135","U-135","LFE1"}));

    const auto* admStereo = orderForLayout("adm", "stereo");
    CHECK(admStereo != nullptr && *admStereo == std::vector<std::string>({"M+030","M-030"}));

    CHECK(orderForLayout("iamf", "does-not-exist") == nullptr);
    CHECK(orderForLayout("mpegh", "7.1.4") == nullptr);  // stub excluded from the table

    CHECK(formatsForLayout("7.1.4") == std::vector<std::string>({"adm","iamf"}));
    CHECK(formatsForLayout("quad") == std::vector<std::string>({"adm"}));
    CHECK(formatsForLayout("7.1.2") == std::vector<std::string>({"adm","iamf"}));

    if (failures) { std::cerr << failures << " failure(s)\n"; return 1; }
    std::cout << "test_profiles OK\n";
    return 0;
}
