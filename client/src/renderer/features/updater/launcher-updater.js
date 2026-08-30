/**
 * Ganj4Craft Launcher - Auto-Updater Feature
 * Управление состоянием обновления лаунчера и переключением кнопки «Играть» -> «Обновить»
 */

import { dom } from '../../utils/dom.js';
import { customAlert, showNotification } from '../../ui/modals.js';
import { logToConsole } from '../console/index.js';

const updaterState = {
    isAvailable: false,
    version: '',
    isDownloading: false,
    isDownloaded: false,
    percent: 0
};

export function isLauncherUpdateAvailable() {
    return updaterState.isAvailable;
}

export function isLauncherUpdateDownloading() {
    return updaterState.isDownloading;
}

export function isLauncherUpdateDownloaded() {
    return updaterState.isDownloaded;
}

export function getLauncherUpdateState() {
    return { ...updaterState };
}

/**
 * Отрисовать состояние кнопки Play / Update
 */
export function renderLauncherUpdateButton() {
    const playBtn = dom.get('play-btn');
    if (!playBtn) return;

    if (updaterState.isDownloaded) {
        playBtn.className = 'magnetic-play-btn-circle is-update-btn is-ready-to-install';
        playBtn.setAttribute('title', 'Установить обновление и перезапустить');
        playBtn.setAttribute('aria-label', 'Перезапустить');
        playBtn.innerHTML = `
            <span class="play-btn-glow-ring update-glow ready-glow"></span>
            <svg class="play-btn-update-icon ready-icon" viewBox="0 0 24 24" fill="none" stroke="#39ff14" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
        `;
    } else if (updaterState.isDownloading) {
        playBtn.className = 'magnetic-play-btn-circle is-update-btn is-downloading';
        const titleText = updaterState.percent > 0 ? `Загрузка обновления (${updaterState.percent}%)...` : 'Загрузка обновления...';
        playBtn.setAttribute('title', titleText);
        playBtn.setAttribute('aria-label', 'Загрузка обновления');
        playBtn.innerHTML = `
            <span class="play-btn-glow-ring update-glow pulse-fast"></span>
            <svg class="play-btn-update-icon spinning-update" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
        `;
    } else if (updaterState.isAvailable) {
        playBtn.className = 'magnetic-play-btn-circle is-update-btn';
        const titleText = updaterState.version ? `Обновить лаунчер (v${updaterState.version})` : 'Обновить лаунчер';
        playBtn.setAttribute('title', titleText);
        playBtn.setAttribute('aria-label', 'Обновить');
        playBtn.innerHTML = `
            <span class="play-btn-glow-ring update-glow"></span>
            <svg class="play-btn-update-icon" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
    } else {
        playBtn.className = 'magnetic-play-btn-circle';
        playBtn.setAttribute('title', 'Играть');
        playBtn.setAttribute('aria-label', 'Играть');
        playBtn.innerHTML = `
            <span class="play-btn-glow-ring"></span>
            <svg class="play-btn-triangle-icon" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `;
    }
}

/**
 * Начать загрузку обновления
 */
export async function startDownloadingLauncherUpdate() {
    if (updaterState.isDownloading) {
        showNotification(`Загрузка обновления уже идёт${updaterState.percent > 0 ? ` (${updaterState.percent}%)` : ''}...`, 'info', 'Обновление', 3000);
        return;
    }
    if (updaterState.isDownloaded) {
        window.api.installUpdate();
        return;
    }

    updaterState.isDownloading = true;
    renderLauncherUpdateButton();
    showNotification('Загрузка обновления началась...', 'info', 'Обновление', 4000);
    logToConsole('[UPDATER] Загрузка новой версии лаунчера...');

    try {
        const res = await window.api.downloadUpdate();
        if (res && res.success === false) {
            updaterState.isDownloading = false;
            renderLauncherUpdateButton();
            showNotification(`Ошибка скачивания обновления: ${res.error || 'Неизвестная ошибка'}`, 'error', 'Ошибка обновления', 6000);
        }
    } catch (e) {
        updaterState.isDownloading = false;
        renderLauncherUpdateButton();
        console.error('[UPDATER] downloadUpdate error:', e);
        showNotification(`Ошибка скачивания обновления: ${e.message}`, 'error', 'Ошибка обновления', 6000);
    }
}

/**
 * Обработка клика по кнопке обновления
 */
export function handleLauncherUpdateClick() {
    if (updaterState.isDownloaded) {
        logToConsole('[UPDATER] Установка обновления и перезапуск...');
        window.api.installUpdate();
    } else if (updaterState.isDownloading) {
        showNotification(`Загрузка обновления продолжается${updaterState.percent > 0 ? ` (${updaterState.percent}%)` : ''}...`, 'info', 'Обновление', 3000);
    } else if (updaterState.isAvailable) {
        startDownloadingLauncherUpdate();
    }
}

/**
 * Инициализация обработчиков IPC для обновления лаунчера
 */
export function initLauncherUpdaterHandlers() {
    if (!window.api) return;

    if (window.api.onUpdateAvailable) {
        window.api.onUpdateAvailable(async (info) => {
            const version = info?.version || '';
            updaterState.isAvailable = true;
            updaterState.version = version;
            renderLauncherUpdateButton();

            const msg = version 
                ? `Доступна новая версия лаунчера (v${version}). Для продолжения игры необходимо обновить лаунчер.`
                : 'Доступна новая версия лаунчера. Для продолжения игры необходимо обновить лаунчер.';

            await customAlert(msg, 'Доступно обновление', 'ОБНОВИТЬ');
            startDownloadingLauncherUpdate();
        });
    }

    if (window.api.onUpdateProgress) {
        window.api.onUpdateProgress((progress) => {
            if (!updaterState.isDownloading) {
                updaterState.isDownloading = true;
            }
            if (progress && typeof progress.percent === 'number') {
                updaterState.percent = Math.round(progress.percent);
            }
            renderLauncherUpdateButton();
        });
    }

    if (window.api.onUpdateDownloaded) {
        window.api.onUpdateDownloaded(async () => {
            updaterState.isDownloading = false;
            updaterState.isDownloaded = true;
            renderLauncherUpdateButton();

            logToConsole('[UPDATER] Обновление успешно загружено.');
            showNotification('Обновление готово к установке!', 'success', 'Обновление', 5000);

            await customAlert('Обновление успешно загружено. Перезапустите лаунчер для установки новой версии.', 'Обновление готово', 'ПЕРЕЗАПУСТИТЬ');
            window.api.installUpdate();
        });
    }
}
