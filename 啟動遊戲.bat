@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 第一次執行，正在安裝套件…
  call npm install
)
echo.
echo 本機：http://localhost:3110
echo 同一個 Wi-Fi 的平板／手機請開下面的區域網路 IP：
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo   http://%%b:3110
echo.
start "" http://localhost:3110
call npm run dev
