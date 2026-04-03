cmake_minimum_required(VERSION 3.19)

project(AlberFlowy VERSION 1.0 LANGUAGES CXX)

find_package(Albert REQUIRED)
find_package(Qt6 REQUIRED COMPONENTS Core Widgets)
find_package(QCoro6Core REQUIRED)
find_package(nlohmann_json REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(GUMBO REQUIRED gumbo)

albert_plugin()

target_include_directories(AlberFlowy SYSTEM PRIVATE ${GUMBO_INCLUDE_DIRS})
target_compile_options(AlberFlowy PRIVATE ${GUMBO_CFLAGS_OTHER})
target_link_libraries(AlberFlowy PRIVATE Qt6::Widgets Qt6::Core QCoro6::Core ${GUMBO_LIBRARIES} nlohmann_json::nlohmann_json)