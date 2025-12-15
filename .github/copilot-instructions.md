# GanjaCraft Launcher - AI Coding Instructions

## 1. Architecture & Project Structure
- **Framework**: Electron application.
- **Core Library**: `minecraft-launcher-core` (v3.12+) for downloading and launching Minecraft.
- **Backend API**: Interacts with `https://ganjacraft.ru/api` (Python/FastAPI) for authentication and news.
- **IPC Pattern**: `preload.js` exposes a secure `window.api` using `contextBridge`.

### Key Files
- `src/main.js`: **Main Process**. Handles app lifecycle, window management, file system access, and Minecraft launching logic.
- `src/preload.js`: **Bridge**. Exposes API to renderer. Handles HTTP requests to the external API and IPC calls.
- `src/renderer.js`: **Renderer Process**. Handles UI logic, DOM manipulation, and calls `window.api`.
- `src/index.html`: Main entry point for the UI.

## 2. Development Patterns

### Inter-Process Communication (IPC)
- **Two-way (Async)**: Use `ipcRenderer.invoke` in preload and `ipcMain.handle` in main.
  - *Usage*: Config loading, file selection, launching game.
- **One-way (Events)**: Use `ipcRenderer.send` / `ipcMain.on` for commands (minimize/close).
- **Main to Renderer**: Use `mainWindow.webContents.send` and `ipcRenderer.on` for streaming data (e.g., launch logs).

### Authentication Flow
- **Mechanism**: Telegram-based OTP (One-Time Password).
- **Logic**: Implemented in `preload.js` via `fetch` calls to `ganjacraft.ru`.
- **Flow**:
  1. `requestAuth(username)`: Request OTP. **Crucial**: The backend sends the code to the user via the **Telegram Bot**.
  2. `verifyAuth(username, code)`: User enters the code from Telegram. Verify OTP, receive token.
  3. `checkAuth(username, token)`: Validate session.

### Configuration
- **Storage**: JSON file in `app.getPath('userData')`.
- **Access**:
  - **Read**: `window.api.loadConfig()` (Renderer) -> `fs.readFileSync` (Main).
  - **Write**: `window.api.saveConfig(config)` (Renderer) -> `fs.writeFileSync` (Main).

### Minecraft Launching
- **Handler**: `ipcMain.handle('launch-game', ...)` in `src/main.js`.
- **Library**: `Client` from `minecraft-launcher-core`.
- **Customization**: Forge version and installer URL are constants in `main.js`.
- **File Source**:
  - Manifest: `https://ganjacraft.ru/files/manifest.json` (Mapped to Bot storage: `/opt/ganjacrafter_bot/storage/manifest.json`).
  - Game Files: `https://ganjacraft.ru/files/...` (Mapped to Server Volume: `/var/lib/pterodactyl/volumes/e773057d-bd12-4b7d-a764-8bf5fd19bb40`).

## 3. Specific Conventions
- **API Exposure**: Do not import `electron` in `renderer.js`. Always go through `window.api` defined in `preload.js`.
- **Logging**: Stream launch logs to the UI console via `log-message` channel.
- **Error Handling**: Wrap IPC handlers in `try/catch` and return meaningful errors to the renderer.
