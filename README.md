# GanjaCraft Launcher Project

## Структура проекта

### /client
Клиентская часть лаунчера на Electron.
- Отвечает за интерфейс.
- Скачивает файлы игры.
- Запускает Minecraft через `minecraft-launcher-core`.

### /server
Серверная часть (API).
- Обрабатывает авторизацию (связь с Telegram ботом).
- Выдает списки файлов для обновления (в будущем).

## Установка и запуск

### Клиент
```bash
cd client
npm install
npm start
```

### Сервер
```bash
cd server
npm install
npm start
```
