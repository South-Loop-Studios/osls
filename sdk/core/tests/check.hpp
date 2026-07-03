#pragma once
#include <iostream>
#include <string>

namespace check {
inline int failures = 0;
}

#define CHECK(cond)                                                                       \
    do {                                                                                  \
        if (!(cond)) {                                                                    \
            ++::check::failures;                                                          \
            std::cerr << "FAIL " << __FILE__ << ":" << __LINE__ << "  " << #cond << "\n"; \
        }                                                                                 \
    } while (0)

#define CHECK_MSG(cond, msg)                                                                \
    do {                                                                                    \
        if (!(cond)) {                                                                      \
            ++::check::failures;                                                            \
            std::cerr << "FAIL " << __FILE__ << ":" << __LINE__ << "  " << (msg) << "\n";   \
        }                                                                                   \
    } while (0)
