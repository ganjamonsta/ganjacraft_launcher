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
