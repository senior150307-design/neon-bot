# 🚀 NEON BOT - ISHGA TUSHIRISH QADAMLARI

## ✅ Bot tokeningiz tayyor: `8058613608:AAEm-S2-LfhFLCw4yK-5VBjqJyViwkd1bOk`

---

## 📦 1-QADAM: GitHub'ga yuklash

### 1.1 GitHub Repository yaratish

1. [github.com/new](https://github.com/new) ga o'ting
2. Repository name: `neon-bot`
3. Public yoki Private tanlang
4. **"Create repository"** ni bosing

### 1.2 Fayllarni GitHub'ga yuklash

Terminal ochib (CMD yoki PowerShell):

```bash
# Bu papkaga o'ting
cd neon-bot-ready

# Git boshlash
git init
git add .
git commit -m "NEON bot ready"

# GitHub'ga ulash (YOUR_USERNAME ni o'zgartiring!)
git remote add origin https://github.com/YOUR_USERNAME/neon-bot.git
git branch -M main
git push -u origin main
```

**MUHIM:** `YOUR_USERNAME` ni o'zingizning GitHub username'ingiz bilan almashtiring!

---

## 🚂 2-QADAM: Railway.app (Backend)

### 2.1 Railway'ga kirish

1. [railway.app](https://railway.app) ga o'ting
2. **"Login with GitHub"** bosing
3. Ruxsat bering

### 2.2 Project yaratish

1. **"New Project"** tugmasini bosing
2. **"Deploy from GitHub repo"** ni tanlang
3. **"neon-bot"** repository'ni tanlang
4. **"Deploy Now"** bosing

### 2.3 PostgreSQL qo'shish

1. Projectingiz sahifasida **"New"** tugmasini bosing
2. **"Database"** → **"Add PostgreSQL"** ni tanlang
3. 1-2 daqiqa kutib turing

### 2.4 Variables sozlash (IXTIYORIY)

Railway avtomatik `DATABASE_URL` qo'shadi. Agar boshqa narsalar kerak bo'lsa:

1. Bot service'ni tanlang
2. **"Variables"** tabiga o'ting
3. Qo'shimcha o'zgaruvchilar qo'shing (agar kerak bo'lsa)

### 2.5 Deploy statusini kuzatish

1. **"Deployments"** tabida status ko'ring
2. Yashil ✅ paydo bo'lguncha kuting (2-3 daqiqa)
3. **"View Logs"** orqali log'larni ko'ring

### 2.6 API URL olish

1. **"Settings"** → **"Domains"** ga o'ting
2. **"Generate Domain"** ni bosing
3. URL nusxalang (masalan: `neon-bot-production.up.railway.app`)

**Bu URL sizning backend API manzilingiz!**

---

## 🌐 3-QADAM: Netlify (Frontend/O'yin)

### 3.1 O'yin faylini tayyorlash

Sizda asl NEON o'yini HTML fayli bor. Uni bir papkaga joylashtiring:

```
frontend/
  └── index.html  (o'yin fayli)
```

### 3.2 HTML fayliga API URL qo'shish

`index.html` faylingizni oching va eng boshiga qo'shing:

```html
<script>
// Railway API URL (2.6 qadamda olgan URL)
const API_URL = 'https://neon-bot-production.up.railway.app/api';
</script>
```

### 3.3 Netlify'ga deploy qilish

#### Variant A: Website orqali

1. [netlify.com](https://netlify.com) ga o'ting
2. **"Add new site"** → **"Deploy manually"**
3. `frontend` papkasini drag & drop qiling
4. Tayyor! URL olasiz (masalan: `neon-game-abc123.netlify.app`)

#### Variant B: GitHub orqali

1. Frontend papkasini alohida GitHub repo qiling
2. Netlify'da **"Import from Git"** ni bosing
3. Repository tanlang va deploy qiling

---

## 🤖 4-QADAM: Telegram Bot sozlash

### 4.1 Web App sozlash

Telegram'da **@BotFather** ga o'ting va yuboring:

```
/setmenubutton
```

Keyin:
1. Botingizni tanlang
2. Button text kiriting: `🎮 O'yin`
3. **URL kiriting:** `https://neon-game-abc123.netlify.app` (3.3 qadamda olgan URL)

### 4.2 Bot buyruqlarini sozlash

```
/setcommands
```

Keyin botingizni tanlang va quyidagilarni yuboring:

```
start - O'yinni boshlash
stats - Statistikani ko'rish
leaderboard - Reytingni ko'rish
help - Yordam
```

---

## ✅ 5-QADAM: Test qilish

### 5.1 Bot ishlayaptimi?

1. Telegram'da botingizni toping
2. `/start` yuboring
3. **"O'YNASH"** tugmasini bosing
4. O'yin ochilishi kerak!

### 5.2 API ishlayaptimi?

Browser'da oching:
```
https://neon-bot-production.up.railway.app
```

Agar `{"status":"✅ Bot ishlayapti!"}` ko'rsatsa — HAMMASI OK! ✅

---

## 🐛 MUAMMOLAR?

### Bot javob bermayapti

Railway'da log'larni tekshiring:
1. Railway project → Bot service
2. **"Deployments"** → **"View Logs"**

### O'yin yuklanmayapti

1. Browser'da F12 bosing → Console tabini oching
2. Xatolarni o'qing
3. API URL to'g'ri ekanligini tekshiring

### Database xatosi

Railway'da PostgreSQL borligini tekshiring:
1. Project'da PostgreSQL ko'rinishida bo'lishi kerak
2. Agar yo'q bo'lsa, qaytadan qo'shing (2.3 qadam)

---

## 📝 QISQASI

1. ✅ GitHub'ga yuklang → `git push`
2. ✅ Railway'ga deploy qiling → Auto deploy
3. ✅ Netlify'ga o'yin joylashtiring → Drag & drop
4. ✅ BotFather'da Web App sozlang → URL kiriting
5. ✅ Test qiling → `/start` yuboring

**HAMMASI! 🎉**

---

## 💡 ESLATMA

- Railway **BEPUL** 500 soat/oy beradi (kifoya)
- Netlify **BEPUL** 100GB bandwidth beradi
- Bot tokeni sizda: `8058613608:AAEm-S2-LfhFLCw4yK-5VBjqJyViwkd1bOk`

**Omad! 🚀**
