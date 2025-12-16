// --- Snow Effect ---
let snowInterval = null;

function createSnowflake() {
    const snowContainer = document.getElementById('snow-container');
    if (!snowContainer) return;

    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    snowflake.textContent = '❄';
    
    // Randomize
    snowflake.style.left = Math.random() * 100 + 'vw';
    // Slower: 8s to 15s
    snowflake.style.animationDuration = Math.random() * 7 + 8 + 's'; 
    snowflake.style.opacity = Math.random() * 0.6 + 0.2; // 0.2 - 0.8
    snowflake.style.fontSize = Math.random() * 10 + 8 + 'px'; // 8px - 18px
    
    // Randomize Animation (Swaying)
    const animations = ['fall-1', 'fall-2', 'fall-3'];
    snowflake.style.animationName = animations[Math.floor(Math.random() * animations.length)];

    snowContainer.appendChild(snowflake);
    
    // Remove after animation ends
    snowflake.addEventListener('animationend', () => {
        snowflake.remove();
    });
}

function toggleSnow(enable) {
    const snowContainer = document.getElementById('snow-container');
    if (enable) {
        if (!snowInterval) {
            // Create less frequently (every 400ms instead of 200ms)
            snowInterval = setInterval(createSnowflake, 400); 
            // Create initial batch
            for(let i=0; i<10; i++) setTimeout(createSnowflake, i * 300);
        }
    } else {
        if (snowInterval) {
            clearInterval(snowInterval);
            snowInterval = null;
        }
        if (snowContainer) snowContainer.innerHTML = ''; // Clear existing
    }
}

// UI Elements
const stepLoading = document.getElementById('step-loading');
const stepLogin = document.getElementById('step-login');
const stepCode = document.getElementById('step-code');
const stepPlay = document.getElementById('step-play');
const stepProgress = document.getElementById('step-progress');

const usernameInput = document.getElementById('username');
const codeInput = document.getElementById('auth-code');
const statusDiv = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const consoleOutput = document.getElementById('console-output');

let currentUsername = '';
let currentConfig = {};

// --- Settings Logic ---
const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('close-settings');
const btnSaveSettings = document.getElementById('save-settings');

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// Open Settings
btnSettings.addEventListener('click', async () => {
    currentConfig = await window.api.loadConfig();
    
    // Populate Fields
    document.getElementById('setting-path').value = currentConfig.installPath;
    document.getElementById('setting-java').value = currentConfig.javaPath || '';
    document.getElementById('setting-ram-min').value = currentConfig.memoryMin;
    document.getElementById('setting-ram-max').value = currentConfig.memoryMax;
    document.getElementById('setting-hide-on-play').checked = currentConfig.hideOnPlay !== false; // Default true
    document.getElementById('setting-enable-snow').checked = currentConfig.enableSnow !== false; // Default true
    
    // Load Mods
    loadModsList(currentConfig.disabledMods || []);
    
    settingsModal.classList.remove('hidden');
});

// Close Settings
btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

// Save Settings
btnSaveSettings.addEventListener('click', async () => {
    let memMin = document.getElementById('setting-ram-min').value.trim().toUpperCase();
    let memMax = document.getElementById('setting-ram-max').value.trim().toUpperCase();

    // Basic validation: Append 'G' if user just typed a number (assuming GB)
    if (memMin && /^\d+$/.test(memMin)) memMin += 'G';
    if (memMax && /^\d+$/.test(memMax)) memMax += 'G';

    // Validate format (must end in M or G)
    if (!/^\d+[MG]$/.test(memMin)) memMin = '2G';
    if (!/^\d+[MG]$/.test(memMax)) memMax = '6G';

    const newConfig = {
        installPath: document.getElementById('setting-path').value,
        javaPath: document.getElementById('setting-java').value,
        memoryMin: memMin,
        memoryMax: memMax,
        hideOnPlay: document.getElementById('setting-hide-on-play').checked,
        enableSnow: document.getElementById('setting-enable-snow').checked,
        disabledMods: getDisabledMods()
    };
    
    await window.api.saveConfig(newConfig);
    currentConfig = newConfig; // Update local config immediately
    
    // Apply Snow Effect
    toggleSnow(newConfig.enableSnow);

    // Update UI values to show formatted result
    document.getElementById('setting-ram-min').value = memMin;
    document.getElementById('setting-ram-max').value = memMax;

    settingsModal.classList.add('hidden');
    logToConsole('[SETTINGS] Saved.');
});

// Path Selectors
document.getElementById('btn-select-path').addEventListener('click', async () => {
    const path = await window.api.selectPath('dir');
    if (path) document.getElementById('setting-path').value = path;
});

document.getElementById('btn-open-path').addEventListener('click', async () => {
    const path = document.getElementById('setting-path').value;
    if (path) {
        await window.api.openFolder(path);
    }
});

document.getElementById('btn-select-java').addEventListener('click', async () => {
    const path = await window.api.selectPath('file');
    if (path) document.getElementById('setting-java').value = path;
});

document.getElementById('btn-reset-java').addEventListener('click', () => {
    document.getElementById('setting-java').value = '';
});

// Reinstall
document.getElementById('btn-reinstall').addEventListener('click', async () => {
    if (confirm('Вы уверены? Это удалит все моды и настройки.')) {
        await window.api.reinstallClient();
        alert('Файлы клиента удалены. Пожалуйста, перезапустите лаунчер или нажмите ИГРАТЬ для повторной загрузки.');
        settingsModal.classList.add('hidden');
    }
});

// Mods Configuration
const MOD_GROUPS = [
    {
        id: 'optimization',
        name: 'Оптимизация и Шейдеры',
        description: 'Embeddium, Oculus (Шейдеры), EntityCulling. Значительно повышает FPS.',
        files: ['client-embeddium', 'client-oculus', 'client-entityculling', 'client-chloride']
    },
    {
        id: 'fancymenu',
        name: 'Красивое Меню',
        description: 'Анимированное главное меню с музыкой.',
        files: ['client-fancymenu', 'client-konkrete', 'client-melody']
    },
    {
        id: 'visuals',
        name: 'Улучшенная Графика',
        description: 'Поддержка сложных текстурпаков (ETF, EMF, CIT).',
        files: ['client-entity_texture_features', 'client-entity_model_features', 'client-citreforged', 'client-athena']
    },
    {
        id: 'controls',
        name: 'Удобное Управление',
        description: 'Поиск конфликтов клавиш (Controlling).',
        files: ['client-Controlling', 'client-Searchables']
    },
    {
        id: 'rpc',
        name: 'Discord RPC',
        description: 'Показывает статус игры в Discord.',
        files: ['client-SimpleRPC']
    },
    {
        id: 'advancements',
        name: 'Улучшенные Достижения',
        description: 'Более удобный интерфейс ачивок.',
        files: ['client-BetterAdvancements']
    },
    {
        id: 'overlays',
        name: 'More Overlays',
        description: 'F7 для просмотра уровня освещения.',
        files: ['client-moreoverlays']
    },
    {
        id: 'thirdperson',
        name: 'Better Third Person',
        description: 'Улучшенная камера от 3-го лица (F5).',
        files: ['client-leawind_third_person']
    },
    {
        id: 'motor',
        name: 'Motor Assistance',
        description: 'Помощь в управлении игрой геймпадом.',
        files: ['client-motorassistance', 'client-controllable']
    },
    {
        id: 'tweaks',
        name: 'Epic Tweaks',
        description: 'Различные мелкие улучшения клиента.',
        files: ['client-epictweaks']
    }
];

// Mods Manager
async function loadModsList(disabledMods) {
    const list = document.getElementById('mods-list');
    list.innerHTML = '<div class="loading">Загрузка манифеста...</div>';
    
    const manifest = await window.api.getManifest();
    if (!manifest) {
        list.innerHTML = '<div class="error">Не удалось загрузить манифест</div>';
        return;
    }
    
    list.innerHTML = '';
    
    // Filter for interesting files (mods, resourcepacks)
    const allFiles = manifest.files.filter(f => 
        f.optional && 
        f.path.startsWith('mods/') && 
        f.path.endsWith('.jar')
    );
    
    if (allFiles.length === 0) {
        list.innerHTML = '<div class="error">Нет доступных опциональных модов.<br>Убедитесь, что вы обновили манифест в боте.</div>';
        return;
    }

    const handledFiles = new Set();

    // Render Groups
    MOD_GROUPS.forEach(group => {
        // Find files belonging to this group
        const groupFiles = allFiles.filter(f => {
            const fileName = f.path.split('/').pop();
            return group.files.some(pattern => fileName.includes(pattern));
        });

        if (groupFiles.length > 0) {
            groupFiles.forEach(f => handledFiles.add(f.path));

            // Check if ALL files in group are enabled (not in disabledMods)
            // If at least one is disabled, we consider the group unchecked (or partial, but simple checkbox is easier)
            // Actually, better logic: if ANY is enabled, check it? No, usually "all or nothing".
            // Let's say: Checked if NONE are disabled.
            const isChecked = groupFiles.every(f => !disabledMods.includes(f.path));

            const div = document.createElement('div');
            div.className = 'mod-item group';
            // Store all file paths in data attribute
            const paths = groupFiles.map(f => f.path).join('|');

            div.innerHTML = `
                <label class="mod-row">
                    <input type="checkbox" data-paths="${paths}" ${isChecked ? 'checked' : ''}>
                    <span class="mod-name">${group.name}</span>
                    <span class="mod-desc">${group.description}</span>
                </label>
            `;
            list.appendChild(div);
        }
    });

    // Render Remaining Files
    const remainingFiles = allFiles.filter(f => !handledFiles.has(f.path));
    if (remainingFiles.length > 0) {
        const otherHeader = document.createElement('div');
        otherHeader.className = 'mod-category-header';
        otherHeader.innerText = 'Остальное';
        list.appendChild(otherHeader);

        remainingFiles.forEach(file => {
            const isChecked = !disabledMods.includes(file.path);
            const div = document.createElement('div');
            div.className = 'mod-item';
            const fileName = file.path.split('/').pop();

            div.innerHTML = `
                <label class="mod-row">
                    <input type="checkbox" data-paths="${file.path}" ${isChecked ? 'checked' : ''}>
                    <span class="mod-name">${fileName}</span>
                </label>
            `;
            list.appendChild(div);
        });
    }
}

function getDisabledMods() {
    const disabled = [];
    document.querySelectorAll('#mods-list input[type="checkbox"]').forEach(cb => {
        if (!cb.checked) {
            // Split paths by pipe
            const paths = cb.dataset.paths.split('|');
            paths.forEach(p => disabled.push(p));
        }
    });
    return disabled;
}

// Window Controls
document.getElementById('btn-minimize').addEventListener('click', () => {
    window.api.minimize();
});

document.getElementById('btn-close').addEventListener('click', () => {
    window.api.close();
});

// Console Toggle
const consoleToggleBtn = document.getElementById('console-toggle-btn');
const newsList = document.getElementById('news-list');
const panelTitle = document.getElementById('panel-title');

consoleToggleBtn.addEventListener('click', () => {
    const isConsoleVisible = !consoleOutput.classList.contains('hidden');
    
    if (isConsoleVisible) {
        // Hide Console, Show News
        consoleOutput.classList.add('hidden');
        newsList.classList.remove('hidden');
        consoleToggleBtn.classList.remove('active');
        panelTitle.innerText = 'Новости';
    } else {
        // Show Console, Hide News
        consoleOutput.classList.remove('hidden');
        newsList.classList.add('hidden');
        consoleToggleBtn.classList.add('active');
        panelTitle.innerText = 'Консоль';
    }
});

// Helper to show error
function showAuthError(elementId, message) {
    const el = document.getElementById(elementId);
    
    // Try to parse JSON error
    if (message.includes('API Error')) {
        try {
            // Extract JSON part: "API Error: 404 - {...}"
            const jsonPart = message.substring(message.indexOf('{'));
            const data = JSON.parse(jsonPart);
            if (data.message) message = data.message;
        } catch (e) {
            // If parsing fails, just clean up the prefix
            message = message.replace('API Error: ', '');
        }
    }
    
    el.innerText = message;
    el.classList.remove('hidden');
    
    // Hide after 5 seconds
    setTimeout(() => {
        el.classList.add('hidden');
        el.innerText = '';
    }, 5000);
}

// Step 1: Login -> Request Code
document.getElementById('login-btn').addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const errorDiv = document.getElementById('login-error');
    errorDiv.classList.add('hidden');
    
    if (!username) {
        showAuthError('login-error', 'Пожалуйста, введите никнейм');
        return;
    }

    // Disable button
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerText = '...';

    try {
        const result = await window.api.requestAuth(username);
        if (result.success) {
            currentUsername = username;
            stepLogin.classList.add('hidden');
            stepCode.classList.remove('hidden');
            stepCode.classList.add('fade-in');
            
            // Auto-focus code input
            codeInput.focus();
            
            // DEBUG: Log code to console for testing
            console.log('DEBUG CODE:', result.debugCode);
            logToConsole(`[AUTH] Debug Code: ${result.debugCode}`);
        } else {
            showAuthError('login-error', result.message || 'Ошибка сервера');
        }
    } catch (e) {
        showAuthError('login-error', e.message);
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Далее';
        usernameInput.focus(); // Ensure focus returns to input
    }
});

// Step 2: Verify Code -> Show Play Screen
document.getElementById('verify-btn').addEventListener('click', async () => {
    const code = codeInput.value.trim();
    const errorDiv = document.getElementById('code-error');
    errorDiv.classList.add('hidden');
    
    if (!code) return;

    const btn = document.getElementById('verify-btn');
    btn.disabled = true;
    btn.innerText = 'Проверка...';

    try {
        const result = await window.api.verifyAuth(currentUsername, code);
        if (result.success) {
            // Save Auth
            localStorage.setItem('auth_user', currentUsername);
            if (result.token) {
                localStorage.setItem('auth_token', result.token);
            }

            stepCode.classList.add('hidden');
            showPlayScreen();
        } else {
            showAuthError('code-error', result.error || 'Неверный код');
            btn.disabled = false;
            btn.innerText = 'Подтвердить';
        }
    } catch (e) {
        showAuthError('code-error', 'Ошибка сети');
        btn.disabled = false;
        btn.innerText = 'Подтвердить';
    }
});

// Step 3: Play Screen Logic
function showPlayScreen() {
    stepPlay.classList.remove('hidden');
    stepPlay.classList.add('fade-in');
    document.getElementById('welcome-msg').innerText = `Добро пожаловать, ${currentUsername}!`;
}

document.getElementById('play-btn').addEventListener('click', () => {
    stepPlay.classList.add('hidden');
    stepProgress.classList.remove('hidden');
    stepProgress.classList.add('fade-in');
    startLaunch();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    location.reload();
});

// Cancel Button
document.getElementById('cancel-btn').addEventListener('click', async () => {
    logToConsole('[LAUNCHER] Отмена запуска...');
    await window.api.cancelLaunch();
    // UI will be reset by the error handler in startLaunch when it catches the cancellation error
});

// Retry Button
document.getElementById('retry-btn').addEventListener('click', () => {
    startLaunch();
});

// Launch Logic
async function startLaunch() {
    // Reset UI
    statusDiv.innerText = 'Инициализация...';
    statusDiv.style.color = '#888';
    progressBar.style.width = '0%';
    progressBar.style.backgroundColor = '#4CAF50';
    
    document.getElementById('retry-btn').classList.add('hidden');
    document.getElementById('cancel-btn').classList.remove('hidden');
    
    consoleOutput.innerHTML = '';
    logToConsole('[LAUNCHER] Запуск игры...');

    const result = await window.api.launchGame({ 
        username: currentUsername,
        token: localStorage.getItem('auth_token')
    });
    
    if (result.success) {
        statusDiv.innerText = 'Игра запущена';
        progressBar.style.width = '100%';
        document.getElementById('cancel-btn').classList.add('hidden');

        if (currentConfig.hideOnPlay !== false) {
            window.api.minimize();
        }
    } else {
        // Error Handling
        console.error(result.error);
        
        let msg = 'Ошибка запуска';
        let isNetwork = false;
        
        const err = result.error ? result.error.toString() : 'Неизвестная ошибка';
        
        if (err.includes('ENOTFOUND') || err.includes('ETIMEDOUT') || err.includes('UnknownHostException')) {
            msg = 'Потеряно соединение. Проверьте интернет.';
            isNetwork = true;
        } else {
            msg = 'Ошибка: ' + err.substring(0, 40) + '...';
        }
        
        statusDiv.innerText = msg;
        statusDiv.style.color = '#e74c3c';
        progressBar.style.backgroundColor = '#e74c3c';
        progressBar.style.width = '100%';
        
        logToConsole(`[ERROR] ${result.error}`);
        
        // Show Retry
        document.getElementById('retry-btn').classList.remove('hidden');
        document.getElementById('cancel-btn').classList.add('hidden');
    }
}

// Log Handler
window.api.onLog((text) => {
    logToConsole(text);
    
    // Update status text for user-friendly messages
    if (text.includes('Скачивание:')) {
        statusDiv.innerText = 'Загрузка ресурсов...';
        // Simulate progress bar movement (fake, since we don't have total size easily accessible here yet)
        // In a real app, we'd parse the progress.
        progressBar.style.width = '50%'; 
    } else if (text.includes('Обновление завершено')) {
        statusDiv.innerText = 'Запуск игры...';
        progressBar.style.width = '100%';
    } else if (text.includes('Проверка обновлений')) {
        statusDiv.innerText = 'Проверка обновлений...';
        progressBar.style.width = '10%';
    }
});

// Game Closed Handler
window.api.onGameClosed(() => {
    logToConsole('[LAUNCHER] Игровая сессия завершена.');
    
    // Reset UI
    stepProgress.classList.add('hidden');
    stepPlay.classList.remove('hidden');
    
    // Reset Progress Bar
    progressBar.style.width = '0%';
    statusDiv.innerText = 'Готов к игре';
    
    // Re-enable Play button just in case
    const btn = document.getElementById('play-btn');
    btn.disabled = false;
    btn.innerText = 'ИГРАТЬ';
});

// Auto Updater Handlers
window.api.onUpdateAvailable((info) => {
    logToConsole(`[UPDATE] Доступна новая версия: ${info.version}`);
    if (confirm(`Доступна новая версия лаунчера ${info.version}. Скачать?`)) {
        window.api.downloadUpdate();
        statusDiv.innerText = 'Скачивание обновления лаунчера...';
        stepLoading.classList.remove('hidden');
        stepLogin.classList.add('hidden');
        stepPlay.classList.add('hidden');
    }
});

window.api.onUpdateProgress((progress) => {
    const percent = Math.round(progress.percent);
    progressBar.style.width = `${percent}%`;
    statusDiv.innerText = `Скачивание обновления: ${percent}%`;
    logToConsole(`[UPDATE] Загрузка: ${percent}%`);
});

window.api.onUpdateDownloaded((info) => {
    logToConsole('[UPDATE] Обновление скачано.');
    if (confirm('Обновление готово к установке. Перезапустить сейчас?')) {
        window.api.quitAndInstall();
    }
});

window.api.onUpdateError((err) => {
    logToConsole(`[UPDATE ERROR] ${err}`);
    statusDiv.innerText = 'Ошибка обновления';
    setTimeout(() => {
        statusDiv.innerText = 'Готов к игре';
    }, 3000);
});

function logToConsole(text) {
    const line = document.createElement('div');
    line.innerText = text;
    line.style.borderBottom = '1px solid #1a1a1a';
    line.style.padding = '2px 0';
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// --- Startup Logic ---
(async () => {
    logToConsole('[LAUNCHER] Client initialized.');
    currentConfig = await window.api.loadConfig();

    // Apply Snow Effect
    toggleSnow(currentConfig.enableSnow !== false);

    // Apply default disabled mods if fresh install
    if (currentConfig.isDefault) {
        try {
            const manifest = await window.api.getManifest();
            if (manifest) {
                const defaultDisabledGroups = ['fancymenu', 'motor'];
                const disabledPaths = [];
                
                const allFiles = manifest.files.filter(f => f.optional && f.path.startsWith('mods/'));
                
                MOD_GROUPS.forEach(group => {
                    if (defaultDisabledGroups.includes(group.id)) {
                        const groupFiles = allFiles.filter(f => {
                            const fileName = f.path.split('/').pop();
                            return group.files.some(pattern => fileName.includes(pattern));
                        });
                        groupFiles.forEach(f => disabledPaths.push(f.path));
                    }
                });
                
                currentConfig.disabledMods = disabledPaths;
                delete currentConfig.isDefault;
                await window.api.saveConfig(currentConfig);
                console.log('[CONFIG] Applied default disabled mods:', disabledPaths);
            }
        } catch (e) {
            console.error('Failed to apply default config:', e);
        }
    }

    // Display Version
    try {
        const ver = await window.api.getAppVersion();
        const vDiv = document.getElementById('app-version');
        if (vDiv) vDiv.innerText = `v${ver}`;
    } catch (e) { console.error('Failed to get version', e); }

    await checkSavedAuth();
    
    // Delay news loading to reduce startup CPU spike
    setTimeout(loadNews, 1500);
})();

async function loadNews() {
    const list = document.getElementById('news-list');
    try {
        const result = await window.api.getNews();
        if (result.success && result.news.length > 0) {
            list.innerHTML = '';
            result.news.forEach(item => {
                const div = document.createElement('div');
                div.className = 'news-item';
                
                let imgHtml = '';
                if (item.image_url) {
                    imgHtml = `<img src="${item.image_url}">`;
                }
                
                div.innerHTML = `
                    <div class="news-date">${item.created_at}</div>
                    ${imgHtml}
                    <div class="news-text">${item.text || ''}</div>
                `;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<div style="padding:10px; color:#888;">Новостей пока нет.</div>';
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="padding:10px; color:#d32f2f;">Не удалось загрузить новости.</div>';
    }
}

async function checkSavedAuth() {
    const savedUser = localStorage.getItem('auth_user');
    const savedToken = localStorage.getItem('auth_token');
    
    if (savedUser && savedToken) {
        // Validate token
        try {
            const result = await window.api.checkAuth(savedUser, savedToken);
            if (result.success) {
                currentUsername = savedUser;
                stepLoading.classList.add('hidden');
                showPlayScreen();
                return;
            }
        } catch (e) {
            console.error("Auth check failed", e);
        }
    }
    
    // If not valid or no token, show login
    stepLoading.classList.add('hidden');
    stepLogin.classList.remove('hidden');
    
    if (savedUser) {
        usernameInput.value = savedUser;
    }
}

