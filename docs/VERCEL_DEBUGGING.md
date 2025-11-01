# Vercel Debugging Guide

## Accessing Vercel Logs

### Method 1: Vercel Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com) and sign in
2. Select your project
3. Click on the **"Deployments"** tab
4. Click on a specific deployment
5. Click **"Runtime Logs"** or **"Functions"** tab
6. Select your serverless function (e.g., `api/index.js` or `server/index.js`)
7. View real-time logs and errors

### Method 2: Vercel CLI
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Link your project
vercel link

# View logs
vercel logs [deployment-url] --follow
```

### Method 3: Function Logs in Dashboard
1. Go to your project → **Settings** → **Functions**
2. Scroll down to see function execution logs
3. Check for errors, execution time, and memory usage

## Common Issues and Solutions

### Issue 1: API Endpoints Not Found (404)

**Symptoms:**
- Client gets 404 when calling `/api/highscores`
- Game shows no scores

**Debug Steps:**
1. Check your Vercel project structure:
   - Server code should be in `api/` folder for Vercel serverless functions
   - OR configure `vercel.json` to route correctly

2. Verify API routes exist:
   ```bash
   # Test the endpoint directly
   curl https://your-project.vercel.app/api/highscores
   ```

**Solution:**
If your server is in `server/` folder, you need to either:
- Move it to `api/` folder (Vercel convention)
- Or configure `vercel.json` (see below)

### Issue 2: CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- Network tab shows preflight failures
- API calls fail with CORS-related errors

**Debug Steps:**
1. Check browser console for CORS error messages
2. Verify `CORS_ORIGIN` environment variable is set correctly
3. Check server logs for CORS-related errors

**Solution:**
Update your `CORS_ORIGIN` environment variable in Vercel:
1. Go to **Project Settings** → **Environment Variables**
2. Add `CORS_ORIGIN` with your frontend URL (e.g., `https://your-frontend.vercel.app`)
3. For development, you might need: `http://localhost:3000,https://your-frontend.vercel.app`

### Issue 3: Database Connection Failed

**Symptoms:**
- `/api/health` returns `database: disconnected`
- High scores endpoint returns 500 errors
- Server logs show connection errors

**Debug Steps:**
1. Check Vercel logs for database connection errors
2. Verify `DATABASE_URL` environment variable is set
3. Test database connection:
   ```bash
   # In Vercel logs, look for:
   # ❌ Error connecting to database: ...
   ```

**Solution:**
1. Go to **Project Settings** → **Environment Variables**
2. Add `DATABASE_URL` with your Supabase connection string:
   ```
   postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres
   ```
3. Ensure Supabase allows connections from Vercel's IP ranges (usually enabled by default)
4. For connection pooling (recommended):
   ```
   postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:6543/postgres?pgbouncer=true
   ```

### Issue 4: Client Can't Reach API

**Symptoms:**
- Client makes requests but gets network errors
- API URL might be wrong

**Debug Steps:**
1. Check browser Network tab to see actual API requests
2. Verify the API base URL in your client code
3. Check if client and API are on same domain

**Solution:**
If client and API are separate Vercel deployments:
1. Update client to use full API URL:
   ```javascript
   const API_URL = process.env.API_URL || 'https://your-api.vercel.app';
   const response = await fetch(`${API_URL}/api/highscores`);
   ```
2. Or configure Vercel rewrites (see `vercel.json` below)

## Vercel Configuration

### Project Structure for Vercel

If deploying the server to Vercel, you need this structure:

```
your-project/
├── api/              # Serverless functions go here
│   └── index.js      # Main API handler
├── public/           # Or client build output
└── vercel.json       # Vercel configuration
```

### vercel.json Configuration

Create `vercel.json` in your project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/client/dist/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Alternative: Separate API and Client Deployments

If you have separate deployments:

**API Deployment (`api/` folder or `vercel.json` routing to server):**
- Set `CORS_ORIGIN` to your client URL
- Set `DATABASE_URL` to Supabase
- Set `NODE_ENV=production`

**Client Deployment:**
- Set `API_URL` environment variable (if using)
- Or configure API calls to use full URL

## Environment Variables Checklist

Ensure these are set in Vercel (Project Settings → Environment Variables):

- ✅ `DATABASE_URL` - Supabase connection string
- ✅ `CORS_ORIGIN` - Your client/frontend URL
- ✅ `NODE_ENV` - Set to `production`
- ✅ `PORT` - Usually not needed (Vercel handles this)

## Testing Steps

### 1. Test Database Connection
```bash
# Use Vercel CLI or test via API
curl https://your-project.vercel.app/api/health

# Should return:
{
  "status": "OK",
  "database": "connected",
  "dbTime": "..."
}
```

### 2. Test High Scores Endpoint
```bash
# GET high scores
curl https://your-project.vercel.app/api/highscores

# POST a high score
curl -X POST https://your-project.vercel.app/api/highscores \
  -H "Content-Type: application/json" \
  -d '{
    "player_name": "TestPlayer",
    "score": 100,
    "survival_time": 60,
    "zombies_killed": 10
  }'
```

### 3. Check Browser Console
1. Open your game in browser
2. Open Developer Tools (F12)
3. Go to **Console** tab - look for errors
4. Go to **Network** tab - check API requests:
   - Status codes (should be 200)
   - Response bodies
   - Request URLs

## Quick Debugging Commands

```bash
# View recent logs
vercel logs --follow

# Test API endpoint
curl https://your-project.vercel.app/api/health

# Check environment variables
vercel env ls

# Redeploy with fresh logs
vercel --prod
```

## Common Error Messages

### "Cannot connect to database"
- Check `DATABASE_URL` is set correctly
- Verify Supabase project is active
- Check if IP restrictions are blocking Vercel

### "CORS policy: No 'Access-Control-Allow-Origin'"
- Set `CORS_ORIGIN` environment variable
- Ensure it matches your frontend URL exactly

### "Function timeout"
- Check Vercel function timeout settings
- Optimize database queries
- Check for connection leaks

### "Module not found"
- Ensure all dependencies are in `package.json`
- Check `vercel.json` build configuration

## Getting More Detailed Logs

Add logging to your server code:

```javascript
// In server/index.js, add more detailed logging
console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('CORS Origin:', process.env.CORS_ORIGIN || 'Not set');
console.log('Node Env:', process.env.NODE_ENV);
```

These will appear in Vercel's Runtime Logs.

## Still Having Issues?

1. **Check Vercel Status**: [status.vercel.com](https://status.vercel.com)
2. **Vercel Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)
3. **Review Supabase Logs**: Check Supabase dashboard for connection attempts
4. **Test Database Directly**: Use `psql` or Supabase SQL Editor to verify data exists

