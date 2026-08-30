/**
 * Ganj4Craft Launcher - Settings Easter Egg
 * Делегирование в единый модуль easter-eggs/meme-webcam.js
 */

import {
    triggerMemeWebcam,
    triggerChaosStage,
    hideMemeWebcam,
    isMemeWebcamActive,
    tryTriggerSettingsEasterEgg
} from '../easter-eggs/meme-webcam.js';

export const triggerSettingsEasterEgg = triggerMemeWebcam;
export const triggerEasterEggStage2 = triggerChaosStage;
export const hideEasterEgg = hideMemeWebcam;
export const isSettingsEasterEggActive = isMemeWebcamActive;
export const getEasterEggStage = () => (isMemeWebcamActive() ? 1 : 0);
export const tryTriggerEasterEgg = tryTriggerSettingsEasterEgg;

