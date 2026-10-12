@echo off
cd /d "%~dp0"
set "TASK_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if exist "%TASK_NODE%\node.exe" set "PATH=%TASK_NODE%;%PATH%"
if not exist "node_modules\vite\bin\vite.js" (
    echo Dependencies missing. Run npm.cmd ci first.
    pause
    exit /b 1
)
node node_modules/vite/bin/vite.js
