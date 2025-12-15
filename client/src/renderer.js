// UI Elements
const stepLogin = document.getElementById('step-login');
const stepCode = document.getElementById('step-code');
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
    const newConfig = {
        installPath: document.getElementById('setting-path').value,
        javaPath: document.getElementById('setting-java').value,
        memoryMin: document.getElementById('setting-ram-min').value,
        memoryMax: document.getElementById('setting-ram-max').value,
        disabledMods: getDisabledMods()
    };
    
    await window.api.saveConfig(newConfig);
    settingsModal.classList.add('hidden');
    logToConsole('[SETTINGS] Saved.');
});

// Path Selectors
document.getElementById('btn-select-path').addEventListener('click', async () => {
    const path = await window.api.selectPath('dir');
    if (path) document.getElementById('setting-path').value = path;
});

document.getElementById('btn-select-java').addEventListener('click', async () => {
    const path = await window.api.selectPath('file');
    if (path) document.getElementById('setting-java').value = path;
});

// Reinstall
document.getElementById('btn-reinstall').addEventListener('click', async () => {
    if (confirm('Are you sure? This will delete all mods and configs.')) {
        await window.api.reinstallClient();
        alert('Client files removed. Please restart the launcher or click Play to re-download.');
        settingsModal.classList.add('hidden');
    }
});

// Mods Manager
async function loadModsList(disabledMods) {
    const list = document.getElementById('mods-list');
    list.innerHTML = '<div class="loading">Loading manifest...</div>';
    
    const manifest = await window.api.getManifest();
    if (!manifest) {
        list.innerHTML = '<div class="error">Failed to load manifest</div>';
        return;
    }
    
    list.innerHTML = '';
    
    // Filter for interesting files (mods, resourcepacks)
    const files = manifest.files.filter(f => 
        f.optional && 
        f.path.startsWith('mods/') && 
        f.path.endsWith('.jar')
    );
    
    if (files.length === 0) {
        list.innerHTML = '<div class="error">Нет доступных опциональных модов.<br>Убедитесь, что вы обновили манифест в боте.</div>';
        return;
    }

    files.forEach(file => {
        const isChecked = !disabledMods.includes(file.path);
        
        const div = document.createElement('div');
        div.className = 'mod-item';
        
        // Display only filename for better UI
        const fileName = file.path.split('/').pop();

        div.innerHTML = `
            <input type="checkbox" data-path="${file.path}" ${isChecked ? 'checked' : ''}>
            <span>${fileName}</span>
        `;
        list.appendChild(div);
    });
}

function getDisabledMods() {
    const disabled = [];
    document.querySelectorAll('#mods-list input[type="checkbox"]').forEach(cb => {
        if (!cb.checked) {
            disabled.push(cb.dataset.path);
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
document.getElementById('toggle-console').addEventListener('click', (e) => {
    e.preventDefault();
    if (consoleOutput.style.display === 'block') {
        consoleOutput.style.display = 'none';
    } else {
        consoleOutput.style.display = 'block';
    }
});

// Step 1: Login -> Get Code
document.getElementById('login-btn').addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) return;

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
            alert('Error: ' + result.error);
        }
    } catch (e) {
        alert('Network Error');
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Next';
    }
});

// Step 2: Verify Code -> Launch
document.getElementById('verify-btn').addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code) return;

    const btn = document.getElementById('verify-btn');
    btn.disabled = true;
    btn.innerText = 'Verifying...';

    try {
        const result = await window.api.verifyAuth(currentUsername, code);
        if (result.success) {
            stepCode.classList.add('hidden');
            stepProgress.classList.remove('hidden');
            stepProgress.classList.add('fade-in');
            
            startLaunch();
        } else {
            alert('Invalid Code: ' + result.error);
            btn.disabled = false;
            btn.innerText = 'Play';
        }
    } catch (e) {
        alert('Network Error');
        btn.disabled = false;
        btn.innerText = 'Play';
    }
});

// Cancel Button (Reloads app to reset state)
document.getElementById('cancel-btn').addEventListener('click', () => {
    location.reload();
});

// Launch Logic
async function startLaunch() {
    statusDiv.innerText = 'Initializing...';
    progressBar.style.width = '0%';
    
    // Show console by default during launch? Maybe not, keep it clean.
    // consoleOutput.style.display = 'block'; 
    consoleOutput.innerHTML = '';

    const result = await window.api.launchGame({ username: currentUsername });
    
    if (!result.success) {
        statusDiv.innerText = 'Launch Error';
        logToConsole(`[ERROR] ${result.error}`);
        alert('Launch Failed: ' + result.error);
        // Reset UI
        stepProgress.classList.add('hidden');
        stepLogin.classList.remove('hidden');
    }
}

// Log Handler
window.api.onLog((text) => {
    logToConsole(text);
    
    // Update status text for user-friendly messages
    if (text.includes('Скачивание:')) {
        statusDiv.innerText = 'Downloading assets...';
        // Simulate progress bar movement (fake, since we don't have total size easily accessible here yet)
        // In a real app, we'd parse the progress.
        progressBar.style.width = '50%'; 
    } else if (text.includes('Обновление завершено')) {
        statusDiv.innerText = 'Starting Game...';
        progressBar.style.width = '100%';
    } else if (text.includes('Проверка обновлений')) {
        statusDiv.innerText = 'Checking updates...';
        progressBar.style.width = '10%';
    }
});

function logToConsole(text) {
    const line = document.createElement('div');
    line.innerText = text;
    line.style.borderBottom = '1px solid #1a1a1a';
    line.style.padding = '2px 0';
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}
