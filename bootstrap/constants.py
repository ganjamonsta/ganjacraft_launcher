"""
GanjaCraft Launcher Bootstrap Constants
Единая точка конфигурации URL и констант загрузчика
"""

BASE_URL = "https://launcher.ganj4craft.ru"
FILES_API_BASE = f"{BASE_URL}/api/launcher/files"
GITHUB_RELEASE_BASE = "https://github.com/ganjamonsta/ganjacraft_launcher/releases/latest/download"

BOOTSTRAP_JSON_URLS = [
    f"{FILES_API_BASE}/bootstrap.json",
    f"{GITHUB_RELEASE_BASE}/bootstrap.json"
]

VERSION_JSON_URLS = [
    f"{FILES_API_BASE}/version.json",
    f"{GITHUB_RELEASE_BASE}/version.json"
]

BOOTSTRAP_JSON_URL = BOOTSTRAP_JSON_URLS[0]
VERSION_JSON_URL = VERSION_JSON_URLS[0]
BOOTSTRAP_EXE_URL = f"{FILES_API_BASE}/GanjaCraft.exe"

