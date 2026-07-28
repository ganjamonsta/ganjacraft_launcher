/**
 * GanjaCraft Launcher - Mod Config Editor Component
 * Визуальный редактор конфигураций модов
 */

let currentSelectedFile = null;
let currentConfigData = null;
let originalRawContent = '';

/**
 * Отрендерить панель редактора конфигов модов
 */
export async function renderModConfigEditor(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="mod-config-editor-wrapper" style="display: flex; flex-direction: column; gap: 14px; width: 100%; height: 100%;">
            <!-- Верхняя панель управления конфигом -->
            <div class="unified-toolbar" style="display: flex; gap: 10px; align-items: center; background: rgba(25, 30, 38, 0.85); padding: 10px 14px; border-radius: var(--gc-radius-md); border: 1px solid var(--gc-border);">
                <div style="display: flex; flex: 1; gap: 10px; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: #888; white-space: nowrap;">Файл конфига:</label>
                    <select id="config-file-select" class="setting-select" style="flex: 1; max-width: 320px;">
                        <option value="">Загрузка списка конфигов...</option>
                    </select>
                    <div class="search-input-wrapper" style="width: 220px;">
                        <input type="text" id="config-search-input" placeholder="Поиск параметра..." autocomplete="off">
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="unified-btn" id="btn-refresh-mod-configs" title="Обновить список">🔄 Обновить</button>
                    <button type="button" class="unified-btn unified-btn-primary" id="btn-save-mod-config" title="Сохранить изменения" disabled>💾 Сохранить</button>
                </div>
            </div>

            <!-- Область отображения редактора -->
            <div id="mod-config-body" style="flex: 1; overflow-y: auto; overflow-y: overlay; padding-right: 4px;">
                <div class="unified-loading"><span class="unified-spinner"></span>Загрузка конфигураций...</div>
            </div>
        </div>
    `;

    setupEvents(container);
    await loadConfigFilesList(container);
}

/**
 * Загрузить список конфигурационных файлов
 */
async function loadConfigFilesList(container) {
    const select = container.querySelector('#config-file-select');
    const body = container.querySelector('#mod-config-body');
    if (!select || !body) return;

    try {
        const res = await window.api.listModConfigs();
        if (!res.success || !res.files || res.files.length === 0) {
            select.innerHTML = '<option value="">Конфигурационные файлы не найдены</option>';
            body.innerHTML = `
                <div class="settings-category" style="text-align: center; padding: 30px 20px;">
                    <h4>Папка config пуста или клиенты еще не запускались</h4>
                    <p style="font-size: 13px; color: #888; margin-top: 8px;">Запустите игру один раз, чтобы моды создали свои конфигурационные файлы.</p>
                </div>
            `;
            return;
        }

        select.innerHTML = res.files.map(f => `
            <option value="${f.relativePath}">${f.name} (${f.extension.toUpperCase()})</option>
        `).join('');

        // Выбираем первый файл по умолчанию или предыдущий выделенный
        const defaultFile = currentSelectedFile && res.files.some(f => f.relativePath === currentSelectedFile)
            ? currentSelectedFile
            : res.files[0].relativePath;

        select.value = defaultFile;
        await loadAndRenderFile(container, defaultFile);
    } catch (e) {
        console.error('Error loading mod config files:', e);
        body.innerHTML = `<div class="settings-category" style="color: #ff5252;">Ошибка загрузки списка: ${e.message}</div>`;
    }
}

/**
 * Настроить обработчики событий
 */
function setupEvents(container) {
    const select = container.querySelector('#config-file-select');
    const searchInput = container.querySelector('#config-search-input');
    const refreshBtn = container.querySelector('#btn-refresh-mod-configs');
    const saveBtn = container.querySelector('#btn-save-mod-config');

    if (select) {
        select.addEventListener('change', async (e) => {
            if (e.target.value) {
                await loadAndRenderFile(container, e.target.value);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterConfigItems(container, e.target.value.trim().toLowerCase());
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadConfigFilesList(container);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await saveCurrentConfig(container);
        });
    }
}

/**
 * Прочитать и отрендерить файл
 */
async function loadAndRenderFile(container, relativePath) {
    currentSelectedFile = relativePath;
    const body = container.querySelector('#mod-config-body');
    const saveBtn = container.querySelector('#btn-save-mod-config');
    if (!body) return;

    body.innerHTML = '<div class="unified-loading"><span class="unified-spinner"></span>Чтение файла...</div>';
    if (saveBtn) saveBtn.disabled = true;

    try {
        const res = await window.api.readModConfig(relativePath);
        if (!res.success) {
            body.innerHTML = `<div class="settings-category" style="color: #ff5252;">Ошибка чтения файла: ${res.error}</div>`;
            return;
        }

        currentConfigData = res.data;
        originalRawContent = res.data.rawContent;

        if (res.data.items && res.data.items.length > 0) {
            renderFormMode(body, res.data);
        } else {
            renderRawTextMode(body, res.data.rawContent);
        }

        if (saveBtn) saveBtn.disabled = false;
    } catch (e) {
        console.error('Error reading config file:', e);
        body.innerHTML = `<div class="settings-category" style="color: #ff5252;">Ошибка: ${e.message}</div>`;
    }
}

/**
 * Отображение визиуальной интерактивной формы
 */
function renderFormMode(bodyContainer, data) {
    // Группировка по категориям
    const categoriesMap = {};
    data.items.forEach(item => {
        const cat = item.category || 'Общие';
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(item);
    });

    const fragment = document.createDocumentFragment();

    Object.keys(categoriesMap).forEach(catName => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'settings-category config-category-group';
        categoryCard.dataset.category = catName;

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
            <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <h4>${catName}</h4>
        `;
        categoryCard.appendChild(header);

        const content = document.createElement('div');
        content.className = 'category-content';

        categoriesMap[catName].forEach(item => {
            const itemRow = document.createElement('div');
            itemRow.className = 'setting-item config-param-item';
            itemRow.dataset.key = item.key.toLowerCase();
            itemRow.dataset.desc = (item.description || '').toLowerCase();

            let controlHtml = '';
            if (item.type === 'boolean') {
                controlHtml = `
                    <span class="toggle-switch">
                        <input type="checkbox" data-item-key="${item.key}" ${item.value ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </span>
                `;
            } else if (item.type === 'number') {
                controlHtml = `
                    <input type="number" class="unified-input" data-item-key="${item.key}" value="${item.value}" style="width: 110px; font-family: monospace;">
                `;
            } else {
                controlHtml = `
                    <input type="text" class="unified-input" data-item-key="${item.key}" value="${escapeHtml(String(item.value))}" style="width: 220px; font-family: monospace;">
                `;
            }

            const descHtml = item.description ? `<span class="setting-desc" style="color: #9aa0a6;">${escapeHtml(item.description)}</span>` : '';

            itemRow.innerHTML = `
                <div class="setting-label" style="flex: 1; padding-right: 12px;">
                    <div class="setting-text">
                        <span class="setting-title" style="font-family: monospace; color: #4caf50; font-weight: 600;">${escapeHtml(item.key)}</span>
                        ${descHtml}
                    </div>
                </div>
                <div class="setting-control">
                    ${controlHtml}
                </div>
            `;

            content.appendChild(itemRow);
        });

        categoryCard.appendChild(content);
        fragment.appendChild(categoryCard);
    });

    bodyContainer.innerHTML = '';
    bodyContainer.appendChild(fragment);
}

/**
 * Резервное отображение в виде полнофункционального текстового редактора
 */
function renderRawTextMode(bodyContainer, rawContent) {
    bodyContainer.innerHTML = `
        <div class="settings-category" style="display: flex; flex-direction: column; gap: 10px;">
            <div class="category-header">
                <h4>Редактор исходного текста конфигурации</h4>
            </div>
            <textarea id="config-raw-textarea" class="unified-input" style="width: 100%; height: 420px; font-family: consolas, monospace; font-size: 13px; line-height: 1.5; background: rgba(12, 14, 18, 0.95); color: #e0e0e0; resize: vertical; padding: 12px; border: 1px solid var(--gc-border);">${escapeHtml(rawContent)}</textarea>
        </div>
    `;
}

/**
 * Фильтрация параметров по поисковому запросу
 */
function filterConfigItems(container, query) {
    const items = container.querySelectorAll('.config-param-item');
    items.forEach(item => {
        const key = item.dataset.key || '';
        const desc = item.dataset.desc || '';
        if (!query || key.includes(query) || desc.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Сохранить текущую конфигурацию
 */
async function saveCurrentConfig(container) {
    if (!currentSelectedFile) return;

    const saveBtn = container.querySelector('#btn-save-mod-config');
    if (saveBtn) saveBtn.disabled = true;

    try {
        let newContent = '';
        const rawTextarea = container.querySelector('#config-raw-textarea');

        if (rawTextarea) {
            newContent = rawTextarea.value;
        } else if (currentConfigData && currentConfigData.items) {
            // Собираем измененные значения с полей формы и обновляем исходные строки
            const lines = originalRawContent.split(/\r?\n/);

            currentConfigData.items.forEach(item => {
                const input = container.querySelector(`[data-item-key="${item.key}"]`);
                if (!input) return;

                let val;
                if (item.type === 'boolean') {
                    val = input.checked;
                } else if (item.type === 'number') {
                    val = Number(input.value);
                } else {
                    val = input.value;
                }

                // Заменяем значение в соответствующей строке
                if (item.lineNumber && item.lineNumber <= lines.length) {
                    const idx = item.lineNumber - 1;
                    const line = lines[idx];

                    if (item.type === 'boolean') {
                        lines[idx] = line.replace(/:\s*(true|false)/i, `: ${val}`).replace(/=\s*(true|false)/i, `= ${val}`);
                    } else if (item.type === 'number') {
                        lines[idx] = line.replace(/:\s*(-?\d+\.?\d*)/, `: ${val}`).replace(/=\s*(-?\d+\.?\d*)/, `= ${val}`);
                    } else {
                        lines[idx] = line.replace(/(["']).*?\1/, `"${val}"`).replace(/:\s*.*$/, `: "${val}"`).replace(/=\s*.*$/, `= "${val}"`);
                    }
                }
            });

            newContent = lines.join('\n');
        }

        const res = await window.api.saveModConfig(currentSelectedFile, newContent);
        if (res.success) {
            alert('Конфигурация успешно сохранена!');
            originalRawContent = newContent;
        } else {
            alert('Ошибка сохранения: ' + res.error);
        }
    } catch (e) {
        console.error('Error saving mod config:', e);
        alert('Ошибка при сохранении: ' + e.message);
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
