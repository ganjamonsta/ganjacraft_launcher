/**
 * GanjaCraft Launcher - Pack Changelog Feature
 * Управление историей изменений сборки и одноразовым бейджем
 */

import { dom } from '../../utils/dom.js';

const STORAGE_KEY_SEEN = 'ganja_last_seen_changelog_id';

let cachedHistory = [];
let isInitialized = false;

/**
 * Загрузить историю изменений манифеста и обновить бейдж
 */
export async function loadChangelogHistory() {
    try {
        if (!window.api || !window.api.getManifestHistory) return;
        const result = await window.api.getManifestHistory();
        if (result && result.success && Array.isArray(result.history)) {
            cachedHistory = result.history;
            checkChangelogBadge();
        }
    } catch (e) {
        console.warn('[Changelog] Failed to load manifest history:', e);
    }
}

/**
 * Проверить актуальность последнего обновления и переключить бейдж
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

    if (latestId && seenId !== latestId) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Отметить текущие обновления как просмотренные
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
    if (badge) {
        badge.classList.add('hidden');
    }
}

/**
 * Открыть модальное окно истории обновлений
 */
export function openChangelogModal() {
    const modal = dom.get('changelog-modal');
    if (!modal) return;

    renderChangelogList();
    modal.classList.remove('hidden');
    markChangelogSeen();
}

/**
 * Закрыть модальное окно
 */
export function closeChangelogModal() {
    const modal = dom.get('changelog-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Рендер карточек истории обновлений
 */
function renderChangelogList() {
    const container = dom.get('changelog-list');
    if (!container) return;

    if (!cachedHistory || cachedHistory.length === 0) {
        container.innerHTML = `
            <div class="changelog-empty">
                <div style="font-size: 32px; margin-bottom: 12px;">📦</div>
                <div style="font-weight: 600; color: #ccc; margin-bottom: 6px;">История обновлений пока пуста</div>
                <div>Все добавленные, обновлённые и удалённые файлы сборки будут отображаться здесь автоматически.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    cachedHistory.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'changelog-card';

        const isLatest = index === 0;
        const summary = item.summary || {};
        const dateStr = item.date || (item.timestamp ? new Date(item.timestamp * 1000).toLocaleString('ru-RU') : 'Недавно');
        const versionStr = item.launcher_version ? `v${item.launcher_version}` : '';

        // Верхняя плашка карточки
        let topHtml = `
            <div class="changelog-card-top">
                <div class="changelog-card-date">
                    <span class="changelog-card-date-icon">📅</span>
                    <span>${dateStr}</span>
                </div>
                <div class="changelog-badges-row">
                    ${isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
                    ${versionStr ? `<span class="changelog-badge-ver">${versionStr}</span>` : ''}
                </div>
            </div>
        `;

        let groupsHtml = '';

        // 1. Добавленные моды
        const added = summary.mods_added || [];
        if (added.length > 0) {
            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-title" style="color: #81c784;">
                        <span>➕ Добавлено модов (${added.length})</span>
                    </div>
                    <div class="changelog-items-wrap">
                        ${added.map(m => `<span class="changelog-tag tag-add" title="${m}">+ ${m}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // 2. Обновлённые моды
        const updated = summary.mods_updated || [];
        if (updated.length > 0) {
            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-title" style="color: #64b5f6;">
                        <span>🔄 Обновлено модов (${updated.length})</span>
                    </div>
                    <div class="changelog-items-wrap">
                        ${updated.map(u => {
                            if (typeof u === 'string') {
                                return `<span class="changelog-tag tag-update">${u}</span>`;
                            }
                            const name = u.name || u.new || 'мод';
                            const oldF = u.old ? `<span style="opacity:0.75;">${u.old}</span>` : '';
                            const newF = u.new || '';
                            if (oldF && newF && oldF !== newF) {
                                return `<span class="changelog-tag tag-update" title="${oldF} ➔ ${newF}">🔄 ${oldF} <span class="changelog-arrow">➔</span> <b>${newF}</b></span>`;
                            }
                            return `<span class="changelog-tag tag-update" title="${name}">🔄 ${name}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // 3. Удалённые моды
        const removed = summary.mods_removed || [];
        if (removed.length > 0) {
            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-title" style="color: #e57373;">
                        <span>➖ Удалено модов (${removed.length})</span>
                    </div>
                    <div class="changelog-items-wrap">
                        ${removed.map(m => `<span class="changelog-tag tag-remove" title="${m}">- ${m}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // 4. Конфиги, скрипты, паки
        const configs = summary.configs_count || 0;
        const scripts = summary.scripts_count || 0;
        const packs = summary.resourcepacks_count || 0;

        if (configs > 0 || scripts > 0 || packs > 0 || summary.is_initial) {
            const extraTags = [];
            if (summary.is_initial) {
                extraTags.push('<span class="changelog-tag tag-misc">🚀 Начальный слепок сборки</span>');
            }
            if (configs > 0) {
                extraTags.push(`<span class="changelog-tag tag-misc">⚙️ Конфигурации (${configs})</span>`);
            }
            if (scripts > 0) {
                extraTags.push(`<span class="changelog-tag tag-misc">📜 Скрипты KubeJS (${scripts})</span>`);
            }
            if (packs > 0) {
                extraTags.push(`<span class="changelog-tag tag-misc">🎨 Ресурспаки (${packs})</span>`);
            }

            groupsHtml += `
                <div class="changelog-group">
                    <div class="changelog-group-title" style="color: #ce93d8;">
                        <span>⚙️ Прочие изменения</span>
                    </div>
                    <div class="changelog-items-wrap">
                        ${extraTags.join('')}
                    </div>
                </div>
            `;
        }

        if (!groupsHtml) {
            groupsHtml = '<div style="color:#777; font-size:12px; font-style:italic;">Мелкие исправления файлов сборки</div>';
        }

        card.innerHTML = topHtml + groupsHtml;
        container.appendChild(card);
    });
}

/**
 * Инициализация обработчиков кнопок и событий
 */
export function initChangelog() {
    if (isInitialized) return;
    isInitialized = true;

    // Кнопка в Titlebar
    const btn = dom.get('btn-changelog');
    if (btn) {
        btn.addEventListener('click', () => {
            openChangelogModal();
        });
    }

    // Кнопки закрытия модалки
    const btnCloseX = dom.get('changelog-close-x');
    if (btnCloseX) {
        btnCloseX.addEventListener('click', closeChangelogModal);
    }

    const btnCloseOk = dom.get('btn-changelog-ok');
    if (btnCloseOk) {
        btnCloseOk.addEventListener('click', closeChangelogModal);
    }

    // Закрытие по клику на фон
    const modal = dom.get('changelog-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeChangelogModal();
            }
        });
    }

    // Закрытие по клавише Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeChangelogModal();
        }
    });

    // Фоновая загрузка истории
    loadChangelogHistory();
}
