# 🚀 TeleSender SaaS - Telegram Excel Rassilka Platformasi

Ko'p foydalanuvchili (**Multi-User SaaS**), xavfsiz va to'liq avtomatlashtirilgan Telegram Excel rassilka platformasi. Har bir foydalanuvchi o'z Gmail pochtasi orqali ro'yxatdan o'tib, mustaqil shaxsiy kabinetiga ega bo'ladi.

---

## ✨ Asosiy Imkoniyatlar:

1. **Shaxsiy Kabinet & Gmail orqali Ro'yxatdan O'tish**:
   * Har bir foydalanuvchi o'z Gmail pochtasi va paroli bilan ro'yxatdan o'tadi yoki Google orqali 1-klikda kiradi.
   * To'liq sessiya xavfsizligi (HTTP-only cookies va PBKDF2 shifrlangan parollar).
2. **Alohida Telegram Sessiyalari (Multi-Tenancy)**:
   * Har bir foydalanuvchining o'z Telegram sessiyasi boshqalardan mutlaqo ajratilgan (`session/user_{id}.session`).
   * Bir vaqtda bir nechta foydalanuvchi bir-biriga xalaqit bermasdan parallel ravishda rassilka yuborishi mumkin.
3. **Excel Integratsiyasi**:
   * `.xlsx` va `.xls` fayllarni yuklash, ustunlarni avtomatik aniqlash va namunaviy qatorlarni ekranda ko'rish.
   * Foydalanuvchilarning yuklagan fayllari alohida papkalarda saqlanadi.
4. **Shaxsiylashtirilgan Xabarlar & Rasm**:
   * `{ism}` va `{telefon}` teglari orqali har bir mijozga o'z ismi bilan murojaat qilish.
   * Matn bilan birga banner yoki mahsulot rasmini biriktirish.
5. **Anti-Ban (Spamdan Himoya)**:
   * Xabarlar orasida tasodifiy kutilma vaqti (masalan, 15–30 soniya).
   * Yangi kontaktlarni xabar yuborilgach avtomatik tozalash (profilingiz kontaktlari to'lib ketmasligi uchun).
   * Telegram `FloodWait` cheklovlarini avtomatik kutish va qayta urinish.
6. **Jonli Monitoring & Real-Vaqt Loglar**:
   * Har bir foydalanuvchiga faqat uning o'z rassilka jarayoni, foizi va loglari WebSocket orqali real vaqtda yetkaziladi.
7. **Rassilkalar Tarixi & Hisobotlar**:
   * Barcha o'tkazilgan rassilkalar tarixi shaxsiy kabinetda saqlanadi.
   * Istalgan vaqtda o'tgan kampaniyalar bo'yicha batafsil Excel hisobotni qayta yuklab olish mumkin.

---

## ⚡ Ishga tushirish

### Windows uchun (Eng osoni):
* **Lokalda ishlatish:** Papkadagi **`ishga_tushirish.bat`** faylini sichqoncha bilan 2 marta bosing. Dastur brauzeringizda **`http://127.0.0.1:5000`** sahifasini ochadi.
* **Internetga chiqarish (Online havola):** Papkadagi **`internetga_chiqarish.bat`** faylini 2 marta bosing. Tizim bepul xavfsiz Cloudflare havolasini (masalan: `https://xxxx.trycloudflare.com`) chiqaradi. Ushbu havolani do'stlaringizga yoki o'zingizning telefoningizga yuborib bemalol kirishingiz mumkin!

### Linux / Server (VPS) uchun:
```bash
chmod +x start.sh
./start.sh
```

### Docker orqali ishga tushirish:
```bash
docker-compose up -d --build
```

---

## 📱 Qisqacha Foydalanish Yo'riqnomasi:

1. **Kirish**: Saytga kirib, **"Ro'yxatdan o'tish"** bo'limida Gmail va parolingizni kiriting (yoki Google orqali 1-klikda kiring).
2. **Telegram Ulash (10 soniyada)**: 
   * **"Telegram akkauntni ulash"** tugmasini bosing.
   * Faqat telefon raqamingizni kiriting va kelgan 5 xonali kodni yozing (Standart rasmiy API integratsiyasi avtomatik ishlaydi, shaxsiy API ID/Hash kiritish shart emas!).
3. **Excel Fayl Yuklash**: Kontaktlar ro'yxatini yuklang (telefon va ism ustunlari avtomatik aniqlanadi).
4. **Xabarni Yozish**: Matnni yozing, kerak bo'lsa rasm biriktiring.
5. **Boshlash**: Yashil **"Boshlash"** tugmasini bosing va natijalarni jonli kuzating.
6. **Shaxsiy Kabinet & Tarix**: 
   * Yuqoridagi foydalanuvchi profiliga bosib, umumiy statistika (yuborilganlar, muvaffaqiyat foizi) ni ko'ring.
   * **"Tarix"** tugmasi orqali o'tgan barcha hisobotlarni Excelda yuklab oling.
