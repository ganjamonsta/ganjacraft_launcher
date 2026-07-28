/**
 * GanjaCraft Launcher - Preset Mod Configs & Interactive Editor Component
 * Каждый файл конфигурации — отдельная независимая карточка в сетке.
 * Поисковая строка зафиксирована вверху, ввод происходит без потери фокуса.
 */

import { dom } from '../../utils/dom.js';

let cachedConfigCards = [];
let searchQuery = '';
let activeExpandedCardId = null;

const DEFAULT_PRESET_CONFIGS = [
    {
        id: 'sodium_extra_options',
        name: 'Sodium Extra Options',
        description: 'sodium-extra-options.json',
        filePath: 'sodium-extra-options.json',
        downloadUrl: 'https://gcrlauncher1.loca.lt/files/config/sodium-options.json'
    },
    {
        id: 'reeses_options',
        name: 'Reese\'s Options',
        description: 'reeses-options.json',
        filePath: 'reeses-options.json',
        downloadUrl: 'https://gcrlauncher1.loca.lt/files/config/reeses-options.json'
    },
    {
        id: 'etf_textures',
        name: 'Entity Texture Features',
        description: 'entity_texture_features.json',
        filePath: 'entity_texture_features.json',
        downloadUrl: 'https://gcrlauncher1.loca.lt/files/config/entity_texture_features.json'
    },
    {
        id: 'forgematica',
        name: 'Forgematica & Printer',
        description: 'forgematica.json',
        filePath: 'forgematica.json',
        downloadUrl: 'https://gcrlauncher1.loca.lt/files/config/forgematica.json'
    }
];

function getModTitleFromPath(filePath) {
    if (!filePath) return 'Мод';
    const fileName = filePath.split('/').pop().split('\\').pop();
    let cleanName = fileName.replace(/\.(json|toml|properties|cfg|json5|snbt|txt|conf)$/i, '');
    
    let suffix = '';
    if (/[-_]client$/i.test(cleanName)) suffix = ' (Client)';
    else if (/[-_]server$/i.test(cleanName)) suffix = ' (Server)';
    else if (/[-_]common$/i.test(cleanName)) suffix = ' (Common)';

    cleanName = cleanName
        .replace(/[-_](client|server|common)$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    return (cleanName.trim() || 'Мод') + suffix;
}

export async function renderModConfigEditor(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="preset-configs-wrapper" style="display: flex; flex-direction: column; gap: 14px; width: 100%; height: 100%;">
            <!-- Зафиксированная поисковая панель -->
            <div class="settings-category" style="margin-bottom: 0; border: 1px solid rgba(255, 255, 255, 0.08);">
                <div class="category-content" style="padding: 10px 12px;">
                    <div class="search-input-wrapper" style="width: 100%;">
                        <input type="text" id="preset-search-input" value="${escapeHtml(searchQuery)}" placeholder="Поиск среди всех конфигов (название мода, имя файла)..." autocomplete="off">
                        <button type="button" id="preset-search-clear-btn" class="search-action-btn" title="Очистить">
                            <svg class="search-icon-magnifier ${searchQuery ? 'hidden' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <svg class="search-icon-clear ${searchQuery ? '' : 'hidden'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Сетка карточек -->
            <div id="preset-configs-grid" class="settings-categories inertia-cascade" style="flex: 1; overflow-y: auto;">
                <div class="unified-loading"><span class="unified-spinner"></span>Загрузка конфигураций...</div>
            </div>
        </div>
    `;

    setupSearchEvents(container);
    await loadAndRenderPresetCards(container);
}

async function loadAndRenderPresetCards(container) {
    const grid = container.querySelector('#preset-configs-grid');
    if (!grid) return;

    try {
        let manifestConfigs = [];
        try {
            const manifestRes = await window.api.getManifest();
            if (manifestRes && Array.isArray(manifestRes.configs) && manifestRes.configs.length > 0) {
                manifestConfigs = manifestRes.configs;
            }
        } catch (e) {
            console.warn('[CONFIGS] Manifest fetch failed:', e.message);
        }

        let localFiles = [];
        try {
            const localRes = await window.api.listModConfigs();
            if (localRes && localRes.success && Array.isArray(localRes.files)) {
                localFiles = localRes.files;
            }
        } catch (e) {
            console.warn('[CONFIGS] Local scan failed:', e.message);
        }

        const cardsMap = new Map();

        // 1. Пресеты манифеста
        if (manifestConfigs.length > 0) {
            manifestConfigs.forEach(m => {
                const relPath = (m.file_path || m.filePath || '').replace(/^config\//, '');
                if (relPath) {
                    const fileName = relPath.split('/').pop().split('\\').pop();
                    cardsMap.set(relPath.toLowerCase(), {
                        id: relPath.replace(/[^a-zA-Z0-9_-]/g, '_'),
                        name: m.name || getModTitleFromPath(relPath),
                        description: fileName,
                        filePath: relPath,
                        downloadUrl: m.download_url || m.downloadUrl
                    });
                }
            });
        }

        // 2. Все локальные файлы
        localFiles.forEach(file => {
            const key = file.relativePath.toLowerCase();
            if (!cardsMap.has(key)) {
                cardsMap.set(key, {
                    id: file.relativePath.replace(/[^a-zA-Z0-9_-]/g, '_'),
                    name: getModTitleFromPath(file.relativePath),
                    description: file.name,
                    filePath: file.relativePath,
                    downloadUrl: `https://gcrlauncher1.loca.lt/files/config/${file.relativePath}`
                });
            }
        });

        if (cardsMap.size === 0) {
            DEFAULT_PRESET_CONFIGS.forEach(p => cardsMap.set(p.filePath.toLowerCase(), p));
        }

        cachedConfigCards = Array.from(cardsMap.values());
        renderCardsGrid(grid);
    } catch (e) {
        console.error('Error loading mod configs:', e);
        grid.innerHTML = `<div class="settings-category" style="color: #ff5252;">Ошибка загрузки конфигураций: ${e.message}</div>`;
    }
}

function renderCardsGrid(grid) {
    const query = searchQuery.toLowerCase().trim();
    const filtered = cachedConfigCards.filter(c => {
        if (!query) return true;
        const nameMatch = c.name && c.name.toLowerCase().includes(query);
        const descMatch = c.description && c.description.toLowerCase().includes(query);
        const fileMatch = c.filePath && c.filePath.toLowerCase().includes(query);
        return nameMatch || descMatch || fileMatch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="settings-category" style="text-align: center; padding: 24px; color: #888;">
                <h4>Конфигурации не найдены${query ? ` по запросу "${escapeHtml(searchQuery)}"` : ''}</h4>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    const colLeft = document.createElement('div');
    colLeft.className = 'mods-col-left';
    colLeft.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0;';

    const colRight = document.createElement('div');
    colRight.className = 'mods-col-right';
    colRight.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0;';

    filtered.forEach((cardItem, index) => {
        const itemCard = document.createElement('div');
        itemCard.className = `settings-category config-mod-card ${activeExpandedCardId === cardItem.id ? 'active-expanded' : ''}`;
        itemCard.style.cssText = `margin-bottom: 0; transition: all 0.2s ease; cursor: pointer; border: 1px solid ${activeExpandedCardId === cardItem.id ? '#39ff14' : 'rgba(255,255,255,0.08)'};`;
        itemCard.dataset.cardId = cardItem.id;

        const isExpanded = activeExpandedCardId === cardItem.id;

        itemCard.innerHTML = `
            <div class="setting-item card-header-clickable" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; gap: 10px; min-width: 0; border-bottom: ${isExpanded ? '1px solid rgba(255,255,255,0.08)' : 'none'};">
                <div class="setting-label" style="flex: 1; min-width: 0; display: flex; gap: 10px; align-items: center;">
                    <svg class="setting-icon" style="flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    <div class="setting-text" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                        <span class="setting-title" style="font-size: 13px; font-weight: 600; line-height: 1.2; word-break: break-word;">${escapeHtml(cardItem.name)}</span>
                        <span class="setting-desc" style="font-size: 11px; color: #888; line-height: 1.3; font-family: monospace; word-break: break-all;">${escapeHtml(cardItem.description)}</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <span class="expand-indicator" style="font-size: 11px; color: ${isExpanded ? '#39ff14' : '#888'}; font-weight: bold; padding: 2px 6px;">
                        ${isExpanded ? '▲' : '▼'}
                    </span>
                </div>
            </div>
            <div class="inline-editor-drawer ${isExpanded ? '' : 'hidden'}" style="padding: 12px; background: rgba(12, 14, 18, 0.6); border-radius: 0 0 var(--gc-radius-md) var(--gc-radius-md);">
                <div class="drawer-content-placeholder">
                    ${isExpanded ? '<div class="unified-loading"><span class="unified-spinner"></span>Загрузка параметров...</div>' : ''}
                </div>
            </div>
        `;

        const clickableHeader = itemCard.querySelector('.card-header-clickable');

        const toggleExpand = async (e) => {
            if (e.target.closest('.inline-editor-drawer')) return;

            if (activeExpandedCardId === cardItem.id) {
                activeExpandedCardId = null;
            } else {
                activeExpandedCardId = cardItem.id;
            }
            renderCardsGrid(grid);
            if (activeExpandedCardId === cardItem.id) {
                const updatedCard = grid.querySelector(`[data-card-id="${cardItem.id}"]`);
                if (updatedCard) {
                    const drawer = updatedCard.querySelector('.drawer-content-placeholder');
                    await loadAndRenderSingleFileParamsEditor(cardItem, drawer);
                }
            }
        };

        clickableHeader.addEventListener('click', toggleExpand);

        if (index % 2 === 0) {
            colLeft.appendChild(itemCard);
        } else {
            colRight.appendChild(itemCard);
        }
    });

    const topSection = document.createElement('div');
    topSection.className = 'mods-top-section';
    topSection.style.cssText = 'display: flex; gap: 14px; width: 100%; grid-column: 1 / -1;';
    topSection.appendChild(colLeft);
    topSection.appendChild(colRight);

    fragment.appendChild(topSection);

    grid.innerHTML = '';
    grid.appendChild(fragment);
}

/**
 * Редактирование конкретного файла конфигурации
 */
async function loadAndRenderSingleFileParamsEditor(cardItem, drawerContainer) {
    if (!drawerContainer) return;

    drawerContainer.innerHTML = '<div class="unified-loading"><span class="unified-spinner"></span>Загрузка параметров...</div>';

    try {
        const res = await window.api.readModConfig(cardItem.filePath);
        if (!res.success) {
            drawerContainer.innerHTML = `<div style="color: #ff5252; font-size: 11px;">Не удалось прочитать файл (${escapeHtml(cardItem.filePath)}): ${escapeHtml(res.error)}. Запустите игру для создания файла.</div>`;
            return;
        }

        const data = res.data;

        const categoriesMap = {};
        data.items.forEach(item => {
            const cat = item.category || 'Общие';
            if (!categoriesMap[cat]) categoriesMap[cat] = [];
            categoriesMap[cat].push(item);
        });

        let paramsFormHtml = '';
        Object.keys(categoriesMap).forEach(catName => {
            paramsFormHtml += `
                <div class="param-category-block" style="margin-bottom: 12px; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
                    <div style="font-size: 11px; font-weight: 700; color: #39ff14; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
                        📌 ${escapeHtml(catName)}
                    </div>
                    <div class="param-items-list" style="display: flex; flex-direction: column; gap: 8px;">
                        ${categoriesMap[catName].map(item => {
                            let control = '';
                            if (item.type === 'boolean') {
                                control = `
                                    <span class="toggle-switch" style="transform: scale(0.85);">
                                        <input type="checkbox" data-line-number="${item.lineNumber}" data-param-type="boolean" ${item.value ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </span>
                                `;
                            } else if (item.type === 'number') {
                                control = `
                                    <input type="number" class="unified-input param-input" data-line-number="${item.lineNumber}" data-param-type="number" value="${item.value}" style="width: 90px; height: 26px; padding: 2px 6px; font-size: 11px; font-family: monospace;">
                                `;
                            } else {
                                control = `
                                    <input type="text" class="unified-input param-input" data-line-number="${item.lineNumber}" data-param-type="string" value="${escapeHtml(String(item.value))}" style="width: 140px; height: 26px; padding: 2px 6px; font-size: 11px; font-family: monospace;">
                                `;
                            }

                            const descText = item.description ? `<span style="font-size: 10px; color: #888; line-height: 1.2;">${escapeHtml(item.description)}</span>` : '';

                            return `
                                <div class="param-row" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.04);">
                                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                                        <span style="font-family: monospace; font-size: 11px; font-weight: 600; color: #d0d8e4; word-break: break-all;">${escapeHtml(item.key)}</span>
                                        ${descText}
                                    </div>
                                    <div style="flex-shrink: 0;">
                                        ${control}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        drawerContainer.innerHTML = `
            <div class="editor-inner-wrapper" style="display: flex; flex-direction: column; gap: 8px;" onclick="event.stopPropagation();">
                <div class="params-container" style="max-height: 300px; overflow-y: auto; overflow-y: overlay; padding-right: 4px;">
                    ${paramsFormHtml || '<div style="color: #888; font-size: 11px;">Нет параметров</div>'}
                </div>
                <div class="editor-action-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
                    <button type="button" class="unified-btn unified-btn-danger btn-reset-file" style="padding: 3px 8px; font-size: 10.5px; height: 26px;">
                        🗑 Сбросить файл
                    </button>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="save-status-msg" style="font-size: 10.5px; color: #39ff14; display: none;">✓ Сохранено</span>
                        <button type="button" class="unified-btn unified-btn-primary btn-save-params" style="padding: 3px 12px; font-size: 11px; height: 26px;">
                            💾 Сохранить изменения
                        </button>
                    </div>
                </div>
            </div>
        `;

        const saveBtn = drawerContainer.querySelector('.btn-save-params');
        const resetFileBtn = drawerContainer.querySelector('.btn-reset-file');
        const statusMsg = drawerContainer.querySelector('.save-status-msg');

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                saveBtn.disabled = true;
                try {
                    const updatedItems = [];
                    data.items.forEach(item => {
                        const boolInput = drawerContainer.querySelector(`input[data-line-number="${item.lineNumber}"][data-param-type="boolean"]`);
                        const numInput = drawerContainer.querySelector(`input[data-line-number="${item.lineNumber}"][data-param-type="number"]`);
                        const strInput = drawerContainer.querySelector(`input[data-line-number="${item.lineNumber}"][data-param-type="string"]`);

                        let val = item.value;
                        if (boolInput) {
                            val = boolInput.checked;
                        } else if (numInput) {
                            val = Number(numInput.value);
                        } else if (strInput) {
                            val = strInput.value;
                        }

                        updatedItems.push({
                            ...item,
                            value: val
                        });
                    });

                    const updateRes = await window.api.updateModConfigValues(cardItem.filePath, updatedItems);
                    if (updateRes.success) {
                        if (statusMsg) {
                            statusMsg.style.display = 'inline';
                            setTimeout(() => { statusMsg.style.display = 'none'; }, 2500);
                        }
                    } else {
                        alert('Ошибка сохранения: ' + updateRes.error);
                    }
                } catch (err) {
                    console.error('Error saving updated parameters:', err);
                    alert('Ошибка записи параметров: ' + err.message);
                } finally {
                    saveBtn.disabled = false;
                }
            });
        }

        if (resetFileBtn) {
            resetFileBtn.addEventListener('click', async () => {
                if (confirm(`Сбросить файл ${cardItem.filePath.split('/').pop()} к стандартным настройкам?`)) {
                    await window.api.deleteModConfig(cardItem.filePath);
                    if (cardItem.downloadUrl) {
                        try {
                            await window.api.downloadPresetConfig(cardItem.downloadUrl, cardItem.filePath);
                        } catch (e) {
                            console.warn('Download fallback skipped:', e.message);
                        }
                    }
                    await loadAndRenderSingleFileParamsEditor(cardItem, drawerContainer);
                }
            });
        }
    } catch (e) {
        console.error('Error rendering params editor:', e);
        drawerContainer.innerHTML = `<div style="color: #ff5252; font-size: 11px;">Ошибка инициализации редактора: ${escapeHtml(e.message)}</div>`;
    }
}

function setupSearchEvents(container) {
    const input = container.querySelector('#preset-search-input');
    const clearBtn = container.querySelector('#preset-search-clear-btn');
    const grid = container.querySelector('#preset-configs-grid');

    if (input) {
        input.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            const magIcon = clearBtn ? clearBtn.querySelector('.search-icon-magnifier') : null;
            const clearIcon = clearBtn ? clearBtn.querySelector('.search-icon-clear') : null;
            if (magIcon && clearIcon) {
                if (searchQuery) {
                    magIcon.classList.add('hidden');
                    clearIcon.classList.remove('hidden');
                } else {
                    magIcon.classList.remove('hidden');
                    clearIcon.classList.add('hidden');
                }
            }
            if (grid) renderCardsGrid(grid);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (input) {
                input.value = '';
                searchQuery = '';
                const magIcon = clearBtn.querySelector('.search-icon-magnifier');
                const clearIcon = clearBtn.querySelector('.search-icon-clear');
                if (magIcon && clearIcon) {
                    magIcon.classList.remove('hidden');
                    clearIcon.classList.add('hidden');
                }
                if (grid) renderCardsGrid(grid);
            }
        });
    }
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
