/**
 * GanjaCraft Launcher - Server Status Feature
 * Проверка статуса сервера + список игроков при наведении
 */

import { dom } from '../../utils/dom.js';

const SERVER_ADDRESS = 'vocalize-cove.gl.joinmc.link';
const STATUS_UPDATE_INTERVAL = 60000; // 60 секунд
let statusInterval = null;

/**
 * Создать/обновить тултип с именами игроков
 */
function buildTooltip(players) {
    let tooltip = document.getElementById('players-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'players-tooltip';
        tooltip.className = 'players-tooltip';
        document.body.appendChild(tooltip);
    }

    if (!players || players.length === 0) {
        tooltip.innerHTML = '<span class="tooltip-empty">Нет игроков</span>';
    } else {
        tooltip.innerHTML = players
            .map(p => {
                const name = typeof p === 'string' ? p : (p?.name_clean || p?.name_raw || 'Игрок');
                return `<span class="tooltip-player">⚔ ${name}</span>`;
            })
            .join('');
    }
    return tooltip;
}

/**
 * Привязать тултип к элементу
 */
function attachTooltip(target, players) {
    const tooltip = buildTooltip(players);

    target.addEventListener('mouseenter', (e) => {
        tooltip.classList.add('visible');
        positionTooltip(e, tooltip);
    });

    target.addEventListener('mousemove', (e) => {
        positionTooltip(e, tooltip);
    });

    target.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });
}

function positionTooltip(e, tooltip) {
    const x = e.clientX;
    const y = e.clientY;
    const rect = tooltip.getBoundingClientRect();
    const winW = window.innerWidth;

    let left = x + 12;
    if (left + rect.width > winW - 8) {
        left = x - rect.width - 12;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${y - rect.height / 2}px`;
}

/**
 * Обновить статус сервера
 */
export async function updateServerStatus() {
    const playerCount = dom.get('player-count');
    const indicator = document.querySelector('.status-indicator');
    if (!playerCount || !indicator) return;

    try {
        let isOnline = false;
        let onlineCount = 0;
        let maxCount = 0;
        let list = [];

        // 1. Пробуем mcstatus.io (отлично поддерживает SRV и прокси-домены joinmc.link)
        try {
            const resIo = await fetch(`https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`, {
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (resIo.ok) {
                const dataIo = await resIo.json();
                if (dataIo.online) {
                    isOnline = true;
                    onlineCount = dataIo.players?.online ?? 0;
                    maxCount = dataIo.players?.max ?? 0;
                    list = dataIo.players?.list || [];
                }
            }
        } catch (e) {
            console.warn('mcstatus.io check failed, trying fallback:', e);
        }

        // 2. Fallback на mcsrvstat.us если mcstatus.io недоступен
        if (!isOnline) {
            try {
                const resSrv = await fetch(`https://api.mcsrvstat.us/3/${SERVER_ADDRESS}`, {
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (resSrv.ok) {
                    const dataSrv = await resSrv.json();
                    if (dataSrv.online) {
                        isOnline = true;
                        onlineCount = dataSrv.players?.online ?? 0;
                        maxCount = dataSrv.players?.max ?? 0;
                        list = dataSrv.players?.list || [];
                    }
                }
            } catch (e) {
                console.warn('mcsrvstat.us check failed:', e);
            }
        }

        const bottomCount = dom.get('bottom-player-count');
        const liveStatusText = dom.get('live-status-text');
        const livePlayerCount = dom.get('live-player-count');
        const livePlayersContainer = dom.get('live-players-container');

        if (isOnline) {
            playerCount.textContent = `${onlineCount} / ${maxCount} онлайн`;
            playerCount.style.cursor = 'default';

            if (bottomCount) {
                bottomCount.textContent = `В сети (${onlineCount} игроков)`;
            }

            indicator.className = 'status-indicator online';
            indicator.title = 'Сервер доступен';

            if (liveStatusText) {
                liveStatusText.textContent = 'СЕРВЕР В СЕТИ';
            }
            if (livePlayerCount) {
                livePlayerCount.textContent = `${onlineCount} / ${maxCount}`;
            }

            if (livePlayersContainer) {
                if (Array.isArray(list) && list.length > 0) {
                    livePlayersContainer.innerHTML = list.map(p => {
                        const name = typeof p === 'string' ? p : (p?.name_clean || p?.name_raw || 'Игрок');
                        const avatarUrl = `https://launcher.ganj4craft.ru/api/skins/${encodeURIComponent(name)}.png`;
                        return `
                            <div class="live-player-item" title="${name}">
                                <div class="live-player-avatar-wrap">
                                    <img src="${avatarUrl}" class="live-player-avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%2339ff14%22><rect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23111%22/><circle cx=%2212%22 cy=%229%22 r=%224%22 fill=%22%2339ff14%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22 fill=%22%2339ff14%22/></svg>'">
                                </div>
                                <span class="live-player-name">${name}</span>
                            </div>
                        `;
                    }).join('');
                } else {
                    livePlayersContainer.innerHTML = `
                        <div class="live-empty-state">
                            <span class="live-empty-icon">🎮</span>
                            <span>Сервер свободен • Будь первым!</span>
                        </div>
                    `;
                }
            }

            // Тултип с никами при наведении
            attachTooltip(playerCount, list);
            attachTooltip(indicator, list);
            if (bottomCount) attachTooltip(bottomCount, list);
        } else {
            playerCount.textContent = 'Оффлайн';
            playerCount.style.cursor = 'default';
            if (bottomCount) {
                bottomCount.textContent = 'Оффлайн';
            }
            indicator.className = 'status-indicator offline';
            indicator.title = 'Сервер недоступен';

            if (liveStatusText) {
                liveStatusText.textContent = 'ОФФЛАЙН';
            }
            if (livePlayerCount) {
                livePlayerCount.textContent = '0 / 0';
            }
            if (livePlayersContainer) {
                livePlayersContainer.innerHTML = `
                    <div class="live-empty-state offline">
                        <span class="live-empty-icon">⚠️</span>
                        <span>Сервер временно недоступен</span>
                    </div>
                `;
            }

            // Убираем тултип если есть
            const tooltip = document.getElementById('players-tooltip');
            if (tooltip) tooltip.remove();
        }
    } catch (error) {
        console.error('Status check failed:', error);
        playerCount.textContent = '—';
        indicator.className = 'status-indicator offline';
        const livePlayersContainer = dom.get('live-players-container');
        if (livePlayersContainer) {
            livePlayersContainer.innerHTML = `
                <div class="live-empty-state offline">
                    <span class="live-empty-icon">⚠️</span>
                    <span>Ошибка связи с сервером</span>
                </div>
            `;
        }
    }
}

/**
 * Запустить периодическую проверку статуса
 */
export function startStatusChecker() {
    updateServerStatus();
    if (!statusInterval) {
        statusInterval = setInterval(updateServerStatus, STATUS_UPDATE_INTERVAL);
    }
}

/**
 * Остановить проверку статуса
 */
export function stopStatusChecker() {
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
}
