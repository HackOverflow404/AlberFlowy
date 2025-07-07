/****************************************************************************
** Meta object code from reading C++ file 'plugin.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.8.3)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../src/plugin.h"
#include <QtCore/qmetatype.h>
#include <QtCore/qplugin.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'plugin.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 68
#error "This file was generated using the moc from 6.8.3. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

#ifndef Q_CONSTINIT
#define Q_CONSTINIT
#endif

QT_WARNING_PUSH
QT_WARNING_DISABLE_DEPRECATED
QT_WARNING_DISABLE_GCC("-Wuseless-cast")
namespace {
struct qt_meta_tag_ZN6PluginE_t {};
} // unnamed namespace


#ifdef QT_MOC_HAS_STRINGDATA
static constexpr auto qt_meta_stringdata_ZN6PluginE = QtMocHelpers::stringData(
    "Plugin"
);
#else  // !QT_MOC_HAS_STRINGDATA
#error "qtmochelpers.h not found or too old."
#endif // !QT_MOC_HAS_STRINGDATA

Q_CONSTINIT static const uint qt_meta_data_ZN6PluginE[] = {

 // content:
      12,       // revision
       0,       // classname
       0,    0, // classinfo
       0,    0, // methods
       0,    0, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       0,       // signalCount

       0        // eod
};

Q_CONSTINIT const QMetaObject Plugin::staticMetaObject = { {
    QMetaObject::SuperData::link<albert::util::ExtensionPlugin::staticMetaObject>(),
    qt_meta_stringdata_ZN6PluginE.offsetsAndSizes,
    qt_meta_data_ZN6PluginE,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_tag_ZN6PluginE_t,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<Plugin, std::true_type>
    >,
    nullptr
} };

void Plugin::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<Plugin *>(_o);
    (void)_t;
    (void)_c;
    (void)_id;
    (void)_a;
}

const QMetaObject *Plugin::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *Plugin::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_ZN6PluginE.stringdata0))
        return static_cast<void*>(this);
    if (!strcmp(_clname, "albert::TriggerQueryHandler"))
        return static_cast< albert::TriggerQueryHandler*>(this);
    return albert::util::ExtensionPlugin::qt_metacast(_clname);
}

int Plugin::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = albert::util::ExtensionPlugin::qt_metacall(_c, _id, _a);
    return _id;
}

#ifdef QT_MOC_EXPORT_PLUGIN_V2
static constexpr unsigned char qt_pluginMetaDataV2_Plugin[] = {
    0xbf, 
    // "IID"
    0x02,  0x78,  0x1f,  'o',  'r',  'g',  '.',  'a', 
    'l',  'b',  'e',  'r',  't',  '.',  'P',  'l', 
    'u',  'g',  'i',  'n',  'I',  'n',  't',  'e', 
    'r',  'f',  'a',  'c',  'e',  '/',  '0',  '.', 
    '3',  '0', 
    // "className"
    0x03,  0x66,  'P',  'l',  'u',  'g',  'i',  'n', 
    // "MetaData"
    0x04,  0xa7,  0x67,  'a',  'u',  't',  'h',  'o', 
    'r',  's',  0x81,  0x6e,  '@',  'M',  'e',  'd', 
    'h',  'a',  'n',  's',  'h',  '-',  'G',  'a', 
    'r',  'g',  0x6b,  'd',  'e',  's',  'c',  'r', 
    'i',  'p',  't',  'i',  'o',  'n',  0x78,  0x22, 
    'M',  'a',  'n',  'a',  'g',  'e',  ' ',  'W', 
    'o',  'r',  'k',  'F',  'l',  'o',  'w',  'y', 
    ' ',  'L',  'i',  's',  't',  's',  ' ',  'w', 
    'i',  't',  'h',  ' ',  'A',  'l',  'b',  'e', 
    'r',  't',  0x62,  'i',  'd',  0x6a,  'A',  'l', 
    'b',  'e',  'r',  'F',  'l',  'o',  'w',  'y', 
    0x67,  'l',  'i',  'c',  'e',  'n',  's',  'e', 
    0x63,  'M',  'I',  'T',  0x64,  'n',  'a',  'm', 
    'e',  0x6a,  'A',  'l',  'b',  'e',  'r',  'F', 
    'l',  'o',  'w',  'y',  0x63,  'u',  'r',  'l', 
    0x60,  0x67,  'v',  'e',  'r',  's',  'i',  'o', 
    'n',  0x63,  '1',  '.',  '0', 
    0xff, 
};
QT_MOC_EXPORT_PLUGIN_V2(Plugin, Plugin, qt_pluginMetaDataV2_Plugin)
#else
QT_PLUGIN_METADATA_SECTION
Q_CONSTINIT static constexpr unsigned char qt_pluginMetaData_Plugin[] = {
    'Q', 'T', 'M', 'E', 'T', 'A', 'D', 'A', 'T', 'A', ' ', '!',
    // metadata version, Qt version, architectural requirements
    0, QT_VERSION_MAJOR, QT_VERSION_MINOR, qPluginArchRequirements(),
    0xbf, 
    // "IID"
    0x02,  0x78,  0x1f,  'o',  'r',  'g',  '.',  'a', 
    'l',  'b',  'e',  'r',  't',  '.',  'P',  'l', 
    'u',  'g',  'i',  'n',  'I',  'n',  't',  'e', 
    'r',  'f',  'a',  'c',  'e',  '/',  '0',  '.', 
    '3',  '0', 
    // "className"
    0x03,  0x66,  'P',  'l',  'u',  'g',  'i',  'n', 
    // "MetaData"
    0x04,  0xa7,  0x67,  'a',  'u',  't',  'h',  'o', 
    'r',  's',  0x81,  0x6e,  '@',  'M',  'e',  'd', 
    'h',  'a',  'n',  's',  'h',  '-',  'G',  'a', 
    'r',  'g',  0x6b,  'd',  'e',  's',  'c',  'r', 
    'i',  'p',  't',  'i',  'o',  'n',  0x78,  0x22, 
    'M',  'a',  'n',  'a',  'g',  'e',  ' ',  'W', 
    'o',  'r',  'k',  'F',  'l',  'o',  'w',  'y', 
    ' ',  'L',  'i',  's',  't',  's',  ' ',  'w', 
    'i',  't',  'h',  ' ',  'A',  'l',  'b',  'e', 
    'r',  't',  0x62,  'i',  'd',  0x6a,  'A',  'l', 
    'b',  'e',  'r',  'F',  'l',  'o',  'w',  'y', 
    0x67,  'l',  'i',  'c',  'e',  'n',  's',  'e', 
    0x63,  'M',  'I',  'T',  0x64,  'n',  'a',  'm', 
    'e',  0x6a,  'A',  'l',  'b',  'e',  'r',  'F', 
    'l',  'o',  'w',  'y',  0x63,  'u',  'r',  'l', 
    0x60,  0x67,  'v',  'e',  'r',  's',  'i',  'o', 
    'n',  0x63,  '1',  '.',  '0', 
    0xff, 
};
QT_MOC_EXPORT_PLUGIN(Plugin, Plugin)
#endif  // QT_MOC_EXPORT_PLUGIN_V2

QT_WARNING_POP
