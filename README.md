# 🚀 GanjaCraft Launcher Project

## 🏗️ Архитектура системы GanjaCraft Launcher & Bot

Вся система завязана на один общий источник файлов — директорию живого Minecraft сервера (`b076eeff-35ff-40b1-84e7-e0d98504dc69`). Через Pterodactyl настроены два маунта (Mounts):

1. **Minecraft Files ➔ TG Bot Container**
   - **Откуда (Хост):** `/var/lib/pterodactyl/volumes/b076eeff...` (Файлы игрового сервера)
   - **Куда (В боте):** `/home/container/storage/files`
   - **Зачем:** Бот сканирует эту папку, вычисляет SHA1-хеши файлов и генерирует `manifest.json` для лаунчера.

2. **Minecraft Files ➔ Nginx Container**
   - **Откуда (Хост):** `/var/lib/pterodactyl/volumes/b076eeff...` (Файлы игрового сервера)
   - **Куда (В Nginx):** `/home/container/www/files`
   - **Зачем:** Nginx раздает статические файлы (моды, конфиги, текстуры) напрямую игрокам по веб-ссылкам из манифеста (`https://gcrlauncher1.loca.lt/files/...`).

---

## 📂 Структура репозитория и компоненты

### 1. 💻 Клиент (Electron / JS)
- **Папка:** `client/` (сборка через `BUILD_CLIENT.bat`, деплой через `deploy_remote.js`).
- **Точка конфигурации:** [constants.js](file:///d:/GanjaCraft/git/ganja_launcher/client/src/main-process/constants.js) — единственный источник правды для всех URL (никакого хардкода ZROK/Localtunnel ссылок в `main.js` и `preload.js`).
- **Обход туннелей:** Во все сетевые запросы (fetch, urllib, HTTP-клиент) встроены заголовки `Bypass-Tunnel-Reminder: true` и `User-Agent: localtunnel` для автоматического прохождения экрана-заглушки Localtunnel.
- **Виджет онлайна:** Пингует Minecraft-сервер `vocalize-cove.gl.joinmc.link`. Добавлен кастомный анимированный HTML/CSS-тултип: при наведении мыши на онлайн отображаются ники игроков в формате `⚔ Ник`.
- **Новости:** Парсит эндпоинт `/api/news` от FastAPI-бота.

### 2. ⚙️ Серверная часть (FastAPI-Бот — Python)
- **Папка:** `ganjacrafter_bot_renew/` (крутится в Pterodactyl, обновляется через `gcb`).
- **API эндпоинты:**
  - `/api/launcher/files/` — файлы обновлений (раздаются из папки `storage/launcher/`).
  - `/api/news` — новости лаунчера (база в `storage/news.json`).
  - `/api/yggdrasil/...` — авторизация игроков.
- **Интеграция новостей с Telegram-каналом:**
  - Бот слушает канал, указанный в `.env` через `CHANNEL_ID`.
  - При выходе поста бот отправляет админам (`ADMIN_IDS`) интерактивное меню с кнопками `✅ Добавить / ❌ Пропустить`.
  - При одобрении новость улетает в `news.json` и мгновенно появляется в лаунчере.

### 3. 🌐 Сетевая инфраструктура
- **Связка:** Домашний сервер (`192.168.1.8`) → Pterodactyl контейнеры Nginx (порт `7777`) и Бот (порт `5000`).
- **Localtunnel:** Настроен как системная служба systemd (`localtunnel.service`) на хосте `192.168.1.8`. Он автоматически запускает и держит туннель на домен `gcrlauncher1.loca.lt`.
- **Сеть бота:** Для работы с Telegram API боту прописан мобильный прокси `TELEGRAM_PROXY_URL` в `.env`.

---

## 🛠️ Разработка и Запуск

### Клиент (Electron)
```bash
cd client
npm install
npm start
```

Сборка релиза:
```bash
npm run build
npm run release
```
