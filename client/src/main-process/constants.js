/**
 * GanjaCraft Launcher - Main Process Constants
 * Все константы для main process
 */

// Версии
const FORGE_VERSION = '21.1.233';
const MC_VERSION = '1.21.1';
const REQUIRED_JAVA_MAJOR = 21;

// URLs
const BASE_URL = 'https://ganjalaunch.loca.lt';
const MIRROR_BASE = `${BASE_URL}/mirror`;
const FILES_BASE = `${BASE_URL}/files`;
const API_BASE = `${BASE_URL}/api`;

const MANIFEST_URL = `${FILES_BASE}/manifest.json`;
const FORGE_INSTALLER_URL = `${FILES_BASE}/forge-${FORGE_VERSION}-installer.jar`;
const AUTHLIB_INJECTOR_URL = `${FILES_BASE}/authlib-injector.jar`;
const YGGDRASIL_AUTH_URL = `${API_BASE}/yggdrasil/authserver/authenticate`;

const VANILLA_VERSION_JSON_URL = `${FILES_BASE}/versions/${MC_VERSION}/${MC_VERSION}.json`;
const VANILLA_VERSION_JAR_URL = `${FILES_BASE}/versions/${MC_VERSION}/${MC_VERSION}.jar`;

// Repair URLs for critical files
const REPAIR_FILES = {
    'authlib-injector.jar': AUTHLIB_INJECTOR_URL,
    'forge-installer.jar': FORGE_INSTALLER_URL,
    'modlauncher.jar': `${FILES_BASE}/libraries/cpw/mods/modlauncher/10.0.9/modlauncher-10.0.9.jar`,
    'securejarhandler.jar': `${FILES_BASE}/libraries/cpw/mods/securejarhandler/2.1.10/securejarhandler-2.1.10.jar`,
    'vanilla-client.jar': `${FILES_BASE}/versions/${MC_VERSION}/${MC_VERSION}.jar`,
};

// URL rewrites for mirroring
const URL_REWRITES = [
    ['https://libraries.minecraft.net/', `${MIRROR_BASE}/libraries/`],
    ['https://resources.download.minecraft.net/', `${MIRROR_BASE}/resources/`],
    ['https://piston-meta.mojang.com/', `${MIRROR_BASE}/piston-meta/`],
    ['https://piston-data.mojang.com/', `${MIRROR_BASE}/piston-data/`],
    ['https://launcher.mojang.com/', `${MIRROR_BASE}/launcher/`],
    ['https://launchermeta.mojang.com/', `${MIRROR_BASE}/launchermeta/`],
    ['https://files.minecraftforge.net/maven/', `${MIRROR_BASE}/forge-maven/`],
    ['https://maven.minecraftforge.net/', `${MIRROR_BASE}/forge-maven/`],
    ['https://files.minecraftforge.net/', `${MIRROR_BASE}/forge-files/`],
    ['https://repo1.maven.org/maven2/', `${MIRROR_BASE}/maven-central/`],
];

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
