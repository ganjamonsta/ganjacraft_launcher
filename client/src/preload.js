const { contextBridge, ipcRenderer } = require('electron');

const MOCK_AUTH = process.env.MOCK_AUTH === '1';

const API_BASE = 'http://regarding-john.gl.at.ply.gg:4917/api';
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
    
    // Auth API calls (unified)
    requestAuth: MOCK_AUTH
        ? async (username) => ({ success: true, message: '[MOCK] Code sent' })
        : (username) => apiCall('/launcher/auth/request', { body: { username } }),
    verifyAuth: MOCK_AUTH
        ? async (username, code) => ({ success: true, token: 'mock-token', is_admin: true })
        : (username, code) => apiCall('/launcher/auth/verify', { body: { username, code } }),
    checkAuth: MOCK_AUTH
        ? async (username, token) => ({ success: true, is_admin: true })
        : (username, token) => apiCall('/launcher/auth/check', {
            body: { username },
            headers: { 'X-Auth-Token': token },
            returnErrorAsResult: true
        }),
    
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
