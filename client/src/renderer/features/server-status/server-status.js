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
            .map(name => `<span class="tooltip-player">⚔ ${name}</span>`)
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
        const response = await fetch(`https://api.mcsrvstat.us/3/${SERVER_ADDRESS}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();

        if (data.online) {
            const online = data.players?.online ?? 0;
            const max = data.players?.max ?? 0;
            const list = data.players?.list || [];

            playerCount.textContent = `${online} / ${max} онлайн`;
            playerCount.style.cursor = 'default';

            indicator.className = 'status-indicator online';
            indicator.title = 'Сервер доступен';

            // Тултип с никами при наведении
            attachTooltip(playerCount, list);
            attachTooltip(indicator, list);
        } else {
            playerCount.textContent = 'Оффлайн';
            playerCount.style.cursor = 'default';
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
