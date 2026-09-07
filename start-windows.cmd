@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
docker compose up --build -d
if errorlevel 1 (
 echo Docker Desktopを起動してから、もう一度実行してください。
 pause
 exit /b 1
)
start http://localhost:8787
pause
