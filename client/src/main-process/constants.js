/**
 * GanjaCraft Launcher - Main Process Constants
 * Все константы для main process
 */

// Версии
const FORGE_VERSION = '21.1.233';
const MC_VERSION = '1.21.1';
const REQUIRED_JAVA_MAJOR = 21;

// URLs
const BASE_URL = 'https://gcrlauncher1.loca.lt';
const MIRROR_BASE = `${BASE_URL}/mirror`;
const FILES_BASE = `${BASE_URL}/files`;
const API_BASE = `${BASE_URL}/api`;

const MANIFEST_URL = `${FILES_BASE}/manifest.json`;
const FORGE_INSTALLER_URL = `https://maven.neoforged.net/releases/net/neoforged/neoforge/21.1.233/neoforge-21.1.233-installer.jar`;
const AUTHLIB_INJECTOR_URL = `https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar`;
const YGGDRASIL_AUTH_URL = `${API_BASE}/yggdrasil/authserver/authenticate`;

const VANILLA_VERSION_JSON_URL = `https://piston-meta.mojang.com/v1/packages/67e466e82c012158c8cda81df39aa40a7ade7276/1.21.1.json`;
const VANILLA_VERSION_JAR_URL = `https://piston-data.mojang.com/v1/objects/30c73b1c5da787909b2f73340419fdf13b9def88/client.jar`;

// Repair URLs for critical files
const REPAIR_FILES = {
    'authlib-injector.jar': AUTHLIB_INJECTOR_URL,
    'forge-installer.jar': FORGE_INSTALLER_URL,
    'modlauncher.jar': `https://maven.minecraftforge.net/cpw/mods/modlauncher/10.0.9/modlauncher-10.0.9.jar`,
    'securejarhandler.jar': `https://maven.minecraftforge.net/cpw/mods/securejarhandler/2.1.10/securejarhandler-2.1.10.jar`,
    'vanilla-client.jar': VANILLA_VERSION_JAR_URL,
};

// URL rewrites for mirroring - disabled, downloading directly from official sources
const URL_REWRITES = [];

// Default disabled optional mods (filename patterns)
const DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS = [
    // FancyMenu stack
    'client-fancymenu',
    'client-konkrete',
    'client-melody',

    // Gamepad/motor assistance stack
    'client-motorassistance',
    'client-controllable',
    'client-framework',

    // Forgematica (schematics)
    'client-Forgematica',
    'client-MaFgLib',
    'client-badpackets',
    'client-NeoForgematicaPrinter',
];

// JVM optimization arguments
const JVM_OPTIMIZATION_ARGS = [
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    '-XX:G1NewSizePercent=30',
    '-XX:G1MaxNewSizePercent=40',
    '-XX:G1HeapRegionSize=8M',
    '-XX:G1ReservePercent=20',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1'
];

module.exports = {
    // Versions
    FORGE_VERSION,
    MC_VERSION,
    REQUIRED_JAVA_MAJOR,
    
    // URLs
    BASE_URL,
    MIRROR_BASE,
    FILES_BASE,
    API_BASE,
    MANIFEST_URL,
    FORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_URL,
    YGGDRASIL_AUTH_URL,
    VANILLA_VERSION_JSON_URL,
    VANILLA_VERSION_JAR_URL,
    
    // Configs
    REPAIR_FILES,
    URL_REWRITES,
    DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS,
    JVM_OPTIMIZATION_ARGS,
};
