# Инструкция по настройке сервера Minecraft для GanjaCraft

Для работы новой системы авторизации сервер должен быть настроен на использование `authlib-injector` и вашего API.

## 1. Скачивание authlib-injector
Убедитесь, что файл `authlib-injector.jar` находится в папке с сервером.
Вы можете скачать его по ссылке: `https://ganjacraft.ru/files/authlib-injector.jar`
Или взять из папки клиента, если он там уже скачался.

## 2. Настройка server.properties
Откройте файл `server.properties` и установите следующие значения:

```properties
online-mode=true
enforce-secure-profile=false
```

*   `online-mode=true`: Обязательно, чтобы сервер проверял сессии.
*   `enforce-secure-profile=false`: Рекомендуется для кастомных лаунчеров/скинов, чтобы избежать проблем с подписями чата.

## 3. Параметры запуска (Start Command)
В ваш скрипт запуска (например, `start.sh` или в панели Pterodactyl) нужно добавить аргумент `-javaagent`.

**Пример команды запуска:**

```bash
java -javaagent:authlib-injector.jar=https://ganjacraft.ru/api/yggdrasil -Xms4G -Xmx8G -jar server.jar nogui
```

**Важно:**
*   Аргумент `-javaagent:...` должен идти **ПЕРЕД** `-jar server.jar`.
*   URL должен быть именно `https://ganjacraft.ru/api/yggdrasil`.

## 4. Перезапуск
После внесения изменений перезапустите сервер.

## Проверка
Если все настроено верно:
1.  При запуске сервера в логах появится сообщение от `authlib-injector` (обычно "Authlib-Injector ... started").
2.  Игроки с лаунчером GanjaCraft смогут заходить.
3.  Игроки с обычным лицензионным лаунчером зайти НЕ смогут (так как сервер теперь проверяет сессии через ваш сайт, а не через Mojang).
