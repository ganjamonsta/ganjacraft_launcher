/**
 * GanjaCraft Launcher - Authentication Feature
 * Аутентификация через Telegram OTP
 */

import { appState } from '../../state/app-state.js';
import { dom } from '../../utils/dom.js';
import { showError } from '../../ui/modals.js';
import { ERROR_DISPLAY_TIME } from '../../constants.js';
import { applyAdminClass } from '../dev-tools/index.js';

// Локальный стейт для auth flow
let currentUsername = '';

/**
 * Проверить сохранённую аутентификацию
 */
export async function checkSavedAuth() {
    // Small delay to ensure Electron has loaded localStorage from leveldb
    await new Promise(r => setTimeout(r, 100));
    
    const savedUser = localStorage.getItem('auth_user');
    const savedToken = localStorage.getItem('auth_token');

    if (savedUser && savedToken) {
        try {
            const result = await window.api.checkAuth(savedUser, savedToken);
            // Server returns { success: true } not { valid: true }
            if (result.success) {
                currentUsername = savedUser;
                
                // Update admin status from server
                if (result.is_admin) {
                    localStorage.setItem('is_admin', 'true');
                } else {
                    localStorage.removeItem('is_admin');
                }
                
                appState.update('auth', {
                    isLoggedIn: true,
                    username: savedUser,
                    token: savedToken,
                    isAdmin: !!result.is_admin
                });
                
                applyAdminClass();
                hideLoginStep();
                showPlayScreen();
                return true;
            }
        } catch (e) {
            console.warn('[AUTH] Token check failed:', e);
        }
        
        // Token invalid, clear
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
    }
    
    // No valid auth - show login screen
    showLoginScreen();
    return false;
}

/**
 * Запросить код подтверждения (Step 1)
 * @param {string} username 
 */
export async function requestAuthCode(username) {
    if (!username.trim()) {
        showError('login-error', 'Пожалуйста, введите никнейм');
        return { success: false };
    }
    
    try {
        const result = await window.api.requestAuth(username);
        if (result.success) {
            currentUsername = username;
            appState.set('auth.username', username);
            return { success: true };
        } else {
            showError('login-error', result.message || 'Ошибка сервера');
            return { success: false, error: result.message };
        }
    } catch (e) {
        showError('login-error', e.message);
        console.error('[AUTH] Request code failed:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Проверить код подтверждения (Step 2)
 * @param {string} code 
 */
export async function verifyAuthCode(code) {
    if (!code.trim()) {
        return { success: false, error: 'Введите код' };
    }
    
    try {
        const result = await window.api.verifyAuth(currentUsername, code);
        if (result.success) {
            // Save auth to localStorage
            localStorage.setItem('auth_user', currentUsername);
            if (result.token) {
                localStorage.setItem('auth_token', result.token);
            }
            // Save admin status
            if (result.is_admin) {
                localStorage.setItem('is_admin', 'true');
            } else {
                localStorage.removeItem('is_admin');
            }
            
            appState.update('auth', {
                isLoggedIn: true,
                username: currentUsername,
                token: result.token,
                isAdmin: !!result.is_admin
            });
            
            applyAdminClass();
            return { success: true };
        } else {
            showError('code-error', result.error || 'Неверный код');
            return { success: false, error: result.error };
        }
    } catch (e) {
        const message = e?.message || String(e);
        showError('code-error', message || 'Ошибка сети');
        console.error('[AUTH] Verify failed:', e);
        return { success: false, error: message };
    }
}

/**
 * Выход из аккаунта
 */
export function logout() {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    
    appState.update('auth', {
        isLoggedIn: false,
        username: null,
        token: null
    });
    
    currentUsername = '';
    
    // Reload to reset UI
    location.reload();
}

/**
 * Получить текущего пользователя
 */
export function getCurrentUsername() {
    return currentUsername || appState.get('auth.username');
}

/**
 * Получить токен
 */
export function getAuthToken() {
    return localStorage.getItem('auth_token');
}

// --- UI Helpers ---

function hideLoadingStep() {
    const stepLoading = dom.get('step-loading');
    if (stepLoading) stepLoading.classList.add('hidden');
}

function hideLoginStep() {
    const stepLogin = dom.get('step-login');
    if (stepLogin) stepLogin.classList.add('hidden');
}

function showLoginScreen() {
    hideLoadingStep();
    const stepLogin = dom.get('step-login');
    if (stepLogin) {
        stepLogin.classList.remove('hidden');
        stepLogin.classList.add('fade-in');
    }
    // Focus username input
    const usernameInput = dom.get('username');
    if (usernameInput) usernameInput.focus();
}

function showPlayScreen() {
    hideLoadingStep();
    const stepPlay = dom.get('step-play');
    const welcomeMsg = dom.get('welcome-msg');
    
    if (stepPlay) {
        stepPlay.classList.remove('hidden');
        stepPlay.classList.add('fade-in');
    }
    
    if (welcomeMsg) {
        welcomeMsg.innerText = `Добро пожаловать, ${currentUsername}!`;
    }
}

/**
 * Инициализация обработчиков аутентификации
 */
export function initAuthHandlers() {
    const loginBtn = dom.get('login-btn');
    const verifyBtn = dom.get('verify-btn');
    const logoutBtn = dom.get('logout-btn');
    const usernameInput = dom.get('username');
    const codeInput = dom.get('auth-code');
    const stepLogin = dom.get('step-login');
    const stepCode = dom.get('step-code');
    
    // Login button
    if (loginBtn && usernameInput) {
        loginBtn.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            
            loginBtn.disabled = true;
            loginBtn.innerText = '...';
            
            try {
                const result = await requestAuthCode(username);
                if (result.success) {
                    stepLogin.classList.add('hidden');
                    stepCode.classList.remove('hidden');
                    stepCode.classList.add('fade-in');
                    codeInput?.focus();
                }
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerText = 'Далее';
                usernameInput.focus();
            }
        });
        
        // Enter key support
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });
    }
    
    // Verify button
    if (verifyBtn && codeInput) {
        verifyBtn.addEventListener('click', async () => {
            const code = codeInput.value.trim();
            if (!code) return;
            
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'Проверка...';
            
            try {
                const result = await verifyAuthCode(code);
                if (result.success) {
                    stepCode.classList.add('hidden');
                    showPlayScreen();
                }
            } finally {
                if (!appState.get('auth.isLoggedIn')) {
                    verifyBtn.disabled = false;
                    verifyBtn.innerText = 'Подтвердить';
                }
            }
        });
        
        // Enter key support
        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                verifyBtn.click();
            }
        });
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}
