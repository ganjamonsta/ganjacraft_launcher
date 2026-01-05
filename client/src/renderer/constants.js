/**
 * GanjaCraft Launcher - Константы
 * Централизованное хранение всех констант приложения
 */

// API & URLs
export const API_BASE = 'https://ganjacraft.ru/api';
export const FILES_BASE = 'https://ganjacraft.ru/files';
export const MANIFEST_URL = `${FILES_BASE}/manifest.json`;

// Minecraft Versions
export const MC_VERSION = '1.20.1';
export const FORGE_VERSION = '1.20.1-47.4.0';

// UI Timings (ms)
export const ANIMATION_DURATION = 300;
export const MODAL_FADE_IN = 200;
export const SETTINGS_ANIMATION = 250;
export const TAB_ANIMATION = 355;
export const ERROR_DISPLAY_TIME = 5000;
export const NEWS_LOAD_DELAY = 1500;
export const SERVER_STATUS_INTERVAL = 30000;

// Easter Egg (settings)
export const EASTER_EGG_CHANCE = 0.05;
export const EASTER_EGG_IMAGE = 'assets/images/easter_egg.jpg';

// Easter Egg (420 BeatDrop)
export const EASTER_EGG_TRIGGER = '420';
export const EASTER_EGG_TIMEOUT = 2000;
export const EASTER_EGG_BEAT_INTERVAL = 500;

// Snow Effect
export const MAX_SNOWFLAKES = 50;
export const SNOW_INTERVAL = 400;
export const SNOW_BURST_COUNT = 60;
export const DIRECTIONAL_BURST_COUNT = 25;
export const SIDE_BURST_COUNT = 20;

// Console
export const MAX_CONSOLE_LINES = 1000;

// Default Mod Groups to disable on fresh install
export const DEFAULT_DISABLED_MOD_PATTERNS = [
    'client-fancymenu',
    'client-konkrete',
    'client-melody',
    'client-motorassistance',
    'client-controllable',
    'client-framework',
    'client-Forgematica',
    'client-MaFgLib',
    'client-badpackets',
];
