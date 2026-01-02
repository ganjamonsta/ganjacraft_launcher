# 📝 GanjaCraft Launcher Roadmap

## ✅ Completed Features

### � Debug-панель разработчика (Dev Tools)
**Цель:** Инструменты для разработки модпака и отладки.

#### Возможности:
- [x] Новая вкладка "🐞 DEBUG" в настройках (для debugMode или админов)
- [x] Пропуск синхронизации файлов при запуске игры
- [x] Выборочная синхронизация по категориям:
  - Моды (mods/)
  - Конфиги (config/)
  - KubeJS скрипты (client_scripts, startup_scripts, server_scripts, assets)
  - Ресурспаки (resourcepacks/)
  - Thingpacks (thingpacks/)
- [x] Принудительное перекачивание (игнорирует совпадение хешей)
- [x] Удаление локальных файлов по категориям
- [x] Скачивание server_scripts (обычно не синхронизируются для игроков)
- [x] Отображение количества файлов (локально / в манифесте)
- [x] Быстрые действия: "Синхронизировать всё", "Принудительно перекачать всё"

#### Файлы:
- `admin.css` - стили админ-панели
- `index.html` - HTML вкладки разработчика
- `preload.js` - API методы для dev tools
- `main.js` - IPC handlers
- `modules/updater.js` - функции syncCategory, deleteCategory, getCategoryCounts, fetchServerScripts

---

## 🔥 High Priority Features

### 📸 Облачная Галерея Скриншотов (Cloud Gallery)
**Цель:** Позволить игрокам смотреть свои скрины в лаунчере и в один клик заливать их на сайт/в бота.

#### 1. Backend (API) - `ganjacrafter_bot`
- [ ] Создать эндпоинт `POST /api/gallery/upload`.
  - Принимает: файл картинки, токен авторизации.
  - Логика: Проверка токена -> Сохранение в `storage/screenshots/{username}_{timestamp}.png`.
  - (Опционально) Запись в БД для отображения в личном кабинете на сайте.

#### 2. Launcher Core (Main Process) - `src/main.js`
- [ ] Реализовать `ipcMain.handle('get-local-screenshots')`:
  - Сканирует папку `screenshots` в директории игры.
  - Возвращает список объектов: `{ name, path, previewUrl (file://), date }`.
  - Сортировка по дате (новые сверху).
- [ ] Реализовать `ipcMain.handle('upload-screenshot')`:
  - Читает файл с диска.
  - Формирует `multipart/form-data`.
  - Отправляет POST запрос на API.

#### 3. Launcher UI (Renderer) - `src/index.html` / `src/renderer.js`
- [ ] Добавить кнопку "📸 Галерея" в главное меню.
- [ ] Сверстать Grid-сетку для отображения картинок (CSS).
- [ ] Реализовать оверлей при наведении: кнопка "Загрузить в облако".
- [ ] Индикация загрузки и уведомление об успехе.

### 🔄 Бесшовное Авто-обновление (Seamless Updater)
**Цель:** Убрать отдельные окна обновлений. Лаунчер должен обновляться сам и показывать прогресс внутри основного окна.

#### 1. UI (Renderer)
- [x] Создать оверлей "Update Screen" в `index.html` (z-index: 9999).
  - Блокирует весь интерфейс.
  - Содержит: Логотип, Текст "Прилетает обнова...", Прогресс-бар.
- [x] Скрыть стандартные диалоговые окна Electron.

#### 2. Logic (Main Process)
- [x] Переписать `updater.js` (Renderer Logic):
  - `autoDownload = true` (Implemented via auto-call in renderer).
  - Убрать `dialog.showMessageBox` (Removed confirms).
  - Прокинуть события `download-progress` в Renderer через IPC.
  - При событии `update-downloaded` -> `autoUpdater.quitAndInstall(true, true)`.
