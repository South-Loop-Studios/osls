cmake_minimum_required(VERSION 3.16)
project(osls_core LANGUAGES CXX VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(OSLS_BUILD_TESTS "Build osls-core tests" ON)

add_library(osls-core STATIC
  src/yaml.cpp
  src/layout.cpp
  src/c_api.cpp
  src/profiles.generated.cpp)

target_include_directories(osls-core
  PUBLIC  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)

if(NOT MSVC)
  target_compile_options(osls-core PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(OSLS_BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()
