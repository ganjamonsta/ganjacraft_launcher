/**
 * Ganj4Craft Launcher - Console Feature
 * Консоль вывода логов и управление терминалом
 */

import { dom } from '../../utils/dom.js';
import { showNotification } from '../../ui/modals.js';
import { MAX_CONSOLE_LINES } from '../../constants.js';

/**
 * Записать сообщение в консоль с цветовой классификацией
 * @param {string} text 
 */
export function logToConsole(text) {
    const consoleOutput = dom.get('console-output');
    if (!consoleOutput) return;
    
    // Если внутри только плейсхолдер - очищаем его при первом реальном логе
    const placeholder = consoleOutput.querySelector('.log-system');
    if (placeholder && consoleOutput.children.length === 1 && !text.includes('Ожидание логов')) {
        consoleOutput.innerHTML = '';
    }

    const line = document.createElement('div');
    line.className = 'console-log-line';
    
    const str = String(text || '');
    
    // Автоматическая подсветка уровней логов
    if (str.includes('[ERROR]') || str.includes('Error:') || str.includes('Exception:') || str.includes('FATAL') || str.includes('Crash')) {
        line.classList.add('log-error');
    } else if (str.includes('[WARN]') || str.includes('Warning:')) {
        line.classList.add('log-warn');
    } else if (str.includes('[LAUNCHER]') || str.includes('[SETTINGS]')) {
        line.classList.add('log-launcher');
    } else if (str.includes('[MCLC]') || str.includes('Скачивание:') || str.includes('Download') || str.includes('Загрузка')) {
        line.classList.add('log-download');
    } else if (str.includes('[DEBUG]')) {
        line.classList.add('log-debug');
    } else {
        line.classList.add('log-info');
    }
    
    line.textContent = str;
    consoleOutput.appendChild(line);

    // Ограничиваем количество строк
    if (consoleOutput.children.length > MAX_CONSOLE_LINES) {
        consoleOutput.removeChild(consoleOutput.firstChild);
    }

    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

/**
 * Очистить консоль
 */
export function clearConsole() {
    const consoleOutput = dom.get('console-output');
    if (consoleOutput) {
        consoleOutput.innerHTML = '<div class="console-log-line log-system">Лог очищен. Ожидание сообщений...</div>';
    }
}

/**
 * Скопировать лог консоли
 */
export function copyConsoleLogs() {
    const consoleOutput = dom.get('console-output');
    if (!consoleOutput) return;
    const text = consoleOutput.innerText || '';
    if (!text.trim()) {
        showNotification('Консоль пуста', 'info', 'Консоль', 2000);
        return;
    }

    const doSuccess = () => {
        showNotification('Логи запуска скопированы в буфер обмена', 'success', 'Консоль', 3000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(doSuccess).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }

    function fallbackCopy(str) {
        const ta = document.createElement('textarea');
        ta.value = str;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            doSuccess();
        } catch (e) {
            console.error('Failed to copy', e);
            showNotification('Не удалось скопировать логи', 'error', 'Ошибка', 3000);
        }
        document.body.removeChild(ta);
    }
}

/**
 * Инициализация кнопок управления консолью
 */
export function initConsoleActions() {
    const btnClear = dom.get('btn-clear-console');
    const btnCopy = dom.get('btn-copy-console');
    if (btnClear) {
        btnClear.onclick = clearConsole;
    }
    if (btnCopy) {
        btnCopy.onclick = copyConsoleLogs;
    }
}

/**
 * Проверить видна ли консоль
 */
export function isConsoleVisible() {
    const consoleOutput = dom.get('console-output');
    return consoleOutput && !consoleOutput.classList.contains('hidden');
}

/**
 * Показать консоль
 */
export function showConsole() {
    const consoleOutput = dom.get('console-output');
    if (consoleOutput) consoleOutput.classList.remove('hidden');
}

/**
 * Скрыть консоль
 */
export function hideConsole() {
    const consoleOutput = dom.get('console-output');
    if (consoleOutput) consoleOutput.classList.add('hidden');
}
