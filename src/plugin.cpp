/*
 * User Flow:
 * - ✅ `wf` will list all nodes at root level
 * - ✅ `wf <node route>` meta + "Remove" will delete that node route and all it's child nodes.
 * - ✅ `wf auth` will run the auth script
 * - ✅ Pressing tab will autocomplete the selected node into the input box and then display the child nodes
 * - ✅ If the input is not an existing node, pressing enter will create a new node with that name
 * - ✅ Make API logic completely asynchronous
 * - ✅ Check off the selected node logic
 * - ✅ Figure out edit flow
 */

#include "plugin.h"

// Constructor
Plugin::Plugin()
{
    // Initialize plugin and timers
    setFuzzyMatching(false);
    refreshTimer = new QTimer(this);
    connect(refreshTimer, &QTimer::timeout, this, &Plugin::refreshCachedTree);
    refreshTimer->start(10000);

    // Initialize the CLI interface path
    CLIPath = QString::fromStdString(findCLI());

    // Get the tree initially and store in cache
    refreshCachedTree();
}

// Query handler logic
void Plugin::handleTriggerQuery(Query &query)
{
    // If the tree is null, wait for it to refresh
    if (cachedTree.is_null())
    {
        qWarning("Workflowy cache is empty, cannot handle query.");
        auto item = make_shared<StandardItem>(
            QStringLiteral("Refreshing"),
            QStringLiteral("Loading Workflowy tree..."),
            QString(),
            []
            {
                return albert::iconFromUrl(IconUrl);
            },
            vector<Action>{});
        query.add(item);
        return;
    }

    // If the query is auth, initialize the auth process
    if (query == QStringLiteral("auth"))
    {
        qWarning("Press enter to reauthenticate");
        auto item = make_shared<StandardItem>(
            QStringLiteral("reauth"),
            QStringLiteral("Press enter to reauthenticate"),
            QString(),
            []
            {
                return albert::iconFromUrl(IconUrl);
            },
            vector<Action>{
                Action(
                    QStringLiteral("reauth"),
                    QStringLiteral("Re-Auth"),
                    [this]()
                    {
                        runWorkflowyCommand({QStringLiteral("auth")}, [this](bool success, const string &output)
                                            {
                            if (!success) {
                                qWarning() << "CLI failed to execute.";
                                refreshCachedTree();
                                return;
                            }
                            
                            // Debug purposes
                            qDebug() << "reauth output:\n" << QString::fromStdString(output);
                            
                            const string prefix = "Found sessionid: ";
                            if (output.find(prefix) == string::npos) {
                                qWarning("SessionID grab failed");
                                return;
                            }

                            string sessionID;

                            size_t pos = output.find(prefix);
                            pos += prefix.length();
                            
                            size_t end = pos;
                            while (end < output.length() && 
                                isalnum(output[end])) {
                                end++;
                            }
                            
                            if (end > pos) {
                                sessionID = output.substr(pos, end - pos);
                            }
                            
                            cout << "Reauthenticated with Session ID: " << sessionID << endl; });
                    })});
        query.add(item);
        return;
    }

    // List nodes in Albert Items
    QStringList parts = query.string().split(QLatin1Char('>'), Qt::SkipEmptyParts);
    query.add(listNodes(parts, cachedTree));
}

// List the nodes as Items
vector<shared_ptr<Item>> Plugin::listNodes(QStringList route, const json &root_nodes)
{
    vector<shared_ptr<Item>> items;

    // Get child nodes or display root based on the route
    json current_nodes = route.isEmpty() ? root_nodes : getChildNodes(root_nodes, route);
    // Lambda function to create QString representation of route
    auto makePath = [](const QStringList &segments)
    {
        return segments.join(u'>');
    };

    // Check if nodes exist
    if (!current_nodes.is_null())
    {
        // If it is an array of nodes
        if (current_nodes.is_array())
        {
            // Stable sorts the nodes based on priority (Decided by WorkFlowy) (Complete nodes sync to the bottom)
            stable_sort(current_nodes.begin(), current_nodes.end(), [](const json &a, const json &b)
                        {
                const bool a_cp = a.contains("cp");
                const bool b_cp = b.contains("cp");

                if (a_cp && !b_cp) { // If a is checked and b is unchecked, b comes before a
                    return false;
                }

                if (!a_cp && b_cp) { // If a is unchecked and b is checked, a comes before b
                    return true;
                }

                if (a_cp && b_cp) { // If a is checked and b is checked, preserve order
                    return false;
                }

                // Sort by priority if both contain priority attributes
                if (a.contains("pr") && b.contains("pr") && a["pr"].is_number() && b["pr"].is_number()) {
                    return a["pr"].get<int>() < b["pr"].get<int>();
                }

                // Else preserve order
                return false; });

            // Append the items to the list
            for (auto &node : current_nodes)
            {
                const string plain = html_to_text(node["nm"].get<string>());
                QString name = QString::fromStdString(plain);
                QString completeLabel = QStringLiteral("Check");

                if (node.contains("cp"))
                {
                    name = applyStrikethrough(name);
                    completeLabel = QStringLiteral("Uncheck");
                }

                QStringList newRoute = route;
                newRoute.append(name);
                QString path = makePath(newRoute);

                auto item = make_shared<StandardItem>(
                    path,          // id
                    QString(name), // text
                    path,          // subtext
                    []
                    {
                        return albert::iconFromUrl(IconUrl);
                    }, // icons
                    vector<Action>{
                        // actions
                        Action(
                            QStringLiteral("tcomplete"),
                            completeLabel,
                            [this, node, newRoute]() mutable
                            { qInfo("Complete node..."); toggleCompleteNode(node, newRoute); }),
                        Action(
                            QStringLiteral("edit"),
                            QStringLiteral("Edit"),
                            [this, node, newRoute]() mutable
                            { qInfo("Editing node..."); editNode(node, newRoute); }),
                        Action(
                            QStringLiteral("remove"),
                            QStringLiteral("Remove"),
                            [this, node, newRoute, root_nodes]() mutable
                            { qInfo("Removing node..."); removeNode(node, newRoute); }),
                    },
                    path + QLatin1Char('>') // action text
                );

                items.push_back(item);
            }
        }
        else if (current_nodes.is_object() && html_to_text(current_nodes["err"].get<string>()) == "Not Found")
        { // If the node doesn't exist
            // Create node option
            auto path = makePath(route);

            auto item = make_shared<StandardItem>(
                path,
                QStringLiteral("Create New Node"),
                QStringLiteral("New node at ").append(path),
                []
                {
                    return albert::iconFromUrl(IconUrl);
                },
                vector<Action>{
                    Action(
                        QStringLiteral("create"),
                        QStringLiteral("Create Node"),
                        [this, route, root_nodes]()
                        { qInfo("Creating new node..."); createNode(route, root_nodes); })},
                path);

            items.push_back(item);
        }
    }

    return items;
}

// Create node handler
void Plugin::createNode(QStringList route, const json &nodes)
{
    if (route.isEmpty())
    {
        qWarning("Route is empty. Cannot create node.");
        return;
    }

    QString name = route.takeLast();          // Retrieve new node name
    json parentNode = findNode(nodes, route); // get the parent node object from the json nodes

    QString parentID = (parentNode.is_object() && parentNode.contains("id") && !parentNode["id"].is_null()) ? QString::fromStdString(parentNode["id"].get<string>()) : QStringLiteral("None"); // Get the parent ID if the parent exists, otherwise place it at root

    qDebug() << "Create:" << name << " at route:" << route.join(u'>') << " with parentID:" << parentID;

    json tempNode = json::object(
        {
            {"nm", name.toStdString()},
            {"parentID", parentID.toStdString()},
        });
    updateCachedTree(NodeAction::Create, tempNode, [](bool success) {});

    runWorkflowyCommand({QStringLiteral("createNodeCustom"), name, parentID},
                        [this](const bool success, const json &output)
                        {
                            if (!success)
                            {
                                qWarning() << "CLI failed to execute.";
                                refreshCachedTree();
                                return;
                            }

                            qDebug() << "createNodeCustom output:\n"
                                     << QString::fromStdString(output.dump(2));

                            if (!output.contains("results") || !output["results"].is_array() || output["results"].empty())
                            {
                                qWarning() << "Missing or malformed 'results' in CLI output.";
                                refreshCachedTree();
                                return;
                            }

                            const json &result = output["results"][0];
                            if (!result.contains("server_run_operation_transaction_json"))
                            {
                                qWarning() << "Missing 'server_run_operation_transaction_json' in result.";
                                refreshCachedTree();
                                return;
                            }

                            try
                            {
                                const json txn_json = json::parse(result["server_run_operation_transaction_json"].get<string>());
                                const auto &ops = txn_json.at("ops");
                                const auto &trees_str = ops.at(0).at("data").at("project_trees").get<string>();
                                const json trees = json::parse(trees_str);

                                const auto &firstTree = trees.at(0);
                                const string id = firstTree.at("id");
                                cout << "Node created with ID: " << id << endl;
                            }
                            catch (const exception &e)
                            {
                                qWarning() << "Error parsing creation result:" << e.what();
                            }

                            refreshCachedTree();
                        });
}

void Plugin::editNode(const json &node, const QStringList route)
{
    QString currentName = QString::fromStdString(node["nm"].get<string>());
    bool complete;
    QString newName = QInputDialog::getText(nullptr, QStringLiteral("Edit Node"), QStringLiteral("New name:"), QLineEdit::Normal, currentName, &complete);

    if (!complete || newName == currentName)
    {
        qInfo("Edit cancelled or no change.");
        return;
    }

    qDebug() << "Edit: " << QString::fromStdString(node["nm"].get<string>()) << " at " << route.join(u'>') << " to " << newName;

    json tempNode = json::object(
        {{"id", node["id"].get<string>()},
         {"nm", newName.toStdString()}});
    updateCachedTree(NodeAction::Edit, tempNode, [](bool success) {});

    runWorkflowyCommand({QStringLiteral("editNode"), newName, QString::fromStdString(node["id"].get<string>())},
                        [this](bool success, const json &output)
                        {
                            if (success && output.contains("id") && !output["id"].is_null())
                            {
                                qDebug() << "Node edited with ID:" << QString::fromStdString(output["id"].get<string>());
                            }
                            else
                            {
                                qWarning() << "CLI returned unexpected response or error:" << QString::fromStdString(output.dump(2));
                            }

                            refreshCachedTree();
                        });
}

void Plugin::removeNode(const json &node, const QStringList route)
{
    qDebug() << "Remove: " << QString::fromStdString(node["nm"].get<string>()) << " at " << route.join(u'>');

    updateCachedTree(NodeAction::Remove, node, [](bool success) {});

    runWorkflowyCommand({QStringLiteral("deleteNode"), QString::fromStdString(node["id"].get<string>())},
                        [this](bool success, const json &output)
                        {
                            if (!success)
                            {
                                qWarning() << "CLI failed to execute.";
                                refreshCachedTree();
                                return;
                            }

                            qDebug() << "deleteNode output:\n"
                                     << QString::fromStdString(output.dump(2));

                            if (!output.contains("server_run_operation_transaction_json"))
                            {
                                qWarning() << "Missing 'server_run_operation_transaction_json' in output.";
                                refreshCachedTree();
                                return;
                            }

                            try
                            {
                                const json txn_json = json::parse(output["server_run_operation_transaction_json"].get<string>());
                                const auto &ops = txn_json.at("ops");
                                const string id = ops.at(0).at("data").at("projectid");
                                cout << "Node deleted with ID:" << id << endl;
                            }
                            catch (const exception &e)
                            {
                                qWarning() << "Error parsing deletion result:" << e.what();
                            }

                            refreshCachedTree();
                        });
}

void Plugin::toggleCompleteNode(const json &node, const QStringList route)
{
    qDebug() << "Complete: " << QString::fromStdString(node["nm"].get<string>()) << " at " << route.join(u'>');

    QString command = node.contains("cp") ? QStringLiteral("uncompleteNode") : QStringLiteral("completeNode");

    updateCachedTree(NodeAction::Complete, node, [](bool success) {});

    runWorkflowyCommand({command, QString::fromStdString(node["id"].get<string>())},
                        [this](bool success, const json &output)
                        {
                            if (!success)
                            {
                                qWarning() << "CLI failed to execute.";
                                refreshCachedTree();
                                return;
                            }

                            qDebug() << "completeNode output:\n"
                                     << QString::fromStdString(output.dump(2));

                            if (!output.contains("server_run_operation_transaction_json"))
                            {
                                qWarning() << "Missing 'server_run_operation_transaction_json' in output.";
                                refreshCachedTree();
                                return;
                            }

                            try
                            {
                                const json txn_json = json::parse(output["server_run_operation_transaction_json"].get<string>());
                                const auto &ops = txn_json.at("ops");
                                const string id = ops.at(0).at("data").at("projectid");
                                cout << "Node deleted with ID:" << id << endl;
                            }
                            catch (const exception &e)
                            {
                                qWarning() << "Error parsing deletion result:" << e.what();
                            }

                            refreshCachedTree();
                        });
}

json Plugin::findNode(const json &nodes, const QStringList &route)
{
    if (route.isEmpty())
    {
        return json::object({{"err", "Empty route"}});
    }

    QString currentName = route[0];
    QStringList remaining = route.mid(1);

    for (const auto &node : nodes)
    {
        QString nodeName = QString::fromStdString(html_to_text(node["nm"].get<string>()));
        if (nodeName == currentName)
        {
            if (remaining.isEmpty())
            {
                return node;
            }
            if (node.contains("children"))
            {
                return findNode(node["children"], remaining);
            }
            else
            {
                return json::object({{"err", "No further children"}});
            }
        }
    }

    return json::object({{"err", "Not Found"}});
}

void Plugin::findPath(const json &nodes, const json &node)
{
}

json Plugin::getChildNodes(const json &nodes, const QStringList &route)
{
    if (route.isEmpty())
    {
        return nodes;
    }

    QString currentName = route[0];
    QStringList remaining = route.mid(1);

    for (const auto &node : nodes)
    {
        QString nodeName = QString::fromStdString(html_to_text(node["nm"].get<string>()));
        if (nodeName == currentName && node.contains("children"))
        {
            return getChildNodes(node["children"], remaining);
        }
    }

    return json::object({{"err", "Not Found"}});
}

void Plugin::refreshCachedTree()
{
    runWorkflowyCommand({QStringLiteral("getTree")},
                        [this](bool success, const json &result)
                        {
                            if (success)
                            {
                                cachedTree = result;
                                lastFetched = chrono::steady_clock::now();
                                qInfo("WorkFlowy tree cache refreshed.");
                            }
                            else
                            {
                                qWarning("Failed to refresh WorkFlowy tree cache.");
                            }
                        });
}

string Plugin::findCLI()
{
    auto isExecutable = [](const string &path)
    {
        QFileInfo fileInfo(QString::fromStdString(path));
        return fileInfo.exists() && fileInfo.isExecutable();
    };

    auto getHomeDir = []()
    {
        return QDir::homePath().toStdString();
    };

    string homeDir = getHomeDir();
    if (homeDir.empty())
    {
        qWarning("Could not determine home directory");
        return "";
    }

    vector<string> nodePaths;

    string nvmDir = homeDir + "/.nvm";
    if (QDir(QString::fromStdString(nvmDir)).exists())
    {
        string currentPath = nvmDir + "/current/bin";
        if (QDir(QString::fromStdString(currentPath)).exists())
        {
            nodePaths.push_back(currentPath);
        }

        QDir versionsDir(QString::fromStdString(nvmDir + "/versions/node"));
        if (versionsDir.exists())
        {
            QStringList versions = versionsDir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);
            for (const QString &version : versions)
            {
                string versionPath = nvmDir + "/versions/node/" + version.toStdString() + "/bin";
                nodePaths.push_back(versionPath);
            }
        }
    }

    string nPrefix = homeDir + "/.local/share/n";
    if (QDir(QString::fromStdString(nPrefix)).exists())
    {
        QDir nDir(QString::fromStdString(nPrefix));
        QStringList versions = nDir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);
        for (const QString &version : versions)
        {
            string versionPath = nPrefix + "/" + version.toStdString() + "/bin";
            nodePaths.push_back(versionPath);
        }
    }

    string voltaHome = homeDir + "/.volta";
    if (QDir(QString::fromStdString(voltaHome)).exists())
    {
        nodePaths.push_back(voltaHome + "/bin");
    }

    string fnmDir = homeDir + "/.local/share/fnm";
    if (QDir(QString::fromStdString(fnmDir)).exists())
    {
        QDir fnmNodeDir(QString::fromStdString(fnmDir + "/node-versions"));
        if (fnmNodeDir.exists())
        {
            QStringList versions = fnmNodeDir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);
            for (const QString &version : versions)
            {
                string versionPath = fnmDir + "/node-versions/" + version.toStdString() + "/installation/bin";
                nodePaths.push_back(versionPath);
            }
        }
    }

    nodePaths.push_back("/usr/local/bin");
    nodePaths.push_back("/usr/bin");
    nodePaths.push_back("/bin");
    nodePaths.push_back("/opt/node/bin");

    for (const string &path : nodePaths)
    {
        string workflowyPath = path + "/workflowy";
        if (isExecutable(workflowyPath))
        {
            qDebug() << "Found workflowy at:" << QString::fromStdString(workflowyPath);
            return workflowyPath;
        }
    }

    vector<string> npmCommands = {
        "npm root -g",
        "npm config get prefix"};

    for (const string &cmd : npmCommands)
    {
        char buffer[512];
        FILE *pipe = popen(cmd.c_str(), "r");
        if (pipe)
        {
            if (fgets(buffer, sizeof(buffer), pipe))
            {
                string result = buffer;
                if (!result.empty() && result.back() == '\n')
                {
                    result.pop_back();
                }

                vector<string> testPaths = {
                    result + "/workflowy/bin/workflowy",
                    result + "/bin/workflowy"};

                for (const string &testPath : testPaths)
                {
                    if (isExecutable(testPath))
                    {
                        qDebug() << "Found workflowy via npm at:" << QString::fromStdString(testPath);
                        pclose(pipe);
                        return testPath;
                    }
                }
            }
            pclose(pipe);
        }
    }

    string expandedPath = "/usr/local/bin:/usr/bin:/bin";

    for (const string &path : nodePaths)
    {
        expandedPath += ":" + path;
    }

    string command = "PATH=\"" + expandedPath + "\" which workflowy 2>/dev/null";
    char buffer[256];
    FILE *pipe = popen(command.c_str(), "r");
    if (pipe)
    {
        if (fgets(buffer, sizeof(buffer), pipe))
        {
            string result = buffer;
            if (!result.empty() && result.back() == '\n')
            {
                result.pop_back();
            }
            pclose(pipe);
            if (isExecutable(result))
            {
                pclose(pipe);
                qDebug() << "Found workflowy via which at:" << QString::fromStdString(result);
                return result;
            }
        }
        pclose(pipe);
    }

    for (const string &path : nodePaths)
    {
        string nodePath = path + "/node";
        string npxPath = path + "/npx";

        if (isExecutable(nodePath) && isExecutable(npxPath))
        {
            qDebug() << "Found Node.js at:" << QString::fromStdString(nodePath);
            qDebug() << "Will use npx to run workflowy";
            return npxPath;
        }
    }

    qWarning("Could not find workflowy CLI tool anywhere");
    return "";
}

string Plugin::html_to_text(const string &in)
{
    if (in.find('<') == string::npos)
    {
        return in;
    }

    GumboOutput *g = gumbo_parse(in.c_str());
    string out;

    function<void(GumboNode *)> walk = [&](GumboNode *n)
    {
        switch (n->type)
        {
        case GUMBO_NODE_TEXT:
        case GUMBO_NODE_WHITESPACE:
            out.append(n->v.text.text);
            break;
        case GUMBO_NODE_ELEMENT:
            for (size_t i = 0; i < n->v.element.children.length; ++i)
                walk(static_cast<GumboNode *>(n->v.element.children.data[i]));
            break;
        default:
            break;
        }
    };
    walk(g->root);
    gumbo_destroy_output(&kGumboDefaultOptions, g);
    return out;
}

QString Plugin::applyStrikethrough(const QString &text)
{
    static const QChar kStrikethroughChar(0x0336);
    QString result;
    for (QChar c : text)
    {
        result += c;
        result += kStrikethroughChar;
    }
    return result;
}

void Plugin::runWorkflowyCommand(const QStringList &args, function<void(bool, const json &)> callback)
{
    QProcess *process = new QProcess(this);

    QProcessEnvironment env = QProcessEnvironment::systemEnvironment();
    QString homeDir = QDir::homePath();

    QStringList additionalPaths = {
        homeDir + QStringLiteral("/.nvm/current/bin"),
        homeDir + QStringLiteral("/.volta/bin"),
        homeDir + QStringLiteral("/.local/share/n/versions/node/latest/bin"),
        QStringLiteral("/usr/local/bin"),
        QStringLiteral("/opt/node/bin")};

    QDir nvmVersionsDir(homeDir + QStringLiteral("/.nvm/versions/node"));
    if (nvmVersionsDir.exists())
    {
        QStringList versions = nvmVersionsDir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);
        for (const QString &version : versions)
        {
            additionalPaths.append(homeDir + QStringLiteral("/.nvm/versions/node/") + version + QStringLiteral("/bin"));
        }
    }

    QString currentPath = env.value(QStringLiteral("PATH"), QStringLiteral(""));
    for (const QString &path : additionalPaths)
    {
        if (!currentPath.contains(path))
        {
            currentPath = path + QStringLiteral(":") + currentPath;
        }
    }
    env.insert(QStringLiteral("PATH"), currentPath);

    process->setProcessEnvironment(env);

    QString executable;
    QStringList processArgs;

    if (CLIPath.endsWith(QStringLiteral("/npx")))
    {
        executable = CLIPath;
        processArgs = QStringList{QStringLiteral("workflowy")} + args;
    }
    else if (CLIPath.endsWith(QStringLiteral("/workflowy")))
    {
        executable = QStringLiteral("node");
        processArgs = QStringList{CLIPath} + args;
    }
    else if (!CLIPath.isEmpty())
    {
        executable = QStringLiteral("node");
        processArgs = QStringList{CLIPath} + args;
    }
    else
    {
        qWarning("No workflowy CLI path found, cannot execute command");
        callback(false, json::object({{"error", "No CLI path found"}}));
        process->deleteLater();
        return;
    }

    QObject::connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, [=](int exitCode, QProcess::ExitStatus exitStatus)
                     {
        (void) exitCode;
        (void) exitStatus;
        QByteArray stdoutData = process->readAllStandardOutput();
        QByteArray stderrData = process->readAllStandardError();

        qDebug() << "[workflowy-cli stdout]" << stdoutData;
        qDebug() << "[workflowy-cli stderr]" << stderrData;

        string output = stdoutData.toStdString();
        json jsonOutput;
        bool success = false;
        bool isJSON;

        if (!stderrData.isEmpty())
            qWarning() << "[workflowy-cli stderr]" << stderrData;

        try {
            jsonOutput = json::parse(stdoutData.toStdString());
            isJSON = true;
            success = true;
        } catch (const exception &e) {
            if (output.find("Found sessionid: ") == string::npos) {
                qWarning() << "[WorkFlowy CLI Error]" << e.what();
            } else {
                isJSON = false;
                success = true;
            }
        }

        process->deleteLater();
        isJSON ? callback(success, jsonOutput) : callback(success, output); });

    qDebug() << "Running command:" << executable << processArgs.join(QStringLiteral(" "));
    process->start(executable, processArgs);
}

void Plugin::updateCachedTree(NodeAction action, const json &NodeInfo, function<void(bool)> callback)
{
    // Helper to find a node by ID and return a pointer to it
    function<json *(json &, const string &)> findNodeById = [&](json &nodes, const string &id) -> json *
    {
        if (!nodes.is_array())
            return nullptr;
        for (auto &node : nodes)
        {
            if (node.contains("id") && node["id"].get<string>() == id)
            {
                return &node;
            }
            if (node.contains("children"))
            {
                if (auto ptr = findNodeById(node["children"], id))
                {
                    return ptr;
                }
            }
        }
        return nullptr;
    };

    switch (action)
    {
    case NodeAction::Create:
    {
        // NodeInfo must include "nm" and optional "parentId"
        string name = NodeInfo.value("nm", "");
        string parentId = NodeInfo.value("parentID", "");
        json *targetArr = &cachedTree;

        if (parentId != "None")
        {
            if (auto parentNode = findNodeById(cachedTree, parentId))
            {
                if (!parentNode->contains("children") || !(*parentNode)["children"].is_array())
                {
                    (*parentNode)["children"] = json::array();
                }
                targetArr = &(*parentNode)["children"];
            }
        }

        // Create temporary placeholder
        string tempId = "temp-" + to_string(
                                      chrono::steady_clock::now().time_since_epoch().count());
        json newNode;
        newNode["nm"] = name;
        newNode["id"] = tempId;
        newNode["children"] = json::array();
        newNode["pr"] = 0;
        targetArr->push_back(newNode);

        cout << "Create node in cache named " << NodeInfo["nm"].get<string>() << " with status " << true << endl;

        callback(true);
        break;
    }
    case NodeAction::Remove:
    {
        // NodeInfo includes full "id"
        string targetId = NodeInfo.value("id", "");
        function<bool(json &)> removeRec = [&](json &nodes)
        {
            if (!nodes.is_array())
                return false;
            for (auto it = nodes.begin(); it != nodes.end(); ++it)
            {
                if ((*it).contains("id") && (*it)["id"].get<string>() == targetId)
                {
                    nodes.erase(it);
                    return true;
                }
            }
            for (auto &node : nodes)
            {
                if (node.contains("children") && removeRec(node["children"]))
                {
                    return true;
                }
            }
            return false;
        };
        bool status = removeRec(cachedTree);
        cout << "Remote node in cache named " << NodeInfo["nm"].get<string>() << " with status " << status << endl;
        callback(status);
        break;
    }
    case NodeAction::Complete:
    {
        // NodeInfo includes full "id"
        string targetId = NodeInfo.value("id", "");
        function<bool(json &)> toggleRec = [&](json &nodes)
        {
            if (!nodes.is_array())
                return false;
            for (auto &node : nodes)
            {
                if (node.contains("id") && node["id"].get<string>() == targetId)
                {
                    if (node.contains("cp"))
                        node.erase("cp");
                    else
                        node["cp"] = true;
                    return true;
                }
                if (node.contains("children") && toggleRec(node["children"]))
                {
                    return true;
                }
            }
            return false;
        };
        bool status = toggleRec(cachedTree);
        cout << "Complete node in cache named " << NodeInfo["nm"].get<string>() << " with status " << status << endl;
        callback(status);
        break;
    }
    case NodeAction::Edit:
    {
        // NodeInfo includes full "id" and new "nm"
        string targetId = NodeInfo.value("id", "");
        string newName = NodeInfo.value("nm", "");
        function<bool(json &)> editNode = [&](json &nodes)
        {
            if (!nodes.is_array())
                return false;
            for (auto &node : nodes)
            {
                if (node.contains("id") && node["id"].get<string>() == targetId)
                {
                    node["nm"] = newName;
                    return true;
                }
                if (node.contains("children") && editNode(node["children"]))
                {
                    return true;
                }
            }
            return false;
        };
        bool status = editNode(cachedTree);

        cout << "Edit node in cache named " << NodeInfo["nm"].get<string>() << " with status " << status << endl;

        callback(status);
        break;
    }
    default:
        callback(false);
        break;
    }
}