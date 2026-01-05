/**
 * GanjaCraft Launcher - Console Feature
 * Консоль вывода логов
 */

import { dom } from '../../utils/dom.js';
import { MAX_CONSOLE_LINES } from '../../constants.js';

/**
 * Записать сообщение в консоль
 * @param {string} text 
 */
export function logToConsole(text) {
    const consoleOutput = dom.get('console-output');
    if (!consoleOutput) return;
    
    const line = document.createElement('div');
    line.innerText = text;
    line.style.borderBottom = '1px solid #1a1a1a';
    line.style.padding = '2px 0';
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
        consoleOutput.innerHTML = '';
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
    const newsList = dom.get('news-list');
    const consoleToggleBtn = dom.get('console-toggle-btn');
    const panelTitle = dom.get('panel-title');
    
    if (consoleOutput) consoleOutput.classList.remove('hidden');
    if (newsList) newsList.classList.add('hidden');
    if (consoleToggleBtn) consoleToggleBtn.classList.add('active');
    if (panelTitle) panelTitle.innerText = 'Консоль';
}

/**
 * Скрыть консоль (показать новости)
 */
export function hideConsole() {
    const consoleOutput = dom.get('console-output');
    const newsList = dom.get('news-list');
    const consoleToggleBtn = dom.get('console-toggle-btn');
    const panelTitle = dom.get('panel-title');
    
    if (consoleOutput) consoleOutput.classList.add('hidden');
    if (newsList) newsList.classList.remove('hidden');
    if (consoleToggleBtn) consoleToggleBtn.classList.remove('active');
    if (panelTitle) panelTitle.innerText = 'Новости';
}

/**
 * Переключить консоль/новости
 */
export function toggleConsole() {
    if (isConsoleVisible()) {
        hideConsole();
    } else {
        showConsole();
    }
}
