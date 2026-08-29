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

        if (isOnline) {
            playerCount.textContent = `${onlineCount} / ${maxCount} онлайн`;
            playerCount.style.cursor = 'default';

            if (bottomCount) {
                bottomCount.textContent = `В сети (${onlineCount} игроков)`;
            }

            indicator.className = 'status-indicator online';
            indicator.title = 'Сервер доступен';

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

            // Убираем тултип если есть
            const tooltip = document.getElementById('players-tooltip');
            if (tooltip) tooltip.remove();
        }
    } catch (error) {
        console.error('Status check failed:', error);
        playerCount.textContent = '—';
        indicator.className = 'status-indicator offline';
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
