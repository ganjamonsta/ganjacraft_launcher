const { contextBridge, ipcRenderer } = require('electron');

const MOCK_AUTH = process.env.MOCK_AUTH === '1';

const API_BASE = 'https://ganjalaunch.share.zrok.io/api';
const DEFAULT_TIMEOUT = 15000;

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function readJsonOrThrow(response) {
    const text = await response.text();
    if (!text) {
        throw new Error('Empty response from server');
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(`Invalid JSON response: ${text}`);
    }
}

// Unified API call helper to reduce duplication
async function apiCall(endpoint, { method = 'POST', body = null, headers = {}, returnErrorAsResult = false } = {}) {
    try {
        const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: body ? JSON.stringify(body) : undefined,
            timeout: DEFAULT_TIMEOUT
        });
        
        if (!response.ok) {
            if (returnErrorAsResult) {
                return { success: false, message: `API Error: ${response.status}` };
            }
            const text = await response.text();
            throw new Error(`API Error: ${response.status} - ${text}`);
        }
        return readJsonOrThrow(response);
    } catch (e) {
        if (e && e.name === 'AbortError') {
            const msg = 'Таймаут сети (сервер не ответил вовремя)';
            if (returnErrorAsResult) return { success: false, message: msg };
            throw new Error(msg);
        }
        if (returnErrorAsResult) return { success: false, message: e?.message || String(e) };
        throw new Error(e?.message || String(e));
    }
}

if (MOCK_AUTH) console.log('[MOCK_AUTH] Mock auth mode enabled');

contextBridge.exposeInMainWorld('api', {
    isMockAuth: MOCK_AUTH,
    launchGame: (options) => ipcRenderer.invoke('launch-game', options),
    
    // Auth API calls with offline fallback when backend is not running
    requestAuth: async (username) => {
        if (MOCK_AUTH) return { success: true, message: '[MOCK] Code sent' };
        try {
            return await apiCall('/launcher/auth/request', { body: { username } });
        } catch (e) {
            console.warn('Backend auth server unreachable, enabling offline login:', e.message);
            return { success: true, offline: true, message: 'Офлайн режим (без кода)' };
        }
    },
    verifyAuth: async (username, code) => {
        if (MOCK_AUTH) return { success: true, token: 'mock-token', is_admin: true };
        try {
            return await apiCall('/launcher/auth/verify', { body: { username, code } });
        } catch (e) {
            console.warn('Backend auth server unreachable, fallback to offline token:', e.message);
            return { success: true, token: 'offline-token', is_admin: false, offline: true };
        }
    },
    checkAuth: async (username, token) => {
        if (MOCK_AUTH) return { success: true, is_admin: true };
        try {
            return await apiCall('/launcher/auth/check', {
                body: { username },
                headers: { 'X-Auth-Token': token },
                returnErrorAsResult: true
            });
        } catch (e) {
            return { success: true, is_admin: false, offline: true };
        }
    },
    
    getNews: async () => {
        if (MOCK_AUTH) return { success: true, news: [{ id: 1, title: '[MOCK] GanjaCraft News', content: 'Локальный тестовый режим', date: new Date().toISOString() }] };
        try {
            const response = await fetchWithTimeout(`${API_BASE}/news?limit=5`);
            return response.json();
        } catch (e) {
            return { success: false, error: e.message, news: [] };
        }
    },
    onLog: (callback) => ipcRenderer.on('log-message', (event, text) => callback(text)),
    onProgress: (callback) => ipcRenderer.on('progress', (event, e) => callback(e)),
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),
    
    // Settings & Config
    loadConfig: () => ipcRenderer.invoke('load-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    selectPath: (type) => ipcRenderer.invoke('select-path', type), // type: 'dir' or 'file'
    openFolder: (path) => ipcRenderer.invoke('open-folder', path),
    openUrl: (url) => ipcRenderer.invoke('open-url', url),
    
    // Advanced
    reinstallClient: () => ipcRenderer.invoke('reinstall-client'),
    getManifest: () => ipcRenderer.invoke('get-manifest'), // To list mods in UI
    
    // Admin Dev Tools
    devSyncCategory: (category, options) => ipcRenderer.invoke('dev-sync-category', category, options),
    devDeleteCategory: (category) => ipcRenderer.invoke('dev-delete-category', category),
    devGetCategoryCounts: () => ipcRenderer.invoke('dev-get-category-counts'),
    devFetchServerScripts: (options) => ipcRenderer.invoke('dev-fetch-server-scripts', options),
    devCancelOperation: (category) => ipcRenderer.send('dev-cancel-operation', category),
    onDevProgress: (callback) => ipcRenderer.on('dev-progress', (event, data) => callback(data)),
    
    // Events
    onGameClosed: (callback) => ipcRenderer.on('game-closed', () => callback()),
    
    cancelLaunch: () => ipcRenderer.invoke('cancel-launch'),
    showContextMenu: () => ipcRenderer.send('show-context-menu')
});
