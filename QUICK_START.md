# 🚀 Banana Pajama - Quick Start Guide

## ✅ What's Been Set Up

Your project now works BOTH locally and on Vercel!

### 📁 New Files Created

```
api/
├── health.js           ✅ Health check endpoint
├── highscores.js       ✅ Get/Post high scores
├── sessions.js         ✅ Game session tracking
└── package.json        ✅ Dependencies installed

VERCEL_SETUP.md         ✅ Complete deployment guide
QUICK_START.md          ✅ This file!
```

### 🔧 Updated Files

- `client/webpack.config.js` - Added API proxy for local dev (port also changed to 8080)
- `vercel.json` - Configured for serverless functions
- `.gitignore` - Already handles everything

---

## 🎮 NEXT STEPS

### 1️⃣ Add Supabase Connection to Vercel (REQUIRED)

Go to: https://vercel.com/dashboard

1. Select your **banana-pajama** project
2. Go to **Settings** → **Environment Variables**
3. Add this variable:

```
Name: DATABASE_URL
Value: postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
Environments: ✅ Production ✅ Preview ✅ Development
```

**Where to get this?**
- Supabase Dashboard → Settings → Database → Connection string (URI tab)

### 2️⃣ Commit and Push New Files

```bash
git add .
git commit -m "Add Vercel serverless functions for Supabase integration"
git push origin main
```

Vercel will automatically redeploy!

### 3️⃣ Initialize Database (First Time Only)

After deployment, run:

```bash
DATABASE_URL="<your Supabase connection string>" node scripts/migrate-supabase.js
```

This creates the tables (with row-level security enabled) and adds sample high
scores. You can also paste `database/init-supabase.sql` into the Supabase SQL
Editor instead.

### 4️⃣ Test It!

Visit: https://banana-pajama.vercel.app

- Play the game
- Submit a high score
- Check the leaderboard
- Verify scores are saved!

---

## 💻 Local Development

### Start the Backend (Terminal 1)

```bash
cd server
npm run dev
```

Server runs on `http://localhost:3000` ✅

### Start the Frontend (Terminal 2)

```bash
cd client
npm run dev
```

Client runs on `http://localhost:8080` ✅

**The client automatically proxies `/api/*` requests to your local Express server!**

---

## 🧪 Quick Test

### Test Vercel API (after deployment):

```bash
# Health check
curl https://banana-pajama.vercel.app/api/health

# Get high scores
curl https://banana-pajama.vercel.app/api/highscores

# Expected: JSON responses with data
```

### Test Local API:

```bash
# Make sure server is running first!
curl http://localhost:3000/api/health
curl http://localhost:3000/api/highscores
```

---

## 📋 Checklist

Before deploying:
- [ ] Add `DATABASE_URL` to Vercel environment variables
- [ ] Commit and push new `/api` folder
- [ ] Commit and push updated `vercel.json` and `webpack.config.js`

After deploying:
- [ ] Run `node scripts/migrate-supabase.js` to create database tables
- [ ] Test the game at https://banana-pajama.vercel.app
- [ ] Submit a high score to verify database connection
- [ ] Check browser console for any errors

---

## 🆘 Troubleshooting

### "Failed to fetch" in browser

**Check:** Did you add `DATABASE_URL` to Vercel?
**Check:** Did you push the `/api` folder?

### Local dev - API calls not working

**Check:** Is the Express server running on port 3000?
**Check:** Is the client running on port 8080 (not 3000)?

### Database errors

**Check:** Did you run `node scripts/migrate-supabase.js` to create tables?
**Check:** Is your Supabase database connection string correct?

---

## 📚 Full Documentation

See **VERCEL_SETUP.md** for complete details on:
- Architecture diagrams
- Environment variable setup
- Monitoring and logs
- Advanced troubleshooting

---

**Ready?** Just add the DATABASE_URL to Vercel and push! 🚀
