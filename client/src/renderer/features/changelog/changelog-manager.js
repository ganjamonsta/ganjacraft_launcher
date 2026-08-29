/**
 * GanjaCraft Launcher - Pack Changelog Feature
 * Управление историей изменений сборки, поиском, фильтрами и бейджами
 */

import { dom } from '../../utils/dom.js';
import { closeSettings, toggleMainUIVisibility } from '../settings/index.js';
import { createSnowBurst } from '../../ui/effects/index.js';
import { triggerInertiaCascade } from '../../utils/performance.js';
import { appState } from '../../state/app-state.js';

const STORAGE_KEY_SEEN = 'ganja_last_seen_changelog_id';

let cachedHistory = [];
let isInitialized = false;
let currentFilter = 'all';
let currentSearchQuery = '';

/**
 * Парсер имени мода для красивого человекочитаемого отображения
 */
export function formatModDisplay(raw) {
    if (!raw) return { title: 'Мод', version: '', raw: '' };
    let fileName = String(raw).replace(/^mods\//i, '').replace(/^client_mods\//i, '').replace(/\.jar$/i, '').trim();
    let isOptional = false;

    if (fileName.startsWith('client-') || fileName.startsWith('client_')) {
        fileName = fileName.slice(7);
        isOptional = true;
    }

    let title = fileName;
    let version = '';

    // Проверка формата CamelCase + Version: "IronBarrels1.21.1-V1.02NeoForge"
    const camelMatch = fileName.match(/^([A-Za-z]+?)((?:1\.\d|v\d|\d\d).*)$/i);
    if (camelMatch) {
        title = camelMatch[1];
        version = camelMatch[2];
    } else {
        // Формат с разделителем: "jei-1.21.1-neoforge-19.2.0.35", "create_connected-0.9.1"
        const delimMatch = fileName.match(/^([A-Za-z0-9_]+?)[-_](v?\d|\+mc|neoforge|forge|fabric)(.*)$/i);
        if (delimMatch) {
            title = delimMatch[1];
            version = (delimMatch[2] + delimMatch[3]).replace(/^[-_]+/, '');
        }
    }

    // Преобразуем camelCase и snake_case в аккуратный Title Case с пробелами
    let cleanTitle = title
        .replace(/([a-z])([A-Z])/g, (m, p1, p2) => p1 + ' ' + p2)
        .replace(/([A-Z]+)([A-Z][a-z])/g, (m, p1, p2) => p1 + ' ' + p2)
        .replace(/[_-]+/g, ' ')
        .trim();

    // Список аббревиатур, которые должны оставаться в верхнем регистре
    const upperWords = new Set(['jei', 'ftb', 'emf', 'etf', 'cit', 'rei', 'emi', 'xaero', 'xaeros', 'mc', 'hud', 'fps', 'tps', 'waila', 'jade', 'mekanism']);
    cleanTitle = cleanTitle.split(' ').map(w => {
        if (upperWords.has(w.toLowerCase())) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');

    // Очищаем строку версии
    let cleanVer = version
        .replace(/[-_]?(?:neoforge|forge|fabric)[-_]?/gi, ' ')
        .replace(/[-_]?(?:mc)?1\.21(?:\.1)?[-_]?/gi, ' ')
        .replace(/[-_]+/g, ' ')
        .trim();

    if (cleanVer && !cleanVer.toLowerCase().startsWith('v') && /^\d/.test(cleanVer)) {
        cleanVer = 'v' + cleanVer;
    }

    return {
        title: cleanTitle || fileName,
        version: cleanVer || '',
        isOptional,
        raw
    };
}

/**
 * Красивое форматирование даты
 */
function formatReleaseDate(dateStr, timestamp) {
    if (timestamp && typeof timestamp === 'number') {
        const d = new Date(timestamp * 1000);
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day} ${month} ${year} • ${hours}:${mins}`;
    }

    if (dateStr) {
        return dateStr;
    }

    return 'Недавнее обновление';
}

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
 * Проверить актуальность последнего обновления и переключить бейдж на колокольчике
 */
export function checkChangelogBadge() {
    const badge = dom.get('changelog-badge');
    if (!badge) return;

    if (!cachedHistory || cachedHistory.length === 0) {
        badge.classList.add('hidden');
        return;
    }

    const latest = cachedHistory[0];
    const latestId = latest.id || String(latest.timestamp || '');
    const seenId = localStorage.getItem(STORAGE_KEY_SEEN);

    const hasUnseen = Boolean(latestId && seenId !== latestId);
    if (hasUnseen) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Отметить текущие обновления как просмотренные (гасит бейдж)
 */
export function markChangelogSeen() {
    if (cachedHistory && cachedHistory.length > 0) {
        const latest = cachedHistory[0];
        const latestId = latest.id || String(latest.timestamp || '');
        if (latestId) {
            localStorage.setItem(STORAGE_KEY_SEEN, latestId);
        }
    }
    const badge = dom.get('changelog-badge');
    if (badge) badge.classList.add('hidden');
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

        // Фильтр по категориям
        if (filter === 'added') {
            updated = [];
            removed = [];
            if (added.length === 0) return null;
        } else if (filter === 'updated') {
            added = [];
            removed = [];
            if (updated.length === 0) return null;
        } else if (filter === 'removed') {
            added = [];
            updated = [];
            if (removed.length === 0) return null;
        } else if (filter === 'configs') {
            added = [];
            updated = [];
            removed = [];
            if (configs === 0 && scripts === 0 && packs === 0) return null;
        }

        // Поиск по ключевому слову
        if (query) {
            const matchInAdded = added.filter(m => {
                const parsed = formatModDisplay(m);
                return parsed.title.toLowerCase().includes(query) || String(m).toLowerCase().includes(query);
            });

            const matchInUpdated = updated.filter(u => {
                const oldRaw = typeof u === 'string' ? u : (u.old || '');
                const newRaw = typeof u === 'string' ? u : (u.new || u.name || '');
                const pOld = formatModDisplay(oldRaw);
                const pNew = formatModDisplay(newRaw);
                return pOld.title.toLowerCase().includes(query) ||
                       pNew.title.toLowerCase().includes(query) ||
                       oldRaw.toLowerCase().includes(query) ||
                       newRaw.toLowerCase().includes(query);
            });

            const matchInRemoved = removed.filter(m => {
                const parsed = formatModDisplay(m);
                return parsed.title.toLowerCase().includes(query) || String(m).toLowerCase().includes(query);
            });

            const matchInDate = item.date && item.date.toLowerCase().includes(query);
            const matchInVer = item.launcher_version && item.launcher_version.toLowerCase().includes(query);
            const matchInMisc = (configs > 0 && 'конфиг'.includes(query)) ||
                                (scripts > 0 && 'скрипт kubejs'.includes(query)) ||
                                (packs > 0 && 'ресурспак'.includes(query));

            const hasItemMatch = matchInAdded.length > 0 || matchInUpdated.length > 0 || matchInRemoved.length > 0;

            if (!hasItemMatch && !matchInDate && !matchInVer && !matchInMisc) {
                return null;
            }

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
        renderEmptyState(query ? `По запросу «${escapeHtml(query)}» ничего не найдено` : 'В этой категории пока нет записей');
        return;
    }

    container.innerHTML = '';

    filteredHistory.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'changelog-release-card';

        const summary = item.summary || {};
        const formattedDate = formatReleaseDate(item.date, item.timestamp);
        const versionStr = item.launcher_version ? `v${item.launcher_version}` : '';

        const added = item._filteredAdded;
        const updated = item._filteredUpdated;
        const removed = item._filteredRemoved;
        const configs = item._configs;
        const scripts = item._scripts;
        const packs = item._packs;

        // Pills для заголовка
        const summaryPills = [];
        if (added.length > 0) summaryPills.push(`<span class="changelog-pill pill-add">➕ ${added.length}</span>`);
        if (updated.length > 0) summaryPills.push(`<span class="changelog-pill pill-update">🔄 ${updated.length}</span>`);
        if (removed.length > 0) summaryPills.push(`<span class="changelog-pill pill-remove">➖ ${removed.length}</span>`);
        if (configs > 0) summaryPills.push(`<span class="changelog-pill pill-misc">⚙️ ${configs}</span>`);
        if (scripts > 0) summaryPills.push(`<span class="changelog-pill pill-misc">📜 ${scripts}</span>`);
        if (packs > 0) summaryPills.push(`<span class="changelog-pill pill-misc">🎨 ${packs}</span>`);

        const headerHtml = `
            <div class="changelog-release-header">
                <div class="changelog-header-left">
                    <svg class="changelog-date-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <h4>${escapeHtml(formattedDate)}</h4>
                    ${item._isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
                    ${versionStr ? `<span class="changelog-badge-ver">${escapeHtml(versionStr)}</span>` : ''}
                </div>
                <div class="changelog-header-pills">
                    ${summaryPills.join('')}
                </div>
            </div>
        `;

        let sectionsHtml = '<div class="changelog-card-content">';

        // 0. Авторская заметка/патчноут админа (если есть)
        if (item.custom_note && item.custom_note.trim()) {
            sectionsHtml += `
                <div class="changelog-admin-note">
                    <div class="admin-note-header">
                        <span class="note-icon">💬</span>
                        <span class="note-title">Патчноут сборки</span>
                    </div>
                    <div class="admin-note-body">${escapeHtml(item.custom_note)}</div>
                </div>
            `;
        }

        // 1. Добавленные моды
        if (added.length > 0) {
            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-add">
                        <span class="title-dot dot-add"></span>
                        <span>Добавленные моды (${added.length})</span>
                    </div>
                    <div class="changelog-mods-grid">
                        ${added.map(m => {
                            const parsed = formatModDisplay(m);
                            return `
                                <div class="changelog-mod-card card-add" title="${escapeHtml(m)}">
                                    <div class="mod-card-left">
                                        <div class="mod-type-icon icon-add">➕</div>
                                        <div class="mod-info-block">
                                            <span class="mod-main-name">${escapeHtml(parsed.title)}</span>
                                            <span class="mod-sub-filename">${escapeHtml(parsed.raw)}</span>
                                        </div>
                                    </div>
                                    ${parsed.version ? `<span class="mod-version-tag">${escapeHtml(parsed.version)}</span>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // 2. Обновлённые моды
        if (updated.length > 0) {
            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-update">
                        <span class="title-dot dot-update"></span>
                        <span>Обновлённые моды (${updated.length})</span>
                    </div>
                    <div class="changelog-mods-grid">
                        ${updated.map(u => {
                            const oldRaw = typeof u === 'string' ? u : (u.old || '');
                            const newRaw = typeof u === 'string' ? u : (u.new || u.name || '');
                            const pOld = formatModDisplay(oldRaw);
                            const pNew = formatModDisplay(newRaw);
                            return `
                                <div class="changelog-mod-card card-update" title="${escapeHtml(oldRaw)} ➔ ${escapeHtml(newRaw)}">
                                    <div class="mod-card-left">
                                        <div class="mod-type-icon icon-update">🔄</div>
                                        <div class="mod-info-block">
                                            <span class="mod-main-name">${escapeHtml(pNew.title || pOld.title)}</span>
                                            <span class="mod-sub-filename">${escapeHtml(newRaw)}</span>
                                        </div>
                                    </div>
                                    <div class="mod-diff-tag">
                                        ${pOld.version ? `<span class="v-old">${escapeHtml(pOld.version)}</span>` : ''}
                                        <span class="v-arrow">➔</span>
                                        <span class="v-new">${escapeHtml(pNew.version || 'new')}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // 3. Удалённые моды
        if (removed.length > 0) {
            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-remove">
                        <span class="title-dot dot-remove"></span>
                        <span>Удалённые моды (${removed.length})</span>
                    </div>
                    <div class="changelog-mods-grid">
                        ${removed.map(m => {
                            const parsed = formatModDisplay(m);
                            return `
                                <div class="changelog-mod-card card-remove" title="${escapeHtml(m)}">
                                    <div class="mod-card-left">
                                        <div class="mod-type-icon icon-remove">➖</div>
                                        <div class="mod-info-block">
                                            <span class="mod-main-name">${escapeHtml(parsed.title)}</span>
                                            <span class="mod-sub-filename">${escapeHtml(parsed.raw)}</span>
                                        </div>
                                    </div>
                                    ${parsed.version ? `<span class="mod-version-tag tag-removed">${escapeHtml(parsed.version)}</span>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // 4. Серверные скрипты и рецепты KubeJS
        const scriptsList = summary.scripts_list || [];
        if (scriptsList.length > 0) {
            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-script">
                        <span class="title-dot dot-script"></span>
                        <span>Серверные скрипты и рецепты KubeJS (${scriptsList.length})</span>
                    </div>
                    <div class="changelog-mods-grid">
                        ${scriptsList.map(s => `
                            <div class="changelog-mod-card card-script" title="${escapeHtml(s.path || s.name)}">
                                <div class="mod-card-left">
                                    <div class="mod-type-icon icon-script">📜</div>
                                    <div class="mod-info-block">
                                        <span class="mod-main-name">${escapeHtml(s.label || s.name)}</span>
                                        <span class="mod-sub-filename">${escapeHtml(s.path || s.name)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (scripts > 0) {
            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-script">
                        <span class="title-dot dot-script"></span>
                        <span>Серверные скрипты KubeJS (${scripts})</span>
                    </div>
                    <div class="changelog-misc-wrap">
                        <span class="changelog-misc-chip">📜 Изменено скриптов: ${scripts}</span>
                    </div>
                </div>
            `;
        }

        // 5. Конфигурации сервера
        const configsList = summary.configs_list || [];
        if (configsList.length > 0) {
            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-config">
                        <span class="title-dot dot-config"></span>
                        <span>Конфигурации сервера (${configsList.length})</span>
                    </div>
                    <div class="changelog-mods-grid">
                        ${configsList.map(c => `
                            <div class="changelog-mod-card card-config" title="${escapeHtml(c.path || c.name)}">
                                <div class="mod-card-left">
                                    <div class="mod-type-icon icon-config">⚙️</div>
                                    <div class="mod-info-block">
                                        <span class="mod-main-name">${escapeHtml(c.label || c.name)}</span>
                                        <span class="mod-sub-filename">${escapeHtml(c.path || c.name)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (configs > 0) {
            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-config">
                        <span class="title-dot dot-config"></span>
                        <span>Конфигурации сервера (${configs})</span>
                    </div>
                    <div class="changelog-misc-wrap">
                        <span class="changelog-misc-chip">⚙️ Изменено конфигураций: ${configs}</span>
                    </div>
                </div>
            `;
        }

        // 6. Ресурспаки и шейдеры
        if (packs > 0 || summary.is_initial) {
            const extraChips = [];
            if (summary.is_initial) {
                extraChips.push('<span class="changelog-misc-chip">🚀 Начальный слепок сборки</span>');
            }
            if (packs > 0) {
                extraChips.push(`<span class="changelog-misc-chip">🎨 Ресурспаки и шейдеры (${packs})</span>`);
            }

            sectionsHtml += `
                <div class="changelog-group">
                    <div class="changelog-section-title group-label-misc">
                        <span class="title-dot dot-misc"></span>
                        <span>Дополнительно</span>
                    </div>
                    <div class="changelog-misc-wrap">
                        ${extraChips.join('')}
                    </div>
                </div>
            `;
        }

        if (added.length === 0 && updated.length === 0 && removed.length === 0 && configs === 0 && scripts === 0 && packs === 0 && !summary.is_initial && !item.custom_note) {
            sectionsHtml += '<div class="changelog-item-empty">Мелкие системные изменения сборки</div>';
        }

        sectionsHtml += '</div>';

        card.innerHTML = headerHtml + sectionsHtml;
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

const BELL_SVG = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
`;

let changelogAnimating = false;

/**
 * Проверить открыт ли экран истории обновлений
 */
export function isChangelogOpen() {
    const screen = dom.get('step-changelog');
    return Boolean(screen && !screen.classList.contains('hidden') && !screen.classList.contains('closing'));
}

/**
 * Открыть экран истории обновлений с анимацией
 */
export function openChangelogScreen() {
    const screen = dom.get('step-changelog');
    if (changelogAnimating || !screen) return;
    changelogAnimating = true;

    // Плавно скрываем основные блоки интерфейса (новости, статус, форма авторизации/игры)
    toggleMainUIVisibility(false);

    // Закрываем настройки, если они были открыты
    const settingsScreen = dom.get('step-settings');
    if (settingsScreen && !settingsScreen.classList.contains('hidden')) {
        closeSettings();
    }

    screen.classList.remove('hidden', 'closing');
    screen.classList.add('opening');

    // Title bar tabs
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) titleMainTab.classList.remove('active');

    const changelogTabs = document.getElementById('changelog-title-tab');
    if (changelogTabs) {
        changelogTabs.classList.remove('hidden', 'closing');
        changelogTabs.classList.add('opening');
    }

    // Button icon to ✕
    const btnChangelog = document.getElementById('btn-changelog');
    if (btnChangelog) {
        btnChangelog.classList.add('settings-active');
        const iconSpan = document.getElementById('btn-changelog-icon');
        if (iconSpan) {
            iconSpan.textContent = '✕';
        }
        btnChangelog.title = 'Закрыть обновления';
    }

    // Snow burst в едином стиле
    if (appState.get('effects.snowEnabled')) {
        createSnowBurst();
    }

    // Инерция на список
    const feed = dom.get('changelog-list');
    if (feed) {
        triggerInertiaCascade(feed, 'down', true);
    }

    markChangelogSeen();
    renderChangelogList();

    setTimeout(() => {
        screen.classList.remove('opening');
        changelogAnimating = false;
    }, 300);
}

/**
 * Закрыть экран истории обновлений с анимацией
 */
export function closeChangelogScreen() {
    const screen = dom.get('step-changelog');
    if (changelogAnimating || !screen) return;
    changelogAnimating = true;

    screen.classList.remove('opening');
    screen.classList.add('closing');

    // Плавно возвращаем основные блоки интерфейса
    const settingsScreen = dom.get('step-settings');
    if (!settingsScreen || settingsScreen.classList.contains('hidden')) {
        toggleMainUIVisibility(true);
    }

    // Восстанавливаем вкладку Title
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) titleMainTab.classList.add('active');

    const changelogTabs = document.getElementById('changelog-title-tab');
    if (changelogTabs) {
        changelogTabs.classList.remove('opening');
        changelogTabs.classList.add('closing');
        setTimeout(() => {
            changelogTabs.classList.remove('closing');
            changelogTabs.classList.add('hidden');
        }, 250);
    }

    // Сбрасываем кнопку
    const btnChangelog = document.getElementById('btn-changelog');
    if (btnChangelog) {
        btnChangelog.classList.remove('settings-active');
        const iconSpan = document.getElementById('btn-changelog-icon');
        if (iconSpan) {
            iconSpan.innerHTML = BELL_SVG;
        }
        btnChangelog.title = 'Обновления сборки';
    }

    setTimeout(() => {
        screen.classList.remove('closing');
        screen.classList.add('hidden');
        changelogAnimating = false;
    }, 250);
}

/**
 * Переключить видимость экрана истории обновлений
 */
export function toggleChangelogScreen() {
    if (isChangelogOpen()) {
        closeChangelogScreen();
    } else {
        openChangelogScreen();
    }
}

/**
 * Инициализация обработчиков экрана обновлений, колокольчика и загрузка данных
 */
export function initChangelog() {
    if (isInitialized) return;
    isInitialized = true;

    // Кнопка колокольчика в шапке
    const bellBtn = dom.get('btn-changelog');
    if (bellBtn) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleChangelogScreen();
        });
    }

    // Клик на логотип лаунчера в шапке закрывает открытый чейнджлог
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) {
        titleMainTab.addEventListener('click', () => {
            if (isChangelogOpen()) {
                closeChangelogScreen();
            }
        });
    }

    // Закрытие по клавише Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isChangelogOpen()) {
            closeChangelogScreen();
        }
    });

    // Фоновая загрузка истории
    loadChangelogHistory();
}
