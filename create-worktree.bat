@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================
:: TaleSpinner — создание нового git worktree
:: с копированием БД и .env конфигов
:: ============================================

set "REPO_ROOT=%~dp0"
set "REPO_ROOT=%REPO_ROOT:~0,-1%"

cd /d "%REPO_ROOT%"

:: Проверка, что мы в git-репозитории
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [Ошибка] Запустите скрипт из корня git-репозитория TaleSpinner.
    pause
    exit /b 1
)

echo.
echo === Создание нового worktree ===
echo.

:: Ввод названия worktree (папка)
set /p "WORKTREE_NAME=Введите название worktree (имя папки, например feature-auth): "
if "%WORKTREE_NAME%"=="" (
    echo [Ошибка] Название не может быть пустым.
    pause
    exit /b 1
)

:: Убираем лишние пробелы и недопустимые символы
set "WORKTREE_NAME=%WORKTREE_NAME: =-%"
set "WORKTREE_NAME=%WORKTREE_NAME:/=-%"
set "WORKTREE_NAME=%WORKTREE_NAME:\=-%"

:: Ввод ветки
set /p "BRANCH_NAME=Введите имя ветки (существующей или новой, например feature/auth): "
if "%BRANCH_NAME%"=="" (
    echo [Ошибка] Имя ветки не может быть пустым.
    pause
    exit /b 1
)

:: Путь к новому worktree (рядом с текущим проектом)
set "PARENT_DIR=%REPO_ROOT%\.."
set "WORKTREE_PATH=%PARENT_DIR%\TaleSpinner_%WORKTREE_NAME%"

if exist "%WORKTREE_PATH%" (
    echo [Ошибка] Папка уже существует: %WORKTREE_PATH%
    pause
    exit /b 1
)

echo.
echo Параметры:
echo   Worktree: %WORKTREE_PATH%
echo   Ветка:   %BRANCH_NAME%
echo.

:: Создание worktree
git rev-parse --verify "%BRANCH_NAME%" >nul 2>&1
if errorlevel 1 (
    echo Ветка "%BRANCH_NAME%" не найдена. Создаём новую ветку...
    git worktree add -b "%BRANCH_NAME%" "%WORKTREE_PATH%"
) else (
    echo Ветка "%BRANCH_NAME%" найдена. Добавляем worktree...
    git worktree add "%WORKTREE_PATH%" "%BRANCH_NAME%"
)

if errorlevel 1 (
    echo [Ошибка] Не удалось создать worktree.
    pause
    exit /b 1
)

echo.
echo Worktree создан. Копируем данные...
echo.

:: Копирование server/.env
set "SRC_ENV=%REPO_ROOT%\server\.env"
set "DST_ENV=%WORKTREE_PATH%\server\.env"

if exist "%SRC_ENV%" (
    if not exist "%WORKTREE_PATH%\server" mkdir "%WORKTREE_PATH%\server"
    copy /Y "%SRC_ENV%" "%DST_ENV%" >nul
    echo [OK] Скопирован server\.env
) else (
    echo [Пропуск] server\.env не найден в исходном проекте
)

:: Копирование server/data/ (БД и связанные файлы)
set "SRC_DATA=%REPO_ROOT%\server\data"
set "DST_DATA=%WORKTREE_PATH%\server\data"

if exist "%SRC_DATA%" (
    if not exist "%DST_DATA%" mkdir "%DST_DATA%"
    
    :: db.sqlite и WAL-файлы
    for %%f in (db.sqlite db.sqlite-wal db.sqlite-shm db.sqlite-journal) do (
        if exist "%SRC_DATA%\%%f" (
            copy /Y "%SRC_DATA%\%%f" "%DST_DATA%\%%f" >nul
            echo [OK] Скопирован server\data\%%f
        )
    )
    
    :: Дополнительно: media и config, если есть
    if exist "%SRC_DATA%\media" (
        xcopy /E /I /Y /Q "%SRC_DATA%\media" "%DST_DATA%\media" >nul 2>&1
        echo [OK] Скопирована папка server\data\media
    )
    if exist "%SRC_DATA%\config" (
        xcopy /E /I /Y /Q "%SRC_DATA%\config" "%DST_DATA%\config" >nul 2>&1
        echo [OK] Скопирована папка server\data\config
    )
) else (
    echo [Пропуск] server\data не найдена
)

:: Копирование .env из web, если есть
set "SRC_WEB_ENV=%REPO_ROOT%\web\.env"
set "SRC_WEB_ENV_LOCAL=%REPO_ROOT%\web\.env.local"
if exist "%SRC_WEB_ENV%" (
    if not exist "%WORKTREE_PATH%\web" mkdir "%WORKTREE_PATH%\web"
    copy /Y "%SRC_WEB_ENV%" "%WORKTREE_PATH%\web\.env" >nul
    echo [OK] Скопирован web\.env
)
if exist "%SRC_WEB_ENV_LOCAL%" (
    if not exist "%WORKTREE_PATH%\web" mkdir "%WORKTREE_PATH%\web"
    copy /Y "%SRC_WEB_ENV_LOCAL%" "%WORKTREE_PATH%\web\.env.local" >nul
    echo [OK] Скопирован web\.env.local
)

:: Установка зависимостей в новом worktree
echo.
echo Установка зависимостей...
cd /d "%WORKTREE_PATH%"
call yarn install
if errorlevel 1 (
    echo [Предупреждение] yarn install завершился с ошибкой.
) else (
    call yarn install:all
    if errorlevel 1 (
        echo [Предупреждение] yarn install:all завершился с ошибкой.
    ) else (
        echo [OK] Зависимости установлены.
    )
)

echo.
echo === Готово ===
echo.
echo Новый worktree: %WORKTREE_PATH%
echo Ветка: %BRANCH_NAME%
echo.
echo Для обновления БД из основного каталога используйте: sync-db-from-main.bat
echo.
pause
