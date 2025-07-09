/*
 * User Flow:
 * - ✅ `wf` will list all nodes at root level
 * - `wf <node route>` meta + "Remove" will delete that node route and all it's child nodes.
 * - `wf auth` will run the auth script
 * - ✅ Pressing tab will autocomplete the selected node into the input box and then display the child nodes
 * - ✅ If the input is not an existing node, pressing enter will create a new node with that name
 * - ✅ Make API logic completely asynchronous
 * - Pressing enter will check off the selected node
 * - Figure out edit flow
 */

#include "plugin.h"

QString Plugin::applyStrikethrough(const QString &text) {
    static const QChar kStrikethroughChar(0x0336);
    QString result;
    for (QChar c : text) {
        result += c;
        result += kStrikethroughChar;
    }
    return result;
}

string Plugin::html_to_text(const string& in) {
    if (in.find('<') == string::npos) {
        return in;
    }

    GumboOutput* g = gumbo_parse(in.c_str());
    string out;

    function<void(GumboNode*)> walk = [&](GumboNode* n) {
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

json Plugin::findNode(const json &nodes, const QStringList &route) {
    if (route.isEmpty()) {
        return json::object({{"err", "Empty route"}});
    }

    QString currentName = route[0];
    QStringList remaining = route.mid(1);

    for (const auto &node : nodes) {
        QString nodeName = QString::fromStdString(html_to_text(node["nm"].get<string>()));
        if (nodeName == currentName) {
            if (remaining.isEmpty()) {
                return node;
            }
            if (node.contains("children")) {
                return findNode(node["children"], remaining);
            } else {
                return json::object({{"err", "No further children"}});
            }
        }
    }

    return json::object({{"err", "Not Found"}});
}

json Plugin::getChildNodes(const json &nodes, const QStringList &route) {
    if (route.isEmpty()) {
        return nodes;
    }

    QString currentName = route[0];
    QStringList remaining = route.mid(1);

    for (const auto &node : nodes) {
        QString nodeName = QString::fromStdString(html_to_text(node["nm"].get<string>()));
        if (nodeName == currentName && node.contains("children")) {
            return getChildNodes(node["children"], remaining);
        }
    }

    return json::object({{"err", "Not Found"}});
}

void Plugin::runWorkflowyCommand(const QStringList &args, function<void(bool, const json &)> callback) {
    QProcess *process = new QProcess(this);  // Let Qt manage deletion
    QStringList fullArgs = QStringList{CLIPath} + args;

    QObject::connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, [=](int exitCode, QProcess::ExitStatus exitStatus) {
        (void) exitCode;
        (void) exitStatus;
        QByteArray stdoutData = process->readAllStandardOutput();
        QByteArray stderrData = process->readAllStandardError();

        qDebug() << "[workflowy-cli stdout]" << stdoutData;
        qDebug() << "[workflowy-cli stderr]" << stderrData;

        json output;
        bool success = false;

        if (!stderrData.isEmpty())
            qWarning() << "[workflowy-cli stderr]" << stderrData;

        try {
            output = json::parse(stdoutData.toStdString());
            success = true;
        } catch (const exception &e) {
            qWarning() << "[JSON parse error]" << e.what();
        }

        process->deleteLater();
        callback(success, output);
    });

    process->start(QStringLiteral("node"), fullArgs);
}

void Plugin::createNode(QStringList route, const json &nodes) {
    if (route.isEmpty()) {
        qWarning("Route is empty. Cannot create node.");
        return;
    }

    QString name = route.takeLast();
    json parentNode = findNode(nodes, route);

    QString parentID = (parentNode.is_object() && parentNode.contains("id") && !parentNode["id"].is_null()) ? QString::fromStdString(parentNode["id"].get<string>()) : QStringLiteral("None");

    qDebug() << "Create:" << name << " at route:" << route.join(u'>') << " with parentID:" << parentID;

    runWorkflowyCommand({QStringLiteral("createNodeCustom"), name, parentID},
        [this](const bool success, const json &output) {

            if (!success) {
                qWarning() << "CLI failed to execute.";
                updateCachedTree();
                return;
            }

            qDebug() << "createNodeCustom output:\n" << QString::fromStdString(output.dump(2));

            if (!output.contains("results") || !output["results"].is_array() || output["results"].empty()) {
                qWarning() << "Missing or malformed 'results' in CLI output.";
                updateCachedTree();
                return;
            }

            const json &result = output["results"][0];
            if (!result.contains("server_run_operation_transaction_json")) {
                qWarning() << "Missing 'server_run_operation_transaction_json' in result.";
                updateCachedTree();
                return;
            }

            try {
                const json txn_json = json::parse(result["server_run_operation_transaction_json"].get<string>());
                const auto &ops = txn_json.at("ops");
                const auto &trees_str = ops.at(0).at("data").at("project_trees").get<string>();
                const json trees = json::parse(trees_str);

                const auto &firstTree = trees.at(0);
                const string id = firstTree.at("id");
                cout << "Node created with ID: " << id << endl;
            } catch (const exception &e) {
                qWarning() << "Error parsing creation result:" << e.what();
            }

            updateCachedTree();
        }
    );
}

void Plugin::editNode(const json &node, const QStringList route) {
    QString currentName = QString::fromStdString(node["nm"].get<string>());
    bool complete;
    QString newName = QInputDialog::getText(nullptr, QStringLiteral("Edit Node"), QStringLiteral("New name:"), QLineEdit::Normal, currentName, &complete);

    if (!complete || newName == currentName) {
        qInfo("Edit cancelled or no change.");
        return;
    }

    qDebug() << "Edit: " << QString::fromStdString(node["nm"].get<string>()) << " at "  << route.join(u'>') << " to " << newName;
    
    runWorkflowyCommand({QStringLiteral("editNode"), newName, QString::fromStdString(node["id"].get<string>())},
        [this](bool success, const json &output) {
            if (success && output.contains("id") && !output["id"].is_null()) {
                qDebug() << "Node edited with ID:" << QString::fromStdString(output["id"].get<string>());
            } else {
                qWarning() << "CLI returned unexpected response or error:" << QString::fromStdString(output.dump(2));
            }

            updateCachedTree();
        }
    );
}

void Plugin::toggleCompleteNode(const json &node, const QStringList route) {
    qDebug() << "Complete: " << QString::fromStdString(node["nm"].get<string>()) << " at "  << route.join(u'>');

    QString command = node.contains("cp") ? QStringLiteral("uncompleteNode") : QStringLiteral("completeNode");

    runWorkflowyCommand({command, QString::fromStdString(node["id"].get<string>())},
        [this](bool success, const json &output) {
            if (!success) {
                qWarning() << "CLI failed to execute.";
                updateCachedTree();
                return;
            }

            qDebug() << "completeNode output:\n" << QString::fromStdString(output.dump(2));

            if (!output.contains("server_run_operation_transaction_json")) {
                qWarning() << "Missing 'server_run_operation_transaction_json' in output.";
                updateCachedTree();
                return;
            }

            try {
                const json txn_json = json::parse(output["server_run_operation_transaction_json"].get<string>());
                const auto &ops = txn_json.at("ops");
                const string id = ops.at(0).at("data").at("projectid");
                cout << "Node deleted with ID:" << id << endl;
            } catch (const exception &e) {
                qWarning() << "Error parsing deletion result:" << e.what();
            }

            updateCachedTree();
        }
    );
}

void Plugin::removeNode(const json &node, const QStringList route) {
    qDebug() << "Remove: " << QString::fromStdString(node["nm"].get<string>()) << " at "  << route.join(u'>');

    runWorkflowyCommand({QStringLiteral("deleteNode"), QString::fromStdString(node["id"].get<string>())},
        [this](bool success, const json &output) {
            if (!success) {
                qWarning() << "CLI failed to execute.";
                updateCachedTree();
                return;
            }

            qDebug() << "deleteNode output:\n" << QString::fromStdString(output.dump(2));

            if (!output.contains("server_run_operation_transaction_json")) {
                qWarning() << "Missing 'server_run_operation_transaction_json' in output.";
                updateCachedTree();
                return;
            }

            try {
                const json txn_json = json::parse(output["server_run_operation_transaction_json"].get<string>());
                const auto &ops = txn_json.at("ops");
                const string id = ops.at(0).at("data").at("projectid");
                cout << "Node deleted with ID:" << id << endl;
            } catch (const exception &e) {
                qWarning() << "Error parsing deletion result:" << e.what();
            }

            updateCachedTree();
        }
    );
}

vector<shared_ptr<Item>> Plugin::listNodes(QStringList route, const json &root_nodes) {
    vector<shared_ptr<Item>> items;

    json current_nodes = route.isEmpty() ? root_nodes : getChildNodes(root_nodes, route);
    auto makePath = [] (const QStringList &segments) {
        const QString joined = segments.join(u'>');
        return joined;
    };
    
    if (!current_nodes.is_null()) {
        if (current_nodes.is_array()) {
            stable_sort(current_nodes.begin(), current_nodes.end(), [](const json &a, const json &b) {
                const bool a_cp = a.contains("cp");
                const bool b_cp = b.contains("cp");

                if (a_cp && !b_cp) {
                    return false;
                }

                if (!a_cp && b_cp) {
                    return true;
                }

                if (a_cp && b_cp) {
                    return false;
                }

                if (a.contains("pr") && b.contains("pr") && a["pr"].is_number() && b["pr"].is_number()) {
                    return a["pr"].get<int>() < b["pr"].get<int>();
                }

                return false;
            });

            for (auto &node : current_nodes) {
                const string plain = html_to_text(node["nm"].get<string>());
                QString name = QString::fromStdString(plain);
                QString completeLabel = QStringLiteral("Check");

                if (node.contains("cp")) {
                    name = applyStrikethrough(name);
                    // name = QStringLiteral("<del>%1</del>").arg(name); // Tags don't work for some reason
                    completeLabel = QStringLiteral("Uncheck");
                }

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
                            QStringLiteral("tcomplete"),
                            completeLabel,
                            [this, node, newRoute]() mutable { qInfo("Complete node..."); toggleCompleteNode(node, newRoute); }
                        ),
                        Action(
                            QStringLiteral("edit"),
                            QStringLiteral("Edit"),
                            [this, node, newRoute]() mutable { qInfo("Editing node..."); editNode(node, newRoute); }
                        ),
                        Action(
                            QStringLiteral("remove"),
                            QStringLiteral("Remove"),
                            [this, node, newRoute, root_nodes]() mutable { qInfo("Removing node..."); removeNode(node, newRoute); }
                        ),
                    },
                    path                    // action text
                );

                items.push_back(item);
            }
        } else if (current_nodes.is_object() && html_to_text(current_nodes["err"].get<string>()) == "Not Found") {
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
                        [this, route, root_nodes]() { qInfo("Creating new node..."); createNode(route, root_nodes); }
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
    if (cachedTree.is_null()) {
        qWarning("Workflowy cache is empty, cannot handle query.");
        auto item = make_shared<StandardItem>(
            QStringLiteral("Refreshing"),
            QStringLiteral("Loading Workflowy tree..."),
            QString(),
            IconUrls,
            vector<Action>{}
        );
        query.add(item);
        return;
    }

    QStringList parts = query.string().split(QLatin1Char('>'), Qt::SkipEmptyParts);
    query.add(listNodes(parts, cachedTree));
}

Plugin::Plugin() {
    setFuzzyMatching(false);
    refreshTimer = new QTimer(this);
    connect(refreshTimer, &QTimer::timeout, this, &Plugin::updateCachedTree);
    refreshTimer->start(10000);

    updateCachedTree();
}

void Plugin::updateCachedTree() {
    runWorkflowyCommand({QStringLiteral("getTree")},
        [this](bool success, const json &result) {
            if (success) {
                cachedTree = result;
                lastFetched = chrono::steady_clock::now();
                qInfo("WorkFlowy tree cache refreshed.");
            } else {
                qWarning("Failed to refresh WorkFlowy tree cache.");
            }
        }
    );
}
