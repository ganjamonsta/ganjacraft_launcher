!macro customRemoveFiles
  ; Удаляем ТОЛЬКО файлы самого Electron-лаунчера (~100 МБ).
  ; Папка 'game' (гигабайты игры, модов, конфигов) и 'launcher_config.json' ВООБЩЕ НЕ ТРОГАЮТСЯ.
  ; Это выполняется мгновенно и без лишней нагрузки даже на слабых HDD (0 перемещений файлов).

  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\swiftshader"
  Delete "$INSTDIR\*.exe"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.txt"
  Delete "$INSTDIR\*.html"
  Delete "$INSTDIR\*.log"
!macroend
