@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================
:: TaleSpinner — синхронизация БД из основного
:: каталога в текущий worktree
:: ============================================

set "CURRENT_DIR=%~dp0"
set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

cd /d "%CURRENT_DIR%"

:: Проверка, что мы в git-репозитории
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [Ошибка] Запустите скрипт из корня git-репозитория TaleSpinner.
    pause
    exit /b 1
)

:: Определение основного каталога (TaleSpinner_v1)
set "PARENT_DIR=%CURRENT_DIR%\.."
set "MAIN_PATH=%PARENT_DIR%\TaleSpinner_v1"

:: Если мы уже в основном каталоге — нечего синхронизировать
if /i "%CURRENT_DIR%"=="%MAIN_PATH%" (
    echo Вы уже в основном каталоге. Синхронизация не требуется.
    pause
    exit /b 0
)

if not exist "%MAIN_PATH%" (
    echo [Ошибка] Основной каталог не найден: %MAIN_PATH%
    echo Убедитесь, что TaleSpinner_v1 находится рядом с текущим worktree.
    pause
    exit /b 1
)

set "SRC_DATA=%MAIN_PATH%\server\data"
set "DST_DATA=%CURRENT_DIR%\server\data"

if not exist "%SRC_DATA%" (
    echo [Ошибка] Папка server\data не найдена в основном каталоге.
    pause
    exit /b 1
)

echo.
echo === Синхронизация БД из основного каталога ===
echo.
echo Источник:  %MAIN_PATH%
echo Приёмник: %CURRENT_DIR%
echo.

:: Создаём папку data, если её нет
if not exist "%DST_DATA%" mkdir "%DST_DATA%"

:: Копирование db.sqlite и WAL-файлов
set "COPIED=0"
for %%f in (db.sqlite db.sqlite-wal db.sqlite-shm db.sqlite-journal) do (
    if exist "%SRC_DATA%\%%f" (
        copy /Y "%SRC_DATA%\%%f" "%DST_DATA%\%%f" >nul
        echo [OK] Скопирован server\data\%%f
        set "COPIED=1"
    )
)

if "%COPIED%"=="0" (
    echo [Предупреждение] Файлы БД не найдены в основном каталоге.
    echo Убедитесь, что server\data\db.sqlite существует в TaleSpinner_v1.
) else (
    echo.
    echo [OK] БД успешно обновлена из основного каталога.
)

:: Опционально: media и config
set "COPY_EXTRA="
set /p "COPY_EXTRA=Скопировать также media и config? (y/N): "
if /i "!COPY_EXTRA!"=="y" (
    if exist "%SRC_DATA%\media" (
        xcopy /E /I /Y /Q "%SRC_DATA%\media" "%DST_DATA%\media" >nul 2>&1
        echo [OK] Скопирована папка server\data\media
    )
    if exist "%SRC_DATA%\config" (
        xcopy /E /I /Y /Q "%SRC_DATA%\config" "%DST_DATA%\config" >nul 2>&1
        echo [OK] Скопирована папка server\data\config
    )
)

echo.
pause
