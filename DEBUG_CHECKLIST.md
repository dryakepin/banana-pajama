# Debug Checklist - Supabase Connection Issue

## Step 1: Check Vercel Environment Variables

Go to: https://vercel.com/dashboard
1. Select your **banana-pajama** project
2. Go to **Settings** → **Environment Variables**

### What to Check:

**List ALL environment variables that contain "DATABASE", "POSTGRES", or "SUPABASE":**

For each variable, tell me:
- ✅ Variable Name (exact)
- ✅ First 30 characters of the value (e.g., `postgres://postgres.ldzzpasy...`)
- ✅ Which environments it's set for (Production/Preview/Development)

**Example format to share:**
```
Variable: DATABASE_URL
Value: postgres://postgres.ldzzpasy... (first 30 chars)
Environments: Production ✓, Preview ✓, Development ✓

Variable: POSTGRES_URL
Value: postgresql://postgres.... (first 30 chars)
Environments: Production ✓
```

---

## Step 2: Check Supabase Connection Strings

Go to: https://supabase.com/dashboard
1. Select your project
2. Go to **Settings** (gear icon) → **Database**
3. Scroll to **Connection string** section

### What to Share:

For each of these tabs, copy the first 50 characters:

**Tab: URI**
```
Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@...
First 50 chars: postgresql://postgres.ldzzpasyp...
```

**Tab: Connection pooling (Session mode)**
```
Port: Should be 6543
First 50 chars: postgres://postgres.ldzzpasy...
```

**Tab: Connection pooling (Transaction mode)**
```
Port: Should be 6543
First 50 chars: postgres://postgres.ldzzpasy...
```

---

## Step 3: Check Your Actual Connection String Format

From the error you showed earlier, your DATABASE_URL is:
```
postgres://postgres.ldzzpasypsahpqmfyknn:GifkJ4NvqVbQALrt@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x
```

### Questions:

1. **Is this the EXACT value in Vercel?** (Yes/No)
2. **Did you manually add `?sslmode=require&supa=base-pooler.x`?** (Yes/No)
3. **Or did Vercel add it automatically?** (Yes/No)

---

## Step 4: Check Vercel Deployment Logs

Go to: https://vercel.com/dashboard
1. Click on your **banana-pajama** project
2. Click on the **latest deployment**
3. Scroll down to **Function Logs** or **Runtime Logs**

### What to Look For:

After you run:
```bash
curl -X POST https://banana-pajama.vercel.app/api/init-db
```

**Look for error messages in the logs that contain:**
- "self-signed certificate"
- "ECONNREFUSED"
- "timeout"
- Any PostgreSQL error codes

**Share the full error message** (it will have more details than the API response)

---

## Step 5: Test Different Connection Strings

Let me know which of these connection string formats Supabase gives you:

### Format A: Direct Connection (Port 5432)
```
postgresql://postgres.[project-ref]:[password]@db.[region].supabase.co:5432/postgres
```
Has this? ☐ Yes ☐ No

### Format B: Pooler - Session Mode (Port 6543)
```
postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```
Has this? ☐ Yes ☐ No

### Format C: Pooler - Transaction Mode (Port 6543)
```
postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```
Has this? ☐ Yes ☐ No

---

## Step 6: Verify Which String You're Using

In Vercel, which connection string did you set?
- ☐ Format A (Direct - Port 5432)
- ☐ Format B (Pooler Session - Port 6543)
- ☐ Format C (Pooler Transaction - Port 6543 + pgbouncer)
- ☐ Something else (please describe)

---

## What I Need From You

Please copy and fill out this template:

```
=== VERCEL ENVIRONMENT VARIABLES ===
Variable 1:
  Name:
  Value (first 30 chars):
  Environments:

Variable 2:
  Name:
  Value (first 30 chars):
  Environments:

=== SUPABASE CONNECTION STRINGS ===
URI Tab (port 5432):
  First 50 chars:

Pooler Session Mode (port 6543):
  First 50 chars:

Pooler Transaction Mode (port 6543):
  First 50 chars:

=== WHICH ONE ARE YOU USING? ===
Current DATABASE_URL in Vercel matches: [URI / Pooler Session / Pooler Transaction / Custom]

=== EXACT ERROR FROM VERCEL LOGS ===
[Paste the full error from Vercel function logs here]
```

---

## Quick Tests to Run

While we debug, try these:

### Test 1: Health Check
```bash
curl https://banana-pajama.vercel.app/api/health
```

**What does it return?**

### Test 2: Check if ENV var is loaded
We can add a debug endpoint. Let me know if you want me to create one that shows which connection string format is being detected (without exposing the password).

