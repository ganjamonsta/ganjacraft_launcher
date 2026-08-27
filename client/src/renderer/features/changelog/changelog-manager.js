/**
 * GanjaCraft Launcher - Pack Changelog Feature
 * Управление историей изменений сборки, поиском, фильтрами и бейджами
 */

import { dom } from '../../utils/dom.js';

const STORAGE_KEY_SEEN = 'ganja_last_seen_changelog_id';

let cachedHistory = [];
let isInitialized = false;
let currentFilter = 'all';
let currentSearchQuery = '';

/**
 * Загрузить историю изменений манифеста и обновить бейдж и список
 */
export async function loadChangelogHistory() {
    try {
        if (!window.api || !window.api.getManifestHistory) return;
        const result = await window.api.getManifestHistory();
        if (result && result.success && Array.isArray(result.history)) {
            cachedHistory = result.history;
            updateChangelogTotalCount();
            checkChangelogBadge();
            renderChangelogList();
        } else {
            renderEmptyState('Не удалось загрузить историю с сервера');
        }
    } catch (e) {
        console.warn('[Changelog] Failed to load manifest history:', e);
        renderEmptyState('Ошибка подключения к серверу');
    }
}

/**
 * Обновить счётчик общего числа зафиксированных обновлений
 */
function updateChangelogTotalCount() {
    const countEl = dom.get('changelog-total-count');
    if (!countEl) return;
    const total = cachedHistory.length;
    if (total === 0) {
        countEl.textContent = 'Нет записей';
    } else if (total === 1) {
        countEl.textContent = '1 обновление';
    } else if (total > 1 && total < 5) {
        countEl.textContent = `${total} обновления`;
    } else {
        countEl.textContent = `${total} обновлений`;
    }
}

/**
 * Проверить актуальность последнего обновления и переключить бейджи
 */
export function checkChangelogBadge() {
    const settingsBadge = dom.get('settings-badge');
    const tabBadge = dom.get('changelog-tab-badge');

    if (!cachedHistory || cachedHistory.length === 0) {
        if (settingsBadge) settingsBadge.classList.add('hidden');
        if (tabBadge) tabBadge.classList.add('hidden');
        return;
    }

    const latest = cachedHistory[0];
    const latestId = latest.id || String(latest.timestamp || '');
    const seenId = localStorage.getItem(STORAGE_KEY_SEEN);

    const hasUnseen = latestId && seenId !== latestId;

    if (settingsBadge) {
        if (hasUnseen) settingsBadge.classList.remove('hidden');
        else settingsBadge.classList.add('hidden');
    }

    if (tabBadge) {
        if (hasUnseen) tabBadge.classList.remove('hidden');
        else tabBadge.classList.add('hidden');
    }
}

/**
 * Отметить текущие обновления как просмотренные (гасит бейджи)
 */
export function markChangelogSeen() {
    if (cachedHistory && cachedHistory.length > 0) {
        const latest = cachedHistory[0];
        const latestId = latest.id || String(latest.timestamp || '');
        if (latestId) {
            localStorage.setItem(STORAGE_KEY_SEEN, latestId);
        }
    }
    const settingsBadge = dom.get('settings-badge');
    if (settingsBadge) settingsBadge.classList.add('hidden');

    const tabBadge = dom.get('changelog-tab-badge');
    if (tabBadge) tabBadge.classList.add('hidden');
}

/**
 * Рендер карточек истории обновлений
 */
export function renderChangelogList() {
    const container = dom.get('changelog-list');
    if (!container) return;

    if (!cachedHistory || cachedHistory.length === 0) {
        renderEmptyState();
        return;
    }

    const query = currentSearchQuery.trim().toLowerCase();
    const filter = currentFilter;

    // Фильтрация истории
    const filteredHistory = cachedHistory.map((item, index) => {
        const summary = item.summary || {};
        let added = summary.mods_added || [];
        let updated = summary.mods_updated || [];
        let removed = summary.mods_removed || [];
        const configs = summary.configs_count || 0;
        const scripts = summary.scripts_count || 0;
        const packs = summary.resourcepacks_count || 0;

        // Фильтр по типам
        if (filter === 'added') {
            updated = [];
            removed = [];
            if (added.length === 0) return null;
        } else if (filter === 'updated') {
            added = [];
            removed = [];
            if (updated.length === 0) return null;
        } else if (filter === 'configs') {
            added = [];
            updated = [];
            removed = [];
            if (configs === 0 && scripts === 0 && packs === 0) return null;
        }

        // Поиск по тексту
        if (query) {
            const matchInAdded = added.filter(m => String(m).toLowerCase().includes(query));
            const matchInUpdated = updated.filter(u => {
                if (typeof u === 'string') return u.toLowerCase().includes(query);
                return (u.old && u.old.toLowerCase().includes(query)) ||
                       (u.new && u.new.toLowerCase().includes(query)) ||
                       (u.name && u.name.toLowerCase().includes(query));
            });
            const matchInRemoved = removed.filter(m => String(m).toLowerCase().includes(query));

            const matchInDate = item.date && item.date.toLowerCase().includes(query);
            const matchInVer = item.launcher_version && item.launcher_version.toLowerCase().includes(query);
            const matchInMisc = (configs > 0 && 'конфиг'.includes(query)) ||
                                (scripts > 0 && 'скрипт kubejs'.includes(query)) ||
                                (packs > 0 && 'ресурспак'.includes(query));

            const hasItemMatch = matchInAdded.length > 0 || matchInUpdated.length > 0 || matchInRemoved.length > 0;

            if (!hasItemMatch && !matchInDate && !matchInVer && !matchInMisc) {
                return null;
            }

            // Оставляем только совпавшие моды если был конкретный поиск
            if (hasItemMatch) {
                added = matchInAdded;
                updated = matchInUpdated;
                removed = matchInRemoved;
            }
        }

        return {
            ...item,
            _isLatest: index === 0 && !query && filter === 'all',
            _filteredAdded: added,
            _filteredUpdated: updated,
            _filteredRemoved: removed,
            _configs: configs,
            _scripts: scripts,
            _packs: packs
        };
    }).filter(Boolean);

    if (filteredHistory.length === 0) {
        renderEmptyState(query ? `По запросу «${escapeHtml(query)}» ничего не найдено` : 'Нет записей в выбранной категории');
        return;
    }

    container.innerHTML = '';

    filteredHistory.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'settings-category changelog-release-card';

        const summary = item.summary || {};
        const dateStr = item.date || (item.timestamp ? new Date(item.timestamp * 1000).toLocaleString('ru-RU') : 'Недавно');
        const versionStr = item.launcher_version ? `v${item.launcher_version}` : '';

        const added = item._filteredAdded;
        const updated = item._filteredUpdated;
        const removed = item._filteredRemoved;
        const configs = item._configs;
        const scripts = item._scripts;
        const packs = item._packs;

        // Pills для заголовка
        const summaryPills = [];
        if (added.length > 0) summaryPills.push(`<span class="changelog-pill pill-add">+${added.length}</span>`);
        if (updated.length > 0) summaryPills.push(`<span class="changelog-pill pill-update">🔄 ${updated.length}</span>`);
        if (removed.length > 0) summaryPills.push(`<span class="changelog-pill pill-remove">-${removed.length}</span>`);
        if (configs > 0) summaryPills.push(`<span class="changelog-pill pill-misc">⚙️ ${configs}</span>`);
        if (scripts > 0) summaryPills.push(`<span class="changelog-pill pill-misc">📜 ${scripts}</span>`);

        const headerHtml = `
            <div class="category-header changelog-release-header">
                <div class="changelog-header-left">
                    <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <h4>${escapeHtml(dateStr)}</h4>
                    ${item._isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
                    ${versionStr ? `<span class="changelog-badge-ver">${escapeHtml(versionStr)}</span>` : ''}
                </div>
                <div class="changelog-header-pills">
                    ${summaryPills.join('')}
                </div>
            </div>
        `;

        let groupsHtml = '<div class="category-content changelog-card-content">';

        // 1. Добавленные моды
        if (added.length > 0) {
            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-label group-label-add">
                        <span class="group-dot"></span>
                        <span>Добавлено (${added.length})</span>
                    </div>
                    <div class="changelog-chips-wrap">
                        ${added.map(m => `<span class="changelog-chip chip-add" title="${escapeHtml(m)}"><span class="chip-sign">+</span> ${escapeHtml(cleanModName(m))}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // 2. Обновлённые моды
        if (updated.length > 0) {
            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-label group-label-update">
                        <span class="group-dot"></span>
                        <span>Обновлено (${updated.length})</span>
                    </div>
                    <div class="changelog-chips-wrap">
                        ${updated.map(u => {
                            if (typeof u === 'string') {
                                return `<span class="changelog-chip chip-update">${escapeHtml(cleanModName(u))}</span>`;
                            }
                            const oldF = cleanModName(u.old || '');
                            const newF = cleanModName(u.new || u.name || '');
                            if (oldF && newF && oldF !== newF) {
                                return `<span class="changelog-chip chip-update" title="${escapeHtml(u.old)} ➔ ${escapeHtml(u.new)}"><span class="chip-sign">🔄</span> <span class="chip-old">${escapeHtml(oldF)}</span> <span class="chip-arrow">➔</span> <b class="chip-new">${escapeHtml(newF)}</b></span>`;
                            }
                            return `<span class="changelog-chip chip-update"><span class="chip-sign">🔄</span> ${escapeHtml(newF || 'мод')}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // 3. Удалённые моды
        if (removed.length > 0) {
            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-label group-label-remove">
                        <span class="group-dot"></span>
                        <span>Удалено (${removed.length})</span>
                    </div>
                    <div class="changelog-chips-wrap">
                        ${removed.map(m => `<span class="changelog-chip chip-remove" title="${escapeHtml(m)}"><span class="chip-sign">-</span> ${escapeHtml(cleanModName(m))}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // 4. Прочее (конфиги, скрипты, паки)
        if (configs > 0 || scripts > 0 || packs > 0 || summary.is_initial) {
            const extraChips = [];
            if (summary.is_initial) {
                extraChips.push('<span class="changelog-chip chip-misc">🚀 Начальный слепок сборки</span>');
            }
            if (configs > 0) {
                extraChips.push(`<span class="changelog-chip chip-misc">⚙️ Конфигурации (${configs})</span>`);
            }
            if (scripts > 0) {
                extraChips.push(`<span class="changelog-chip chip-misc">📜 Скрипты KubeJS (${scripts})</span>`);
            }
            if (packs > 0) {
                extraChips.push(`<span class="changelog-chip chip-misc">🎨 Ресурспаки (${packs})</span>`);
            }

            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-label group-label-misc">
                        <span class="group-dot"></span>
                        <span>Конфигурации и скрипты</span>
                    </div>
                    <div class="changelog-chips-wrap">
                        ${extraChips.join('')}
                    </div>
                </div>
            `;
        }

        if (added.length === 0 && updated.length === 0 && removed.length === 0 && configs === 0 && scripts === 0 && packs === 0 && !summary.is_initial) {
            groupsHtml += '<div class="changelog-item-empty">Мелкие системные изменения сборки</div>';
        }

        groupsHtml += '</div>';

        card.innerHTML = headerHtml + groupsHtml;
        container.appendChild(card);
    });
}

/**
 * Отрендерить состояние пустой истории или отсутствия результатов
 */
function renderEmptyState(message) {
    const container = dom.get('changelog-list');
    if (!container) return;

    container.innerHTML = `
        <div class="changelog-empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-title">${message || 'История обновлений пока пуста'}</div>
            <div class="empty-desc">
                Все добавленные, обновлённые и удалённые моды, конфиги и скрипты сборки будут отображаться здесь автоматически при сборке сервера.
            </div>
        </div>
    `;
}

/**
 * Упростить имя файла мода для чистого отображения
 */
function cleanModName(fileName) {
    if (!fileName) return '';
    return String(fileName).replace(/\.jar$/i, '').trim();
}

/**
 * Экранирование HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Инициализация обработчиков поисковой строки, фильтров и кнопки обновления
 */
export function initChangelog() {
    if (isInitialized) return;
    isInitialized = true;

    // Поиск
    const searchInput = dom.get('changelog-search-input');
    const clearBtn = dom.get('changelog-search-clear');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentSearchQuery = searchInput.value;
            if (clearBtn) {
                if (currentSearchQuery.length > 0) {
                    clearBtn.classList.remove('hidden');
                } else {
                    clearBtn.classList.add('hidden');
                }
            }
            renderChangelogList();
        });
    }

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            currentSearchQuery = '';
            clearBtn.classList.add('hidden');
            renderChangelogList();
            searchInput.focus();
        });
    }

    // Фильтр-кнопки
    const filterButtons = document.querySelectorAll('.changelog-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter || 'all';
            renderChangelogList();
        });
    });

    // Кнопка обновления
    const refreshBtn = dom.get('btn-changelog-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('spinning');
            try {
                await loadChangelogHistory();
            } finally {
                setTimeout(() => {
                    refreshBtn.classList.remove('spinning');
                }, 400);
            }
        });
    }

    // Фоновая загрузка истории
    loadChangelogHistory();
}
