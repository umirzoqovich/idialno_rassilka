# 🚀 Telegram Excel Rassilka Pro (Shaxsiy Akkauntdan)

Ushbu dastur orqali siz **Excel (.xlsx)** faylingizdagi telefon raqamlarga shaxsiy Telegram akkauntingizdan avtomatik ravishda xabar yuborishingiz mumkin. Dastur chiroyli, zamonaviy va juda qulay veb-boshqaruv paneliga ega.

---

## ✨ Imkoniyatlari:
1. **Shaxsiy akkauntdan to'g'ridan-to'g'ri yuborish**: Telegram Bot emas, balki shaxsiy profilingiz nomidan yuboriladi.
2. **Excel integratsiyasi**: `.xlsx` va `.xls` fayllarni yuklash, ustunlarni avtomatik aniqlash va dastlabki qatorlarni ekranda ko'rish.
3. **Shaxsiylashtirilgan xabarlar (Dinamik taglar)**: `{ism}` va `{telefon}` teglari orqali har bir mijozga o'z ismi bilan murojaat qilish (Masalan: *"Assalomu alaykum {ism}!"*).
4. **Rasm biriktirish**: Matn bilan birga flyer, banner yoki mahsulot rasmini ham jo'natish imkoniyati.
5. **Anti-Ban (Spamdan himoya)**:
   * Xabarlar orasida tasodifiy kutilma vaqti (masalan, 15–30 soniya).
   * Yangi kontaktlarni xabar yuborilgach avtomatik tozalash (profilingiz to'lib ketmasligi uchun).
   * Telegram `FloodWait` cheklovlarini avtomatik kutish va qayta urinish.
6. **Jonli monitoring**: Real vaqtda foiz, yuborilganlar, topilmaganlar va xatoliklar hisobi hamda jonli loglar jadvali.
7. **Natijalarni Excelda yuklab olish**: Rassilka yakunlangach, kimga yuborildi-yu kimda Telegram yo'qligini ko'rsatuvchi hisobot faylini yuklab olish.

---

## 🛠️ 1-qadam: Telegram API ma'lumotlarini olish
Telegram shaxsiy akkauntdan dastur orqali foydalanish uchun bir martalik `API ID` va `API HASH` talab qiladi:
1. Brauzerda [my.telegram.org](https://my.telegram.org) saytiga kiring.
2. O'z Telegram telefon raqamingizni kiriting va Telegram ilovangizga kelgan kodni yozing.
3. **API development tools** bo'limiga bosing.
4. Ixtiyoriy ilova nomini (masalan: `MySender`) va qisqa nomini yozing, so'ng tasdiqlang.
5. Ekranda paydo bo'lgan **`api_id`** (raqamlar) va **`api_hash`** (harf va raqamlar) ni nusxalab oling.

---

## ⚡ 2-qadam: Dasturni ishga tushirish
Dasturni ishga tushirish juda oson:
* **Variant 1 (Eng osoni)**: Papkadagi **`ishga_tushirish.bat`** faylini sichqoncha bilan 2 marta bosing.
* **Variant 2**: Terminalda quyidagi buyruqni bering:
  ```powershell
  py app.py
  ```
Dastur ishga tushgach, brauzeringizda avtomatik ravishda **`http://127.0.0.1:5000`** sahifasi ochiladi.

---

## 📱 3-qadam: Foydalanish bo'yicha qo'llanma

### 1. Telegram Akkauntni ulash
* Sahifaning yuqori o'ng burchagidagi **"Akkaunt ulanmagan"** tugmasini yoki 1-blokdagi **"Telegram akkauntni ulash"** tugmasini bosing.
* `API ID`, `API Hash` va telefon raqamingizni kiriting.
* Telegramingizga kelgan 5 xonali kodni kiriting (agar 2FA parol bo'lsa, uni ham kiriting).
* Akkaunt muvaffaqiyatli ulanadi va sessiya kompyuteringizda xavfsiz saqlanadi (keyingi safar qayta kod kiritish shart bo'lmaydi).

### 2. Excel Fayl yuklash
* Excel faylingizni sudrab olib kelib tashlang yoki tugmani bosing.
* Dastur avtomatik ravishda telefon raqamlar ustunini va ism ustunini aniqlaydi.
* Namunani ko'rish uchun yuqoridagi **"Namunaviy Excel shablon"** tugmasini bosib, tayyor shablonni yuklab olishingiz mumkin.

### 3. Xabar matnini yozish
* Xabar matnini yozing.
* **`+ {ism}`** tugmasini bosib, matnga mijoz ismini joylashtiring.
* Pastdagi kichik ekranda mijoz bu xabarni qanday ko'rinishda olishini jonli ko'rishingiz mumkin.
* Xohlasangiz, **"Rasm biriktirish"** orqali rasm ham qo'shishingiz mumkin.

### 4. Xavfsizlik sozlamalari (Tavsiya)
* **Kutilma vaqti**: Minimal 15, maksimal 25–30 soniya qilib belgilang.
* **Limit**: Dastlab sinov uchun limit maydoniga masalan `3` yoki `5` deb yozib sinab ko'ring.

### 5. Rassilkani boshlash
* Katta yashil **"Boshlash"** tugmasini bosing.
* O'ng tomondagi jadvalda xabarlarning borishini real vaqtda kuzating.
* Kerak bo'lsa **"Pauza"** yoki **"To'xtatish"** tugmalaridan foydalaning.
* Jarayon tugagach, **"Natijalarni Excelda yuklab olish"** tugmasi orqali hisobotni saqlab oling.
