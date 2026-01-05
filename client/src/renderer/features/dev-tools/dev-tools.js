/**
 * GanjaCraft Launcher - Dev Tools Feature
 * Админ-инструменты для разработки
 */

import { dom } from '../../utils/dom.js';
import { customConfirm, customAlert, showNotification } from '../../ui/modals.js';
import { logToConsole, showConsole } from '../console/console.js';

// Отслеживание активных операций
const activeOperations = new Map();

// Флаг инициализации
let devToolsListenersInitialized = false;

/**
 * Логирование в консоль с префиксом [DEV]
 */
function devLog(message) {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    logToConsole(`[${timestamp}] [DEV] ${message}`);
}

/**
 * Форматирование размера файла
 */
function formatSize(bytes) {
    if (bytes === 0 || bytes == null) return '--';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Обновить индикатор синхронизации
 */
function updateSyncIndicator(category, status) {
    const indicator = document.getElementById(`dev-indicator-${category}`);
    if (indicator) {
        indicator.className = 'dev-sync-indicator ' + status;
    }
}

/**
 * Обновить прогресс-бар
 */
export function updateProgress(category, percent) {
    const bar = document.getElementById(`dev-progress-${category}`);
    if (bar) {
        bar.style.width = percent + '%';
        if (percent >= 100) {
            bar.classList.add('complete');
        } else {
            bar.classList.remove('complete');
        }
    }
}

/**
 * Загрузить счётчики категорий
 */
export async function loadDevCategoryCounts() {
    try {
        const result = await window.api.devGetCategoryCounts();
        if (result.success && result.counts) {
            const counts = result.counts;
            let totalFiles = 0;
            let totalSize = 0;
            
            const updateCount = (category, data) => {
                const el = document.getElementById(`dev-${category}-count`);
                if (el) {
                    el.textContent = `${data.local} / ${data.manifest}`;
                    el.title = `Локально: ${data.local}, В манифесте: ${data.manifest}`;
                }
                
                // Обновляем размер
                const sizeEl = document.getElementById(`dev-${category}-size`);
                if (sizeEl && data.size != null) {
                    sizeEl.textContent = formatSize(data.size);
                    totalSize += data.size;
                }
                
                // Обновляем pending (нужно скачать)
                const pendingEl = document.getElementById(`dev-${category}-pending`);
                if (pendingEl) {
                    const pending = (data.manifest || 0) - (data.local || 0);
                    if (pending > 0) {
                        pendingEl.textContent = `${pending} к загрузке`;
                    } else {
                        pendingEl.textContent = '';
                    }
                }
                
                // Обновляем индикатор
                const local = data.local || 0;
                const manifest = data.manifest || 0;
                totalFiles += local;
                
                if (local === 0 && manifest === 0) {
                    updateSyncIndicator(category, '');
                } else if (local >= manifest) {
                    updateSyncIndicator(category, 'synced');
                } else {
                    updateSyncIndicator(category, 'pending');
                }
                
                // Обновляем прогресс
                const progress = manifest > 0 ? Math.round((local / manifest) * 100) : 0;
                updateProgress(category, progress);
            };
            
            updateCount('mods', counts.mods || { local: 0, manifest: 0 });
            updateCount('config', counts.config || { local: 0, manifest: 0 });
            updateCount('kubejs', counts.kubejs || { local: 0, manifest: 0 });
            updateCount('resourcepacks', counts.resourcepacks || { local: 0, manifest: 0 });
            updateCount('thingpacks', counts.thingpacks || { local: 0, manifest: 0 });
            
            // Обновляем глобальную статистику
            const totalFilesEl = document.getElementById('dev-total-files');
            if (totalFilesEl) totalFilesEl.textContent = `${totalFiles} файлов`;
            
            const totalSizeEl = document.getElementById('dev-total-size');
            if (totalSizeEl) totalSizeEl.textContent = formatSize(totalSize);
        }
    } catch (e) {
        console.error('Failed to load category counts:', e);
    }
}

/**
 * Показать статус операции
 */
export function showDevStatus(category, message, type = 'info') {
    const statusEl = document.getElementById(`dev-status-${category}`);
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `unified-status show unified-status-${type}`;
        
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 5000);
    }
}

/**
 * Установить состояние загрузки кнопки
 */
function setDevButtonLoading(btn, loading) {
    if (loading) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        const text = btn.textContent.trim();
        btn.innerHTML = `<span class="unified-spinner"></span>`;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }
}

/**
 * Получить выбранные папки KubeJS
 */
function getKubejsSelectedFolders() {
    const folders = [];
    if (document.getElementById('dev-kjs-client')?.checked) folders.push('client_scripts');
    if (document.getElementById('dev-kjs-startup')?.checked) folders.push('startup_scripts');
    if (document.getElementById('dev-kjs-server')?.checked) folders.push('server_scripts');
    if (document.getElementById('dev-kjs-assets')?.checked) folders.push('assets');
    return folders;
}

/**
 * Показать/скрыть кнопку отмены
 */
function showCancelButton(category, show = true) {
    const cancelBtn = document.querySelector(`.unified-btn[data-category="${category}"][data-cancel]`);
    const actionBtns = document.querySelectorAll(`.unified-btn[data-category="${category}"][data-action]`);
    
    if (cancelBtn) {
        if (show) {
            cancelBtn.classList.remove('hidden');
            actionBtns.forEach(btn => btn.style.display = 'none');
        } else {
            cancelBtn.classList.add('hidden');
            actionBtns.forEach(btn => btn.style.display = '');
        }
    }
}

/**
 * Инициализация слушателей Dev Tools
 */
export function initDevToolsListeners() {
    if (devToolsListenersInitialized) return;
    devToolsListenersInitialized = true;
    
    // Category action handlers
    document.querySelectorAll('.unified-btn[data-category][data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const category = btn.dataset.category;
            const action = btn.dataset.action;
            
            if (!category || !action) return;
            
            activeOperations.set(category, { cancelled: false });
            showCancelButton(category, true);
            setDevButtonLoading(btn, true);
            updateSyncIndicator(category, 'syncing');
            
            const actionName = action === 'delete' ? 'Удаление' : (action === 'force' ? 'Force Sync' : 'Sync');
            devLog(`${actionName} ${category}...`);
            showConsole();
            
            try {
                if (action === 'delete') {
                    const confirmed = await customConfirm(
                        `Удалить все файлы категории "${category}"?`,
                        '⚠️ Подтверждение удаления'
                    );
                    if (!confirmed) {
                        devLog(`${category}: Удаление отменено пользователем`);
                        setDevButtonLoading(btn, false);
                        showCancelButton(category, false);
                        activeOperations.delete(category);
                        updateSyncIndicator(category, '');
                        await loadDevCategoryCounts();
                        return;
                    }
                    
                    const result = await window.api.devDeleteCategory(category);
                    if (result.success) {
                        devLog(`${category}: Удалено ${result.deleted} файлов`);
                        showDevStatus(category, `Удалено: ${result.deleted} элементов`, 'success');
                        updateSyncIndicator(category, 'pending');
                    } else {
                        devLog(`${category}: ОШИБКА - ${result.error}`);
                        showDevStatus(category, `Ошибка: ${result.error}`, 'error');
                        updateSyncIndicator(category, 'error');
                    }
                } else {
                    const force = action === 'force';
                    const options = { force };
                    
                    if (category === 'kubejs') {
                        options.kubejsFolders = getKubejsSelectedFolders();
                        if (options.kubejsFolders.length === 0) {
                            devLog(`${category}: Не выбраны папки`);
                            showDevStatus(category, 'Выберите хотя бы одну папку KubeJS', 'error');
                            setDevButtonLoading(btn, false);
                            showCancelButton(category, false);
                            activeOperations.delete(category);
                            updateSyncIndicator(category, 'error');
                            return;
                        }
                        devLog(`${category}: Папки - ${options.kubejsFolders.join(', ')}`);
                    }
                    
                    const result = await window.api.devSyncCategory(category, options);
                    
                    const op = activeOperations.get(category);
                    if (op?.cancelled) {
                        devLog(`${category}: Операция отменена`);
                        showDevStatus(category, 'Операция отменена', 'info');
                    } else if (result.success) {
                        devLog(`${category}: Скачано ${result.downloaded}, пропущено ${result.skipped}`);
                        showDevStatus(category, `Скачано: ${result.downloaded}, пропущено: ${result.skipped}`, 'success');
                        updateSyncIndicator(category, 'synced');
                    } else {
                        devLog(`${category}: ОШИБКА - ${result.error}`);
                        showDevStatus(category, `Ошибка: ${result.error}`, 'error');
                        updateSyncIndicator(category, 'error');
                    }
                }
                
                await loadDevCategoryCounts();
            } catch (e) {
                const op = activeOperations.get(category);
                if (!op?.cancelled) {
                    devLog(`${category}: ИСКЛЮЧЕНИЕ - ${e.message}`);
                    showDevStatus(category, `Ошибка: ${e.message}`, 'error');
                    updateSyncIndicator(category, 'error');
                }
            } finally {
                setDevButtonLoading(btn, false);
                showCancelButton(category, false);
                activeOperations.delete(category);
            }
        });
    });

    // Cancel button handlers
    document.querySelectorAll('.unified-btn[data-category][data-cancel]').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            const op = activeOperations.get(category);
            if (op) {
                op.cancelled = true;
                window.api.devCancelOperation(category);
                devLog(`${category}: Запрос отмены операции`);
                showDevStatus(category, 'Отмена...', 'info');
                btn.disabled = true;
            }
        });
    });

    // Sync All button
    const syncAllBtn = document.getElementById('dev-sync-all');
    if (syncAllBtn) {
        syncAllBtn.addEventListener('click', async () => {
            setDevButtonLoading(syncAllBtn, true);
            devLog('=== SYNC ALL ===');
            showConsole();
            
            const categories = ['mods', 'config', 'kubejs', 'resourcepacks', 'thingpacks'];
            let totalDownloaded = 0;
            let errors = [];
            
            for (const category of categories) {
                try {
                    devLog(`Синхронизация ${category}...`);
                    updateSyncIndicator(category, 'syncing');
                    
                    const options = {};
                    if (category === 'kubejs') {
                        options.kubejsFolders = getKubejsSelectedFolders();
                    }
                    
                    const result = await window.api.devSyncCategory(category, options);
                    if (result.success) {
                        totalDownloaded += result.downloaded || 0;
                        devLog(`${category}: Скачано ${result.downloaded}, пропущено ${result.skipped}`);
                        updateSyncIndicator(category, 'synced');
                    } else {
                        errors.push(`${category}: ${result.error}`);
                        devLog(`${category}: ОШИБКА - ${result.error}`);
                        updateSyncIndicator(category, 'error');
                    }
                } catch (e) {
                    errors.push(`${category}: ${e.message}`);
                    devLog(`${category}: ИСКЛЮЧЕНИЕ - ${e.message}`);
                    updateSyncIndicator(category, 'error');
                }
            }
            
            await loadDevCategoryCounts();
            setDevButtonLoading(syncAllBtn, false);
            devLog(`=== SYNC ALL ЗАВЕРШЕНО: ${totalDownloaded} файлов, ${errors.length} ошибок ===`);
            
            if (errors.length > 0) {
                await customAlert(`Синхронизация завершена с ошибками:\n\n${errors.join('\n')}\n\nСкачано файлов: ${totalDownloaded}`, '⚠️ Синхронизация завершена');
            } else {
                showNotification(`Скачано файлов: ${totalDownloaded}`, 'success', 'Синхронизация завершена');
            }
        });
    }

    // Force Sync All button
    const forceAllBtn = document.getElementById('dev-force-all');
    if (forceAllBtn) {
        forceAllBtn.addEventListener('click', async () => {
            const confirmed = await customConfirm(
                'Принудительно перекачать ВСЕ файлы?\nЭто может занять много времени.',
                '⚡ Принудительная синхронизация'
            );
            if (!confirmed) {
                devLog('Force All: Отменено пользователем');
                return;
            }
            
            devLog('========================================');
            devLog('⚡ FORCE ALL - Принудительная синхронизация');
            devLog('========================================');
            showConsole();
            
            setDevButtonLoading(forceAllBtn, true);
            
            const categories = ['mods', 'config', 'kubejs', 'resourcepacks', 'thingpacks'];
            let totalDownloaded = 0;
            let errors = [];
            
            for (const category of categories) {
                devLog(`Force ${category}...`);
                try {
                    const options = { force: true };
                    if (category === 'kubejs') {
                        options.kubejsFolders = getKubejsSelectedFolders();
                    }
                    
                    const result = await window.api.devSyncCategory(category, options);
                    if (result.success) {
                        totalDownloaded += result.downloaded || 0;
                        devLog(`  ✓ ${category}: Скачано ${result.downloaded || 0} файлов`);
                    } else {
                        errors.push(`${category}: ${result.error}`);
                        devLog(`  ✗ ${category}: ${result.error}`);
                    }
                } catch (e) {
                    errors.push(`${category}: ${e.message}`);
                    devLog(`  ✗ ${category}: Exception - ${e.message}`);
                }
            }
            
            await loadDevCategoryCounts();
            setDevButtonLoading(forceAllBtn, false);
            
            devLog('----------------------------------------');
            devLog(`⚡ FORCE ALL ЗАВЕРШЕНО: ${totalDownloaded} файлов, ${errors.length} ошибок`);
            devLog('========================================');
            
            if (errors.length > 0) {
                await customAlert(`Принудительная синхронизация завершена с ошибками:\n\n${errors.join('\n')}\n\nСкачано файлов: ${totalDownloaded}`, '⚠️ Синхронизация завершена');
            } else {
                showNotification(`Скачано файлов: ${totalDownloaded}`, 'success', 'Принудительная синхронизация завершена');
            }
        });
    }

    // Fetch Server Scripts button
    const fetchServerScriptsBtn = document.getElementById('dev-fetch-server-scripts');
    if (fetchServerScriptsBtn) {
        fetchServerScriptsBtn.addEventListener('click', async () => {
            devLog('Fetch Server Scripts: Запуск...');
            showConsole();
            setDevButtonLoading(fetchServerScriptsBtn, true);
            
            try {
                const result = await window.api.devFetchServerScripts();
                if (result.success) {
                    devLog(`  ✓ Server Scripts: Скачано ${result.downloaded} файлов`);
                    showDevStatus('kubejs', `Server Scripts: Скачано ${result.downloaded} файлов`, 'success');
                } else {
                    devLog(`  ✗ Server Scripts: ${result.error}`);
                    showDevStatus('kubejs', `Ошибка: ${result.error}`, 'error');
                }
                
                await loadDevCategoryCounts();
            } catch (e) {
                devLog(`  ✗ Server Scripts: Exception - ${e.message}`);
                showDevStatus('kubejs', `Ошибка: ${e.message}`, 'error');
            } finally {
                setDevButtonLoading(fetchServerScriptsBtn, false);
            }
        });
    }

    // Dev progress listener
    if (window.api.onDevProgress) {
        window.api.onDevProgress((data) => {
            if (data.category && data.message) {
                // Логируем прогресс в консоль
                devLog(`[${data.category}] ${data.message}`);
                
                const statusEl = document.getElementById(`dev-status-${data.category}`);
                if (statusEl) {
                    statusEl.textContent = data.message;
                    statusEl.className = 'unified-status show unified-status-info';
                }
            }
            
            if (data.category && data.localCount !== undefined && data.manifestCount !== undefined) {
                const counterId = `dev-${data.category}-count`;
                const counterEl = document.getElementById(counterId);
                if (counterEl) {
                    counterEl.textContent = `${data.localCount} / ${data.manifestCount}`;
                    counterEl.title = `Локально: ${data.localCount}, В манифесте: ${data.manifestCount}`;
                    
                    counterEl.classList.add('updating');
                    setTimeout(() => {
                        counterEl.classList.remove('updating');
                    }, 600);
                }
            }
        });
    }
}

/**
 * Сбросить флаг инициализации (для тестов)
 */
export function resetDevToolsListeners() {
    devToolsListenersInitialized = false;
}

/**
 * Проверить является ли пользователь админом
 */
export function isAdmin() {
    return localStorage.getItem('is_admin') === 'true';
}

/**
 * Применить admin class к body
 */
export function applyAdminClass() {
    if (isAdmin()) {
        document.body.classList.add('is-admin');
    } else {
        document.body.classList.remove('is-admin');
    }
}
