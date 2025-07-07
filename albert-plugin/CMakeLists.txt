cmake_minimum_required(VERSION 3.16)

project(AlberFlowy VERSION 1.0)

find_package(Albert REQUIRED)
find_package(Qt6 REQUIRED COMPONENTS Core)
find_package(nlohmann_json REQUIRED)

albert_plugin()

target_link_libraries(AlberFlowy PRIVATE nlohmann_json::nlohmann_json)
target_link_libraries(AlberFlowy PRIVATE Qt6::Core)