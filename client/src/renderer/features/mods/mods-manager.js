/**
 * GanjaCraft Launcher - Mods Manager
 * Управление опциональными модами (оптимизировано)
 */

import { dom } from '../../utils/dom.js';
import { MOD_GROUPS, CATEGORY_ORDER } from './mod-groups.js';
import { whenIdle } from '../../utils/performance.js';

// Локальный стейт
let allModsData = [];
let categorizedMods = {};

// Кеш для DOM элементов
let cachedModsList = null;
let cachedSidebar = null;

/**
 * Загрузить список модов
 * @param {string[]} disabledMods - список отключённых путей
 * @param {Object} config - текущая конфигурация
 */
export async function loadModsList(disabledMods, config) {
    cachedModsList = dom.get('mods-list');
    if (!cachedModsList) return;
    
    cachedModsList.innerHTML = '<div class="unified-loading"><span class="unified-spinner"></span>Загрузка манифеста...</div>';
    
    const manifest = await window.api.getManifest();
    if (!manifest) {
        cachedModsList.innerHTML = '<div class="unified-empty"><div class="unified-empty-icon">⚠️</div><div class="unified-empty-text">Не удалось загрузить манифест</div></div>';
        return;
    }
    
    // Фильтруем опциональные .jar моды
    const allFiles = manifest.files.filter(f => 
        f.optional && 
        f.path.startsWith('mods/') && 
        f.path.endsWith('.jar')
    );
    
    if (allFiles.length === 0) {
        cachedModsList.innerHTML = '<div class="unified-empty"><div class="unified-empty-icon">📦</div><div class="unified-empty-text">Нет доступных опциональных модов</div></div>';
        return;
    }

    const handledFiles = new Set();
    allModsData = [];

    // Группируем по категориям
    const categorized = {};
    
    // Обрабатываем группы
    MOD_GROUPS.forEach(group => {
        const groupFiles = allFiles.filter(f => {
            const fileName = f.path.split('/').pop();
            return group.files.some(pattern => fileName.includes(pattern));
        });

        if (groupFiles.length > 0) {
            groupFiles.forEach(f => handledFiles.add(f.path));

            // Определяем checked состояние
            let isChecked;
            if (config.modsDefaultsApplied !== true && group.defaultDisabled) {
                isChecked = false;
            } else {
                isChecked = groupFiles.every(f => !disabledMods.includes(f.path));
            }

            const category = group.category || 'Разное';
            if (!categorized[category]) categorized[category] = [];
            
            categorized[category].push({
                type: 'group',
                id: group.id,
                name: group.name,
                description: group.description,
                paths: groupFiles.map(f => f.path),
                checked: isChecked
            });
        }
    });

    // Обрабатываем оставшиеся файлы
    const remainingFiles = allFiles.filter(f => !handledFiles.has(f.path));
    if (remainingFiles.length > 0) {
        if (!categorized['Остальное']) categorized['Остальное'] = [];
        
        remainingFiles.forEach(file => {
            const isChecked = !disabledMods.includes(file.path);
            const fileName = file.path.split('/').pop();
            
            categorized['Остальное'].push({
                type: 'file',
                name: fileName,
                paths: [file.path],
                checked: isChecked
            });
        });
    }

    // Сохраняем данные для фильтрации
    Object.keys(categorized).forEach(cat => {
        categorized[cat].forEach(mod => {
            allModsData.push({ ...mod, category: cat });
        });
    });

    renderModsList(categorized);
    updateModsCounter();
}

/**
 * Отрендерить список модов (оптимизировано)
 * Использует DocumentFragment для batch DOM операций
 * @param {Object} categorized 
 */
export function renderModsList(categorized) {
    categorizedMods = categorized;
    
    const sidebar = dom.get('mods-categories-list');
    const list = dom.get('mods-list');
    
    if (!sidebar || !list) return;
    
    // Используем DocumentFragment для batch рендеринга
    const sidebarFragment = document.createDocumentFragment();
    const listFragment = document.createDocumentFragment();
    
    // Рендерим сайдбар категорий
    CATEGORY_ORDER.forEach(categoryName => {
        const mods = categorized[categoryName];
        if (!mods || mods.length === 0) return;
        
        const activeCount = mods.filter(m => m.checked).length;

        const categoryItem = document.createElement('div');
        categoryItem.className = 'unified-sidebar-item';
        if (activeCount > 0) {
            categoryItem.classList.add('active');
        }
        categoryItem.dataset.category = categoryName;
        categoryItem.innerHTML = `
            <div class="unified-sidebar-item-name">${categoryName}</div>
            <div class="unified-sidebar-item-count">${activeCount} / ${mods.length}</div>
        `;
        
        categoryItem.addEventListener('click', () => {
            scrollToCategory(categoryName);
        });
        
        sidebarFragment.appendChild(categoryItem);
    });
    
    // Рендерим все моды по категориям
    CATEGORY_ORDER.forEach(categoryName => {
        const mods = categorized[categoryName];
        if (!mods || mods.length === 0) return;
        
        // Заголовок категории
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'unified-section-header';
        categoryHeader.dataset.category = categoryName;
        categoryHeader.textContent = categoryName;
        listFragment.appendChild(categoryHeader);
        
        // Моды
        mods.forEach(mod => {
            const div = document.createElement('label');
            div.className = 'unified-list-item';
            div.dataset.category = categoryName;
            
            const paths = mod.paths.join('|');
            const desc = mod.description ? `<span class="unified-list-item-desc">${mod.description}</span>` : '';
            
            div.innerHTML = `
                <input type="checkbox" data-paths="${paths}" ${mod.checked ? 'checked' : ''}>
                <span class="unified-list-item-name">${mod.name}</span>
                ${desc}
            `;
            listFragment.appendChild(div);
        });
    });
    
    // Один раз обновляем DOM (предотвращает множественные reflows)
    sidebar.innerHTML = '';
    list.innerHTML = '';
    sidebar.appendChild(sidebarFragment);
    list.appendChild(listFragment);
    
    updateCategorySidebar();
}

/**
 * Прокрутить к категории
 */
export function scrollToCategory(categoryName) {
    const list = dom.get('mods-list');
    const categoryHeader = list?.querySelector(`.unified-section-header[data-category="${categoryName}"]`);
    
    if (categoryHeader && list) {
        const listRect = list.getBoundingClientRect();
        const headerRect = categoryHeader.getBoundingClientRect();
        const scrollTop = list.scrollTop;
        
        const targetScroll = scrollTop + (headerRect.top - listRect.top) - 10;
        
        list.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    }
}

/**
 * Обновить счётчик модов
 */
export function updateModsCounter() {
    const checkboxes = document.querySelectorAll('#mods-list input[type="checkbox"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
    
    const selectedEl = dom.get('mods-selected-count');
    const totalEl = dom.get('mods-total-count');
    
    if (selectedEl) selectedEl.textContent = String(checked);
    if (totalEl) totalEl.textContent = String(checkboxes.length);
}

/**
 * Обновить сайдбар категорий
 */
export function updateCategorySidebar() {
    CATEGORY_ORDER.forEach(categoryName => {
        const categoryItem = document.querySelector(`.unified-sidebar-item[data-category="${categoryName}"]`);
        if (!categoryItem) return;
        
        const categoryModItems = document.querySelectorAll(`.unified-list-item[data-category="${categoryName}"] input[type="checkbox"]`);
        const activeCount = Array.from(categoryModItems).filter(cb => cb.checked).length;
        const totalCount = categoryModItems.length;
        
        const countEl = categoryItem.querySelector('.unified-sidebar-item-count');
        if (countEl) {
            countEl.textContent = `${activeCount} / ${totalCount}`;
        }
        
        if (activeCount > 0) {
            categoryItem.classList.add('active');
        } else {
            categoryItem.classList.remove('active');
        }
    });
}

/**
 * Получить список отключённых модов
 * @returns {string[]}
 */
export function getDisabledMods() {
    const disabled = [];
    document.querySelectorAll('#mods-list input[type="checkbox"]').forEach(cb => {
        if (!cb.checked) {
            const paths = cb.dataset.paths.split('|');
            paths.forEach(p => disabled.push(p));
        }
    });
    return disabled;
}

/**
 * Инициализация слушателей изменений модов
 * @param {Function} onChangeCallback - колбэк при изменении
 */
export function initModsListeners(onChangeCallback) {
    const list = dom.get('mods-list');
    if (!list) return;
    
    list.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            updateModsCounter();
            updateCategorySidebar();
            if (onChangeCallback) onChangeCallback();
        }
    });
}

/**
 * Получить все данные модов
 */
export function getAllModsData() {
    return allModsData;
}

/**
 * Получить категоризированные моды
 */
export function getCategorizedMods() {
    return categorizedMods;
}
