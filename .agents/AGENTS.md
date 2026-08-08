# GanjaCraft Launcher — Project Rules & Architecture

## 🏗️ Архитектура системы

```
launcher.ganj4craft.ru (VPS/Nginx)
├── /files/...           ← файлы игры (моды, конфиги, kubejs и т.д.)
├── /files/manifest.json ← манифест (генерирует ganjacrafter_bot_renew)
├── /api/...             ← FastAPI от ganjacrafter_bot_renew
└── /mirror/...          ← зеркало официальных файлов Minecraft/Maven/etc.
```

**Единый публичный домен:** `https://launcher.ganj4craft.ru`
Всё (файлы, API, зеркало) ходит через него. Заголовки `Bypass-Tunnel-Reminder: true` / `User-Agent: localtunnel` **сохранены** как legacy — не трогать.

---

## 📦 Компоненты

### 1. Electron Client (JS)
- **Папка:** `client/`
- **Сборка:** `BUILD_CLIENT.bat` → деплой по SFTP на Pterodactyl через `scripts/deploy_remote.js`.
- **Source of truth для URL:** `client/src/main-process/constants.js` — все URL только отсюда, никакого хардкода в `main.js`, `preload.js` и т.д.
- **Ключевые константы:**
  - `BASE_URL = 'https://launcher.ganj4craft.ru'`
  - `FILES_BASE = BASE_URL + '/files'`
  - `MANIFEST_URL = FILES_BASE + '/manifest.json'`
  - `API_BASE = BASE_URL + '/api'`
  - `MIRROR_BASE = BASE_URL + '/mirror'`
  - `API_BASES = ['https://launcher.ganj4craft.ru/api']`
- **Зеркало:** При недоступности официальных репозиториев — фолбэк на `launcher.ganj4craft.ru/mirror/` через `MIRROR_FALLBACKS`.
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

### 2. Mirror (`mirror/`)
- Локальная копия Minecraft/Maven/piston-data/assets.
- Собирается `scripts/collect-mirror.js`, заливается на `https://launcher.ganj4craft.ru/mirror/`.
- Папки: `assets/`, `github/`, `libraries/`, `maven/`, `piston-data/`, `piston-meta/`.

### 3. Deploy WWW (`deploy_www/`)
- `api/launcher/` — файлы auto-updater для Electron (latest.yml + архивы).

---

## 🖥️ Инфраструктура

| Компонент | Хост | Описание |
|---|---|---|
| VPS/Nginx | `launcher.ganj4craft.ru` | Публичный домен; `/files/`, `/mirror/`, proxy `/api/` |
| FastAPI-бот | VPS (Pterodactyl) | Авторизация, манифест, скины, yggdrasil |
| Minecraft сервер | Wings на домашней машине `192.168.1.8` | NeoForge 1.21.1 / 21.1.233 |
| FRP туннель | VPS:6022 → home:1337 | SSH доступ к домашнему серверу |
| FRP туннель | VPS:25565 → home:25565 | Minecraft порт для игроков |
| FRP туннель | VPS:25575 → home:25575 | RCON к MC серверу |
| Wings SFTP | VPS:2022 → home:2022 | Pterodactyl SFTP |

- Файлы игры физически на домашней машине (Wings volume MC-сервера).
- При нажатии "Обновить манифест" бот делает rsync через FRP-тоннель → `storage/files/` на VPS → генерирует `manifest.json`.
- Nginx на VPS — единая точка входа, раздаёт всё.

---

## 🛠️ Команды

```bash
# Dev-режим клиента
cd client && npm start

# Сборка релиза
BUILD_CLIENT.bat

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
6. **Домен:** `launcher.ganj4craft.ru` — единственный публичный адрес. `ganj4craft.ru` устарел.
