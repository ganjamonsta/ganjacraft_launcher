const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');

const usernameInput = document.getElementById('username');
const codeInput = document.getElementById('auth-code');
const statusDiv = document.getElementById('status');
const welcomeMsg = document.getElementById('welcome-msg');

let currentUsername = '';

// Кнопка "Получить код"
document.getElementById('btn-get-code').addEventListener('click', async () => {
    const username = usernameInput.value;
    if (!username) return;

    statusDiv.innerText = 'Запрос кода...';
    
    try {
        const result = await window.api.requestAuth(username);
        if (result.success) {
            currentUsername = username;
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            statusDiv.innerText = result.message;
            
            // ДЛЯ ТЕСТОВ: Выводим код в консоль (в реале юзер смотрит в ТГ)
            console.log('DEBUG CODE:', result.debugCode);
        } else {
            statusDiv.innerText = 'Ошибка: ' + result.error;
        }
    } catch (e) {
        statusDiv.innerText = 'Ошибка сети';
        console.error(e);
    }
});

// Кнопка "Войти"
document.getElementById('btn-verify').addEventListener('click', async () => {
    const code = codeInput.value;
    if (!code) return;

    statusDiv.innerText = 'Проверка...';

    try {
        const result = await window.api.verifyAuth(currentUsername, code);
        if (result.success) {
            step2.classList.add('hidden');
            step3.classList.remove('hidden');
            welcomeMsg.innerText = `Привет, ${result.username}!`;
            statusDiv.innerText = 'Готов к запуску';
        } else {
            statusDiv.innerText = 'Ошибка: ' + result.error;
        }
    } catch (e) {
        statusDiv.innerText = 'Ошибка сети';
    }
});

// Кнопка "Играть"
document.getElementById('btn-launch').addEventListener('click', async () => {
    statusDiv.innerText = 'Инициализация...';
    const consoleDiv = document.getElementById('console-output');
    consoleDiv.style.display = 'block';
    consoleDiv.innerHTML = ''; // Очистить старые логи

    const result = await window.api.launchGame({ username: currentUsername });
    
    if (!result.success) {
        statusDiv.innerText = 'Ошибка запуска: ' + result.error;
    }
});

// Слушаем логи из main процесса
window.api.onLog((text) => {
    const consoleDiv = document.getElementById('console-output');
    const line = document.createElement('div');
    line.innerText = text;
    consoleDiv.appendChild(line);
    consoleDiv.scrollTop = consoleDiv.scrollHeight; // Авто-скролл вниз
});
