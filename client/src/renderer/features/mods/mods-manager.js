/**
 * GanjaCraft Launcher - Mods Manager (Native Launcher UI)
 * Управление модами с использованием стандартных категорий и переключателей лаунчера
 */

import { dom } from '../../utils/dom.js';
import { MOD_GROUPS, SUB_CATEGORIES } from './mod-groups.js';

let cachedManifest = null;
let currentSubTab = 'ОПЦИОНАЛЬНЫЕ';
let searchQuery = '';
let allGroupItems = [];

function getModStem(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const fileName = filePath.split('/').pop().split('\\').pop().toLowerCase();
    return fileName
        .replace(/\.jar$/i, '')
        .replace(/[-_](v?\d+\.[\d.]+.*)$/i, '')
        .replace(/[-_](neoforge|forge|fabric|mc\d+.*)$/i, '');
}

function isModDisabled(filePath, disabledMods = []) {
    if (!filePath || !Array.isArray(disabledMods) || disabledMods.length === 0) return false;
    const normPath = String(filePath).replace(/\\/g, '/');
    if (disabledMods.includes(normPath)) return true;

    const targetFileName = normPath.split('/').pop().toLowerCase();
    const targetStem = getModStem(normPath);

    for (const disabledEntry of disabledMods) {
        if (!disabledEntry) continue;
        const normDisabled = String(disabledEntry).replace(/\\/g, '/');
        if (normDisabled === normPath) return true;

        const groupById = MOD_GROUPS.find(g => g.id === normDisabled);
        if (groupById && groupById.files) {
            if (groupById.files.some(p => targetFileName.includes(p.toLowerCase()))) return true;
        }

        const entryFileName = normDisabled.split('/').pop().toLowerCase();
        const matchingGroup = MOD_GROUPS.find(g => 
            g.files && g.files.some(p => entryFileName.includes(p.toLowerCase()))
        );
        if (matchingGroup && matchingGroup.files) {
            if (matchingGroup.files.some(p => targetFileName.includes(p.toLowerCase()))) return true;
        }

        const entryStem = getModStem(normDisabled);
        if (targetStem && entryStem && targetStem === entryStem) return true;
    }

    return false;
}

/**
 * Загрузить список модов
 */
export async function loadModsList(disabledMods = [], config = {}, forceReload = false) {
    const gridContainer = dom.get('mods-grid');
    if (!gridContainer) return;

    // Если список модов уже загружен в память — обновляем состояния и сетку без вывода спиннера
    if (allGroupItems.length > 0 && !forceReload) {
        allGroupItems.forEach(item => {
            if (item.type === 'group') {
                const group = MOD_GROUPS.find(g => g.id === item.id);
                if (config.modsDefaultsApplied !== true && group?.defaultDisabled) {
                    item.checked = false;
                } else {
                    item.checked = item.paths.every(p => !isModDisabled(p, disabledMods));
                }
            } else {
                item.checked = item.paths.every(p => !isModDisabled(p, disabledMods));
            }
        });

        renderModsGrid();
        return;
    }

    if (allGroupItems.length === 0) {
        gridContainer.innerHTML = '<div class="unified-loading"><span class="unified-spinner"></span>Загрузка модов...</div>';
    }

    cachedManifest = await window.api.getManifest();
    if (!cachedManifest) {
        gridContainer.innerHTML = '<div class="unified-empty"><div class="unified-empty-icon">⚠️</div><div class="unified-empty-text">Не удалось загрузить манифест модов</div></div>';
        return;
    }

    const allFiles = cachedManifest.files.filter(f => 
        f.optional && 
        f.path.startsWith('mods/') && 
        f.path.endsWith('.jar')
    );

    allGroupItems = [];
    const handledFiles = new Set();

    // Обрабатываем группы
    MOD_GROUPS.forEach(group => {
        const groupFiles = allFiles.filter(f => {
            const fileName = f.path.split('/').pop().toLowerCase();
            return group.files.some(pattern => fileName.includes(pattern.toLowerCase()));
        });

        if (groupFiles.length > 0) {
            groupFiles.forEach(f => handledFiles.add(f.path));

            let isChecked;
            if (config.modsDefaultsApplied !== true && group.defaultDisabled) {
                isChecked = false;
            } else {
                isChecked = groupFiles.every(f => !isModDisabled(f.path, disabledMods));
            }

            allGroupItems.push({
                type: 'group',
                id: group.id,
                name: group.name,
                shortName: group.shortName || group.name,
                version: group.version || '1.0.0',
                subCategory: group.subCategory || 'Оптимизация',
                icon: group.icon || 'gear',
                dependsOn: group.dependsOn || null,
                description: group.description,
                curseSlug: group.curseSlug,
                modrinthSlug: group.modrinthSlug,
                paths: groupFiles.map(f => f.path),
                checked: isChecked
            });
        }
    });

    // Обрабатываем оставшиеся единичные файлы
    const remainingFiles = allFiles.filter(f => !handledFiles.has(f.path));
    remainingFiles.forEach(file => {
        const isChecked = !isModDisabled(file.path, disabledMods);
        const fileName = file.path.split('/').pop();

        let prettyName = fileName
            .replace(/\.jar$/i, '')
            .replace(/^client[-_]/i, '')
            .replace(/[-_](neoforge|forge|fabric|mc|\d+\.\d+).*/i, '')
            .replace(/[-_]\d+.*$/i, '');
        prettyName = prettyName.charAt(0).toUpperCase() + prettyName.slice(1);

        const slug = prettyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        allGroupItems.push({
            type: 'file',
            id: slug,
            name: prettyName,
            shortName: prettyName,
            version: '1.0.0',
            subCategory: 'Механики',
            icon: 'block',
            dependsOn: null,
            description: `Дополнительный мод (${fileName})`,
            curseSlug: slug,
            modrinthSlug: slug,
            paths: [file.path],
            checked: isChecked
        });
    });

    // Валидация зависимостей при старте
    allGroupItems.forEach(item => {
        if (item.dependsOn && item.checked) {
            const parent = allGroupItems.find(p => p.id === item.dependsOn);
            if (parent && !parent.checked) {
                item.checked = false;
            }
        }
    });

    setupSubtabsListeners();
    renderModsGrid();
    if (cachedManifest) {
        renderLinksCatalog(cachedManifest);
    }
}

let subtabTransitionTimer = null;

function setupSubtabsListeners() {
    const subtabsContainer = dom.get('mods-subtabs');
    if (!subtabsContainer) return;

    subtabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.unified-btn');
        if (!btn) return;

        const subtab = btn.dataset.subtab;
        if (!subtab || subtab === currentSubTab) return;

        const prevSubtab = currentSubTab;
        currentSubTab = subtab;

        const subtabOrder = ['ОПЦИОНАЛЬНЫЕ', 'КАТАЛОГ ССЫЛОК'];
        const prevIndex = subtabOrder.indexOf(prevSubtab);
        const newIndex = subtabOrder.indexOf(subtab);
        const direction = newIndex > prevIndex ? 'right' : 'left';

        const enterAnim = direction === 'right' ? 'subtab-enter-right' : 'subtab-enter-left';
        const exitAnim = direction === 'right' ? 'subtab-exit-left' : 'subtab-exit-right';

        subtabsContainer.querySelectorAll('.unified-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const gridView = dom.get('mods-grid-container');
        const catalogView = dom.get('mods-catalog-container');

        const outgoingView = subtab === 'КАТАЛОГ ССЫЛОК' ? gridView : catalogView;
        const incomingView = subtab === 'КАТАЛОГ ССЫЛОК' ? catalogView : gridView;

        if (subtabTransitionTimer) {
            clearTimeout(subtabTransitionTimer);
            subtabTransitionTimer = null;
        }

        // 1. Очищаем анимационные классы со всех контейнеров при быстрой смене
        [gridView, catalogView].forEach(v => {
            if (v) {
                v.classList.remove(
                    'subtab-entering', 'subtab-exiting',
                    'subtab-enter-right', 'subtab-enter-left',
                    'subtab-exit-right', 'subtab-exit-left'
                );
            }
        });

        // 2. Включаем целевую вкладку
        if (incomingView) {
            incomingView.classList.remove('hidden');
            incomingView.classList.add('subtab-entering', enterAnim);
            if (subtab === 'КАТАЛОГ ССЫЛОК') {
                renderLinksCatalog(cachedManifest);
            } else {
                renderModsGrid();
            }
        }

        // 3. Плавно уводим уходящую вкладку
        if (outgoingView && !outgoingView.classList.contains('hidden')) {
            outgoingView.classList.add('subtab-exiting', exitAnim);
        }

        // 4. Гарантированная детерминированная зачистка на основе реального текущего currentSubTab
        subtabTransitionTimer = setTimeout(() => {
            const activeView = currentSubTab === 'КАТАЛОГ ССЫЛОК' ? catalogView : gridView;
            const inactiveView = currentSubTab === 'КАТАЛОГ ССЫЛОК' ? gridView : catalogView;

            if (inactiveView) {
                inactiveView.classList.add('hidden');
                inactiveView.classList.remove('subtab-exiting', 'subtab-exit-left', 'subtab-exit-right');
            }

            if (activeView) {
                activeView.classList.remove('hidden', 'subtab-entering', 'subtab-enter-right', 'subtab-enter-left');
            }

            subtabTransitionTimer = null;
        }, 280);
    });

    const searchInput = dom.get('mods-search-input');
    const clearBtn = dom.get('mods-search-clear-btn');

    function updateSearchUI() {
        const val = searchInput ? searchInput.value.trim() : '';
        if (clearBtn) {
            const mag = clearBtn.querySelector('.search-icon-magnifier');
            const clr = clearBtn.querySelector('.search-icon-clear');
            if (val.length > 0) {
                if (mag) mag.classList.add('hidden');
                if (clr) clr.classList.remove('hidden');
            } else {
                if (clr) clr.classList.add('hidden');
                if (mag) mag.classList.remove('hidden');
            }
        }
    }

    function triggerSearchUpdate() {
        if (currentSubTab === 'КАТАЛОГ ССЫЛОК') {
            renderLinksCatalog(cachedManifest, true);
        } else {
            renderModsGrid();
        }
    }

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            updateSearchUI();
            triggerSearchUpdate();
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                searchQuery = '';
                updateSearchUI();
                searchInput.focus();
                triggerSearchUpdate();
            }
        };
    }
}

/**
 * Переключить состояние мода и применить каскадные зависимости
 */
export function toggleModState(modId, isChecked) {
    const mod = allGroupItems.find(m => m.id === modId);
    if (!mod) return;

    mod.checked = isChecked;

    // Синхронизируем состояние чекбокса в DOM без перерисовки всего контейнера
    const grid = dom.get('mods-grid');
    if (grid) {
        const input = grid.querySelector(`input[data-id="${modId}"]`);
        if (input && input.checked !== isChecked) {
            input.checked = isChecked;
        }
    }

    if (isChecked) {
        if (mod.dependsOn) {
            const parent = allGroupItems.find(p => p.id === mod.dependsOn);
            if (parent && !parent.checked) {
                toggleModState(parent.id, true);
            }
        }
    } else {
        const children = allGroupItems.filter(c => c.dependsOn === modId);
        children.forEach(child => {
            if (child.checked) {
                toggleModState(child.id, false);
            }
        });
    }
}

/**
 * Индивидуальные SVG иконки для каждого мода
 */
function getModItemSVG(iconType) {
    switch (iconType) {
        case 'sodium':
            return `<svg class="setting-icon" style="color: #4CAF50;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
        case 'cloud':
            return `<svg class="setting-icon" style="color: #64b5f6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>`;
        case 'eye':
            return `<svg class="setting-icon" style="color: #ba68c8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        case 'map':
            return `<svg class="setting-icon" style="color: #ffb74d;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`;
        case 'gamepad':
            return `<svg class="setting-icon" style="color: #81c784;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="4"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1"/><circle cx="18" cy="13" r="1"/></svg>`;
        case 'swords':
            return `<svg class="setting-icon" style="color: #e57373;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>`;
        case 'block':
            return `<svg class="setting-icon" style="color: #4dd0e1;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
        case 'gear':
        default:
            return `<svg class="setting-icon" style="color: #a1a8b5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;
    }
}

/**
 * Иконки для категории
 */
function getCategoryIconId(catName) {
    switch (catName.toUpperCase()) {
        case 'ОПТИМИЗАЦИЯ': return '#icon-game';
        case 'ГРАФИКА': return '#icon-appearance';
        case 'ИНТЕРФЕЙС': return '#icon-wrench';
        case 'МЕХАНИКИ': return '#icon-folder';
        default: return '#icon-game';
    }
}

/**
 * Отрендерить единую одностраничную таблицу модов (Опциональные моды + Поиск + Полный список)
 */
export function renderModsGrid() {
    const grid = dom.get('mods-grid');
    if (!grid) return;

    const query = searchQuery ? searchQuery.trim().toLowerCase() : '';

    // Фильтруем элементы
    const filteredMods = allGroupItems.filter(item => {
        if (!query) return true;
        return (item.name && item.name.toLowerCase().includes(query)) ||
               (item.shortName && item.shortName.toLowerCase().includes(query)) ||
               (item.description && item.description.toLowerCase().includes(query));
    });

    const groupsMap = {};
    filteredMods.forEach(mod => {
        const cat = mod.subCategory || 'Остальное';
        if (!groupsMap[cat]) groupsMap[cat] = [];
        groupsMap[cat].push(mod);
    });

    const fragment = document.createDocumentFragment();

    // 1. КАРТОЧКА ПОИСКА МОДОВ (Top-Right Card, без лишних кнопок)
    const searchCard = document.createElement('div');
    searchCard.className = 'settings-category search-card-top';
    searchCard.innerHTML = `
        <div class="category-header">
            <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <h4>ПОИСК МОДОВ</h4>
        </div>
        <div class="category-content" style="padding: 12px 14px;">
            <div class="search-input-wrapper" style="width: 100%;">
                <input type="text" id="mods-search-input" value="${searchQuery || ''}" placeholder="Поиск модов..." autocomplete="off">
                <button type="button" id="mods-search-clear-btn" class="search-action-btn" title="Очистить">
                    <svg class="search-icon-magnifier ${searchQuery ? 'hidden' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <svg class="search-icon-clear ${searchQuery ? '' : 'hidden'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
    `;

    // 2. Двухколоночный флекс-контейнер
    const colLeft = document.createElement('div');
    colLeft.className = 'mods-col-left';
    colLeft.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 14px; min-width: 0;';

    const colRight = document.createElement('div');
    colRight.className = 'mods-col-right';
    colRight.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 14px; min-width: 0;';

    // Помещаем Поиск первым в правую колонку
    colRight.appendChild(searchCard);

    // Распределяем категории по колонкам:
    // Левая:  ОПТИМИЗАЦИЯ, ГРАФИКА
    // Правая: ПОИСК МОДОВ, ИНТЕРФЕЙС, МЕХАНИКИ
    Object.keys(groupsMap).forEach(catName => {
        const categoryMods = groupsMap[catName];
        if (categoryMods.length === 0) return;

        const categoryCard = document.createElement('div');
        categoryCard.className = 'settings-category';

        const iconId = getCategoryIconId(catName);
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
            <svg class="category-icon"><use href="${iconId}"/></svg>
            <h4>${catName}</h4>
        `;
        categoryCard.appendChild(header);

        const content = document.createElement('div');
        content.className = 'category-content';

        categoryMods.forEach(mod => {
            const itemLabel = document.createElement('label');
            itemLabel.className = 'setting-item setting-item-toggle';
            itemLabel.dataset.id = mod.id;

            let depNotice = '';
            if (mod.dependsOn) {
                const parent = allGroupItems.find(p => p.id === mod.dependsOn);
                if (parent) {
                    depNotice = ` <strong style="color: #e5c158; font-size: 11px;">(Зависит от ${parent.shortName})</strong>`;
                }
            }

            const iconSvg = getModItemSVG(mod.icon);
            const paths = mod.paths.join('|');

            itemLabel.innerHTML = `
                <div class="setting-label">
                    ${iconSvg}
                    <div class="setting-text">
                        <span class="setting-title">${mod.shortName} <span style="font-size: 11px; color: #888; font-family: monospace;">v${mod.version}</span></span>
                        <span class="setting-desc">${mod.description}${depNotice}</span>
                    </div>
                </div>
                <div class="setting-control">
                    <span class="toggle-switch">
                        <input type="checkbox" data-paths="${paths}" data-id="${mod.id}" ${mod.checked ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </span>
                </div>
            `;

            const checkbox = itemLabel.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                toggleModState(mod.id, e.target.checked);
            });

            content.appendChild(itemLabel);
        });

        categoryCard.appendChild(content);

        const upperCat = catName.toUpperCase();
        if (upperCat === 'ОПТИМИЗАЦИЯ' || upperCat === 'ГРАФИКА') {
            colLeft.appendChild(categoryCard);
        } else {
            colRight.appendChild(categoryCard);
        }
    });

    const topSection = document.createElement('div');
    topSection.className = 'mods-top-section';
    topSection.style.cssText = 'display: flex; gap: 14px; width: 100%; grid-column: 1 / -1;';
    topSection.appendChild(colLeft);
    topSection.appendChild(colRight);
    fragment.appendChild(topSection);

    // 3. НИЖНЯЯ КАРТОЧКА ПОЛНОГО СПИСКА (Full Width Span 2 Columns)
    if (cachedManifest && cachedManifest.files) {
        const fullListCard = document.createElement('div');
        fullListCard.className = 'settings-category full-mods-list-card';
        fullListCard.style.gridColumn = '1 / -1';
        fullListCard.innerHTML = `
            <div class="category-header">
                <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                </svg>
                <h4>ВСЕ МОДЫ И ФАЙЛЫ В СБОРКЕ (ПОЛНЫЙ СПИСОК & ССЫЛКИ)</h4>
            </div>
            <div class="category-content catalog-items-content"></div>
        `;

        const catalogContent = fullListCard.querySelector('.category-content');
        
        // Делегирование ссылок CurseForge / Modrinth
        catalogContent.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-url]');
            if (!btn) return;
            const url = btn.dataset.url;
            if (url && window.api?.openUrl) {
                window.api.openUrl(url);
            } else if (url) {
                window.open(url, '_blank');
            }
        });

        renderLinksCatalogIntoContainer(cachedManifest, catalogContent, query);
        fragment.appendChild(fullListCard);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);

    setupSearchCardEvents();
}

function setupSearchCardEvents() {
    const searchInput = document.getElementById('mods-search-input');
    const clearBtn = document.getElementById('mods-search-clear-btn');
    const enableAllBtn = document.getElementById('btn-enable-all-mods');
    const disableAllBtn = document.getElementById('btn-disable-all-mods');

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderModsGrid();
            const newSearchInput = document.getElementById('mods-search-input');
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
            }
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            searchQuery = '';
            renderModsGrid();
        };
    }

    if (enableAllBtn) {
        enableAllBtn.onclick = () => setAllModsState(true);
    }

    if (disableAllBtn) {
        disableAllBtn.onclick = () => setAllModsState(false);
    }
}

let cachedCatalogData = null;
let lastCatalogManifest = null;
let lastRenderedQuery = null;
let currentRenderedIndex = 0;
let filteredCatalogItems = [];
const BATCH_SIZE = 25;

function appendCatalogBatch(contentContainer) {
    if (currentRenderedIndex >= filteredCatalogItems.length) return;

    const nextIndex = Math.min(currentRenderedIndex + BATCH_SIZE, filteredCatalogItems.length);
    const fragment = document.createDocumentFragment();

    for (let i = currentRenderedIndex; i < nextIndex; i++) {
        const item = filteredCatalogItems[i];
        const row = document.createElement('div');
        row.className = 'setting-item';
        row.innerHTML = `
            <div class="setting-label">
                <svg class="setting-icon"><use href="#icon-game"/></svg>
                <div class="setting-text">
                    <span class="setting-title">${item.cleanName} <span style="font-size: 11px; color: ${item.isOptional ? '#81c784' : '#64b5f6'};">(${item.isOptional ? 'Опциональный' : 'Базовый'})</span></span>
                    <span class="setting-desc" style="font-family: monospace;">${item.fileName}</span>
                </div>
            </div>
            <div class="setting-control">
                <button type="button" class="unified-btn unified-btn-warning" data-url="${item.curseUrl}">🔥 CurseForge ↗</button>
                <button type="button" class="unified-btn unified-btn-primary" data-url="${item.modrinthUrl}">⚡ Modrinth ↗</button>
            </div>
        `;
        fragment.appendChild(row);
    }

    currentRenderedIndex = nextIndex;
    contentContainer.appendChild(fragment);

    if (currentRenderedIndex < filteredCatalogItems.length) {
        requestAnimationFrame(() => {
            appendCatalogBatch(contentContainer);
        });
    }
}

function renderLinksCatalogIntoContainer(manifest, contentContainer, query = '') {
    if (!manifest || !manifest.files || !contentContainer) return;

    if (!cachedCatalogData || lastCatalogManifest !== manifest) {
        lastCatalogManifest = manifest;
        const jarFiles = manifest.files.filter(f => f.path.startsWith('mods/') && f.path.endsWith('.jar'));

        cachedCatalogData = jarFiles.map(file => {
            const fileName = file.path.split('/').pop();
            let cleanName = fileName
                .replace(/\.jar$/i, '')
                .replace(/^client[-_]/i, '')
                .replace(/[-_](neoforge|forge|fabric|mc|\d+\.\d+).*/i, '')
                .replace(/[-_]\d+.*$/i, '');
            cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

            const groupMatch = MOD_GROUPS.find(g => 
                g.files && g.files.some(p => fileName.toLowerCase().includes(p.toLowerCase()))
            );

            const downloadUrl = file.url || `https://gcrlauncher1.loca.lt/files/${file.path.replace(/^\/+/, '')}`;

            const curseUrl = groupMatch?.curseSlug 
                ? `https://www.curseforge.com/minecraft/mc-mods/${groupMatch.curseSlug}`
                : `https://www.curseforge.com/minecraft/search?search=${encodeURIComponent(groupMatch ? groupMatch.name : cleanName)}`;

            const modrinthUrl = groupMatch?.modrinthSlug 
                ? `https://modrinth.com/mod/${groupMatch.modrinthSlug}`
                : `https://modrinth.com/mods?q=${encodeURIComponent(groupMatch ? groupMatch.name : cleanName)}`;

            return {
                fileName,
                cleanName: groupMatch ? groupMatch.name : cleanName,
                isOptional: !!groupMatch,
                downloadUrl,
                curseUrl,
                modrinthUrl
            };
        });
    }

    filteredCatalogItems = cachedCatalogData.filter(item => {
        if (!query) return true;
        return item.cleanName.toLowerCase().includes(query) || item.fileName.toLowerCase().includes(query);
    });

    if (filteredCatalogItems.length === 0) {
        contentContainer.innerHTML = '<div class="unified-empty"><div class="unified-empty-text">Моды не найдены</div></div>';
        return;
    }

    contentContainer.innerHTML = '';
    currentRenderedIndex = 0;
    appendCatalogBatch(contentContainer);
}

export function renderLinksCatalog(manifest) {
    if (manifest) cachedManifest = manifest;
    renderModsGrid();
}

/**
 * Получить список отключённых модов
 */
export function getDisabledMods() {
    const disabled = [];
    allGroupItems.forEach(item => {
        if (!item.checked) {
            item.paths.forEach(p => disabled.push(p));
        }
    });
    return disabled;
}

/**
 * Включить или отключить все моды
 */
export function setAllModsState(isChecked) {
    allGroupItems.forEach(item => {
        item.checked = isChecked;
    });
    const grid = dom.get('mods-grid');
    if (grid) {
        grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = isChecked;
        });
    }
}

export function updateModsCounter() {}
export function updateCategorySidebar() {}
export function updateSidebarStats() {}

export function initModsListeners(onChangeCallback) {
    const grid = dom.get('mods-grid');
    if (!grid) return;

    grid.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            if (onChangeCallback) onChangeCallback();
        }
    });
}
