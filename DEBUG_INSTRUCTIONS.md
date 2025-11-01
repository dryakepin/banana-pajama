# How to Debug Vercel Deployment

## Get Browser Console Logs

1. **Open the deployed game**: https://banana-pajama.vercel.app/
2. **Open Developer Tools**:
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - Safari: Enable Developer menu first, then `Cmd+Option+C`

3. **Check the Console tab** - Look for red error messages like:
   - `Failed to fetch`
   - `404 Not Found`
   - `CORS error`
   - `Network error`

4. **Check the Network tab**:
   - Click the "Network" tab
   - Reload the page (`Ctrl+R` or `Cmd+R`)
   - Look for requests to `/api/highscores`
   - Click on the failed request to see details

5. **Copy all error messages** and share them

## Get Vercel Build Logs

1. Go to: https://vercel.com/dashboard
2. Click on your "banana-pajama" project
3. Click on the latest deployment
4. Click "View Build Logs"
5. Copy any errors or warnings

## What to Look For

### Expected Error in Browser Console:
```
GET https://banana-pajama.vercel.app/api/highscores 404 (Not Found)
```

This confirms the backend is not deployed.

### In Network Tab:
- Status: **404** (backend doesn't exist)
- Or **CORS error** (if backend exists but misconfigured)

## Quick Test

Open the browser console on https://banana-pajama.vercel.app/ and run:

```javascript
fetch('/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Expected result: `404 Not Found` (confirms no backend)
