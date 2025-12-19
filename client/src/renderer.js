// --- Snow Effect ---
let snowInterval = null;

// --- Smoke Cursor Effect ---
let lastSmokeTime = 0;
document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastSmokeTime > 50) { // Limit spawn rate
        createSmokeParticle(e.clientX, e.clientY);
        lastSmokeTime = now;
    }
});

function createSmokeParticle(x, y) {
    const particle = document.createElement('div');
    particle.classList.add('smoke-particle');
    
    // Randomize drift
    const driftX = (Math.random() - 0.5) * 30 + 'px';
    particle.style.setProperty('--tx', driftX);
    
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    
    document.body.appendChild(particle);
    
    particle.addEventListener('animationend', () => {
        particle.remove();
    });
}

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
const consoleOutput = document.getElementById('console-output');

if (consoleOutput) {
    consoleOutput.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.api.showContextMenu();
    });
}

// Joint Progress Elements
const gameJointProgress = document.getElementById('game-joint-progress');
const gameJointBurn = document.getElementById('game-joint-burn');
const gameJointEnd = document.getElementById('game-joint-end');

const updateJointProgress = document.getElementById('joint-progress-container');
const updateJointBurn = document.getElementById('update-joint-burn');
const updateJointEnd = document.getElementById('update-joint-end');

function setJointProgress(container, burn, endImg, percent) {
    if (!container) return;
    
    // Constants for realistic smoking effect
    const MAX_WIDTH = 260; // Total width of the image in pixels
    const MIN_WIDTH = 28;  // Width at 100% progress (the filter/butt)
    const START_BURN_HEIGHT = 19; // Thickness at start
    const END_BURN_HEIGHT = 10;    // Thickness at end

    // Calculate current width of the container (the unsmoked part)
    // 0% progress -> MAX_WIDTH
    // 100% progress -> MIN_WIDTH
    const currentWidthPx = MAX_WIDTH - ((MAX_WIDTH - MIN_WIDTH) * (percent / 100));
    
    // Calculate burn height (thickness)
    const currentBurnHeight = START_BURN_HEIGHT - ((START_BURN_HEIGHT - END_BURN_HEIGHT) * (percent / 100));

    if (percent >= 100) {
        // Finished
        container.classList.add('hidden');
        if (burn) burn.classList.add('hidden');
        if (endImg) endImg.classList.remove('hidden');
    } else {
        // In progress
        container.classList.remove('hidden');
        container.style.width = `${currentWidthPx}px`;
        
        if (burn) {
            burn.classList.remove('hidden');
            
            // Position: The burn is separate from the container in the DOM.
            // It tracks the left edge of the visible joint.
            // Since the joint is anchored right, the left edge is at (MAX_WIDTH - currentWidthPx).
            const burnLeftPos = MAX_WIDTH - currentWidthPx;
            burn.style.left = `${burnLeftPos}px`;
            
            // Vertical Trajectory: Moves down by 4px as it burns
            // 0% -> 0px offset
            // 100% -> 4px offset
            const verticalOffset = 3 * (percent / 100);
            burn.style.top = `${verticalOffset}px`;
            
            // Update height/thickness of the burning tip
            const burnTip = burn.querySelector('.joint-burn');
            if (burnTip) {
                burnTip.style.height = `${currentBurnHeight}px`;
            }
        }
        
        if (endImg) endImg.classList.add('hidden');
    }
}

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
        description: 'Кастомное меню FancyMenu.',
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
        description: 'Поиск конфликтов клавиш и комбинации биндов(Controlling).',
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
        description: 'F7 для просмотра уровня освещения и поиск в инвентаре.',
        files: ['client-moreoverlays']
    },
    {
        id: 'thirdperson',
        name: 'Better Third Person',
        description: 'Альтернатинвая камера от 3-го лица (F5).',
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
    setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
    
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
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 100);
        document.getElementById('cancel-btn').classList.add('hidden');

        if (currentConfig.hideOnPlay !== false) {
            window.api.minimize();
        }
    } else {
        // Error Handling
        console.error(result.error);
        
        const err = result.error ? result.error.toString() : 'Неизвестная ошибка';

        // Handle Cancellation
        if (err === 'Запуск отменен') {
            logToConsole('[LAUNCHER] Запуск отменен.');
            stepProgress.classList.add('hidden');
            showPlayScreen();
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
            return;
        }
        
        let msg = 'Ошибка запуска';
        let isNetwork = false;
        
        if (err.includes('ENOTFOUND') || err.includes('ETIMEDOUT') || err.includes('UnknownHostException')) {
            msg = 'Потеряно соединение. Проверьте интернет.';
            isNetwork = true;
        } else {
            msg = 'Ошибка: ' + err.substring(0, 40) + '...';
        }
        
        statusDiv.innerText = msg;
        statusDiv.style.color = '#e74c3c';
        
        logToConsole(`[ERROR] ${result.error}`);
        
        // Show Retry
        document.getElementById('retry-btn').classList.remove('hidden');
        document.getElementById('cancel-btn').classList.add('hidden');
    }
}

// Real Progress Handler (from Core)
if (window.api.onProgress) {
    window.api.onProgress((e) => {
        // e.task / e.total
        const percent = (e.task / e.total) * 100;
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, percent);
        statusDiv.innerText = `Загрузка ресурсов: ${Math.round(percent)}%`;
    });
}

// Log Handler
window.api.onLog((text) => {
    logToConsole(text);
    
    // Update status text for user-friendly messages
    if (text.includes('Скачивание:')) {
        statusDiv.innerText = 'Загрузка ресурсов...';
        // Fallback if onProgress is not firing (e.g. java download)
        // Only update if we are at 0 (start)
        if (gameJointProgress && !gameJointProgress.classList.contains('hidden') && gameJointProgress.style.width === '100%') {
             setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 40);
        }
    } else if (text.includes('Обновление завершено')) {
        statusDiv.innerText = 'Запуск игры...';
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 100);
        // Hide cancel button as we cannot interrupt the launch process easily from here
        document.getElementById('cancel-btn').classList.add('hidden');
    } else if (text.includes('Проверка обновлений')) {
        statusDiv.innerText = 'Проверка обновлений...';
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 5);
    }
});

// Game Closed Handler
window.api.onGameClosed(() => {
    logToConsole('[LAUNCHER] Игровая сессия завершена.');
    
    // Reset UI
    stepProgress.classList.add('hidden');
    stepPlay.classList.remove('hidden');
    
    // Reset Progress Bar
    setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
    statusDiv.innerText = 'Готов к игре';
    
    // Re-enable Play button just in case
    const btn = document.getElementById('play-btn');
    btn.disabled = false;
    btn.innerText = 'ИГРАТЬ';
});

// Auto Updater Handlers
const updateOverlay = document.getElementById('update-overlay');
const updateStatusText = document.getElementById('update-status-text');
const updateChoices = document.getElementById('update-choices');
const btnUpdateAuto = document.getElementById('btn-update-auto');
const btnUpdateManual = document.getElementById('btn-update-manual');
const updateJointWrapper = document.querySelector('#update-overlay .joint-wrapper');

let updateUrl = '';

window.api.onUpdateAvailable((info) => {
    logToConsole(`[UPDATE] Доступна новая версия: ${info.version}`);
    updateUrl = info.url; // Assuming info contains url, which it should from main.js
    
    // Show Overlay
    updateOverlay.classList.remove('hidden');
    updateStatusText.innerText = `Найдена новая версия ${info.version}. Как обновляемся?`;
    
    // Show Choices, Hide Progress
    updateChoices.classList.remove('hidden');
    if (updateJointWrapper) updateJointWrapper.classList.add('hidden');
});

if (btnUpdateAuto) {
    btnUpdateAuto.onclick = () => {
        updateChoices.classList.add('hidden');
        if (updateJointWrapper) updateJointWrapper.classList.remove('hidden');
        updateStatusText.innerText = 'Взрываем...';
        window.api.downloadUpdate();
    };
}

if (btnUpdateManual) {
    btnUpdateManual.onclick = () => {
        if (updateUrl) {
            window.api.openUrl(updateUrl);
            updateStatusText.innerText = 'Открыта ссылка в браузере. После установки перезапустите лаунчер.';
        } else {
            updateStatusText.innerText = 'Ошибка: Ссылка не найдена.';
        }
    };
}

window.api.onUpdateProgress((progress) => {
    const percent = Math.round(progress.percent);
    setJointProgress(updateJointProgress, updateJointBurn, updateJointEnd, percent);
    
    if (updateStatusText) updateStatusText.innerText = `Скуриваем обнову: ${percent}%`;
    
    logToConsole(`[UPDATE] Загрузка: ${percent}%`);
});

window.api.onUpdateDownloaded((info) => {
    logToConsole('[UPDATE] Обновление скачано.');
    if (updateStatusText) updateStatusText.innerText = 'Патч скачан! Требуется перезапуск.';
    
    // Show Restart Button
    const btn = document.getElementById('btn-restart-launcher');
    if (btn) {
        btn.classList.remove('hidden');
        // Ensure we don't add multiple listeners if this event fires multiple times (unlikely but safe)
        btn.onclick = () => {
            window.api.quitAndInstall();
        };
    }
});

window.api.onUpdateError((err) => {
    logToConsole(`[UPDATE ERROR] ${err}`);
    if (updateStatusText) {
        updateStatusText.innerText = 'Ошибка обновления! Пропускаем...';
        updateStatusText.style.color = 'red';
    }
    
    // Hide overlay after 3 seconds and continue
    setTimeout(() => {
        updateOverlay.classList.add('hidden');
    }, 3000);
});

function logToConsole(text) {
    const line = document.createElement('div');
    line.innerText = text;
    line.style.borderBottom = '1px solid #1a1a1a';
    line.style.padding = '2px 0';
    consoleOutput.appendChild(line);

    // Limit max lines to prevent lag
    if (consoleOutput.children.length > 1000) {
        consoleOutput.removeChild(consoleOutput.firstChild);
    }

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

