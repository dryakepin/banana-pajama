# Vercel Environment Variables - Which One to Use?

## What You Have from Vercel-Supabase Integration

When you created your Supabase database through Vercel, it likely set these variables:

| Variable Name | What It Is | Use It For |
|---------------|------------|------------|
| `POSTGRES_URL` or `POSTGRES_PRISMA_URL` | PostgreSQL connection string | ✅ **THIS ONE** - Direct database access |
| `SUPABASE_URL` | Supabase API endpoint | ❌ For Supabase client SDK (not needed for our use case) |
| `SUPABASE_ANON_KEY` | Anonymous API key | ❌ For Supabase client SDK |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | ❌ For Supabase client SDK |

## Which One Should You Use?

### ✅ Use `POSTGRES_URL` (or similar)

This is the **direct PostgreSQL connection string** that looks like:
```
postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

This is what the `pg` library (node-postgres) needs.

### ❌ Don't Use `SUPABASE_URL`

This is the **Supabase API URL** that looks like:
```
https://xxxxx.supabase.co
```

This is for the Supabase JavaScript client library (`@supabase/supabase-js`), which we're NOT using.

## How to Check What You Have

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Look for variables that start with:
- `POSTGRES_URL` ✅
- `POSTGRES_PRISMA_URL` ✅
- `DATABASE_URL` ✅
- `DB_URL` ✅

Any of these would work!

## What Format Should It Be?

Your connection string should look like:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

With optional parameters:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

## Most Likely Scenario

If you created Supabase through Vercel, you probably have:
- ✅ `POSTGRES_URL` - Direct PostgreSQL connection
- ✅ `POSTGRES_PRISMA_URL` - Same as above, optimized for Prisma ORM
- ❌ `SUPABASE_URL` - API endpoint (not for direct DB access)

**Use `POSTGRES_URL` or `POSTGRES_PRISMA_URL`** - both work the same for our use case!
