# 📝 GanjaCraft Launcher Roadmap

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
