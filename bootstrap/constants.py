"""
GanjaCraft Launcher Bootstrap Constants
Единая точка конфигурации URL и констант загрузчика
"""

GITHUB_RELEASE_BASE = "https://github.com/ganjamonsta/ganjacraft_launcher/releases/latest/download"

BOOTSTRAP_JSON_URLS = [
    f"{GITHUB_RELEASE_BASE}/bootstrap.json"
]

VERSION_JSON_URLS = [
    f"{GITHUB_RELEASE_BASE}/version.json"
]

BOOTSTRAP_JSON_URL = BOOTSTRAP_JSON_URLS[0]
VERSION_JSON_URL = VERSION_JSON_URLS[0]
BOOTSTRAP_EXE_URL = f"{GITHUB_RELEASE_BASE}/GanjaCraft.exe"
