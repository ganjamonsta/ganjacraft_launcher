import os
import re
import json
import shutil
import subprocess
import requests
import hashlib

# Paths
BOOTSTRAP_DIR = os.path.dirname(os.path.abspath(__file__))
MAIN_PY = os.path.join(BOOTSTRAP_DIR, "main.py")
HASH_FILE = os.path.join(BOOTSTRAP_DIR, "last_build.hash")
STORAGE_DIR = os.path.abspath(os.path.join(BOOTSTRAP_DIR, "../../ganjacrafter_bot/storage/launcher"))
BOOTSTRAP_JSON = os.path.join(STORAGE_DIR, "bootstrap.json")
DIST_EXE = os.path.join(BOOTSTRAP_DIR, "dist/GanjaCraft.exe")
DEST_EXE = os.path.join(STORAGE_DIR, "GanjaCraft.exe")

def get_file_hash(filepath):
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def check_changes():
    current_hash = get_file_hash(MAIN_PY)
    last_hash = ""
    if os.path.exists(HASH_FILE):
        with open(HASH_FILE, 'r') as f:
            last_hash = f.read().strip()
    
    if current_hash == last_hash:
        return False, current_hash
    return True, current_hash

def bump_version():
    print(f"📖 Reading {MAIN_PY}...")
    with open(MAIN_PY, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find version like: BOOTSTRAP_VERSION = "1.0.0"
    match = re.search(r'BOOTSTRAP_VERSION = "(\d+)\.(\d+)\.(\d+)"', content)
    if not match:
        print("❌ Error: Could not find BOOTSTRAP_VERSION in main.py")
        return None
    
    major, minor, patch = map(int, match.groups())
    new_version = f"{major}.{minor}.{patch + 1}"
    
    new_content = re.sub(r'BOOTSTRAP_VERSION = ".*?"', f'BOOTSTRAP_VERSION = "{new_version}"', content)
    
    with open(MAIN_PY, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"🚀 Bumped version to {new_version}")
    return new_version

def build_exe():
    print("🔨 Building with PyInstaller...")
    # Run PyInstaller
    subprocess.check_call([
        "python", "-m", "PyInstaller",
        "--clean", "--noconfirm", "--onefile", "--windowed",
        "--icon", "assets/icon.ico",
        "--add-data", "assets/logo.png;assets",
        "--name", "GanjaCraft",
        "main.py"
    ], cwd=BOOTSTRAP_DIR)

def update_json(version):
    print(f"📝 Updating bootstrap.json...")
    data = {
        "version": version,
        "url": "https://ganj4craft.ru/api/launcher/files/GanjaCraft.exe"
    }
    
    # Ensure directory exists
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR)

    with open(BOOTSTRAP_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    print(f"✅ Updated bootstrap.json to version {version}")

def get_api_token():
    env_path = os.path.abspath(os.path.join(BOOTSTRAP_DIR, "../../ganjacrafter_bot/.env"))
    if not os.path.exists(env_path):
        print("⚠️ .env not found, skipping upload.")
        return None
    
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith("API_AUTH_TOKEN="):
                return line.strip().split("=", 1)[1].strip().strip('"').strip("'")
    return None

def upload_file(file_path):
    token = get_api_token()
    if not token:
        return

    url = "https://ganj4craft.ru/api/admin/upload/launcher"
    print(f"☁️ Uploading {os.path.basename(file_path)} to {url}...")
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            headers = {'X-API-Token': token}
            response = requests.post(url, files=files, headers=headers)
            
        if response.status_code == 200:
            print(f"✅ Upload success: {response.json()}")
        else:
            print(f"❌ Upload failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Upload error: {e}")

def main():
    print("--- Starting Bootstrap Auto-Build ---")
    
    changed, current_hash = check_changes()
    if not changed:
        print("💤 No changes detected in main.py. Skipping build.")
        return

    new_version = bump_version()
    if not new_version:
        return
    
    # Update hash after bump (because bump changes the file!)
    # Actually, bump changes the file, so the hash WILL change.
    # We should save the hash of the file AFTER bump, so next time we compare against that.
    
    try:
        build_exe()
    except subprocess.CalledProcessError:
        print("❌ Build failed!")
        return
    
    # Save new hash
    new_hash = get_file_hash(MAIN_PY)
    with open(HASH_FILE, 'w') as f:
        f.write(new_hash)

    print(f"📦 Copying to {DEST_EXE}...")
    if os.path.exists(DIST_EXE):
        shutil.copy2(DIST_EXE, DEST_EXE)
    else:
        print(f"❌ Error: {DIST_EXE} not found!")
        return
    
    update_json(new_version)
    
    # Upload to server
    upload_file(DEST_EXE)
    upload_file(BOOTSTRAP_JSON)

    print("🎉 Done! Bootstrap updated and deployed.")

if __name__ == "__main__":
    main()
