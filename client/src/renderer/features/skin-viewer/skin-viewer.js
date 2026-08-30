/**
 * Ganj4Craft Launcher - Skin Viewer Feature
 * Интерактивный 3D WebGL и 2D рендер скина игрока
 */

import * as skinview3d from 'skinview3d';
import { dom } from '../../utils/dom.js';
import { equipmentManager } from './equipment-manager.js';

const STORAGE_KEY_MODE = 'ganja_skin_viewer_mode';
const SKIN_BASE_URL = 'https://launcher.ganj4craft.ru/api/skins';
const CAPE_BASE_URL = 'https://launcher.ganj4craft.ru/api/capes';

let skinViewer3d = null;
let currentUsername = '';
let currentMode = localStorage.getItem(STORAGE_KEY_MODE) || '3d'; // '3d' | '2d' | 'off'
let mouseMoveHandler = null;

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
 * Рендер 3D скина через skinview3d
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

            if (skinViewer3d.playerObject) {
                skinViewer3d.playerObject.position.set(-3.5, -1.0, 0);
                skinViewer3d.playerObject.rotation.y = -0.32;
            }

            // Тактическая анимация: руки держат оружие прямо перед собой
            skinViewer3d.animation = new skinview3d.FunctionAnimation((player, progress) => {
                const t = progress * 1.5;
                if (!player || !player.skin) return;

                // Если активен шутер во время загрузки — держим оружие прямо перед собой в Top-Down стойке
                if (document.body.classList.contains('is-shooter-active')) {
                    const weaponId = equipmentManager.getSlot('mainHand');
                    if (player.skin.head) {
                        player.skin.head.rotation.set(0, 0, 0);
                    }
                    if (player.skin.rightArm) {
                        if (weaponId === 'tacz_minigun') {
                            player.skin.rightArm.rotation.set(-0.95, -0.15, 0.08);
                        } else if (weaponId === 'tacz_rpg7') {
                            player.skin.rightArm.rotation.set(-Math.PI / 2.05, -0.20, 0.08);
                        } else {
                            player.skin.rightArm.rotation.set(-Math.PI / 2, -0.22, 0.08);
                        }
                    }
                    if (player.skin.leftArm) {
                        if (weaponId === 'tacz_minigun') {
                            player.skin.leftArm.rotation.set(-1.25, 0.65, -0.30);
                        } else if (weaponId === 'tacz_rpg7') {
                            player.skin.leftArm.rotation.set(-Math.PI / 2.05, 0.70, -0.30);
                        } else {
                            player.skin.leftArm.rotation.set(-Math.PI / 2.08, 0.75, -0.32);
                        }
                    }
                    if (player.skin.rightLeg) player.skin.rightLeg.rotation.set(0, 0, 0);
                    if (player.skin.leftLeg) player.skin.leftLeg.rotation.set(0, 0, 0);
                    return;
                }

                // Дыхание головы
                if (player.skin.head) {
                    player.skin.head.rotation.y = Math.sin(t * 0.5) * 0.04;
                    player.skin.head.rotation.x = Math.sin(t * 0.3) * 0.02;
                }

                const weaponId = equipmentManager.getSlot('mainHand');
                const hasWeapon = weaponId !== 'none';
                const breath = Math.sin(t * 0.8) * 0.015;

                // 1. Поза правой руки
                if (player.skin.rightArm) {
                    if (weaponId === 'tacz_minigun') {
                        // Тяжелая поза минигана (стрельба от бедра)
                        player.skin.rightArm.rotation.x = -0.75 + breath;
                        player.skin.rightArm.rotation.y = -0.15;
                        player.skin.rightArm.rotation.z = 0.10;
                    } else if (weaponId === 'tacz_rpg7') {
                        // РПГ на плече
                        player.skin.rightArm.rotation.x = -Math.PI / 2.10 + breath;
                        player.skin.rightArm.rotation.y = -0.22;
                        player.skin.rightArm.rotation.z = 0.10;
                    } else if (weaponId === 'tacz_glock17' || weaponId === 'tacz_deagle') {
                        // Одноручный хват пистолета
                        player.skin.rightArm.rotation.x = -Math.PI / 2.20 + breath;
                        player.skin.rightArm.rotation.y = -0.08;
                        player.skin.rightArm.rotation.z = 0.04;
                    } else if (hasWeapon) {
                        // АК-47, Vector, AWP, Spas-12: сведенные руки в боевой хват
                        player.skin.rightArm.rotation.x = -Math.PI / 2.15 + breath;
                        player.skin.rightArm.rotation.y = -0.35;
                        player.skin.rightArm.rotation.z = 0.12;
                    } else {
                        // Свободная рука
                        player.skin.rightArm.rotation.x = Math.sin(t * 0.6) * 0.04;
                        player.skin.rightArm.rotation.y = 0;
                        player.skin.rightArm.rotation.z = 0.02;
                    }
                }

                // 2. Поза левой руки (поддержка оружия)
                if (player.skin.leftArm) {
                    if (weaponId === 'tacz_minigun') {
                        // Левая рука крепко держит верхнюю рукоять минигана сверху
                        player.skin.leftArm.rotation.x = -1.22 + breath;
                        player.skin.leftArm.rotation.y = 0.72;
                        player.skin.leftArm.rotation.z = -0.38;
                    } else if (weaponId === 'tacz_rpg7') {
                        // Левая рука держит переднюю ручку РПГ
                        player.skin.leftArm.rotation.x = -Math.PI / 2.12 + breath;
                        player.skin.leftArm.rotation.y = 0.75;
                        player.skin.leftArm.rotation.z = -0.34;
                    } else if (weaponId === 'tacz_glock17' || weaponId === 'tacz_deagle') {
                        // Тактический хват пистолета двумя руками
                        player.skin.leftArm.rotation.x = -Math.PI / 2.22 + breath;
                        player.skin.leftArm.rotation.y = 0.58;
                        player.skin.leftArm.rotation.z = -0.28;
                    } else if (hasWeapon) {
                        // АК-47, Vector, AWP, Spas-12: левая рука плотно тянется через грудь и обхватывает цевье
                        player.skin.leftArm.rotation.x = -Math.PI / 2.14 + breath;
                        player.skin.leftArm.rotation.y = 0.82;
                        player.skin.leftArm.rotation.z = -0.36;
                    } else {
                        // Свободная рука
                        player.skin.leftArm.rotation.x = -Math.sin(t * 0.6) * 0.04;
                        player.skin.leftArm.rotation.y = 0;
                        player.skin.leftArm.rotation.z = -0.02;
                    }
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
            if (skinViewer3d.playerObject) {
                skinViewer3d.playerObject.position.set(-3.5, -1.0, 0);
                skinViewer3d.playerObject.rotation.y = -0.32;
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

        // Применяем сохраненную экипировку персонажа
        try {
            equipmentManager.loadEquipment();
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
 * Слежение головы 3D скина за курсором мыши (в обычном режиме дашборда)
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
        const centerY = rect.top + rect.height / 3; // фокус на голову

        const deltaX = (e.clientX - centerX) / (window.innerWidth / 2);
        const deltaY = (e.clientY - centerY) / (window.innerHeight / 2);

        // Ограничиваем угол поворота головы
        const targetRotY = Math.max(-0.6, Math.min(0.6, deltaX * 0.8));
        const targetRotX = Math.max(-0.4, Math.min(0.4, deltaY * 0.6));

        const head = skinViewer3d.playerObject.skin.head;
        if (head) {
            head.rotation.y += (targetRotY - head.rotation.y) * 0.1;
            head.rotation.x += (targetRotX - head.rotation.x) * 0.1;
        }
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
        // Возврат в стандартную камеру персонажа слева
        if (skinViewer3d.controls) {
            skinViewer3d.controls.minPolarAngle = Math.PI / 2 - 0.5;
            skinViewer3d.controls.maxPolarAngle = Math.PI / 2 + 0.3;
            skinViewer3d.controls.enableRotate = true;
        }
        skinViewer3d.camera.position.set(-2, 0, 78);
        skinViewer3d.camera.lookAt(0, 0, 0);

        if (skinViewer3d.playerObject) {
            skinViewer3d.playerObject.position.set(-3.5, -1.0, 0);
            skinViewer3d.playerObject.rotation.set(0, -0.32, 0);
            skinViewer3d.playerObject.scale.set(1.0, 1.0, 1.0);
        }
    }
}

