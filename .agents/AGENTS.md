# GanjaCraft Project Rules & Architecture

This file contains rules and structural guidelines for the GanjaCraft Launcher & Bot project.

## 🏗️ Architecture Overview

- **Source of Truth for Files:** Minecraft server files reside in `/var/lib/pterodactyl/volumes/b076eeff-35ff-40b1-84e7-e0d98504dc69`.
- **Mounts in Pterodactyl:**
  - **TG Bot Container:** Mounted from server files folder to `/home/container/storage/files` (scans/generates `manifest.json`).
  - **Nginx Container:** Mounted from server files folder to `/home/container/www/files` (hosts game files at `https://gcrlauncher1.loca.lt/files/...`).
- **Bootstrap Loader (Python/PyInstaller):**
  - Compiled via `BUILD_BOOTSTRAP.bat` into `GanjaCraft.exe`.
  - Performs Ed25519 signature checks on updates.
  - Supports delta updates: downloads `url` (resources/app.asar, lightweight) if launcher exe exists, otherwise `fullUrl` (entire package).
- **Client (Electron/JS):**
  - Source of truth for URL configuration is [constants.js](file:///d:/GanjaCraft/git/ganja_launcher/client/src/main-process/constants.js). Do not hardcode URL endpoints anywhere else.
  - Automatic tunnel bypass: Always set headers `Bypass-Tunnel-Reminder: true` and `User-Agent: localtunnel` for outgoing network requests to pass through Localtunnel reminders.
  - Online Widget: Pings `vocalize-cove.gl.joinmc.link` and formats list with tooltips.
- **Server FastAPI (Telegram Bot):**
  - Code resides in `ganjacrafter_bot_renew/`.
  - Exposes news, launcher files, and Yggdrasil authentication.
- **Localtunnel:**
  - Standard systemd service on host `192.168.1.8`, maps to `gcrlauncher1.loca.lt`.
