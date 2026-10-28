#!/bin/bash
# TeleSender PRO - Yangilash va Qayta Ishga Tushirish skripti
set -e

echo "============================================================"
echo "  TeleSender PRO - Yangilash va Qayta Ishga Tushirish"
echo "============================================================"

# GitHub'dan eng oxirgi kodni tortish
git pull origin main

# 5000-portda ishlab turgan eski jarayonlarni to'liq o'chirish
echo "[!] 5000-port tozalanmoqda..."
fuser -k 5000/tcp 2>/dev/null || true
pkill -9 -f "python3 app.py" 2>/dev/null || true
sleep 1

# Dasturni yangi kod bilan yurgizish
chmod +x start.sh
./start.sh
