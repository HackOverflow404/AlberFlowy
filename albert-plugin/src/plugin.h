/*
 * Plugin directories
 * ~/.local/{lib,lib64}/albert
 * /usr/local/{lib,lib64}/albert
 * /usr/lib/${MULTIARCH_TUPLE}/albert
 * /usr/{lib,lib64}/albert
 */

#pragma once
#include <albert/extensionplugin.h>
#include <albert/triggerqueryhandler.h>

class Plugin : public albert::util::ExtensionPlugin, public albert::TriggerQueryHandler {
    ALBERT_PLUGIN
    
    public:
        void handleTriggerQuery(albert::Query &query) override;
};