@echo off
chcp 65001 > nul
title Telegram Excel Rassilka Pro

echo ============================================================
echo   🚀 Telegram Excel Rassilka Pro (Shaxsiy Akkauntdan)
echo ============================================================
echo.
echo Tizim tekshirilmoqda...

if not exist ".venv\Scripts\python.exe" (
    echo [!] Virtual muhit (.venv) yaratilmoqda...
    py -m venv .venv
    .venv\Scripts\pip install -r requirements.txt
)

echo [✓] Dastur ishga tushirilmoqda...
echo [✓] Brauzeringiz avtomatik ochiladi: http://127.0.0.1:5000
echo.

.venv\Scripts\python.exe app.py
if %errorlevel% neq 0 (
    echo.
    echo [!] Xatolik yuz berdi. Dasturni to'xtatish uchun ixtiyoriy tugmani bosing...
    pause
)
