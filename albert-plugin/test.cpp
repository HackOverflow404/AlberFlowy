#include <nlohmann/json.hpp>
#include <fstream>
#include <iostream>

using json = nlohmann::json;

int main() {
    std::ifstream file("tree_data.json");  // ✅ std::ifstream
    if (!file) {
        std::cerr << "Failed to open file.\n";
        return 1;
    }

    json data = json::parse(file);         // ✅ std::ifstream works here
    std::cout << data << std::endl;        // ✅ std::cout

    return 0;
}
