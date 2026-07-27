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
import hashlib

try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.hazmat.primitives.asymmetric import ed25519
except Exception:  # cryptography will be bundled in the compiled bootstrap
    InvalidSignature = None
    load_pem_public_key = None
    ed25519 = None

from constants import BOOTSTRAP_JSON_URL, VERSION_JSON_URL

# Build trigger
# Configuration
BOOTSTRAP_VERSION = "1.0.38"
BOOTSTRAP_API_URL = BOOTSTRAP_JSON_URL
API_URL = VERSION_JSON_URL
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
        normalized = [n.replace('\\', '/') for n in names]
        # If it is a delta update (contains app.asar), we do not require the .exe inside the zip
        is_delta = any('app.asar' in n for n in normalized)
        if not is_delta:
            if not any(n.endswith('/' + expected_exe_name) or n == expected_exe_name for n in normalized):
                raise Exception(f"В ZIP нет {expected_exe_name} — пакет не похож на клиент")


def _fetch_with_retry(url: str, timeout: int = 15, max_retries: int = 4, retry_delay: float = 10.0) -> bytes:
    """Fetch URL with automatic retries to survive ZROK tunnel reconnects (~27s window)."""
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'localtunnel',
                'Bypass-Tunnel-Reminder': 'true'
            })
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise e
            last_error = e
            if attempt < max_retries:
                time.sleep(retry_delay)
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                time.sleep(retry_delay)
    raise last_error

class BootstrapApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("GanjaCraft Launcher")
        self.geometry("420x340")
        self.configure(bg=BG_COLOR)
        self.overrideredirect(True)  # Frameless

        # Center window
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        x = (screen_width - 420) // 2
        y = (screen_height - 340) // 2
        self.geometry(f"420x340+{x}+{y}")

        # Show window on Windows Taskbar
        if sys.platform == 'win32':
            self.after(10, self._set_appwindow)

        # Dragging functionality
        self.x_offset = 0
        self.y_offset = 0
        self.bind("<ButtonPress-1>", self.start_move)
        self.bind("<B1-Motion>", self.do_move)

        # Top Control Bar (Minimize / Close buttons)
        self.top_bar = tk.Frame(self, bg=BG_COLOR)
        self.top_bar.pack(fill="x", side="top", padx=8, pady=4)
        self.top_bar.bind("<ButtonPress-1>", self.start_move)
        self.top_bar.bind("<B1-Motion>", self.do_move)

        self.close_btn = tk.Label(
            self.top_bar, text="✕", font=("Segoe UI", 10, "bold"),
            fg="#888888", bg=BG_COLOR, cursor="hand2", width=3
        )
        self.close_btn.pack(side="right")
        self.close_btn.bind("<Enter>", lambda e: self.close_btn.config(fg="#ffffff", bg="#e81123"))
        self.close_btn.bind("<Leave>", lambda e: self.close_btn.config(fg="#888888", bg=BG_COLOR))
        self.close_btn.bind("<Button-1>", lambda e: self.close_app())

        self.min_btn = tk.Label(
            self.top_bar, text="—", font=("Segoe UI", 10, "bold"),
            fg="#888888", bg=BG_COLOR, cursor="hand2", width=3
        )
        self.min_btn.pack(side="right")
        self.min_btn.bind("<Enter>", lambda e: self.min_btn.config(fg="#ffffff", bg="#333333"))
        self.min_btn.bind("<Leave>", lambda e: self.min_btn.config(fg="#888888", bg=BG_COLOR))
        self.min_btn.bind("<Button-1>", lambda e: self.minimize_window())

        # Main Frame
        self.main_frame = tk.Frame(self, bg=BG_COLOR)
        self.main_frame.pack(expand=True, fill="both", padx=20, pady=(0, 20))
        
        # Bind drag events to frame and labels too
        self.main_frame.bind("<ButtonPress-1>", self.start_move)
        self.main_frame.bind("<B1-Motion>", self.do_move)

    def _set_appwindow(self):
        try:
            import ctypes
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            if hwnd == 0:
                hwnd = self.winfo_id()
            style = ctypes.windll.user32.GetWindowLongW(hwnd, -20)
            style = (style & ~0x00000080) | 0x00040000
            ctypes.windll.user32.SetWindowLongW(hwnd, -20, style)
            self.wm_withdraw()
            self.after(10, self.wm_deiconify)
        except Exception as e:
            print(f"Taskbar hook failed: {e}")

    def minimize_window(self):
        self.overrideredirect(False)
        self.iconify()
        self.bind("<FocusIn>", self._on_restore)

    def _on_restore(self, event=None):
        self.overrideredirect(True)
        self.unbind("<FocusIn>")
        if sys.platform == 'win32':
            self._set_appwindow()

    def close_app(self):
        os._exit(0)

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
                data = _fetch_with_retry(API_URL)
                remote_data = json.loads(data)
                remote_version = remote_data.get("version")
                
                # Fast delta update support:
                # If the main exe exists, we can download just the quick update zip (url).
                # If not (first install), we must download the full installation zip (fullUrl).
                exe_path = os.path.join(CLIENT_DIR, LAUNCHER_EXE_NAME)
                if os.path.exists(exe_path) and "url" in remote_data:
                    download_url = remote_data.get("url")
                else:
                    download_url = remote_data.get("fullUrl") or remote_data.get("url")
                    
                signature = remote_data.get("signature")
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    # version.json нет на сервере — запускаем установленный клиент
                    self.update_status("Клиент обновлён.")
                    self.update_progress(100)
                    time.sleep(0.3)
                    self.launch_client()
                    return
                print(f"Network error: {e}")
                self.launch_existing_or_fail("Ошибка сети. Запуск оффлайн...")
                return
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
            data = json.loads(_fetch_with_retry(BOOTSTRAP_API_URL, timeout=10, max_retries=2, retry_delay=10.0))
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
            max_retries = 4
            retry_delay = 10.0
            last_error = None
            
            for attempt in range(1, max_retries + 1):
                try:
                    # Download new exe
                    req = urllib.request.Request(url, headers={
                        'User-Agent': 'localtunnel',
                        'Bypass-Tunnel-Reminder': 'true'
                    })
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
                    
                    break # Success
                except Exception as e:
                    last_error = e
                    if attempt < max_retries:
                        self.update_status(f"Ошибка загрузки загрузчика, повтор {attempt}/{max_retries}...")
                        time.sleep(retry_delay)
            else:
                raise last_error
            
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
            max_retries = 4
            retry_delay = 10.0
            last_error = None
            
            for attempt in range(1, max_retries + 1):
                try:
                    req = urllib.request.Request(url, headers={
                        'User-Agent': 'localtunnel',
                        'Bypass-Tunnel-Reminder': 'true'
                    })
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
                    
                    break # Success
                except Exception as e:
                    last_error = e
                    if attempt < max_retries:
                        self.update_status(f"Ошибка загрузки, повтор {attempt}/{max_retries}...")
                        time.sleep(retry_delay)
            else:
                raise last_error

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
