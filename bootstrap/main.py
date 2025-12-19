import os
import sys
import json
import time
import subprocess
import threading
import urllib.request
import urllib.error
import zipfile
import ctypes
import tkinter as tk
from tkinter import ttk

# Configuration
BOOTSTRAP_VERSION = "1.0.0"
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

class BootstrapApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("GanjaCraft Updater")
        self.geometry("400x300")
        self.configure(bg=BG_COLOR)
        self.overrideredirect(True)  # Frameless
        self.after(10, self.set_appwindow) # Show in taskbar

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
        self.label = tk.Label(self.main_frame, text="Checking for updates...", font=("Segoe UI", 12, "bold"), fg=TEXT_COLOR, bg=BG_COLOR)
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

        # Start update process
        threading.Thread(target=self.run_update_process, daemon=True).start()

    def set_appwindow(self):
        GWL_EXSTYLE = -20
        WS_EX_APPWINDOW = 0x00040000
        WS_EX_TOOLWINDOW = 0x00000080
        hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        style = style & ~WS_EX_TOOLWINDOW
        style = style | WS_EX_APPWINDOW
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
        self.wm_withdraw()
        self.after(10, self.wm_deiconify)

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
            self.update_status("Connecting to server...")
            try:
                req = urllib.request.Request(API_URL, headers={'User-Agent': 'GanjaCraft Launcher'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = response.read()
                    remote_data = json.loads(data)
                    remote_version = remote_data.get("version")
                    download_url = remote_data.get("url")
            except Exception as e:
                print(f"Network error: {e}")
                self.launch_existing_or_fail("Network error. Launching offline...")
                return

            # 3. Check Local Version (Client)
            local_version = "0.0.0"
            version_path = os.path.join(LAUNCHER_DIR, VERSION_FILE)
            if os.path.exists(version_path):
                with open(version_path, "r") as f:
                    local_version = f.read().strip()

            if remote_version != local_version:
                self.download_update(download_url, remote_version)
            else:
                self.update_status("Client is up to date.")
                self.update_progress(100)
                time.sleep(0.5)
                self.launch_client()

        except Exception as e:
            self.status_label.config(text=f"Error: {str(e)}")
            time.sleep(3)
            self.destroy()

    def check_self_update(self):
        # Only update if running as compiled exe
        if not getattr(sys, 'frozen', False):
            return False

        self.update_status("Checking launcher updates...")
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
        self.update_status(f"Updating launcher to v{version}...")
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
            
            # Create batch script to replace exe and restart
            batch_file = "update_bootstrap.bat"
            with open(batch_file, "w") as f:
                f.write(f"""
@echo off
timeout /t 2 /nobreak > NUL
move /y "{new_exe}" "{current_exe}"
start "" "{current_exe}"
del "%~f0"
""")
            
            self.update_status("Restarting...")
            time.sleep(1)
            subprocess.Popen(batch_file, shell=True)
            self.quit()
            
        except Exception as e:
            self.status_label.config(text=f"Self-update failed: {e}")
            time.sleep(2)
            # Continue to client update if self-update fails
            return

    def download_update(self, url, version):
        self.update_status(f"Downloading version {version}...")
        try:
            # Handle spaces in URL if not already handled
            url = url.replace(" ", "%20")
            
            zip_path = os.path.join(LAUNCHER_DIR, "update.zip")

            req = urllib.request.Request(url, headers={'User-Agent': 'GanjaCraft Launcher'})
            with urllib.request.urlopen(req, timeout=30) as response:
                total_size = int(response.info().get('Content-Length', 0))
                downloaded = 0
                block_size = 8192

                with open(zip_path, 'wb') as f:
                    while True:
                        buffer = response.read(block_size)
                        if not buffer:
                            break
                        downloaded += len(buffer)
                        f.write(buffer)
                        if total_size > 0:
                            self.update_progress(downloaded, total_size)

            self.update_status("Installing update...")
            
            # Extract Zip
            if not os.path.exists(CLIENT_DIR):
                os.makedirs(CLIENT_DIR)
                
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(CLIENT_DIR)
            
            # Clean up zip
            os.remove(zip_path)

            # Update version file
            with open(os.path.join(LAUNCHER_DIR, VERSION_FILE), "w") as f:
                f.write(version)

            self.update_status("Update complete!")
            time.sleep(0.5)
            self.launch_client()

        except Exception as e:
            self.status_label.config(text=f"Download failed: {e}")
            print(f"Download error: {e}")
            time.sleep(3)
            self.launch_existing_or_fail("Update failed. Trying offline...")

    def launch_existing_or_fail(self, message):
        self.update_status(message)
        time.sleep(1)
        self.launch_client()

    def launch_client(self):
        exe_path = os.path.join(CLIENT_DIR, LAUNCHER_EXE_NAME)
        if os.path.exists(exe_path):
            self.update_status("Launching...")
            subprocess.Popen([exe_path], cwd=CLIENT_DIR)
            self.quit()
        else:
            self.status_label.config(text="Client not found. Reinstall required.")
            time.sleep(3)
            self.destroy()

if __name__ == "__main__":
    app = BootstrapApp()
    app.mainloop()
