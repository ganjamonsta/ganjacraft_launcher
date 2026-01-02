// --- Snow Effect ---
let snowInterval = null;

// --- Visual Effects (Smoke & Parallax) ---
let mouseX = 0;
let mouseY = 0;
let hasMouseMoved = false;
let isWindowVisible = true;

// Parallax State
let parallaxTargetX = 0;
let parallaxTargetY = 0;
let parallaxCurrentX = 0;
let parallaxCurrentY = 0;

// Pause visual effects when window is hidden to save CPU
document.addEventListener('visibilitychange', () => {
    isWindowVisible = !document.hidden;
    if (isWindowVisible && currentConfig.enableSnow !== false) {
        toggleSnow(true);
    } else if (!isWindowVisible) {
        // Pause snow when hidden
        if (snowInterval) {
            clearInterval(snowInterval);
            snowInterval = null;
        }
    }
});

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    hasMouseMoved = true;

    // Calculate target parallax offset
    if (currentConfig.enableParallax !== false) {
        const main = document.getElementById('main-content');
        const rect = main ? main.getBoundingClientRect() : null;
        const centerX = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
        const centerY = rect ? (rect.top + rect.height / 2) : (window.innerHeight / 2);

        parallaxTargetX = (centerX - e.clientX) * 0.03; // Factor
        parallaxTargetY = (centerY - e.clientY) * 0.03;
    }
});

// Animation Loop for Smooth Parallax (only when visible)
let parallaxAnimId = null;
function animateParallax() {
    if (isWindowVisible && currentConfig.enableParallax !== false) {
        const bg = document.getElementById('bg-overlay');
        if (bg) {
            // Linear Interpolation (Lerp) for smoothness
            parallaxCurrentX += (parallaxTargetX - parallaxCurrentX) * 0.05;
            parallaxCurrentY += (parallaxTargetY - parallaxCurrentY) * 0.05;
            
            bg.style.transform = `translate(${parallaxCurrentX.toFixed(2)}px, ${parallaxCurrentY.toFixed(2)}px)`;
        }
    }
    parallaxAnimId = requestAnimationFrame(animateParallax);
}
requestAnimationFrame(animateParallax);

// Smoke effect management
let smokeInterval = null;

function startSmokeEffect() {
    if (smokeInterval) return;
    smokeInterval = setInterval(() => {
        if (hasMouseMoved) {
            createSmokeParticle(mouseX, mouseY);
        }
    }, 50);
}

function stopSmokeEffect() {
    if (smokeInterval) {
        clearInterval(smokeInterval);
        smokeInterval = null;
    }
}

// Initialize smoke based on config (will be started after config loads)

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
    
    // Limit max snowflakes to prevent performance issues
    if (snowContainer.children.length > 50) return;

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

// Burst effect - snow explosion when settings drop
function createSnowBurst() {
    const snowContainer = document.getElementById('snow-container');
    if (!snowContainer) return;
    
    const burstCount = 35; // Снежинок в залпе
    
    for (let i = 0; i < burstCount; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake', 'burst');
            snowflake.textContent = '❄';
            
            // Старт по ВСЕЙ ширине окна
            const startX = 5 + Math.random() * 90; // 5-95% ширины экрана
            snowflake.style.left = startX + 'vw';
            snowflake.style.top = '-10px'; // Выше окна - за пределами видимости
            
            // Направление разлёта - меньше дистанция
            const spreadX = (Math.random() - 0.5) * 150; // -75 to 75 px в стороны
            const spreadY = 100 + Math.random() * 200; // 100-300px вниз
            const rotation = (Math.random() - 0.5) * 360; // Случайное вращение
            
            snowflake.style.setProperty('--burst-x', spreadX + 'px');
            snowflake.style.setProperty('--burst-y', spreadY + 'px');
            snowflake.style.setProperty('--burst-rotate', rotation + 'deg');
            
            // Короче анимация
            const duration = 0.8 + Math.random() * 1.2; // 0.8-2s
            snowflake.style.animationDuration = duration + 's';
            
            snowflake.style.opacity = 0.7 + Math.random() * 0.3;
            snowflake.style.fontSize = (12 + Math.random() * 14) + 'px';
            
            snowContainer.appendChild(snowflake);
            
            snowflake.addEventListener('animationend', () => {
                snowflake.remove();
            });
        }, i * 8); // Быстрее спавн для ощущения взрыва
    }
}

// Side burst effect - snow explosion from left or right side
// side: 'left' или 'right'
function createSideBurst(side) {
    const snowContainer = document.getElementById('snow-container');
    if (!snowContainer) return;
    
    const burstCount = 20; // Снежинок в боковом залпе
    
    for (let i = 0; i < burstCount; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.classList.add('snowflake', 'burst');
            snowflake.textContent = '❄';
            
            // Старт сбоку окна
            if (side === 'left') {
                snowflake.style.left = '-10px';
            } else {
                snowflake.style.left = 'calc(100vw + 10px)';
            }
            
            // По всей высоте
            const startY = 10 + Math.random() * 80; // 10-90% высоты
            snowflake.style.top = startY + 'vh';
            
            // Направление разлёта - в сторону центра и вниз
            const spreadX = side === 'left' 
                ? 80 + Math.random() * 150  // влево -> вправо (80-230px)
                : -(80 + Math.random() * 150); // вправо -> влево (-80 to -230px)
            const spreadY = (Math.random() - 0.3) * 150; // немного вниз
            const rotation = (Math.random() - 0.5) * 360;
            
            snowflake.style.setProperty('--burst-x', spreadX + 'px');
            snowflake.style.setProperty('--burst-y', spreadY + 'px');
            snowflake.style.setProperty('--burst-rotate', rotation + 'deg');
            
            const duration = 0.6 + Math.random() * 1.0; // 0.6-1.6s
            snowflake.style.animationDuration = duration + 's';
            
            snowflake.style.opacity = 0.6 + Math.random() * 0.4;
            snowflake.style.fontSize = (10 + Math.random() * 12) + 'px';
            
            snowContainer.appendChild(snowflake);
            
            snowflake.addEventListener('animationend', () => {
                snowflake.remove();
            });
        }, i * 10);
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

// --- Settings Change Tracking ---
let initialSettingsState = {};
let hasUnsavedChanges = false;

// Get current settings state for comparison
function getCurrentSettingsState() {
    return {
        installPath: document.getElementById('setting-path').value,
        javaPath: document.getElementById('setting-java').value,
        memoryMin: document.getElementById('setting-ram-min').value.trim().toUpperCase(),
        memoryMax: document.getElementById('setting-ram-max').value.trim().toUpperCase(),
        hideOnPlay: document.getElementById('setting-hide-on-play').checked,
        enableSnow: document.getElementById('setting-enable-snow').checked,
        enableSmoke: document.getElementById('setting-enable-smoke').checked,
        enableParallax: document.getElementById('setting-enable-parallax').checked,
        debugMode: document.getElementById('setting-debug-mode').checked,
        skipSync: document.getElementById('dev-skip-sync-checkbox')?.checked || false,
        disabledMods: getDisabledMods().sort().join(',')
    };
}

// Compare two settings states
function settingsChanged() {
    const current = getCurrentSettingsState();
    return JSON.stringify(current) !== JSON.stringify(initialSettingsState);
}

// Update floating save button visibility
function updateSaveButtonVisibility() {
    const saveBtn = document.getElementById('save-settings');
    if (!saveBtn) return;
    
    hasUnsavedChanges = settingsChanged();
    
    if (hasUnsavedChanges) {
        saveBtn.classList.add('visible');
    } else {
        saveBtn.classList.remove('visible');
    }
}

// Setup listeners for all settings fields
function setupSettingsChangeListeners() {
    // Text inputs
    const textInputs = [
        'setting-path',
        'setting-java', 
        'setting-ram-min',
        'setting-ram-max'
    ];
    
    textInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateSaveButtonVisibility);
            el.addEventListener('change', updateSaveButtonVisibility);
        }
    });
    
    // Checkboxes
    const checkboxes = [
        'setting-hide-on-play',
        'setting-enable-snow',
        'setting-enable-smoke',
        'setting-enable-parallax',
        'setting-debug-mode',
        'dev-skip-sync-checkbox'
    ];
    
    checkboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateSaveButtonVisibility);
        }
    });
    
    // Mods list - use event delegation
    const modsList = document.getElementById('mods-list');
    if (modsList) {
        modsList.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                updateSaveButtonVisibility();
            }
        });
    }
}

// Initialize listeners once
setupSettingsChangeListeners();

// --- Settings Logic ---
const settingsScreen = document.getElementById('step-settings');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('save-settings');

// Tabs
document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// Helper to hide/show UI elements when settings open
function toggleMainUIVisibility(show) {
    const elements = [
        { el: document.getElementById('news-section'), defaultTransform: 'none', hideTransform: 'translateX(-120%)', side: 'left' }, // Slide left
        { el: document.getElementById('server-status-widget'), defaultTransform: 'none', hideTransform: 'translateY(-150%)', side: null }, // Slide up
        { el: document.querySelector('.auth-container'), defaultTransform: 'translateY(-50%)', hideTransform: 'translateY(-50%) translateX(120%)', side: 'right' } // Slide right
    ];
    elements.forEach(({ el, defaultTransform, hideTransform, side }, index) => {
        if (el) {
            if (show) {
                // Быстрый возврат с bounce эффектом
                const delay = index * 50; // Быстрый stagger
                el.style.transition = `transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`;
                el.style.transform = defaultTransform;
                
                // Side burst когда элемент выезжает
                if (side && currentConfig && currentConfig.enableSnow !== false) {
                    setTimeout(() => createSideBurst(side), delay + 50);
                }
            } else {
                // Быстрый уход
                const delay = index * 20;
                el.style.transition = `transform 0.15s cubic-bezier(0.4, 0, 1, 1) ${delay}ms`;
                el.style.transform = hideTransform;
            }
            el.style.pointerEvents = show ? 'auto' : 'none';
        }
    });
}

// Helper function to open settings with animation
function openSettings() {
    settingsScreen.classList.remove('hidden', 'closing');
    settingsScreen.classList.add('opening');
    
    // Trigger snow burst effect on impact (after drop animation reaches bottom)
    setTimeout(() => {
        if (currentConfig.enableSnow !== false) {
            createSnowBurst();
        }
    }, 150); // Sync with faster drop animation
}

// Helper function to close settings with animation
function closeSettings() {
    settingsScreen.classList.remove('opening');
    settingsScreen.classList.add('closing');
    
    // Snow burst когда окно закрывается (уезжает вверх)
    if (currentConfig.enableSnow !== false) {
        createSnowBurst();
    }
    
    // After animation completes, set to hidden
    setTimeout(() => {
        settingsScreen.classList.remove('closing');
        settingsScreen.classList.add('hidden');
    }, 250); // Быстрее анимация
}

// Close Settings button
btnCloseSettings.addEventListener('click', () => {
    // Start UI elements appearing FIRST (they'll slide in while settings slides up)
    toggleMainUIVisibility(true);
    // Start closing animation
    closeSettings();
    // Hide save button when closing
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) saveBtn.classList.remove('visible');
});

// Toggle Settings
btnSettings.addEventListener('click', async () => {
    // Toggle: if open - close, if closed - open
    if (settingsScreen.classList.contains('opening') || 
        (!settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing'))) {
        // Start UI elements appearing FIRST
        toggleMainUIVisibility(true);
        closeSettings();
        // Hide save button when closing
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) saveBtn.classList.remove('visible');
        return;
    }
    
    toggleMainUIVisibility(false);
    currentConfig = await window.api.loadConfig();
    
    // Populate Fields
    document.getElementById('setting-path').value = currentConfig.installPath;
    document.getElementById('setting-java').value = currentConfig.javaPath || '';
    document.getElementById('setting-ram-min').value = currentConfig.memoryMin;
    document.getElementById('setting-ram-max').value = currentConfig.memoryMax;
    document.getElementById('setting-hide-on-play').checked = currentConfig.hideOnPlay !== false; // Default true
    document.getElementById('setting-enable-snow').checked = currentConfig.enableSnow !== false; // Default true
    document.getElementById('setting-enable-smoke').checked = currentConfig.enableSmoke !== false; // Default true
    document.getElementById('setting-enable-parallax').checked = currentConfig.enableParallax !== false; // Default true
    document.getElementById('setting-debug-mode').checked = currentConfig.debugMode === true; // Default false
    
    // Load Mods
    loadModsList(currentConfig.disabledMods || []);
    
    // Show/hide dev tab for debug mode or admins
    const devTab = document.querySelector('.tab-dev');
    if (devTab) {
        if (currentConfig.debugMode === true || localStorage.getItem('is_admin') === 'true') {
            devTab.classList.remove('hidden');
            // Load category counts and restore skip sync state
            loadDevCategoryCounts();
            const skipSyncCheckbox = document.getElementById('dev-skip-sync-checkbox');
            if (skipSyncCheckbox) {
                skipSyncCheckbox.checked = currentConfig.skipSync === true;
            }
        } else {
            devTab.classList.add('hidden');
        }
    }
    
    openSettings();
    
    // Save initial state for change detection (after a small delay for mods to load)
    setTimeout(() => {
        initialSettingsState = getCurrentSettingsState();
        hasUnsavedChanges = false;
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) saveBtn.classList.remove('visible');
    }, 100);
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

    // IMPORTANT: preserve existing config flags and mark mod defaults as applied.
    // Otherwise the UI will keep forcing some groups disabled on each open.
    const newConfig = {
        ...currentConfig,
        installPath: document.getElementById('setting-path').value,
        javaPath: document.getElementById('setting-java').value,
        memoryMin: memMin,
        memoryMax: memMax,
        hideOnPlay: document.getElementById('setting-hide-on-play').checked,
        enableSnow: document.getElementById('setting-enable-snow').checked,
        enableSmoke: document.getElementById('setting-enable-smoke').checked,
        enableParallax: document.getElementById('setting-enable-parallax').checked,
        debugMode: document.getElementById('setting-debug-mode').checked,
        skipSync: document.getElementById('dev-skip-sync-checkbox')?.checked || false,
        disabledMods: getDisabledMods(),
        modsDefaultsApplied: true,
    };
    
    const ok = await window.api.saveConfig(newConfig);
    if (!ok) {
        logToConsole('[SETTINGS] Ошибка сохранения настроек (конфиг не записан).');
        return;
    }
    currentConfig = newConfig; // Update local config immediately
    
    // Apply Visual Effects
    toggleSnow(newConfig.enableSnow);
    if (newConfig.enableSmoke) {
        startSmokeEffect();
    } else {
        stopSmokeEffect();
    }

    // Reset Parallax if disabled
    if (!newConfig.enableParallax) {
        const bg = document.getElementById('bg-overlay');
        if (bg) bg.style.transform = 'none';
    }

    // Update UI values to show formatted result
    document.getElementById('setting-ram-min').value = memMin;
    document.getElementById('setting-ram-max').value = memMax;

    // Update initial state and hide save button
    initialSettingsState = getCurrentSettingsState();
    hasUnsavedChanges = false;
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) saveBtn.classList.remove('visible');

    toggleMainUIVisibility(true);
    closeSettings();
    logToConsole('[SETTINGS] Saved.');
});

// Path Selectors
document.getElementById('btn-select-path').addEventListener('click', async () => {
    const path = await window.api.selectPath('dir');
    if (path) {
        document.getElementById('setting-path').value = path;
        updateSaveButtonVisibility();
    }
});

document.getElementById('btn-open-path').addEventListener('click', async () => {
    const path = document.getElementById('setting-path').value;
    if (path) {
        await window.api.openFolder(path);
    }
});

document.getElementById('btn-select-java').addEventListener('click', async () => {
    const path = await window.api.selectPath('file');
    if (path) {
        document.getElementById('setting-java').value = path;
        updateSaveButtonVisibility();
    }
});

document.getElementById('btn-reset-java').addEventListener('click', () => {
    document.getElementById('setting-java').value = '';
    updateSaveButtonVisibility();
});

// Reinstall
document.getElementById('btn-reinstall').addEventListener('click', async () => {
    if (confirm('Вы уверены? Это удалит все моды и настройки.')) {
        await window.api.reinstallClient();
        alert('Файлы клиента удалены. Пожалуйста, перезапустите лаунчер или нажмите ИГРАТЬ для повторной загрузки.');
        settingsScreen.classList.add('hidden');
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
        files: ['client-motorassistance', 'client-controllable', 'client-framework']
    },
    {
        id: 'tweaks',
        name: 'Epic Tweaks',
        description: 'Твики Epic Fight.',
        files: ['client-epictweaks']
    },
    {
        id: 'schematics',
        name: 'Схематики (Forgematica)',
        description: 'Загрузка/просмотр схематики и помощь в строительстве.',
        files: ['client-Forgematica', 'client-MaFgLib', 'client-badpackets']
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
            let isChecked;
            
            if (currentConfig.modsDefaultsApplied !== true && (group.id === 'fancymenu' || group.id === 'motor' || group.id === 'schematics')) {
                // Disable these by default on fresh install
                isChecked = false;
            } else {
                isChecked = groupFiles.every(f => !disabledMods.includes(f.path));
            }

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
        const message = (e && e.message) ? e.message : String(e);
        showAuthError('code-error', message || 'Ошибка сети');
        console.error('[AUTH] verify failed', e);
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

    // Check skip sync from config (set in debug tab)
    const skipSync = currentConfig.skipSync === true;
    
    if (skipSync) {
        logToConsole('[DEBUG] Синхронизация файлов отключена!');
    }

    const result = await window.api.launchGame({ 
        username: currentUsername,
        token: localStorage.getItem('auth_token'),
        devMode: skipSync
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

    // Apply Visual Effects based on config
    toggleSnow(currentConfig.enableSnow !== false);
    if (currentConfig.enableSmoke !== false) {
        startSmokeEffect();
    }

    // NOTE: Default disabled mods are now applied in main.js before syncFiles.
    // This ensures they are applied before the first download, not after UI init.

    // Display Version
    try {
        const ver = await window.api.getAppVersion();
        const vDiv = document.getElementById('app-version');
        if (vDiv) vDiv.innerText = `v${ver}`;
    } catch (e) { console.error('Failed to get version', e); }

    await checkSavedAuth();
    
    // Delay news loading to reduce startup CPU spike
    setTimeout(loadNews, 1500);

    // Start Server Status Checker
    updateServerStatus();
    setInterval(updateServerStatus, 30000);
})();

async function updateServerStatus() {
    const playerCount = document.getElementById('player-count');
    const indicator = document.querySelector('.status-indicator');
    if (!playerCount || !indicator) return;

    try {
        // Using mcsrvstat.us public API to avoid CORS issues and backend changes
        const response = await fetch('https://api.mcsrvstat.us/3/ganjacraft.ru');
        const data = await response.json();

        if (data.online) {
            playerCount.textContent = `${data.players.online} / ${data.players.max}`;
            indicator.className = 'status-indicator online';
            indicator.title = 'Сервер доступен';
        } else {
            playerCount.textContent = 'Оффлайн';
            indicator.className = 'status-indicator offline';
            indicator.title = 'Сервер недоступен';
        }
    } catch (error) {
        console.error('Status check failed:', error);
        playerCount.textContent = 'Ошибка';
        indicator.className = 'status-indicator offline';
    }
}

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
                // Store admin status for dev mode
                if (result.is_admin) {
                    localStorage.setItem('is_admin', 'true');
                } else {
                    localStorage.removeItem('is_admin');
                }
                stepLoading.classList.add('hidden');
                showPlayScreen();
                return;
            }
        } catch (e) {
            console.error("Auth check failed", e);
        }
    }
    
    // If not valid or no token, show login
    localStorage.removeItem('is_admin');
    stepLoading.classList.add('hidden');
    stepLogin.classList.remove('hidden');
    
    if (savedUser) {
        usernameInput.value = savedUser;
    }
}

// === Admin Dev Tools ===

async function loadDevCategoryCounts() {
    try {
        const result = await window.api.devGetCategoryCounts();
        if (result.success && result.counts) {
            const counts = result.counts;
            
            const updateCount = (id, data) => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = `${data.local} / ${data.manifest}`;
                    el.title = `Локально: ${data.local}, В манифесте: ${data.manifest}`;
                }
            };
            
            updateCount('dev-mods-count', counts.mods || { local: 0, manifest: 0 });
            updateCount('dev-config-count', counts.config || { local: 0, manifest: 0 });
            updateCount('dev-kubejs-count', counts.kubejs || { local: 0, manifest: 0 });
            updateCount('dev-resourcepacks-count', counts.resourcepacks || { local: 0, manifest: 0 });
            updateCount('dev-thingpacks-count', counts.thingpacks || { local: 0, manifest: 0 });
        }
    } catch (e) {
        console.error('Failed to load category counts:', e);
    }
}

function showDevStatus(category, message, type = 'info') {
    const statusEl = document.getElementById(`dev-status-${category}`);
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `dev-status show ${type}`;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 5000);
    }
}

function setDevButtonLoading(btn, loading) {
    if (loading) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        const text = btn.textContent.trim();
        btn.innerHTML = `<span class="spinner"></span> ${text.substring(2)}`; // Remove emoji
    } else {
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }
}

function getKubejsSelectedFolders() {
    const folders = [];
    if (document.getElementById('dev-kjs-client')?.checked) folders.push('client_scripts');
    if (document.getElementById('dev-kjs-startup')?.checked) folders.push('startup_scripts');
    if (document.getElementById('dev-kjs-server')?.checked) folders.push('server_scripts');
    if (document.getElementById('dev-kjs-assets')?.checked) folders.push('assets');
    return folders;
}

// Category action handlers
document.querySelectorAll('.dev-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', async () => {
        const category = btn.dataset.category;
        const action = btn.dataset.action;
        
        if (!category || !action) return;
        
        setDevButtonLoading(btn, true);
        
        try {
            if (action === 'delete') {
                if (!confirm(`Удалить все файлы категории "${category}"?`)) {
                    setDevButtonLoading(btn, false);
                    return;
                }
                
                const result = await window.api.devDeleteCategory(category);
                if (result.success) {
                    showDevStatus(category, `Удалено: ${result.deleted} элементов`, 'success');
                } else {
                    showDevStatus(category, `Ошибка: ${result.error}`, 'error');
                }
            } else {
                // sync or force
                const force = action === 'force';
                const options = { force };
                
                if (category === 'kubejs') {
                    options.kubejsFolders = getKubejsSelectedFolders();
                    if (options.kubejsFolders.length === 0) {
                        showDevStatus(category, 'Выберите хотя бы одну папку KubeJS', 'error');
                        setDevButtonLoading(btn, false);
                        return;
                    }
                }
                
                const result = await window.api.devSyncCategory(category, options);
                if (result.success) {
                    showDevStatus(category, `Скачано: ${result.downloaded}, пропущено: ${result.skipped}`, 'success');
                } else {
                    showDevStatus(category, `Ошибка: ${result.error}`, 'error');
                }
            }
            
            // Refresh counts
            await loadDevCategoryCounts();
        } catch (e) {
            showDevStatus(category, `Ошибка: ${e.message}`, 'error');
        } finally {
            setDevButtonLoading(btn, false);
        }
    });
});

// Sync All button
document.getElementById('dev-sync-all')?.addEventListener('click', async () => {
    const btn = document.getElementById('dev-sync-all');
    setDevButtonLoading(btn, true);
    
    const categories = ['mods', 'config', 'kubejs', 'resourcepacks', 'thingpacks'];
    let totalDownloaded = 0;
    let errors = [];
    
    for (const category of categories) {
        try {
            const options = {};
            if (category === 'kubejs') {
                options.kubejsFolders = getKubejsSelectedFolders();
            }
            
            const result = await window.api.devSyncCategory(category, options);
            if (result.success) {
                totalDownloaded += result.downloaded || 0;
            } else {
                errors.push(`${category}: ${result.error}`);
            }
        } catch (e) {
            errors.push(`${category}: ${e.message}`);
        }
    }
    
    await loadDevCategoryCounts();
    setDevButtonLoading(btn, false);
    
    if (errors.length > 0) {
        alert(`Синхронизация завершена с ошибками:\n\n${errors.join('\n')}\n\nСкачано файлов: ${totalDownloaded}`);
    } else {
        alert(`Синхронизация завершена!\nСкачано файлов: ${totalDownloaded}`);
    }
});

// Force Sync All button
document.getElementById('dev-force-all')?.addEventListener('click', async () => {
    if (!confirm('Принудительно перекачать ВСЕ файлы?\nЭто может занять много времени.')) {
        return;
    }
    
    const btn = document.getElementById('dev-force-all');
    setDevButtonLoading(btn, true);
    
    const categories = ['mods', 'config', 'kubejs', 'resourcepacks', 'thingpacks'];
    let totalDownloaded = 0;
    let errors = [];
    
    for (const category of categories) {
        try {
            const options = { force: true };
            if (category === 'kubejs') {
                options.kubejsFolders = getKubejsSelectedFolders();
            }
            
            const result = await window.api.devSyncCategory(category, options);
            if (result.success) {
                totalDownloaded += result.downloaded || 0;
            } else {
                errors.push(`${category}: ${result.error}`);
            }
        } catch (e) {
            errors.push(`${category}: ${e.message}`);
        }
    }
    
    await loadDevCategoryCounts();
    setDevButtonLoading(btn, false);
    
    if (errors.length > 0) {
        alert(`Принудительная синхронизация завершена с ошибками:\n\n${errors.join('\n')}\n\nСкачано файлов: ${totalDownloaded}`);
    } else {
        alert(`Принудительная синхронизация завершена!\nСкачано файлов: ${totalDownloaded}`);
    }
});

// Fetch Server Scripts button
document.getElementById('dev-fetch-server-scripts')?.addEventListener('click', async () => {
    const btn = document.getElementById('dev-fetch-server-scripts');
    setDevButtonLoading(btn, true);
    
    try {
        const result = await window.api.devFetchServerScripts();
        if (result.success) {
            showDevStatus('server-scripts', `Скачано: ${result.downloaded} файлов`, 'success');
        } else {
            showDevStatus('server-scripts', `Ошибка: ${result.error}`, 'error');
        }
        
        await loadDevCategoryCounts();
    } catch (e) {
        showDevStatus('server-scripts', `Ошибка: ${e.message}`, 'error');
    } finally {
        setDevButtonLoading(btn, false);
    }
});

// Dev progress listener
if (window.api.onDevProgress) {
    window.api.onDevProgress((data) => {
        if (data.category && data.message) {
            const statusEl = document.getElementById(`dev-status-${data.category}`);
            if (statusEl) {
                statusEl.textContent = data.message;
                statusEl.className = 'dev-status show info';
            }
        }
    });
}

