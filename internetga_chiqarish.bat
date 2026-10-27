@echo off
chcp 65001 > nul
title TeleSender - Internetga Chiqarish (Cloudflare Tunnel)

echo ============================================================
echo   🌐 TeleSender SaaS - Internetga Chiqarish (Online Rejim)
echo ============================================================
echo.
echo Bu dastur orqali kompyuteringizdagi tizim butun dunyoga bepul
echo va xavfsiz (HTTPS) havola orqali ochiladi.
echo.

if not exist "cloudflared.exe" (
    echo [!] Cloudflare utility yuklab olinmoqda, iltimos kuting...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing"
)

echo.
echo [✓] Cloudflare Tunnel ishga tushirilmoqda...
echo [✓] Havola hosil bo'lmoqda (ekranda https://....trycloudflare.com chiqadi)...
echo [✓] Ushbu havolani do'stlaringizga yoki o'zingizning telefoningizga yuboring!
echo.
echo ============================================================
echo.

cloudflared.exe tunnel --url http://127.0.0.1:5000
pause
