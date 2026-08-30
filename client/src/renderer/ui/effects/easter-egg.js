/**
 * Ganj4Craft Launcher - Easter Egg (420 BeatDrop)
 * Делегирование в модуль easter-eggs/blaze-rave.js
 */

import {
    initBlazeRave,
    stopBlazeRave,
    isBlazeRaveActive
} from '../../features/easter-eggs/blaze-rave.js';

export const initEasterEgg = initBlazeRave;
export const destroyEasterEgg = stopBlazeRave;
export const isEasterEggActive = isBlazeRaveActive;

