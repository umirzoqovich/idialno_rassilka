#!/bin/bash
# Telegram Excel Rassilka Pro - Linux Server Start Script

echo "============================================================"
echo "  Telegram Excel Rassilka Pro (Server Launcher)"
echo "============================================================"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "[!] Python 3 topilmadi! Iltimos, Python 3 o'rnating: sudo apt update && sudo apt install python3 python3-pip python3-venv -y"
    exit 1
fi

# Create virtualenv if not exists
if [ ! -d ".venv" ]; then
    echo "[!] Virtual muhit (.venv) yaratilmoqda..."
    python3 -m venv .venv
fi

# Always ensure requirements (aiosqlite, etc.) are installed
echo "[!] Kutubxonalar tekshirilmoqda va yangilanmoqda..."
.venv/bin/pip install -r requirements.txt

echo "[!] Eski jarayonlar va 5000-port tozalanmoqda..."
fuser -k 5000/tcp 2>/dev/null || true
pkill -9 -f "python3 app.py" 2>/dev/null || true
sleep 1

echo "[✓] Server ishga tushirilmoqda..."
echo "[✓] Tashqaridan kirish uchun brauzerda oching: http://SERVER_IP:5000"
echo "============================================================"

.venv/bin/python3 app.py
