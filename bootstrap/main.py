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
import gzip
import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from pathlib import Path

import ctypes

try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.hazmat.primitives.asymmetric import ed25519
except Exception:  # cryptography will be bundled in the compiled bootstrap
    InvalidSignature = None
    load_pem_public_key = None
    ed25519 = None


def set_file_hidden(filepath: str) -> bool:
    """Делает файл скрытым в Windows."""
    try:
        FILE_ATTRIBUTE_HIDDEN = 0x02
        result = ctypes.windll.kernel32.SetFileAttributesW(filepath, FILE_ATTRIBUTE_HIDDEN)
        return result != 0
    except Exception:
        return False

# Build trigger
# Configuration
BOOTSTRAP_VERSION = "1.0.22"
BOOTSTRAP_API_URL = "https://ganj4craft.ru/api/launcher/files/bootstrap.json"
API_URL = "https://ganj4craft.ru/api/launcher/files/version.json"
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
        self.geometry("420x340")
        self.configure(bg=BG_COLOR)
        self.overrideredirect(True)  # Frameless

        # Center window
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        x = (screen_width - 420) // 2
        y = (screen_height - 340) // 2
        self.geometry(f"420x340+{x}+{y}")

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
        self.label = tk.Label(
            self.main_frame,
            text="Проверка обновлений...",
            font=("Segoe UI", 12, "bold"),
            fg=TEXT_COLOR,
            bg=BG_COLOR,
            wraplength=360,
            justify="center",
        )
        self.label.pack(pady=(10, 14))
        self.label.bind("<ButtonPress-1>", self.start_move)
        self.label.bind("<B1-Motion>", self.do_move)

        # Custom Style for Progressbar
        style = ttk.Style()
        style.theme_use('default')
        style.configure("Green.Horizontal.TProgressbar",
                        troughcolor=BG_COLOR,
                        background=ACCENT_COLOR,
                        thickness=14,
                        borderwidth=0)

        self.progress = ttk.Progressbar(self.main_frame, style="Green.Horizontal.TProgressbar", length=320, mode='determinate')
        self.progress.pack(pady=(8, 6))

        self.percent_label = tk.Label(self.main_frame, text="0%", font=("Segoe UI", 10, "bold"), fg=ACCENT_COLOR, bg=BG_COLOR)
        self.percent_label.pack(pady=(0, 6))
        self.percent_label.bind("<ButtonPress-1>", self.start_move)
        self.percent_label.bind("<B1-Motion>", self.do_move)

        self.status_label = tk.Label(
            self.main_frame,
            text="",
            font=("Segoe UI", 10),
            fg="#b0b0b0",
            bg=BG_COLOR,
            wraplength=360,
            justify="center",
        )
        self.status_label.pack(pady=(6, 0))
        self.status_label.bind("<ButtonPress-1>", self.start_move)
        self.status_label.bind("<B1-Motion>", self.do_move)

        # Version Label (Bottom Right)
        self.version_label = tk.Label(self.main_frame, text=f"v{BOOTSTRAP_VERSION}", font=("Segoe UI", 8), fg="#777777", bg=BG_COLOR)
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
        try:
            if total and total > 0:
                pct = int((value / total) * 100)
                if pct < 0:
                    pct = 0
                elif pct > 100:
                    pct = 100
                self.percent_label.config(text=f"{pct}%")
            else:
                self.percent_label.config(text="")
        except Exception:
            pass
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
                    # Legacy updates: always download the full zip and extract.
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
            
            # Скрываем временный файл
            set_file_hidden(new_exe)
            
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
            
            # Скрываем batch скрипт
            set_file_hidden(batch_file)
            
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
