/*
 * User Flow:
 * - ✅ `wf` will list all nodes at root level
 * - `wf <node route>` meta + "Remove" will delete that node route and all it's child nodes.
 * - `wf auth` will run the auth script
 * - ✅ Pressing tab will autocomplete the selected node into the input box and then display the child nodes
 * - Pressing enter will check off the selected node
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
#include <string>
#include <gumbo.h>

using namespace albert;
using namespace std;
using json = nlohmann::json;

static const QStringList IconUrls {QStringLiteral("/home/d4rkc10ud/Documents/Projects/albert-workflowy-plugin/albert-plugin/src/icon.png")};

inline std::string html_to_text(const std::string& in) {
    if (in.find('<') == std::string::npos) {
        return in;
    }

    GumboOutput* g = gumbo_parse(in.c_str());
    std::string out;

    std::function<void(GumboNode*)> walk = [&](GumboNode* n) {
        switch (n->type) {
        case GUMBO_NODE_TEXT:
        case GUMBO_NODE_WHITESPACE:
            out.append(n->v.text.text);
            break;
        case GUMBO_NODE_ELEMENT:
            for (size_t i = 0; i < n->v.element.children.length; ++i)
                walk(static_cast<GumboNode*>(n->v.element.children.data[i]));
            break;
        default:
            break;
        }
    };
    walk(g->root);
    gumbo_destroy_output(&kGumboDefaultOptions, g);
    return out;
}

void removeNode(json &node, QStringList route) {
    cout << "Remove: " << node["nm"] << " at "  << route.join(u'>').toStdString() << endl;
}

void createNode(QStringList route) {
    cout << "Creating a node at " << route.join(u'>').toStdString() << endl;
}

json getNodes(const json &nodes, const QStringList &route) {
    if (route.isEmpty()) {
        return nodes;
    }

    QString currentName = route[0];
    QStringList remaining = route.mid(1);

    for (const auto &node : nodes) {
        QString nodeName = QString::fromStdString(html_to_text(node["nm"].get<std::string>()));
        if (nodeName == currentName && node.contains("children")) {
            return getNodes(node["children"], remaining);
        }
    }

    return json::object({{"err", "Not Found"}});

}

vector<shared_ptr<Item>> listNodes(QStringList route) {
    using albert::Action;
    using util::StandardItem;

    ifstream file("/home/d4rkc10ud/Documents/Projects/albert-workflowy-plugin/albert-plugin/src/tree_data.json");
    json root_nodes = json::parse(file);

    vector<shared_ptr<Item>> items;

    json current_nodes = route.isEmpty() ? root_nodes : getNodes(root_nodes, route);
    auto makePath = [] (const QStringList &segments) {
        const QString joined = segments.join(u'>');
        return joined;
    };
    
    if (!current_nodes.is_null()) {
        if (current_nodes.is_array()) {

            for (auto &node : current_nodes) {
                const string plain = html_to_text(node["nm"].get<std::string>());
                const QString name = QString::fromStdString(plain);

                QStringList newRoute = route;
                newRoute.append(name);
                QString path = makePath(newRoute);

                auto item = make_shared<StandardItem>(
                    path,                   // id
                    QString(name),          // text
                    path,                   // subtext
                    IconUrls,               // icons
                    vector<Action> {        // actions
                        Action(
                            QStringLiteral("remove"),
                            QStringLiteral("Remove"),
                            [node, newRoute]() mutable { qInfo("Removing node..."); removeNode(node, newRoute); }
                        )
                    },
                    path                    // action text
                );

                items.push_back(item);
            }
        } else if (current_nodes.is_object() && html_to_text(current_nodes["err"].get<std::string>()) == "Not Found") {
            auto path = makePath(route);

            auto item = make_shared<StandardItem>(
                path,
                QStringLiteral("Create New Node"),
                QStringLiteral("New node at ").append(path),
                IconUrls,
                vector<Action> {
                    Action(
                        QStringLiteral("create"),
                        QStringLiteral("Create Node"),
                        [route]() { qInfo("Creating new node..."); createNode(route); }
                    )
                },
                path
            );

            items.push_back(item);
        }
    }

    return items;
}

void Plugin::handleTriggerQuery(Query &query) {
    QStringList parts = query.string().split(QLatin1Char('>'), Qt::SkipEmptyParts);
    query.add(listNodes(parts));
}