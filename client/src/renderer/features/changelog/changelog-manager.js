/**
 * GanjaCraft Launcher - Pack & Client Changelog Feature
 * Управление историей изменений сборки и релизов лаунчера
 */

import { dom } from '../../utils/dom.js';
import { closeSettings, toggleMainUIVisibility } from '../settings/index.js';
import { createSnowBurst } from '../../ui/effects/index.js';
import { triggerInertiaCascade } from '../../utils/performance.js';
import { appState } from '../../state/app-state.js';

const STORAGE_KEY_SEEN = 'ganja_last_seen_changelog_id';

let cachedPackHistory = [];
let cachedLauncherReleases = [];
let isInitialized = false;

/**
 * Проверка, является ли мод чисто клиентским (графика, интерфейс, утилиты)
 */
export function isClientMod(raw) {
    if (!raw) return false;
    const str = String(raw).toLowerCase();
    if (str.startsWith('client_mods/') || str.startsWith('client-') || str.startsWith('client_')) return true;
    
    const clientKeywords = [
        'sodium', 'iris', 'embeddium', 'oculus', 'rubidium', 'xaero', 'jei', 'rei', 'emi',
        'jade', 'waila', 'hud', 'appleskin', 'cloth', 'controlling', 'searchables',
        'customskinloader', 'authlib', 'sound', 'animation', 'ambient', 'presence', 'chat',
        'smoothboot', 'ferrite', 'entityculling', 'immediatelyfast', 'modernfix', 'fps',
        'dynamic', 'zoom', 'invtweaks', 'mouse', 'gamma', 'tooltip', 'screenshot', 'voice',
        'simplevoicechat', 'replay', 'borderless', 'fullscreen', 'custom_steve', 'emotecraft',
        'cit', 'emf', 'etf', 'falling_leaves', 'notenoughanimations', 'itemphysic', 'legendarytooltips'
    ];
    return clientKeywords.some(k => str.includes(k));
}

/**
 * Парсер имени мода для красивого человекочитаемого отображения
 */
export function formatModDisplay(raw) {
    if (!raw) return { title: 'Мод', version: '', raw: '', isClient: false };
    let fileName = String(raw).replace(/^mods\//i, '').replace(/^client_mods\//i, '').replace(/\.jar$/i, '').trim();
    let isClient = isClientMod(raw);

    if (fileName.startsWith('client-') || fileName.startsWith('client_')) {
        fileName = fileName.slice(7);
        isClient = true;
    }

    let title = fileName;
    let version = '';

    const camelMatch = fileName.match(/^([A-Za-z]+?)((?:1\.\d|v\d|\d\d).*)$/i);
    if (camelMatch) {
        title = camelMatch[1];
        version = camelMatch[2];
    } else {
        const delimMatch = fileName.match(/^([A-Za-z0-9_]+?)[-_](v?\d|\+mc|neoforge|forge|fabric)(.*)$/i);
        if (delimMatch) {
            title = delimMatch[1];
            version = (delimMatch[2] + delimMatch[3]).replace(/^[-_]+/, '');
        }
    }

    let cleanTitle = title
        .replace(/([a-z])([A-Z])/g, (m, p1, p2) => p1 + ' ' + p2)
        .replace(/([A-Z]+)([A-Z][a-z])/g, (m, p1, p2) => p1 + ' ' + p2)
        .replace(/[_-]+/g, ' ')
        .trim();

    const upperWords = new Set(['jei', 'ftb', 'emf', 'etf', 'cit', 'rei', 'emi', 'xaero', 'xaeros', 'mc', 'hud', 'fps', 'tps', 'waila', 'jade', 'mekanism']);
    cleanTitle = cleanTitle.split(' ').map(w => {
        if (upperWords.has(w.toLowerCase())) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');

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
        isClient,
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
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                const day = d.getDate();
                const month = months[d.getMonth()];
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                return `${day} ${month} ${year} • ${hours}:${mins}`;
            }
        } catch {}
        return dateStr;
    }

    return 'Недавнее обновление';
}

function getLatestCompoundId() {
    const latestPack = cachedPackHistory[0];
    const latestLauncher = cachedLauncherReleases[0];
    const pId = latestPack ? (latestPack.id || String(latestPack.timestamp || '')) : '';
    const lId = latestLauncher ? (latestLauncher.version || String(latestLauncher.timestamp || '')) : '';
    return `${pId}_${lId}`;
}

/**
 * Загрузить историю изменений манифеста и релизов лаунчера
 */
export async function loadChangelogHistory() {
    try {
        const promises = [];
        if (window.api && window.api.getManifestHistory) {
            promises.push(window.api.getManifestHistory().catch(() => ({ success: false, history: [] })));
        } else {
            promises.push(Promise.resolve({ success: false, history: [] }));
        }

        if (window.api && window.api.getLauncherReleases) {
            promises.push(window.api.getLauncherReleases().catch(() => ({ success: false, releases: [] })));
        } else {
            promises.push(Promise.resolve({ success: false, releases: [] }));
        }

        const [packRes, launcherRes] = await Promise.all(promises);

        if (packRes && packRes.success && Array.isArray(packRes.history)) {
            cachedPackHistory = packRes.history;
        }

        if (launcherRes && launcherRes.success && Array.isArray(launcherRes.releases)) {
            cachedLauncherReleases = launcherRes.releases;
        }

        checkChangelogBadge();
        renderChangelogList();
    } catch (e) {
        console.warn('[Changelog] Failed to load history:', e);
        renderEmptyState('Ошибка загрузки истории обновлений');
    }
}

/**
 * Проверить актуальность последнего обновления и переключить бейдж на колокольчике
 */
export function checkChangelogBadge() {
    const badge = dom.get('changelog-badge');
    if (!badge) return;

    if ((!cachedPackHistory || cachedPackHistory.length === 0) && (!cachedLauncherReleases || cachedLauncherReleases.length === 0)) {
        badge.classList.add('hidden');
        return;
    }

    const compoundId = getLatestCompoundId();
    const seenId = localStorage.getItem(STORAGE_KEY_SEEN);

    if (compoundId && seenId !== compoundId) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Отметить текущие обновления как просмотренные (гасит бейдж)
 */
export function markChangelogSeen() {
    const compoundId = getLatestCompoundId();
    if (compoundId) {
        localStorage.setItem(STORAGE_KEY_SEEN, compoundId);
    }
    const badge = dom.get('changelog-badge');
    if (badge) badge.classList.add('hidden');
}

/**
 * Рендер карточек объединённой истории обновлений
 */
export function renderChangelogList() {
    const container = dom.get('changelog-list');
    if (!container) return;

    const allItems = [];

    // 1. Обновления сборки
    cachedPackHistory.forEach((item, index) => {
        const ts = item.timestamp ? Number(item.timestamp) : (item.date ? new Date(item.date).getTime() / 1000 : 0);
        allItems.push({
            itemType: 'pack',
            timestamp: ts,
            date: item.date,
            isLatest: index === 0,
            data: item
        });
    });

    // 2. Релизы лаунчера
    cachedLauncherReleases.forEach((rel, index) => {
        const ts = rel.timestamp ? Number(rel.timestamp) : (rel.date ? new Date(rel.date).getTime() / 1000 : 0);
        allItems.push({
            itemType: 'launcher',
            timestamp: ts,
            date: rel.date,
            isLatest: index === 0,
            data: rel
        });
    });

    // Сортировка по времени (сначала самые свежие)
    allItems.sort((a, b) => b.timestamp - a.timestamp);

    if (allItems.length === 0) {
        renderEmptyState('История обновлений пока пуста');
        return;
    }

    container.innerHTML = '';

    allItems.forEach((entry, idx) => {
        const card = document.createElement('div');
        card.className = `changelog-release-card ${entry.itemType === 'launcher' ? 'card-theme-launcher' : 'card-theme-pack'}`;

        if (entry.itemType === 'launcher') {
            card.innerHTML = renderLauncherCardHtml(entry.data, idx === 0);
        } else {
            card.innerHTML = renderPackCardHtml(entry.data, idx === 0);
        }

        container.appendChild(card);
    });
}

/**
 * Рендер карточки релиза самого лаунчера
 */
function renderLauncherCardHtml(rel, isLatest) {
    const formattedDate = formatReleaseDate(rel.date, rel.timestamp);
    const versionStr = rel.version ? `v${rel.version}` : '';
    let changes = rel.changes || [];

    if (!Array.isArray(changes) || changes.length === 0) {
        changes = [
            '⚡ Оптимизация сетевых протоколов и ускорение синхронизации',
            '🔧 Повышение стабильности работы клиента',
            '🛡️ Обновление модулей авторизации и безопасности'
        ];
    }

    return `
        <div class="changelog-release-header launcher-release-header">
            <div class="changelog-header-left">
                <svg class="changelog-date-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h4>${escapeHtml(formattedDate)}</h4>
                <span class="changelog-badge-tag changelog-badge-scope-launcher">🚀 ЛАУНЧЕР</span>
                ${isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
                ${versionStr ? `<span class="changelog-badge-ver ver-launcher">${escapeHtml(versionStr)}</span>` : ''}
            </div>
        </div>

        <div class="changelog-card-content">
            <div class="changelog-admin-note launcher-note">
                <div class="admin-note-header">
                    <span class="note-icon">🚀</span>
                    <span class="note-title">${escapeHtml(rel.title || `Обновление лаунчера ${versionStr}`)}</span>
                </div>
                ${rel.description ? `<div class="admin-note-body">${escapeHtml(rel.description)}</div>` : ''}
            </div>

            <div class="changelog-group">
                <div class="changelog-section-title group-label-launcher">
                    <span class="title-dot dot-launcher"></span>
                    <span>Что нового в лаунчере</span>
                </div>
                <div class="changelog-launcher-changes-grid">
                    ${changes.map(ch => `
                        <div class="changelog-launcher-change-item">
                            <span class="launcher-change-bullet">▸</span>
                            <span class="launcher-change-text">${escapeHtml(ch)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Рендер карточки обновления сборки (чётко разделено по группам: Клиент, Сервер, KubeJS, Конфиги)
 */
function renderPackCardHtml(item, isLatest) {
    const summary = item.summary || {};
    const formattedDate = formatReleaseDate(item.date, item.timestamp);
    const versionStr = item.launcher_version ? `v${item.launcher_version}` : '';

    const allAdded = summary.mods_added || [];
    const allUpdated = summary.mods_updated || [];
    const allRemoved = summary.mods_removed || [];
    const configsList = summary.configs_list || [];
    const scriptsList = summary.scripts_list || [];
    const resourcepacksList = summary.resourcepacks_list || [];

    const configsCount = summary.configs_count || configsList.length;
    const scriptsCount = summary.scripts_count || scriptsList.length;
    const packsCount = summary.resourcepacks_count || resourcepacksList.length;

    // Разделение модов на Клиентские и Серверные
    const clientAdded = [];
    const serverAdded = [];
    allAdded.forEach(m => {
        if (isClientMod(m)) clientAdded.push(m);
        else serverAdded.push(m);
    });

    const clientUpdated = [];
    const serverUpdated = [];
    allUpdated.forEach(u => {
        const raw = typeof u === 'string' ? u : (u.new || u.name || u.old || '');
        if (isClientMod(raw)) clientUpdated.push(u);
        else serverUpdated.push(u);
    });

    const clientRemoved = [];
    const serverRemoved = [];
    allRemoved.forEach(m => {
        if (isClientMod(m)) clientRemoved.push(m);
        else serverRemoved.push(m);
    });

    // Бейджи в шапке
    const summaryPills = [];
    const totalAdded = allAdded.length;
    const totalUpdated = allUpdated.length;
    const totalRemoved = allRemoved.length;

    if (totalAdded > 0) summaryPills.push(`<span class="changelog-pill pill-add">➕ ${totalAdded}</span>`);
    if (totalUpdated > 0) summaryPills.push(`<span class="changelog-pill pill-update">🔄 ${totalUpdated}</span>`);
    if (totalRemoved > 0) summaryPills.push(`<span class="changelog-pill pill-remove">➖ ${totalRemoved}</span>`);
    if (scriptsCount > 0) summaryPills.push(`<span class="changelog-pill pill-script">📜 ${scriptsCount}</span>`);
    if (configsCount > 0) summaryPills.push(`<span class="changelog-pill pill-config">⚙️ ${configsCount}</span>`);

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
                <span class="changelog-badge-tag changelog-badge-scope-pack">🎮 СБОРКА</span>
                ${isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
                ${versionStr ? `<span class="changelog-badge-ver">${escapeHtml(versionStr)}</span>` : ''}
            </div>
            <div class="changelog-header-pills">
                ${summaryPills.join('')}
            </div>
        </div>
    `;

    let sectionsHtml = '<div class="changelog-card-content">';

    // 0. Заметка разработчика
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

    // 1. ГРУППА: СЕРВЕРНАЯ ЧАСТЬ И ГЕЙМПЛЕЙНЫЕ МОДЫ
    const hasServerMods = serverAdded.length > 0 || serverUpdated.length > 0 || serverRemoved.length > 0;
    if (hasServerMods) {
        sectionsHtml += `
            <div class="changelog-group">
                <div class="changelog-section-title group-label-server">
                    <span class="title-dot dot-server"></span>
                    <span>⚙️ Серверные моды и ядро (${serverAdded.length + serverUpdated.length + serverRemoved.length})</span>
                </div>
                <div class="changelog-mods-grid">
                    ${serverAdded.map(m => renderModCard(m, 'add')).join('')}
                    ${serverUpdated.map(u => renderModCard(u, 'update')).join('')}
                    ${serverRemoved.map(m => renderModCard(m, 'remove')).join('')}
                </div>
            </div>
        `;
    }

    // 2. ГРУППА: КЛИЕНТСКИЕ МОДЫ И ГРАФИКА
    const hasClientMods = clientAdded.length > 0 || clientUpdated.length > 0 || clientRemoved.length > 0 || packsCount > 0;
    if (hasClientMods) {
        sectionsHtml += `
            <div class="changelog-group">
                <div class="changelog-section-title group-label-client">
                    <span class="title-dot dot-client"></span>
                    <span>💻 Клиентские моды и графика (${clientAdded.length + clientUpdated.length + clientRemoved.length + packsCount})</span>
                </div>
                <div class="changelog-mods-grid">
                    ${clientAdded.map(m => renderModCard(m, 'add')).join('')}
                    ${clientUpdated.map(u => renderModCard(u, 'update')).join('')}
                    ${clientRemoved.map(m => renderModCard(m, 'remove')).join('')}
                    ${resourcepacksList.map(r => `
                        <div class="changelog-mod-card card-misc" title="${escapeHtml(r.path || r.name)}">
                            <div class="mod-card-left">
                                <div class="mod-type-icon icon-misc">🎨</div>
                                <div class="mod-info-block">
                                    <span class="mod-main-name">${escapeHtml(r.label || r.name)}</span>
                                    <span class="mod-sub-filename">${escapeHtml(r.path || r.name)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 3. ГРУППА: БАЛАНС И СКРИПТЫ KUBEJS
    if (scriptsList.length > 0) {
        sectionsHtml += `
            <div class="changelog-group">
                <div class="changelog-section-title group-label-script">
                    <span class="title-dot dot-script"></span>
                    <span>📜 Баланс и скрипты KubeJS (${scriptsList.length})</span>
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
    } else if (scriptsCount > 0) {
        sectionsHtml += `
            <div class="changelog-group">
                <div class="changelog-section-title group-label-script">
                    <span class="title-dot dot-script"></span>
                    <span>📜 Баланс и скрипты KubeJS (${scriptsCount})</span>
                </div>
                <div class="changelog-misc-wrap">
                    <span class="changelog-misc-chip">📜 Обновлены серверные скрипты и рецепты крафтов (${scriptsCount})</span>
                </div>
            </div>
        `;
    }

    // 4. ГРУППА: КОНФИГУРАЦИИ СЕРВЕРА
    if (configsList.length > 0) {
        sectionsHtml += `
            <div class="changelog-group">
                <div class="changelog-section-title group-label-config">
                    <span class="title-dot dot-config"></span>
                    <span>🔧 Конфигурации сервера (${configsList.length})</span>
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
    } else if (configsCount > 0) {
        sectionsHtml += `
            <div class="changelog-group">
                <div class="changelog-section-title group-label-config">
                    <span class="title-dot dot-config"></span>
                    <span>🔧 Конфигурации сервера (${configsCount})</span>
                </div>
                <div class="changelog-misc-wrap">
                    <span class="changelog-misc-chip">⚙️ Обновлены серверные конфигурации и баланс (${configsCount})</span>
                </div>
            </div>
        `;
    }

    if (!hasServerMods && !hasClientMods && scriptsCount === 0 && configsCount === 0 && !item.custom_note) {
        sectionsHtml += '<div class="changelog-item-empty">Мелкие системные исправления сборки</div>';
    }

    sectionsHtml += '</div>';

    return headerHtml + sectionsHtml;
}

/**
 * Хелпер рендера карточки отдельного мода (добавлен / обновлен / удален)
 */
function renderModCard(item, actionType) {
    if (actionType === 'update') {
        const oldRaw = typeof item === 'string' ? item : (item.old || '');
        const newRaw = typeof item === 'string' ? item : (item.new || item.name || '');
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
    }

    const raw = typeof item === 'string' ? item : (item.name || '');
    const parsed = formatModDisplay(raw);

    if (actionType === 'remove') {
        return `
            <div class="changelog-mod-card card-remove" title="${escapeHtml(raw)}">
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
    }

    // Default: 'add'
    return `
        <div class="changelog-mod-card card-add" title="${escapeHtml(raw)}">
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
}

/**
 * Отрендерить состояние пустой истории
 */
function renderEmptyState(message) {
    const container = dom.get('changelog-list');
    if (!container) return;

    container.innerHTML = `
        <div class="changelog-empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-title">${message || 'История обновлений пока пуста'}</div>
            <div class="empty-desc">
                Все добавленные, обновлённые и удалённые моды сборки, конфиги, рецепты и релизы лаунчера будут автоматически появляться здесь.
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
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
    if (!screen) return;

    // 1. Безусловно и мгновенно глушим настройки
    closeSettings(true);

    // 2. Плавно скрываем основные блоки интерфейса
    toggleMainUIVisibility(false);

    changelogAnimating = true;
    screen.classList.remove('hidden', 'closing');
    screen.classList.add('opening');

    // Title bar tabs
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) titleMainTab.classList.remove('active');

    const settingsTabs = document.getElementById('settings-tabs-bar');
    if (settingsTabs) {
        settingsTabs.className = 'settings-tabs hidden';
    }

    const changelogTabs = document.getElementById('changelog-tabs-bar');
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
        if (changelogTabs) changelogTabs.classList.remove('opening');
        changelogAnimating = false;
    }, 280);
}

/**
 * Закрыть экран истории обновлений с анимацией (или мгновенно при переключении разделов)
 */
export function closeChangelogScreen(instant = false) {
    const screen = dom.get('step-changelog');
    if (!screen) return;
    if (changelogAnimating && !instant) return;

    if (instant) {
        screen.className = 'settings-screen changelog-screen hidden';
        const changelogTabs = document.getElementById('changelog-tabs-bar');
        if (changelogTabs) changelogTabs.className = 'changelog-tabs hidden';
        const btnChangelog = document.getElementById('btn-changelog');
        if (btnChangelog) {
            btnChangelog.classList.remove('settings-active');
            const iconSpan = document.getElementById('btn-changelog-icon');
            if (iconSpan) {
                iconSpan.innerHTML = BELL_SVG;
            }
            btnChangelog.title = 'Обновления';
        }
        changelogAnimating = false;
        return;
    }

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

    const changelogTabs = document.getElementById('changelog-tabs-bar');
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
        btnChangelog.title = 'Обновления';
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
