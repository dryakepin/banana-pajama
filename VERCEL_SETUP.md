# Vercel Deployment Setup Guide

## Quick Start

Your game is now configured to work both **locally** and on **Vercel** with Supabase!

---

## 🔧 Vercel Environment Variables Setup

### Required Environment Variable

You need to add **ONE** environment variable to Vercel:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**: `banana-pajama`
3. **Go to Settings** → **Environment Variables**
4. **Add the following variable**:

| Name | Value | Environment |
|------|-------|-------------|
| `DATABASE_URL` | Your Supabase connection string | Production, Preview, Development |

### Where to Find Your Supabase Connection String

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon) → **Database**
4. Scroll to **Connection string** section
5. Select **URI** tab
6. Copy the connection string (looks like this):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxxx.supabase.co:5432/postgres
   ```
7. **Replace `[YOUR-PASSWORD]`** with your actual database password

### Adding to Vercel

```
Name: DATABASE_URL
Value: postgresql://postgres:your_actual_password@db.xxxxxxxxxxxxxx.supabase.co:5432/postgres

✅ Production
✅ Preview
✅ Development
```

Click **Save**.

---

## 🎮 Initialize Database (First Time Only)

After deploying, you need to create the database tables:

### Option 1: Run the migration script
```bash
DATABASE_URL="<your Supabase connection string>" node scripts/migrate-supabase.js
```

### Option 2: Run SQL directly in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Paste the contents of `database/init-supabase.sql`
3. Click **Run**

---

## 💻 Local Development Workflow

### Setup (First Time)

```bash
# 1. Install dependencies
cd client && npm install
cd ../server && npm install
cd ../api && npm install
cd ..

# 2. Create .env file in the server directory
cp env.example server/.env

# 3. Edit server/.env and add your Supabase connection string
# DATABASE_URL=postgresql://postgres:your_password@db.xxx.supabase.co:5432/postgres
```

### Running Locally

**Terminal 1** - Start the Express backend:
```bash
cd server
npm run dev
# Server runs on http://localhost:3000
```

**Terminal 2** - Start the Phaser client:
```bash
cd client
npm run dev
# Client runs on http://localhost:8080
# API calls automatically proxy to localhost:3000
```

Open http://localhost:8080 in your browser!

---

## 🚀 Deployment

### Automatic Deployment

Vercel automatically deploys when you push to your Git repository:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Vercel will:
1. Install dependencies from `/api` and `/client`
2. Build the client with webpack
3. Deploy serverless functions from `/api`
4. Serve the static game from `/client/dist`

### Manual Deployment

If you have the Vercel CLI:

```bash
vercel --prod
```

---

## 🏗️ Architecture

### Local Development
```
Browser → http://localhost:8080
  ↓
Webpack Dev Server (port 8080)
  ↓ (proxies /api/* requests)
Express Server (port 3000)
  ↓
Supabase PostgreSQL Database
```

### Production (Vercel)
```
Browser → https://banana-pajama.vercel.app
  ↓
  ├─ Static Game Files (client/dist)
  └─ API Routes (/api/*)
       ↓
     Vercel Serverless Functions
       ↓
     Supabase PostgreSQL Database
```

---

## 📁 Project Structure

```
banana-pajama/
├── api/                        # Vercel serverless functions (production)
│   ├── health.js              # GET /api/health
│   ├── highscores.js          # GET/POST /api/highscores
│   ├── sessions.js            # POST /api/sessions/*
│   └── package.json           # Dependencies (pg)
│
├── server/                     # Express server (local development)
│   ├── index.js               # Full Express app
│   ├── config/
│   │   └── database.js        # Database connection logic
│   └── package.json
│
├── client/                     # Phaser game
│   ├── src/
│   │   ├── scenes/            # Game scenes
│   │   ├── sprites/           # Game sprites
│   │   └── index.js           # Game entry point
│   ├── assets/                # Graphics and audio
│   ├── webpack.config.js      # Webpack with proxy config
│   └── package.json
│
├── database/
│   └── init-supabase.sql      # Database schema
│
├── vercel.json                 # Vercel configuration
└── env.example                 # Environment variables template
```

---

## 🔍 Testing the Deployment

### Check if API is working

1. **Health Check**:
   ```bash
   curl https://banana-pajama.vercel.app/api/health
   ```
   Expected: `{"status":"OK","database":"connected"}`

2. **Get High Scores**:
   ```bash
   curl https://banana-pajama.vercel.app/api/highscores
   ```
   Expected: JSON with high scores array

3. **Browser Console**:
   - Open https://banana-pajama.vercel.app
   - Press F12 → Console tab
   - Should see no red errors
   - Network tab should show `/api/highscores` returning 200 OK

---

## 🐛 Troubleshooting

### "Database disconnected" error

**Problem**: API returns database error

**Solution**:
1. Check environment variable `DATABASE_URL` is set in Vercel
2. Verify the connection string is correct
3. Ensure password doesn't have special characters (or URL-encode them)
4. Check Supabase project is not paused

### "404 Not Found" on /api routes

**Problem**: API endpoints return 404

**Solution**:
1. Ensure `/api` folder exists with .js files
2. Check vercel.json has correct rewrites
3. Redeploy: Push a new commit to trigger rebuild

### Local development - API calls fail

**Problem**: Client can't reach API locally

**Solution**:
1. Make sure Express server is running on port 3000
2. Check webpack.config.js has proxy configuration
3. Restart webpack dev server

### Game loads but scores don't save

**Problem**: Database tables don't exist

**Solution**:
Run database initialization:
```bash
DATABASE_URL="<your Supabase connection string>" node scripts/migrate-supabase.js
```

---

## 📊 Monitoring

### Vercel Dashboard

- **Deployments**: See build logs and status
- **Functions**: Monitor serverless function invocations
- **Analytics**: Track page views and performance

### Supabase Dashboard

- **Database**: View tables and data
- **Logs**: Check database queries
- **API**: Monitor connection pooling

---

## 🎯 Next Steps

Once deployed successfully:

1. ✅ Test the game at https://banana-pajama.vercel.app
2. ✅ Submit a high score
3. ✅ Check leaderboard
4. ✅ Monitor Vercel function logs
5. ✅ Check Supabase connection usage

---

## 💡 Tips

- **Free Tier Limits**: Vercel free tier includes 100GB bandwidth and 100GB-hours of serverless function execution
- **Connection Pooling**: Supabase free tier has 60 concurrent connections. The serverless functions use `max: 1` to minimize connections.
- **Cold Starts**: First API call after inactivity may be slow (~1-2 seconds). This is normal for serverless.
- **Development**: Always run both `server` and `client` locally for best development experience

---

## 🆘 Getting Help

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Phaser Docs**: https://photonstorm.github.io/phaser3-docs/

---

**Ready to deploy?** Just push your code and Vercel handles the rest! 🚀
