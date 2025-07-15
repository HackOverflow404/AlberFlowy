/*
 * Plugin directories
 * ~/.local/{lib,lib64}/albert
 * /usr/local/{lib,lib64}/albert
 * /usr/lib/${MULTIARCH_TUPLE}/albert
 * /usr/{lib,lib64}/albert
 */

#pragma once
#include <albert/extensionplugin.h>
#include <albert/indexqueryhandler.h>
#include <albert/albert.h>
#include <albert/standarditem.h>

#include <fstream>
#include <iostream>
#include <string>

#include <nlohmann/json.hpp>
#include <gumbo.h>

#include <QString>
#include <QStringList>
#include <QProcess>
#include <QJsonDocument>
#include <QTimer>
#include <QMetaObject>
#include <QInputDialog>
#include <QLineEdit>

using namespace albert;
using namespace std;
using json = nlohmann::json;
using albert::Action;
using util::StandardItem;

class Plugin : public util::ExtensionPlugin, public TriggerQueryHandler {
    ALBERT_PLUGIN

    public:
        Plugin();
        void handleTriggerQuery(Query &query) override;

    private:
        inline static const QStringList IconUrls = {QStringLiteral("/usr/lib/x86_64-linux-gnu/albert/AlberFlowy/icon.png")};
        
        vector<shared_ptr<Item>> listNodes(QStringList route, const json &root_nodes);
        
        void createNode(QStringList route, const json &nodes);
        void editNode(const json &node, const QStringList route);
        void removeNode(const json &node, const QStringList route);
        void toggleCompleteNode(const json &node, const QStringList route);

        json findNode(const json &nodes, const QStringList &route);
        json getChildNodes(const json &nodes, const QStringList &route);

        QTimer *refreshTimer;
        json cachedTree;
        std::chrono::steady_clock::time_point lastFetched;
        void updateCachedTree();
        
        QString CLIPath;
        string findCLI();
        string html_to_text(const string& in);
        QString applyStrikethrough(const QString &text);
        void runWorkflowyCommand(const QStringList &args, std::function<void(bool success, const json &result)> callback);
};
