# GanjaCraft Launcher — Project Rules & Architecture

## 🏗️ Архитектура системы

```
ganj4craft.ru (VPS/Nginx)
├── /files/...           ← статические файлы игры (моды, конфиги, kubejs и т.д.)
├── /files/manifest.json ← манифест (генерирует ganjacrafter_bot_renew)
├── /api/...             ← FastAPI от ganjacrafter_bot_renew
└── /mirror/...          ← зеркало официальных файлов Minecraft/Maven/etc.
```

**Единый публичный домен:** `https://ganj4craft.ru`
Всё (файлы, API, зеркало) ходит через него. Никаких отдельных Localtunnel/ZROK ссылок в коде — убраны. Заголовки `Bypass-Tunnel-Reminder: true` / `User-Agent: localtunnel` **сохранены** как legacy — не трогать.

---

## 📦 Компоненты

### 1. Bootstrap (Python/PyInstaller)
- **Папка:** `bootstrap/`
- **Сборка:** `BUILD_BOOTSTRAP.bat` → `GanjaCraft.exe`
- **Роль:** Скачивание и верификация Ed25519-подписи Electron-клиента, его запуск.
- **Delta-обновления:**
  - Нет лаунчера → качает `fullUrl` (полный архив ~100 МБ).
  - Лаунчер есть → качает только `url` (`resources/app.asar`, ~1.35 МБ).

### 2. Electron Client (JS)
- **Папка:** `client/`
- **Сборка:** `BUILD_CLIENT.bat` → деплой по SFTP на Pterodactyl через `scripts/deploy_remote.js`.
- **Source of truth для URL:** `client/src/main-process/constants.js` — все URL только отсюда, никакого хардкода в `main.js`, `preload.js` и т.д.
- **Ключевые константы:**
  - `BASE_URL = 'https://ganj4craft.ru'`
  - `FILES_BASE = BASE_URL + '/files'`
  - `MANIFEST_URL = FILES_BASE + '/manifest.json'`
  - `API_BASE = BASE_URL + '/api'`
  - `MIRROR_BASE = BASE_URL + '/mirror'`
  - `API_BASES = ['https://ganj4craft.ru/api', 'http://192.168.1.8:5000/api']` — fallback на LAN
- **Зеркало:** При недоступности официальных репозиториев — фолбэк на `ganj4craft.ru/mirror/` через `MIRROR_FALLBACKS`.
- **Авторизация:** Telegram-код или пароль, эндпоинт `/api/launcher/auth/`.
- **Онлайн-виджет:** Пингует `vocalize-cove.gl.joinmc.link`, тултип с никами игроков.
- **Структура `client/src/`:**
  - `main.js` — точка входа Electron (импортирует из `main-process/`)
  - `main-process/` — модули: `constants.js`, `game/`, `ipc/`, `window/`, `parsers/`
  - `renderer/` — UI (features/state/ui/utils), собирается esbuild → `renderer.bundle.js`
  - `modules/` — доп. модули renderer
  - `index.html` — основной HTML интерфейса
  - `preload.js` — bridge renderer ↔ main
  - `styles.css` — стили (~100 КБ единый файл)

### 3. Mirror (`mirror/`)
- Локальная копия Minecraft/Maven/piston-data/assets.
- Собирается `scripts/collect-mirror.js`, заливается на `https://ganj4craft.ru/mirror/`.
- Папки: `assets/`, `github/`, `libraries/`, `maven/`, `piston-data/`, `piston-meta/`.

### 4. Deploy WWW (`deploy_www/`)
- `api/launcher/` — файлы auto-updater для Electron (latest.yml + архивы).

---

## 🖥️ Инфраструктура

| Компонент | Хост | Описание |
|---|---|---|
| VPS/Nginx | `ganj4craft.ru` | Публичный домен; `/files/`, `/mirror/`, proxy `/api/` |
| FastAPI-бот | `192.168.1.8:5000` (Pterodactyl) | Авторизация, манифест, скины, yggdrasil |
| Minecraft сервер | Pterodactyl на `192.168.1.8` | NeoForge 1.21.1 / 21.1.233 |
| SFTP деплой | `192.168.1.8:2022` | Pterodactyl SFTP, user `monsta.e96acddb` |

- Файлы игры в Pterodactyl volume на `192.168.1.8`.
- Бот читает их через `storage/files/` (symlink/mount внутри контейнера) → генерирует `manifest.json`.
- Nginx на VPS — единая точка входа, проксирует/раздаёт всё.

---

## 🛠️ Команды

```bash
# Dev-режим клиента
cd client && npm start

# Сборка релиза
BUILD_CLIENT.bat

# Сборка GanjaCraft.exe (bootstrap)
BUILD_BOOTSTRAP.bat

# Деплой всего
DEPLOY_ALL.bat
```

---

## 📏 Правила разработки

1. **Все URL** — только через `client/src/main-process/constants.js`. Нигде больше.
2. **Не удалять** `Bypass-Tunnel-Reminder: true` / `User-Agent: localtunnel` заголовки.
3. **Опциональные моды** — файлы с префиксом `client-` или `client_` в `mods/` → `optional: true` в манифесте.
4. **Авторизация** через `/api/launcher/auth/` (код из TG или пароль), токен в `X-Auth-Token`.
5. **Версии:** Minecraft 1.21.1, NeoForge 21.1.233, Java 21+.
