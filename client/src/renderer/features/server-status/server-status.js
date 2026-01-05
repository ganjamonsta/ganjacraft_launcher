/**
 * GanjaCraft Launcher - Server Status Feature
 * Проверка статуса сервера
 */

import { dom } from '../../utils/dom.js';

// Интервал обновления (30 секунд)
const STATUS_UPDATE_INTERVAL = 30000;
let statusInterval = null;

/**
 * Обновить статус сервера
 */
export async function updateServerStatus() {
    const playerCount = dom.get('player-count');
    const indicator = document.querySelector('.status-indicator');
    if (!playerCount || !indicator) return;

    try {
        // Using mcsrvstat.us public API
        const response = await fetch('https://api.mcsrvstat.us/3/ganjacraft.ru');
        const data = await response.json();

        if (data.online) {
            playerCount.textContent = `${data.players.online} / ${data.players.max}`;
            indicator.className = 'status-indicator online';
            indicator.title = 'Сервер доступен';
        } else {
            playerCount.textContent = 'Оффлайн';
            indicator.className = 'status-indicator offline';
            indicator.title = 'Сервер недоступен';
        }
    } catch (error) {
        console.error('Status check failed:', error);
        playerCount.textContent = 'Ошибка';
        indicator.className = 'status-indicator offline';
    }
}

/**
 * Запустить периодическую проверку статуса
 */
export function startStatusChecker() {
    // Initial check
    updateServerStatus();
    
    // Periodic updates
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
