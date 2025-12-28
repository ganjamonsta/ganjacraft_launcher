import os
import sys
import json
import time
import base64
import subprocess
import threading
import urllib.request
import urllib.error
import urllib.parse
import zipfile
import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from pathlib import Path
import hashlib

try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.hazmat.primitives.asymmetric import ed25519
except Exception:  # cryptography will be bundled in the compiled bootstrap
    InvalidSignature = None
    load_pem_public_key = None
    ed25519 = None

# Build trigger
# Configuration
BOOTSTRAP_VERSION = "1.0.15"
BOOTSTRAP_API_URL = "https://ganjacraft.ru/api/launcher/files/bootstrap.json"
API_URL = "https://ganjacraft.ru/api/launcher/files/version.json"
APPDATA = os.getenv('APPDATA')
LAUNCHER_DIR = os.path.join(APPDATA, ".ganjacraft")
CLIENT_DIR = os.path.join(LAUNCHER_DIR, "client")
LAUNCHER_EXE_NAME = "GanjaCraft Launcher.exe" # Name inside the zip
VERSION_FILE = "version.txt"
LOGO_PATH = "assets/logo.png"

# Colors
BG_COLOR = "#121212"
TEXT_COLOR = "#e0e0e0"
ACCENT_COLOR = "#4CAF50"


# Pinned public key used to verify launcher update ZIP signatures.
# This is NOT a secret.
UPDATE_PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAQv9ZFfputwoW/JzVhRwLIiUy3/3Mgaj0aDrz+t5y2+s=
-----END PUBLIC KEY-----
"""

_UPDATE_PUBLIC_KEY = None


def _get_update_public_key():
    global _UPDATE_PUBLIC_KEY
    if _UPDATE_PUBLIC_KEY is not None:
        return _UPDATE_PUBLIC_KEY

    if load_pem_public_key is None or ed25519 is None:
        raise Exception("Отсутствует криптобиблиотека для проверки подписи обновлений. Переустановите лаунчер.")

    key = load_pem_public_key(UPDATE_PUBLIC_KEY_PEM.encode('utf-8'))
    if not isinstance(key, ed25519.Ed25519PublicKey):
        raise Exception("Неверный тип ключа подписи обновлений (ожидался Ed25519)")

    _UPDATE_PUBLIC_KEY = key
    return _UPDATE_PUBLIC_KEY


def verify_update_signature(zip_path: str, signature_b64: str) -> None:
    """Verify downloaded update zip against signature from version.json."""
    if not signature_b64:
        raise Exception("Обновление не подписано. Установка заблокирована из соображений безопасности.")

    try:
        signature = base64.b64decode(signature_b64, validate=True)
    except Exception:
        raise Exception("Неверная подпись обновления (base64)")

    # Ed25519 signatures are always 64 bytes.
    if len(signature) != 64:
        raise Exception("Неверная подпись обновления (длина)")

    public_key = _get_update_public_key()
    with open(zip_path, 'rb') as f:
        data = f.read()

    try:
        public_key.verify(signature, data)
    except InvalidSignature:
        raise Exception("Подпись обновления не совпадает. Возможна подмена файла.")


def verify_update_signature_bytes(data: bytes, signature_b64: str) -> None:
    """Verify arbitrary bytes (e.g. manifest) against signature from version.json."""
    if not signature_b64:
        raise Exception("Обновление не подписано. Установка заблокирована из соображений безопасности.")

    try:
        signature = base64.b64decode(signature_b64, validate=True)
    except Exception:
        raise Exception("Неверная подпись обновления (base64)")

    if len(signature) != 64:
        raise Exception("Неверная подпись обновления (длина)")

    public_key = _get_update_public_key()
    try:
        public_key.verify(signature, data)
    except InvalidSignature:
        raise Exception("Подпись обновления не совпадает. Возможна подмена файла.")


def _safe_join(base_dir: str, rel_path: str) -> str:
    if not rel_path or not isinstance(rel_path, str):
        raise Exception("Неверный путь файла обновления")

    rel_path = rel_path.replace('\\', '/')
    if rel_path.startswith('/') or rel_path.startswith('\\'):
        raise Exception("Небезопасный путь файла обновления (absolute)")

    normalized = os.path.normpath(rel_path)
    if os.path.isabs(normalized) or normalized.startswith('..') or normalized.startswith('..' + os.sep):
        raise Exception("Небезопасный путь файла обновления (traversal)")

    out_path = os.path.join(base_dir, normalized)
    if not _is_within_directory(base_dir, out_path):
        raise Exception("Небезопасный путь файла обновления (escaped base)")
    return out_path


def _sha256_file(path_: str) -> str:
    h = hashlib.sha256()
    with open(path_, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def _download_url_to_file(url: str, dest_path: str, expected_sha256: str | None, expected_size: int | None,
                          progress_cb=None) -> None:
    url = url.replace(" ", "%20")
    tmp_path = dest_path + ".tmp"
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

    req = urllib.request.Request(url, headers={'User-Agent': 'GanjaCraft Launcher'})
    with urllib.request.urlopen(req, timeout=60) as response:
        total_size = int(response.info().get('Content-Length', 0))
        if expected_size is not None and expected_size >= 0 and total_size > 0 and expected_size != total_size:
            # Not fatal (CDN/proxy may omit), but can indicate wrong file.
            pass

        downloaded = 0
        h = hashlib.sha256()
        block_size = 64 * 1024
        with open(tmp_path, 'wb') as f:
            while True:
                buf = response.read(block_size)
                if not buf:
                    break
                f.write(buf)
                h.update(buf)
                downloaded += len(buf)
                if progress_cb:
                    progress_cb(downloaded)

    if expected_size is not None and expected_size >= 0:
        actual_size = os.path.getsize(tmp_path)
        if actual_size != expected_size:
            try:
                os.remove(tmp_path)
            except Exception:
                pass
            raise Exception(f"Размер не совпадает: ожидалось {expected_size}, получено {actual_size}")

    actual_hash = h.hexdigest()
    if expected_sha256 and actual_hash.lower() != expected_sha256.lower():
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        raise Exception("Хеш не совпадает (sha256)")

    try:
        if os.path.exists(dest_path):
            os.remove(dest_path)
    except Exception:
        pass
    os.replace(tmp_path, dest_path)


def _is_within_directory(base_dir: str, target_path: str) -> bool:
    base = os.path.abspath(base_dir)
    target = os.path.abspath(target_path)
    base_with_sep = base if base.endswith(os.sep) else base + os.sep
    return target.startswith(base_with_sep)


def safe_extract_zip(zip_path: str, dest_dir: str) -> None:
    """Extracts a zip safely (prevents Zip Slip path traversal)."""
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        for member in zip_ref.infolist():
            member_name = member.filename
            # Reject absolute paths and traversal
            if member_name.startswith(('/', '\\')):
                raise Exception("Небезопасный ZIP: абсолютный путь")

            out_path = os.path.join(dest_dir, member_name)
            if not _is_within_directory(dest_dir, out_path):
                raise Exception("Небезопасный ZIP: попытка выхода из папки установки")
        zip_ref.extractall(dest_dir)


def validate_zip_integrity(zip_path: str, expected_exe_name: str | None = None) -> None:
    """Basic integrity checks for downloaded update zip."""
    # 1) Minimal size sanity
    size = os.path.getsize(zip_path)
    if size < 1024 * 200:  # 200KB is unrealistically small for this client
        raise Exception("ZIP слишком маленький — похоже на обрыв загрузки")

    # 2) Header check (PK..)
    with open(zip_path, 'rb') as f:
        header = f.read(4)
        if header not in (b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08'):
            raise Exception("Неверный ZIP (заголовок не PK)")

    # 3) EOCD presence (quick truncation heuristic)
    # EOCD signature: 0x50 0x4B 0x05 0x06. Scan last 64KB per ZIP spec.
    scan_size = min(size, 65557)
    with open(zip_path, 'rb') as f:
        f.seek(size - scan_size)
        tail = f.read(scan_size)
        if b'PK\x05\x06' not in tail:
            raise Exception("ZIP выглядит обрезанным (нет EOCD)")

    # 4) Can open/list
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            names = z.namelist()
    except zipfile.BadZipFile:
        raise Exception("ZIP повреждён (BadZipFile)")

    if expected_exe_name:
        # Either file is at root or within subfolder
        normalized = [n.replace('\\', '/') for n in names]
        if not any(n.endswith('/' + expected_exe_name) or n == expected_exe_name for n in normalized):
            raise Exception(f"В ZIP нет {expected_exe_name} — пакет не похож на клиент")

class BootstrapApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("GanjaCraft Updater")
        self.geometry("400x300")
        self.configure(bg=BG_COLOR)
        self.overrideredirect(True)  # Frameless

        # Center window
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        x = (screen_width - 400) // 2
        y = (screen_height - 300) // 2
        self.geometry(f"400x300+{x}+{y}")

        # Dragging functionality
        self.x_offset = 0
        self.y_offset = 0
        self.bind("<ButtonPress-1>", self.start_move)
        self.bind("<B1-Motion>", self.do_move)

        # Main Frame
        self.main_frame = tk.Frame(self, bg=BG_COLOR)
        self.main_frame.pack(expand=True, fill="both", padx=20, pady=20)
        
        # Bind drag events to frame and labels too
        self.main_frame.bind("<ButtonPress-1>", self.start_move)
        self.main_frame.bind("<B1-Motion>", self.do_move)

        # Logo
        try:
            if hasattr(sys, '_MEIPASS'):
                logo_path = os.path.join(sys._MEIPASS, LOGO_PATH)
            else:
                logo_path = LOGO_PATH
            
            if os.path.exists(logo_path):
                self.logo_img = tk.PhotoImage(file=logo_path)
                # Resize if needed (simple subsample)
                if self.logo_img.width() > 150:
                    subsample_factor = self.logo_img.width() // 120
                    if subsample_factor > 1:
                        self.logo_img = self.logo_img.subsample(subsample_factor, subsample_factor)

                self.logo_label = tk.Label(self.main_frame, image=self.logo_img, bg=BG_COLOR, bd=0)
                self.logo_label.pack(pady=(20, 10))
                self.logo_label.bind("<ButtonPress-1>", self.start_move)
                self.logo_label.bind("<B1-Motion>", self.do_move)
        except Exception as e:
            print(f"Logo error: {e}")

        # Label
        self.label = tk.Label(self.main_frame, text="Проверка обновлений...", font=("Segoe UI", 12, "bold"), fg=TEXT_COLOR, bg=BG_COLOR)
        self.label.pack(pady=(10, 20))
        self.label.bind("<ButtonPress-1>", self.start_move)
        self.label.bind("<B1-Motion>", self.do_move)

        # Custom Style for Progressbar
        style = ttk.Style()
        style.theme_use('default')
        style.configure("Green.Horizontal.TProgressbar",
                        troughcolor=BG_COLOR,
                        background=ACCENT_COLOR,
                        thickness=10,
                        borderwidth=0)

        self.progress = ttk.Progressbar(self.main_frame, style="Green.Horizontal.TProgressbar", length=300, mode='determinate')
        self.progress.pack(pady=10)

        self.status_label = tk.Label(self.main_frame, text="", font=("Segoe UI", 9), fg="#888888", bg=BG_COLOR)
        self.status_label.pack(pady=5)
        self.status_label.bind("<ButtonPress-1>", self.start_move)
        self.status_label.bind("<B1-Motion>", self.do_move)

        # Version Label (Bottom Right)
        self.version_label = tk.Label(self.main_frame, text=f"v{BOOTSTRAP_VERSION}", font=("Segoe UI", 8), fg="#444444", bg=BG_COLOR)
        self.version_label.place(relx=1.0, rely=1.0, anchor="se", x=-5, y=-5)

        # Start update process
        threading.Thread(target=self.run_update_process, daemon=True).start()

    def start_move(self, event):
        self.x_offset = event.x
        self.y_offset = event.y

    def do_move(self, event):
        x = self.winfo_x() + (event.x - self.x_offset)
        y = self.winfo_y() + (event.y - self.y_offset)
        self.geometry(f"+{x}+{y}")

    def update_status(self, text):
        self.label.config(text=text)
        self.update_idletasks()

    def update_progress(self, value, total=100):
        self.progress['value'] = value
        self.progress['maximum'] = total
        self.update_idletasks()

    def run_update_process(self):
        try:
            if not os.path.exists(LAUNCHER_DIR):
                os.makedirs(LAUNCHER_DIR)

            # 1. Check for Bootstrap Self-Update
            if self.check_self_update():
                return

            # 2. Check Remote Version (Client)
            self.update_status("Подключение к серверу...")
            try:
                req = urllib.request.Request(API_URL, headers={'User-Agent': 'GanjaCraft Launcher'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = response.read()
                    remote_data = json.loads(data)
                    remote_version = remote_data.get("version")
                    download_url = remote_data.get("url")
                    signature = remote_data.get("signature")
                    manifest_url = remote_data.get("manifestUrl")
                    manifest_signature = remote_data.get("manifestSignature")
                    base_url = remote_data.get("baseUrl")
            except Exception as e:
                print(f"Network error: {e}")
                self.launch_existing_or_fail("Ошибка сети. Запуск оффлайн...")
                return

            # 3. Check Local Version (Client)
            local_version = "0.0.0"
            version_path = os.path.join(LAUNCHER_DIR, VERSION_FILE)
            if os.path.exists(version_path):
                with open(version_path, "r") as f:
                    local_version = f.read().strip()

            if remote_version != local_version:
                # Prefer incremental update if available.
                if manifest_url and base_url and manifest_signature:
                    self.download_update_files(manifest_url, base_url, remote_version, manifest_signature, download_url, signature)
                else:
                    self.download_update(download_url, remote_version, signature)
            else:
                self.update_status("Клиент обновлен.")
                self.update_progress(100)
                time.sleep(0.5)
                self.launch_client()

        except Exception as e:
            self.status_label.config(text=f"Ошибка: {str(e)}")
            time.sleep(3)
            self.destroy()

    def check_self_update(self):
        # Only update if running as compiled exe
        if not getattr(sys, 'frozen', False):
            return False

        self.update_status("Проверка обновлений лаунчера...")
        try:
            req = urllib.request.Request(BOOTSTRAP_API_URL, headers={'User-Agent': 'GanjaCraft Launcher'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read())
                latest_version = data.get("version")
                download_url = data.get("url")
                
                if latest_version != BOOTSTRAP_VERSION:
                    self.perform_self_update(download_url, latest_version)
                    return True
        except Exception as e:
            print(f"Bootstrap update check failed: {e}")
        return False

    def perform_self_update(self, url, version):
        self.update_status(f"Обновление загрузчика до v{version}...")
        try:
            url = url.replace(" ", "%20")
            current_exe = sys.executable
            new_exe = current_exe + ".new"
            
            # Download new exe
            req = urllib.request.Request(url, headers={'User-Agent': 'GanjaCraft Launcher'})
            with urllib.request.urlopen(req, timeout=30) as response:
                total_size = int(response.info().get('Content-Length', 0))
                downloaded = 0
                block_size = 8192
                with open(new_exe, 'wb') as f:
                    while True:
                        buffer = response.read(block_size)
                        if not buffer: break
                        downloaded += len(buffer)
                        f.write(buffer)
                        if total_size > 0:
                            self.update_progress(downloaded, total_size)
                
                if total_size > 0 and downloaded != total_size:
                    raise Exception(f"Загрузка не завершена: {downloaded}/{total_size} байт")
            
            # Validate the downloaded file
            with open(new_exe, 'rb') as f:
                header = f.read(2)
                if header != b'MZ':
                    raise Exception("Неверный исполняемый файл (Ошибка заголовка)")
                f.seek(0, 2)
                if f.tell() < 1024 * 1024: # Less than 1MB
                    raise Exception("Неверный исполняемый файл (Слишком маленький)")

            # Create batch script to replace exe and restart
            batch_file = "update_bootstrap.bat"
            exe_dir = os.path.dirname(current_exe)
            exe_name = os.path.basename(current_exe)
            
            with open(batch_file, "w") as f:
                f.write(f"""
@echo off
:wait_loop
timeout /t 1 /nobreak > NUL
del "{current_exe}" 2>NUL
if exist "{current_exe}" goto wait_loop

move "{new_exe}" "{current_exe}"
del "%~f0"
""")
            
            self.update_status("Обновление завершено.")
            messagebox.showinfo("Обновление", "Загрузчик успешно обновлен.\nПожалуйста, запустите его заново.")
            
            subprocess.Popen(batch_file, shell=True)
            os._exit(0)
            
        except Exception as e:
            self.status_label.config(text=f"Ошибка самообновления: {e}")
            time.sleep(2)
            # Continue to client update if self-update fails
            return

    def download_update(self, url, version, signature_b64):
        self.update_status(f"Загрузка версии {version}...")
        try:
            # Handle spaces in URL if not already handled
            url = url.replace(" ", "%20")
            
            zip_path = os.path.join(LAUNCHER_DIR, "update.zip")
            tmp_zip_path = zip_path + ".tmp"

            req = urllib.request.Request(url, headers={'User-Agent': 'GanjaCraft Launcher'})
            with urllib.request.urlopen(req, timeout=30) as response:
                total_size = int(response.info().get('Content-Length', 0))
                downloaded = 0
                block_size = 8192

                with open(tmp_zip_path, 'wb') as f:
                    while True:
                        buffer = response.read(block_size)
                        if not buffer:
                            break
                        downloaded += len(buffer)
                        f.write(buffer)
                        if total_size > 0:
                            self.update_progress(downloaded, total_size)

            # Size check if server provided it
            if total_size > 0 and downloaded != total_size:
                raise Exception(f"Загрузка не завершена: {downloaded}/{total_size} байт")

            # Replace atomically
            try:
                if os.path.exists(zip_path):
                    os.remove(zip_path)
            except Exception:
                pass
            os.replace(tmp_zip_path, zip_path)

            # Verify signature BEFORE doing any zip parsing/extraction.
            self.update_status("Проверка подписи обновления...")
            self.update_idletasks()
            verify_update_signature(zip_path, signature_b64)

            # Validate zip integrity BEFORE extraction
            self.update_status("Проверка целостности архива...")
            self.update_idletasks()
            validate_zip_integrity(zip_path, expected_exe_name=LAUNCHER_EXE_NAME)

            self.update_status("Установка обновления...")
            
            # Extract Zip
            if not os.path.exists(CLIENT_DIR):
                os.makedirs(CLIENT_DIR)

            # Safety: extract without Zip Slip
            safe_extract_zip(zip_path, CLIENT_DIR)
            
            # Clean up zip
            os.remove(zip_path)

            # Update version file
            with open(os.path.join(LAUNCHER_DIR, VERSION_FILE), "w") as f:
                f.write(version)

            self.update_status("Обновление завершено!")
            time.sleep(0.5)
            self.launch_client()

        except Exception as e:
            self.status_label.config(text=f"Ошибка загрузки: {e}")
            print(f"Download error: {e}")
            time.sleep(3)
            self.launch_existing_or_fail("Ошибка обновления. Попытка запуска оффлайн...")

    def download_update_files(self, manifest_url, base_url, version, manifest_sig_b64, fallback_zip_url=None, fallback_zip_sig=None):
        """Incremental update: download only changed files listed in signed manifest."""
        self.update_status(f"Проверка манифеста {version}...")
        try:
            # 1) Download manifest
            req = urllib.request.Request(manifest_url, headers={'User-Agent': 'GanjaCraft Launcher'})
            with urllib.request.urlopen(req, timeout=20) as response:
                manifest_bytes = response.read()

            # 2) Verify signature
            self.update_status("Проверка подписи манифеста...")
            self.update_idletasks()
            verify_update_signature_bytes(manifest_bytes, manifest_sig_b64)

            # 3) Parse
            manifest = json.loads(manifest_bytes.decode('utf-8'))
            if not manifest or not isinstance(manifest, dict) or not isinstance(manifest.get('files'), list):
                raise Exception("Некорректный манифест")
            if manifest.get('version') and manifest.get('version') != version:
                raise Exception("Версия манифеста не совпадает")

            files = manifest.get('files')
            # Determine total bytes for progress
            total_bytes = 0
            for it in files:
                try:
                    total_bytes += int(it.get('size') or 0)
                except Exception:
                    pass
            if total_bytes <= 0:
                total_bytes = 1

            wanted_paths = set()
            downloaded_bytes = 0

            def _bump_progress(delta: int):
                nonlocal downloaded_bytes
                downloaded_bytes += delta
                if downloaded_bytes < 0:
                    downloaded_bytes = 0
                if downloaded_bytes > total_bytes:
                    downloaded_bytes = total_bytes
                self.update_progress(downloaded_bytes, total_bytes)

            self.update_status("Обновление файлов...")

            # Ensure base dir
            os.makedirs(CLIENT_DIR, exist_ok=True)

            for entry in files:
                rel_path = entry.get('path')
                expected_sha256 = entry.get('sha256')
                expected_size = entry.get('size')
                if not rel_path or not isinstance(rel_path, str):
                    continue
                if expected_size is not None:
                    try:
                        expected_size = int(expected_size)
                    except Exception:
                        expected_size = None

                wanted_paths.add(rel_path.replace('\\', '/'))

                local_path = _safe_join(CLIENT_DIR, rel_path)

                # Skip if up-to-date
                try:
                    if os.path.exists(local_path) and os.path.isfile(local_path):
                        if expected_size is not None and os.path.getsize(local_path) != expected_size:
                            raise Exception("size mismatch")
                        if expected_sha256 and _sha256_file(local_path).lower() == expected_sha256.lower():
                            continue
                except Exception:
                    pass

                # Download
                # Build URL: base_url + '/' + quoted path (preserve slashes)
                quoted = '/'.join(urllib.parse.quote(p) for p in rel_path.replace('\\', '/').split('/'))
                file_url = base_url.rstrip('/') + '/' + quoted

                last_downloaded = 0

                def _progress_cb(current_downloaded: int):
                    nonlocal last_downloaded
                    delta = current_downloaded - last_downloaded
                    last_downloaded = current_downloaded
                    if delta > 0:
                        _bump_progress(delta)

                self.update_status(f"Скачивание: {rel_path}")
                self.update_idletasks()
                _download_url_to_file(file_url, local_path, expected_sha256, expected_size, progress_cb=_progress_cb)

            # Cleanup extra files
            self.update_status("Очистка...")
            for root, dirs, files_in_dir in os.walk(CLIENT_DIR):
                for fn in files_in_dir:
                    full = os.path.join(root, fn)
                    rel = os.path.relpath(full, CLIENT_DIR).replace('\\', '/')
                    if rel not in wanted_paths:
                        try:
                            os.remove(full)
                        except Exception:
                            pass

            # Remove empty dirs (bottom-up)
            for root, dirs, _ in os.walk(CLIENT_DIR, topdown=False):
                for d in dirs:
                    p = os.path.join(root, d)
                    try:
                        if not os.listdir(p):
                            os.rmdir(p)
                    except Exception:
                        pass

            # Update version file
            with open(os.path.join(LAUNCHER_DIR, VERSION_FILE), "w") as f:
                f.write(version)

            self.update_status("Обновление завершено!")
            self.update_progress(total_bytes, total_bytes)
            time.sleep(0.5)
            self.launch_client()

        except Exception as e:
            # Fallback to zip update to keep users unblocked
            self.status_label.config(text=f"Ошибка инкрементального обновления: {e}")
            print(f"Incremental update error: {e}")
            time.sleep(1.5)
            if fallback_zip_url and fallback_zip_sig:
                self.download_update(fallback_zip_url, version, fallback_zip_sig)
            else:
                self.launch_existing_or_fail("Ошибка обновления. Попытка запуска оффлайн...")

    def launch_existing_or_fail(self, message):
        self.update_status(message)
        time.sleep(1)
        self.launch_client()

    def launch_client(self):
        exe_path = os.path.join(CLIENT_DIR, LAUNCHER_EXE_NAME)
        if os.path.exists(exe_path):
            self.update_status("Запуск...")
            subprocess.Popen([exe_path], cwd=CLIENT_DIR)
            self.quit()
        else:
            self.status_label.config(text="Клиент не найден. Требуется переустановка.")
            time.sleep(3)
            self.destroy()

if __name__ == "__main__":
    app = BootstrapApp()
    app.mainloop()
