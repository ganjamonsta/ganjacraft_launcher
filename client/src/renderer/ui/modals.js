/**
 * GanjaCraft Launcher - Modal Dialogs
 * Кастомные модальные окна (confirm, alert)
 */

import { dom } from '../utils/dom.js';
import { ERROR_DISPLAY_TIME } from '../constants.js';

/**
 * Показать модальное окно подтверждения
 * @param {string} message - Текст сообщения
 * @param {string} title - Заголовок окна
 * @returns {Promise<boolean>} - true если OK, false если Cancel/ESC
 */
export function customConfirm(message, title = 'Подтверждение') {
    return new Promise((resolve) => {
        const modal = dom.get('confirm-modal');
        const titleEl = dom.get('confirm-title');
        const messageEl = dom.get('confirm-message');
        const okBtn = dom.get('confirm-ok');
        const cancelBtn = dom.get('confirm-cancel');

        // Fallback to native confirm if modal elements don't exist
        if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        
        // Show cancel button for confirm
        cancelBtn.style.display = '';
        
        // Ensure OK button has danger class for confirmations
        okBtn.classList.remove('modal-btn-primary');
        okBtn.classList.add('modal-btn-danger');

        // AbortController for proper cleanup
        const abortController = new AbortController();
        const { signal } = abortController;

        const cleanup = () => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            abortController.abort();
        };

        okBtn.onclick = () => {
            cleanup();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(false);
        };

        // ESC key support with proper cleanup
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };
        document.addEventListener('keydown', escHandler, { signal });

        modal.classList.remove('hidden');
    });
}

/**
 * Показать информационное модальное окно
 * @param {string} message - Текст сообщения
 * @param {string} title - Заголовок окна
 * @returns {Promise<void>}
 */
export function customAlert(message, title = 'Информация') {
    return new Promise((resolve) => {
        const modal = dom.get('confirm-modal');
        const titleEl = dom.get('confirm-title');
        const messageEl = dom.get('confirm-message');
        const okBtn = dom.get('confirm-ok');
        const cancelBtn = dom.get('confirm-cancel');

        // Fallback to native alert if modal elements don't exist
        if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
            alert(message);
            resolve();
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;

        // Hide cancel button for alert
        cancelBtn.style.display = 'none';
        
        // Style OK button as primary (green) for info dialogs
        okBtn.classList.remove('modal-btn-danger');
        okBtn.classList.add('modal-btn-primary');

        // AbortController for proper cleanup
        const abortController = new AbortController();
        const { signal } = abortController;

        const cleanup = () => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.style.display = '';
            okBtn.classList.remove('modal-btn-primary');
            okBtn.classList.add('modal-btn-danger');
            abortController.abort();
        };

        okBtn.onclick = () => {
            cleanup();
            resolve();
        };

        // ESC key support with proper cleanup
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve();
            }
        };
        document.addEventListener('keydown', escHandler, { signal });

        modal.classList.remove('hidden');
    });
}

/**
 * Показать сообщение об ошибке в указанном элементе
 * @param {string} elementId - ID элемента для отображения ошибки
 * @param {string} message - Текст ошибки
 */
export function showError(elementId, message) {
    const el = dom.get(elementId);
    if (!el) return;
    
    // Try to parse JSON error from API
    let displayMessage = message;
    if (message.includes('API Error')) {
        try {
            const jsonPart = message.substring(message.indexOf('{'));
            const data = JSON.parse(jsonPart);
            if (data.message) displayMessage = data.message;
        } catch (e) {
            displayMessage = message.replace('API Error: ', '');
        }
    }
    
    el.innerText = displayMessage;
    el.classList.remove('hidden');
    
    // Auto-hide after timeout
    setTimeout(() => {
        el.classList.add('hidden');
        el.innerText = '';
    }, ERROR_DISPLAY_TIME);
}

/**
 * Показать всплывающее уведомление (Toast)
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип (success, error, info, warning)
 * @param {string} title - Заголовок (опционально)
 * @param {number} duration - Длительность в мс (по умолчанию 3000)
 */
export function showNotification(message, type = 'info', title = '', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    // Если заголовок не передан, используем дефолтный по типу
    if (!title) {
        if (type === 'success') title = 'Успешно';
        if (type === 'error') title = 'Ошибка';
        if (type === 'warning') title = 'Внимание';
        if (type === 'info') title = 'Информация';
    }

    toast.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;

    // Show
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide and remove
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}
