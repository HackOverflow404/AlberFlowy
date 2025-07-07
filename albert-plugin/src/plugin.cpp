/*
 * User Flow:
 * - ✅ `wf` will list all nodes at root level
 * - `wf <node route>` meta + "Remove" will delete that node route and all it's child nodes.
 * - `wf auth` will run the auth script
 * - Pressing tab will autocomplete the selected node into the input box and then display the child nodes
 * - Pressing enter will complete the selected node
 * - If the input is not an existing node, pressing enter will create a new node with that name
 */

#include "plugin.h"

#include <albert/albert.h>
#include <albert/standarditem.h>
#include <QMetaEnum>
#include <QCoreApplication>
#include <QString>
#include <QStringList>
#include <memory>
#include <nlohmann/json.hpp>
#include <fstream>
#include <iostream>

using namespace albert;
using namespace std;
using json = nlohmann::json;

void removeNode(json& node) {
    cout << "Would remove: " << node["nm"] << endl;
}

json getNodes(json nodes, QStringList route) {
    if (nodes[route.at(0).toStdString()]) {
        json children = nodes[route[0].toStdString()];
        route.removeFirst();
        return getNodes(children, route);
    }
    
    return json(); // Create Node
}

vector<shared_ptr<Item>> listNodes(QStringList route) {
    using albert::Action;
    using util::StandardItem;

    ifstream file("/home/d4rkc10ud/Documents/Projects/albert-workflowy-plugin/albert-plugin/src/tree_data.json");
    json root_nodes = json::parse(file);

    vector<shared_ptr<Item>> items;
    QStringList icon_urls = {QStringLiteral("/home/d4rkc10ud/Documents/Projects/albert-workflowy-plugin/albert-plugin/src/icon.png")};

    if (route.isEmpty()) {
        for (auto &node : root_nodes) {
            auto item = make_shared<StandardItem>(
                QStringLiteral("Root"),
                QString::fromStdString(node["nm"]),
                QStringLiteral("Root"),
                icon_urls,
                vector<Action>{
                    Action(QStringLiteral("remove"), QStringLiteral("Remove"), [node]() mutable { removeNode(node); })
                }
            );
            items.push_back(item);
        }
        return items;
    }

    json nodes = getNodes(root_nodes, route);

    if (route.isEmpty()) {
        for (auto &node : root_nodes) {
            route.append(QString::fromStdString(" " + node["nm"]));
            auto item = make_shared<StandardItem>(
                QStringLiteral("Root"),
                route,
                QStringLiteral("Root"),
                icon_urls,
                vector<Action>{
                    Action(QStringLiteral("remove"), QStringLiteral("Remove"), [node]() mutable { removeNode(node); })
                }
            );
            items.push_back(item);
        }
        return items;
    }
}

void Plugin::handleTriggerQuery(Query &query) {
    QStringList parts = query.string().split(' ', Qt::SkipEmptyParts);
    if (!parts.isEmpty()) {
        parts.removeFirst();
    }

    query.add(listNodes(parts));
}