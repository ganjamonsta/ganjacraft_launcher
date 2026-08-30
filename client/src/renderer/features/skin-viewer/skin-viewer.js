import * as THREE from 'three';
import * as skinview3d from 'skinview3d';
import { dom } from '../../utils/dom.js';
import { equipmentManager } from './equipment-manager.js';
import { BedrockPlayerRig } from './bedrock-player-rig.js';
import { poseAnimator } from './pose-animator.js';

const STORAGE_KEY_MODE = 'ganja_skin_viewer_mode';
const SKIN_BASE_URL = 'https://launcher.ganj4craft.ru/api/skins';
const CAPE_BASE_URL = 'https://launcher.ganj4craft.ru/api/capes';

let skinViewer3d = null;
let currentUsername = '';
let currentMode = localStorage.getItem(STORAGE_KEY_MODE) || '3d'; // '3d' | '2d' | 'off'
let mouseMoveHandler = null;

let targetHeadX = 0;
let targetHeadY = 0;
let currentHeadX = 0;
let currentHeadY = 0;
let targetBodyY = 0.38; // Базовый угол поворота к центру экрана
let currentBodyY = 0.38;

/**
 * Получить текущий режим отображения скина
 */
export function getSkinViewerMode() {
    return currentMode;
}

/**
 * Получить экземпляр SkinViewer3D
 */
export function getSkinViewer3d() {
    return skinViewer3d;
}

/**
 * Инициализировать или обновить скин игрока
 * @param {string} username 
 */
export async function initSkinViewer(username) {
    if (!username) return;
    currentUsername = username;

    console.log('[SKIN-VIEWER] initSkinViewer called for:', username);
    // Восстанавливаем сохраненный режим
    currentMode = localStorage.getItem(STORAGE_KEY_MODE) || '3d';
    console.log('[SKIN-VIEWER] Current skin mode:', currentMode);
    await applySkinMode(currentMode);
    setupMouseTracking();
    setupWindowRestoreRandomizer();
    console.log('[SKIN-VIEWER] initSkinViewer completed for:', username);
}

/**
 * Применить режим отображения скина (3d, 2d, off)
 * @param {'3d'|'2d'|'off'} mode 
 */
export async function applySkinMode(mode) {
    currentMode = mode || '3d';
    localStorage.setItem(STORAGE_KEY_MODE, currentMode);
    console.log('[SKIN-VIEWER] applySkinMode:', currentMode);

    const layout = document.querySelector('.main-dashboard-layout');
    const playerSection = document.querySelector('.player-character-section');

    if (currentMode === 'off') {
        if (playerSection) playerSection.style.display = 'none';
        if (layout) layout.classList.add('layout-skin-off');
        return;
    }

    if (playerSection) playerSection.style.display = '';
    if (layout) layout.classList.remove('layout-skin-off');

    if (currentUsername) {
        if (currentMode === '3d') {
            console.log('[SKIN-VIEWER] Calling render3dSkin for:', currentUsername);
            await render3dSkin(currentUsername);
        } else {
            console.log('[SKIN-VIEWER] Calling render2dSkin for:', currentUsername);
            await render2dSkin(currentUsername);
        }
    }
}

/**
 * Переключить режим рендера 3D / 2D / off
 * @param {'3d'|'2d'|'off'} mode 
 */
export async function setSkinViewerMode(mode) {
    if (mode === currentMode) return;
    await applySkinMode(mode);
}

/**
 * Рендер 3D скина через skinview3d и BedrockPlayerRig с суставами
 */
async function render3dSkin(username) {
    const canvas3d = dom.get('skin-canvas-3d');
    const canvas2d = dom.get('skin-canvas-2d');
    if (!canvas3d) {
        console.warn('[SKIN-VIEWER] canvas3d element not found in DOM');
        return;
    }

    if (canvas2d) canvas2d.style.display = 'none';
    canvas3d.style.display = 'block';

    const skinUrl = `${SKIN_BASE_URL}/${encodeURIComponent(username)}.png?t=${Date.now()}`;
    const capeUrl = `${CAPE_BASE_URL}/${encodeURIComponent(username)}.png?t=${Date.now()}`;

    try {
        if (!skinViewer3d) {
            console.log('[SKIN-VIEWER] Creating new skinview3d.SkinViewer instance...');
            skinViewer3d = new skinview3d.SkinViewer({
                canvas: canvas3d,
                width: 380,
                height: 375,
                skin: skinUrl,
                model: 'default'
            });
            console.log('[SKIN-VIEWER] skinview3d.SkinViewer created successfully');

            // Камера с запасом по горизонтали для длинных стволов (АК-47, РПГ, миниган)
            skinViewer3d.camera.position.set(-2, 0, 78);
            skinViewer3d.zoom = 0.70;

            // ── ПОДКЛЮЧЕНИЕ СУСТАВНОГО СКЕЛЕТА BEDROCK RIG ──
            const bedrockRig = new BedrockPlayerRig();
            skinViewer3d.bedrockRig = bedrockRig;
            
            if (skinViewer3d.playerObject) {
                skinViewer3d.playerObject.position.set(-3.5, -1.0, 0);
                skinViewer3d.playerObject.rotation.y = 0.38;
                skinViewer3d.playerObject.add(bedrockRig.root);
                // Скрываем базовый недеформируемый 6-блочный меш
                if (skinViewer3d.playerObject.skin) {
                    skinViewer3d.playerObject.skin.visible = false;
                }
            }

            // Загрузка текстуры скина на суставной скелет
            new THREE.TextureLoader().load(skinUrl, (texture) => {
                bedrockRig.applySkinTexture(texture);
                equipmentManager.applyToViewer(skinViewer3d);
            });

            // Тактическая анимация: суставы, локти, оружие, тело и голова следят за курсором
            skinViewer3d.animation = new skinview3d.FunctionAnimation((player, progress) => {
                const t = progress * 1.5;
                if (!player) return;

                // Плавная интерполяция к целевым углам курсора (lerp)
                currentHeadX += (targetHeadX - currentHeadX) * 0.12;
                currentHeadY += (targetHeadY - currentHeadY) * 0.12;
                currentBodyY += (targetBodyY - currentBodyY) * 0.10;

                const weaponId = equipmentManager.getSlot('mainHand');

                // Если активен шутер во время загрузки — держим оружие прямо перед собой в Top-Down стойке
                if (document.body.classList.contains('is-shooter-active')) {
                    if (skinViewer3d.bedrockRig) {
                        skinViewer3d.bedrockRig.root.rotation.set(0, 0, 0);
                    }
                    return;
                }

                // Обновляем суставную позу через PoseAnimator
                if (skinViewer3d.bedrockRig) {
                    poseAnimator.update(skinViewer3d.bedrockRig, weaponId, t, {
                        headX: currentHeadX,
                        headY: currentHeadY,
                        bodyY: currentBodyY
                    });
                }

                // Плащ
                if (player.cape) {
                    player.cape.rotation.x = Math.sin(t * 0.6) * 0.03 + Math.PI * 0.06;
                }
            });

            // Управление вращением
            if (skinViewer3d.controls) {
                skinViewer3d.controls.enableRotate = true;
                skinViewer3d.controls.enableZoom = false;
                skinViewer3d.controls.enablePan = false;
                skinViewer3d.controls.maxPolarAngle = Math.PI / 2 + 0.3;
                skinViewer3d.controls.minPolarAngle = Math.PI / 2 - 0.5;
            }
        } else {
            await skinViewer3d.loadSkin(skinUrl);
            new THREE.TextureLoader().load(skinUrl, (texture) => {
                if (skinViewer3d.bedrockRig) {
                    skinViewer3d.bedrockRig.applySkinTexture(texture);
                    equipmentManager.applyToViewer(skinViewer3d);
                }
            });
            if (skinViewer3d.playerObject) {
                skinViewer3d.playerObject.position.set(-3.5, -1.0, 0);
                skinViewer3d.playerObject.rotation.y = 0.38;
            }
        }

        // Попытка загрузить плащ
        try {
            await skinViewer3d.loadCape(capeUrl);
        } catch (e) {
            // Плащ может отсутствовать
            if (skinViewer3d.playerObject && skinViewer3d.playerObject.cape) {
                skinViewer3d.loadCape(null);
            }
        }

        // Применяем рандомизированную экипировку персонажа
        try {
            equipmentManager.randomizeEquipment();
            await equipmentManager.applyToViewer(skinViewer3d);
        } catch (e) {
            console.warn('[SkinViewer3D] Equipment apply error:', e);
        }
    } catch (err) {
        console.warn('[SkinViewer3D] Error loading 3D skin:', err);
        // Fallback to 2D
        render2dSkin(username);
    }
}

/**
 * Принудительное обновление 3D экипировки персонажа
 */
export function refreshCharacterEquipment() {
    if (skinViewer3d && currentMode === '3d') {
        equipmentManager.applyToViewer(skinViewer3d);
    }
}

/**
 * Оптимизированный 2D изометрический рендер скина
 */
async function render2dSkin(username) {
    const canvas3d = dom.get('skin-canvas-3d');
    const canvas2d = dom.get('skin-canvas-2d');
    if (!canvas2d) return;

    if (canvas3d) canvas3d.style.display = 'none';
    canvas2d.style.display = 'block';

    const ctx = canvas2d.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const skinUrl = `${SKIN_BASE_URL}/${encodeURIComponent(username)}.png?t=${Date.now()}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
        ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);

        // Масштабированный красивый фронтальный рендер персонажа
        const scale = 11.5;
        const centerX = canvas2d.width / 2;
        const startY = 10;

        // Рисуем персонажа по частям (Head, Body, Arms, Legs)

        // 1. Голова (8x8 из 8,8)
        ctx.drawImage(img, 8, 8, 8, 8, centerX - 4 * scale, startY, 8 * scale, 8 * scale);
        // Голова оверлей (40,8)
        ctx.drawImage(img, 40, 8, 8, 8, centerX - 4.5 * scale, startY - 0.5 * scale, 9 * scale, 9 * scale);

        // 2. Тело (8x12 из 20,20)
        ctx.drawImage(img, 20, 20, 8, 12, centerX - 4 * scale, startY + 8 * scale, 8 * scale, 12 * scale);
        // Тело оверлей (20,36)
        if (img.height >= 64) {
            ctx.drawImage(img, 20, 36, 8, 12, centerX - 4.2 * scale, startY + 8 * scale, 8.4 * scale, 12 * scale);
        }

        // 3. Левая рука (4x12 из 44,20)
        ctx.drawImage(img, 44, 20, 4, 12, centerX - 8 * scale, startY + 8 * scale, 4 * scale, 12 * scale);
        if (img.height >= 64) {
            ctx.drawImage(img, 44, 36, 4, 12, centerX - 8.2 * scale, startY + 8 * scale, 4.4 * scale, 12 * scale);
        }

        // 4. Правая рука (4x12 из 36,52 или 44,20)
        if (img.height >= 64) {
            ctx.drawImage(img, 36, 52, 4, 12, centerX + 4 * scale, startY + 8 * scale, 4 * scale, 12 * scale);
            ctx.drawImage(img, 52, 52, 4, 12, centerX + 4 * scale, startY + 8 * scale, 4.4 * scale, 12 * scale);
        } else {
            // Flip for 64x32 legacy
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(img, 44, 20, 4, 12, -(centerX + 8 * scale), startY + 8 * scale, 4 * scale, 12 * scale);
            ctx.restore();
        }

        // 5. Ноги
        // Левая нога (4x12 из 4,20)
        ctx.drawImage(img, 4, 20, 4, 12, centerX - 4 * scale, startY + 20 * scale, 4 * scale, 12 * scale);
        if (img.height >= 64) {
            ctx.drawImage(img, 4, 36, 4, 12, centerX - 4.2 * scale, startY + 20 * scale, 4.4 * scale, 12 * scale);
        }

        // Правая нога (4x12 из 20,52 или 4,20)
        if (img.height >= 64) {
            ctx.drawImage(img, 20, 52, 4, 12, centerX, startY + 20 * scale, 4 * scale, 12 * scale);
            ctx.drawImage(img, 4, 52, 4, 12, centerX, startY + 20 * scale, 4.4 * scale, 12 * scale);
        } else {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(img, 4, 20, 4, 12, -(centerX + 4 * scale), startY + 20 * scale, 4 * scale, 12 * scale);
            ctx.restore();
        }
    };

    img.onerror = () => {
        ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);
        ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
        ctx.fillRect(centerX - 40, 60, 80, 160);
        ctx.fillStyle = '#4CAF50';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(username || 'Игрок', centerX, 150);
    };

    img.src = skinUrl;
}

/**
 * Слежение тела и головы 3D скина за курсором мыши (в обычном режиме дашборда)
 */
function setupMouseTracking() {
    if (mouseMoveHandler) return;

    mouseMoveHandler = (e) => {
        if (currentMode !== '3d' || !skinViewer3d || !skinViewer3d.playerObject) return;
        if (document.body.classList.contains('is-shooter-active')) return;

        const canvas = dom.get('skin-canvas-3d');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height * 0.35; // фокус на голову

        const deltaX = (e.clientX - centerX) / (window.innerWidth * 0.55);
        const deltaY = (e.clientY - centerY) / (window.innerHeight * 0.55);

        // Поворот головы: следование за курсором
        targetHeadY = Math.max(-0.65, Math.min(0.65, deltaX * 0.85));
        targetHeadX = Math.max(-0.40, Math.min(0.40, deltaY * 0.60));

        // Поворот тела: по дефолту повернут к центру экрана (+0.38) + легкий доворот за курсором
        targetBodyY = 0.38 + Math.max(-0.25, Math.min(0.25, deltaX * 0.35));
    };

    window.addEventListener('mousemove', mouseMoveHandler, { passive: true });
}

/**
 * Переключение камеры и положения персонажа между обычным видом и Top-Down шутером
 * @param {boolean} isShooter 
 */
export function setTopDownShooterCamera(isShooter) {
    if (!skinViewer3d) return;

    if (isShooter) {
        // Камера шутера сверху под углом (Top-Down Action Perspective)
        if (skinViewer3d.controls) {
            skinViewer3d.controls.minPolarAngle = 0;
            skinViewer3d.controls.maxPolarAngle = Math.PI;
            skinViewer3d.controls.enableRotate = false;
        }
        skinViewer3d.camera.position.set(0, 65, 46);
        skinViewer3d.camera.lookAt(0, 0, 0);

        if (skinViewer3d.playerObject) {
            skinViewer3d.playerObject.position.set(0, -3.5, 0);
            skinViewer3d.playerObject.rotation.set(0, 0, 0);
            skinViewer3d.playerObject.scale.set(0.58, 0.58, 0.58);
        }
    } else {
        // Возврат в стандартную камеру персонажа слева (повернут к центру)
        if (skinViewer3d.controls) {
            skinViewer3d.controls.minPolarAngle = Math.PI / 2 - 0.5;
            skinViewer3d.controls.maxPolarAngle = Math.PI / 2 + 0.3;
            skinViewer3d.controls.enableRotate = true;
        }
        skinViewer3d.camera.position.set(-2, 0, 78);
        skinViewer3d.camera.lookAt(0, 0, 0);

        if (skinViewer3d.playerObject) {
            skinViewer3d.playerObject.position.set(-3.5, -1.0, 0);
            skinViewer3d.playerObject.rotation.set(0, 0.38, 0);
            skinViewer3d.playerObject.scale.set(1.0, 1.0, 1.0);
        }
    }
}

let lastRandomizeTime = 0;
let isRandomizerHooked = false;

/**
 * Рандомизация экипировки персонажа при возврате на главный экран или разворачивании окна
 * @param {boolean} force - пропустить проверку дебаунса
 */
export function randomizeCharacterEquipment(force = false) {
    const now = Date.now();
    if (!force && (now - lastRandomizeTime < 1000)) return; // дебаунс 1 сек при авто-триггерах

    if (!skinViewer3d || currentMode !== '3d') return;
    if (document.body.classList.contains('is-shooter-active')) return;
    if (document.querySelector('.wardrobe-modal.visible')) return;

    lastRandomizeTime = now;
    console.log('[SKIN-VIEWER] Randomizing character equipment set!');
    equipmentManager.randomizeEquipment();
    equipmentManager.applyToViewer(skinViewer3d);
}

function triggerRandomizeOnRestore() {
    randomizeCharacterEquipment(false);
}

/**
 * Подписка на события восстановления и фокуса окна
 */
export function setupWindowRestoreRandomizer() {
    if (isRandomizerHooked) return;
    isRandomizerHooked = true;

    // 1. При переключении вкладок/окон или разворачивании через DOM
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            triggerRandomizeOnRestore();
        }
    });

    // 2. При получении фокуса окном
    window.addEventListener('focus', () => {
        triggerRandomizeOnRestore();
    });

    // 3. Через IPC события Electron при восстановлении из трея/сворачивания
    if (window.api?.onWindowRestore) {
        window.api.onWindowRestore(() => {
            triggerRandomizeOnRestore();
        });
    }
    if (window.api?.onWindowFocus) {
        window.api.onWindowFocus(() => {
            triggerRandomizeOnRestore();
        });
    }
}

