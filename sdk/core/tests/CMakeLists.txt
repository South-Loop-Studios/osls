add_executable(osls_tests test_core.cpp test_blessed.cpp)
target_link_libraries(osls_tests PRIVATE osls-core)

# Tests reach into the internal YAML reader (to parse fixtures) and need the
# repo root to locate the blessed layouts + conformance fixtures.
target_include_directories(osls_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../src)
target_compile_definitions(osls_tests PRIVATE
  OSLS_REPO_ROOT="${CMAKE_CURRENT_SOURCE_DIR}/../../..")

if(NOT MSVC)
  target_compile_options(osls_tests PRIVATE -Wall -Wextra)
endif()

add_test(NAME osls_tests COMMAND osls_tests)

add_executable(test_profiles test_profiles.cpp)
target_link_libraries(test_profiles PRIVATE osls-core)
target_include_directories(test_profiles PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../src)
add_test(NAME test_profiles COMMAND test_profiles)
