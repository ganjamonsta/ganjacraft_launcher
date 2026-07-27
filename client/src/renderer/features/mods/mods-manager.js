/**
 * GanjaCraft Launcher - Mods Manager (Native Launcher UI)
 * Управление модами с использованием стандартных категорий и переключателей лаунчера
 */

import { dom } from '../../utils/dom.js';
import { MOD_GROUPS, SUB_CATEGORIES } from './mod-groups.js';

let cachedManifest = null;
let currentSubTab = 'ВСЕ';
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
export async function loadModsList(disabledMods = [], config = {}) {
    const gridContainer = dom.get('mods-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '<div class="unified-loading"><span class="unified-spinner"></span>Загрузка модов...</div>';

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
}

/**
 * Инициализация подвкладок
 */
function setupSubtabsListeners() {
    const subtabsContainer = dom.get('mods-subtabs');
    if (!subtabsContainer) return;

    subtabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.unified-btn');
        if (!btn) return;

        const subtab = btn.dataset.subtab;
        if (!subtab) return;

        currentSubTab = subtab;

        subtabsContainer.querySelectorAll('.unified-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const gridView = dom.get('mods-grid-container');
        const catalogView = dom.get('mods-catalog-container');

        if (subtab === 'КАТАЛОГ ССЫЛОК') {
            if (gridView) gridView.classList.add('hidden');
            if (catalogView) {
                catalogView.classList.remove('hidden');
                catalogView.classList.remove('subtab-fade-animate');
                void catalogView.offsetWidth;
                catalogView.classList.add('subtab-fade-animate');
                renderLinksCatalog(cachedManifest);
            }
        } else {
            if (catalogView) catalogView.classList.add('hidden');
            if (gridView) {
                gridView.classList.remove('hidden');
                gridView.classList.remove('subtab-fade-animate');
                void gridView.offsetWidth;
                gridView.classList.add('subtab-fade-animate');
            }
            renderModsGrid();
        }
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

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            updateSearchUI();
            if (currentSubTab === 'КАТАЛОГ ССЫЛОК') {
                renderLinksCatalog(cachedManifest);
            } else {
                renderModsGrid();
            }
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                searchQuery = '';
                updateSearchUI();
                searchInput.focus();
                if (currentSubTab === 'КАТАЛОГ ССЫЛОК') {
                    renderLinksCatalog(cachedManifest);
                } else {
                    renderModsGrid();
                }
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
 * Отрендерить сетку модов в стиле стандартных категорий настроек
 */
export function renderModsGrid() {
    const grid = dom.get('mods-grid');
    if (!grid) return;

    // Фильтруем моды по выбранной подвкладке и строке поиска
    const items = allGroupItems.filter(item => {
        const matchesSubtab = currentSubTab === 'ВСЕ' || item.subCategory.toUpperCase() === currentSubTab.toUpperCase();
        if (!matchesSubtab) return false;
        if (!searchQuery) return true;
        return (item.name && item.name.toLowerCase().includes(searchQuery)) ||
               (item.shortName && item.shortName.toLowerCase().includes(searchQuery)) ||
               (item.description && item.description.toLowerCase().includes(searchQuery)) ||
               (item.paths && item.paths.some(p => p.toLowerCase().includes(searchQuery)));
    });

    if (items.length === 0) {
        grid.innerHTML = '<div class="unified-empty"><div class="unified-empty-text">В данной категории нет модов</div></div>';
        return;
    }

    // Группируем элементы по категориям
    const groupsMap = {};
    items.forEach(mod => {
        const cat = mod.subCategory || 'Остальное';
        if (!groupsMap[cat]) groupsMap[cat] = [];
        groupsMap[cat].push(mod);
    });

    const fragment = document.createDocumentFragment();

    Object.keys(groupsMap).forEach((catName, index) => {
        const categoryMods = groupsMap[catName];
        if (categoryMods.length === 0) return;

        const categoryCard = document.createElement('div');
        categoryCard.className = 'settings-category settings-category-animate';
        categoryCard.style.animationDelay = `${index * 0.05}s`;

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
        fragment.appendChild(categoryCard);
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
}

let cachedCatalogData = null;
let lastCatalogManifest = null;
let catalogObserver = null;
let currentRenderedIndex = 0;
let filteredCatalogItems = [];
const BATCH_SIZE = 15;

/**
 * Отрендерить Каталог ссылок на моды (CurseForge & Modrinth) с ленивой подгрузкой (Lazy Loading)
 */
export function renderLinksCatalog(manifest) {
    const list = dom.get('catalog-list');
    if (!list) return;

    if (!manifest || !manifest.files) {
        list.innerHTML = '<div class="unified-empty"><div class="unified-empty-text">Список файлов пуст</div></div>';
        return;
    }

    // Кешируем распарсенный массив данных каталога, чтобы не делать тяжелую регулярку и поиск при каждом переключении
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

            const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

            const groupMatch = MOD_GROUPS.find(g => 
                g.files.some(p => fileName.toLowerCase().includes(p.toLowerCase()))
            );

            const curseSlug = groupMatch?.curseSlug || slug;
            const modrinthSlug = groupMatch?.modrinthSlug || slug;
            const isOptional = file.optional;

            return {
                fileName,
                cleanName: groupMatch ? groupMatch.name : cleanName,
                category: groupMatch ? groupMatch.category : (isOptional ? 'Опциональный' : 'Базовый'),
                isOptional,
                curseUrl: `https://www.curseforge.com/minecraft/mc-mods/${curseSlug}`,
                modrinthUrl: `https://modrinth.com/mod/${modrinthSlug}`
            };
        });
    }

    // Фильтрация по поисковому запросу
    const query = searchQuery.toLowerCase();
    filteredCatalogItems = cachedCatalogData.filter(item => 
        item.cleanName.toLowerCase().includes(query) ||
        item.fileName.toLowerCase().includes(query)
    );

    if (filteredCatalogItems.length === 0) {
        if (catalogObserver) {
            catalogObserver.disconnect();
            catalogObserver = null;
        }
        list.innerHTML = '<div class="unified-empty"><div class="unified-empty-text">Моды не найдены</div></div>';
        return;
    }

    // Сброс и создание карточки контейнера
    list.innerHTML = '';
    currentRenderedIndex = 0;

    const card = document.createElement('div');
    card.className = 'settings-category';
    card.style.gridColumn = '1 / -1';

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
        <svg class="category-icon"><use href="#icon-folder-open"/></svg>
        <h4>Каталог ссылок на моды сборки (${filteredCatalogItems.length})</h4>
    `;
    card.appendChild(header);

    const content = document.createElement('div');
    content.className = 'category-content';
    card.appendChild(content);

    const sentinel = document.createElement('div');
    sentinel.className = 'catalog-sentinel';
    sentinel.style.height = '10px';
    sentinel.style.width = '100%';

    card.appendChild(sentinel);
    list.appendChild(card);

    function renderBatch() {
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
                    <button class="unified-btn unified-btn-warning" data-url="${item.curseUrl}">🔥 CurseForge ↗</button>
                    <button class="unified-btn unified-btn-primary" data-url="${item.modrinthUrl}">⚡ Modrinth ↗</button>
                </div>
            `;

            row.querySelectorAll('button').forEach(btn => {
                btn.onclick = () => {
                    const url = btn.dataset.url;
                    if (url && window.api?.openUrl) {
                        window.api.openUrl(url);
                    } else if (url) {
                        window.open(url, '_blank');
                    }
                };
            });

            fragment.appendChild(row);
        }

        content.appendChild(fragment);
        currentRenderedIndex = nextIndex;
    }

    // Первоначальная порция (мгновенный отклик без фриза)
    renderBatch();

    // Отключаем предыдущий observer при перерисовке
    if (catalogObserver) {
        catalogObserver.disconnect();
        catalogObserver = null;
    }

    // Автоматическая дозагрузка при скролле до sentinel
    const scrollContainer = list;
    catalogObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && currentRenderedIndex < filteredCatalogItems.length) {
            renderBatch();
        }
    }, {
        root: scrollContainer,
        rootMargin: '300px'
    });

    catalogObserver.observe(sentinel);
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
