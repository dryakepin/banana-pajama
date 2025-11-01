# SSL Certificate Error Fix

## The Issue

`"self-signed certificate in certificate chain"` means the Node.js pg driver can't verify Supabase's SSL certificate.

## Solution: Update Your Connection String

### Option 1: Add SSL Mode Parameter (Recommended)

Your connection string should include `?sslmode=require`:

**BEFORE:**
```
postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

**AFTER:**
```
postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

### Update in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Edit `DATABASE_URL`
3. Add `?sslmode=require` at the end
4. Save and redeploy

### Option 2: Use Supabase Connection Pooler (For High Traffic)

If you have high traffic, use the pooler endpoint with port 6543:

```
postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true&sslmode=require
```

**Note:** Connection pooling uses port **6543** instead of 5432

## Quick Test

After updating the connection string in Vercel and redeploying:

```bash
# Test health endpoint
curl https://banana-pajama.vercel.app/api/health

# Initialize database
curl -X POST https://banana-pajama.vercel.app/api/init-db
```

Expected: `{"success":true,"message":"Database initialized successfully"}`

## Where to Get the Correct Connection String

1. **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Under "Connection string" → select **URI** tab
5. Copy the string and replace `[YOUR-PASSWORD]`
6. **Add `?sslmode=require` to the end**

## Example:

If your Supabase project ref is `abcdefghijk`:

```
postgresql://postgres:your_password@db.abcdefghijk.supabase.co:5432/postgres?sslmode=require
```

## Still Not Working?

### Check Your Password

Special characters in passwords need URL encoding:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `&` → `%26`
- `=` → `%3D`
- `+` → `%2B`

Example:
```
Password: MyP@ss#123
Encoded:  MyP%40ss%23123
```

### Verify Supabase Project Status

1. Check your Supabase project is not paused
2. Verify your IP/region is allowed (Supabase has no IP restrictions by default)
3. Test the connection from Supabase SQL Editor first

## Local Development

For local dev, create `server/.env`:

```env
DATABASE_URL=postgresql://postgres:your_password@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

Then restart your Express server.
