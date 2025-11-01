# Supabase Deployment Guide

This guide walks you through deploying the Banana Pajama Zombie Shooter database to Supabase.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- A Supabase project created
- Node.js installed (for running migration scripts)

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - **Name**: Your project name (e.g., "banana-pajama")
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
5. Wait for the project to be created (takes a few minutes)

## Step 2: Get Connection Credentials

Once your project is ready:

1. Go to **Settings** → **Database**
2. Scroll down to **Connection string**
3. Copy the **URI** connection string (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
   ```
   
   Or for connection pooling (recommended for server applications):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
   ```

4. Save this connection string securely - you'll need it for the server configuration

## Step 3: Run Database Migration

You have two options to set up the database schema:

### Option A: Using the Migration Script (Recommended)

1. Set your connection string as an environment variable:
   ```bash
   export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
   ```
   
   Or create a `.env` file in the project root:
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
   ```

2. Run the migration script:
   ```bash
   node scripts/migrate-supabase.js
   ```

3. The script will create all tables, indexes, views, and sample data.

### Option B: Using Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New query**
4. Open the file `database/init-supabase.sql` from this project
5. Copy and paste the entire contents into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Verify the tables were created in **Table Editor**

## Step 4: Configure Server

### For Local Development

Create a `.env` file in the project root or set environment variables:

```env
# Supabase Connection (Option 1: Connection String - Recommended)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres

# OR Supabase Connection (Option 2: Individual Parameters)
DB_PROVIDER=supabase
DB_HOST=[PROJECT-REF].supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=[YOUR-PASSWORD]

# For connection pooling (recommended for production)
USE_CONNECTION_POOLING=true
# And use port 6543 instead of 5432

# Other settings
PORT=3000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development
```

### For Docker Compose

1. Create a `.env` file in the `docker/` directory (or project root):
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
   ```

2. Start only the server and client (skip local database):
   ```bash
   cd docker
   docker-compose up server client
   ```
   
   Or start everything including local database tools:
   ```bash
   docker-compose --profile local-db up
   ```

### For Production Deployment

Set the following environment variables in your deployment platform:

- `DATABASE_URL`: Supabase connection string
- `NODE_ENV`: `production`
- `CORS_ORIGIN`: Your frontend URL
- `PORT`: Server port (usually set by platform)

## Step 5: Verify Connection

1. Start your server
2. Check the logs - you should see:
   ```
   ✅ Database connected successfully (supabase)
   ```
3. Test the health endpoint:
   ```bash
   curl http://localhost:3000/api/health
   ```
   
   Should return:
   ```json
   {
     "status": "OK",
     "timestamp": "...",
     "service": "Banana Pajama Zombie Shooter API",
     "database": "connected",
     "dbTime": "..."
   }
   ```

## Connection Options

### Direct Connection (Port 5432)

- Standard PostgreSQL connection
- More concurrent connections available
- Direct connection to database instance
- Use for: Development, when you need maximum connections

### Connection Pooling (Port 6543)

- Recommended for server applications
- Better connection management
- Handles connection limits better
- Use for: Production, serverless/server applications

To use connection pooling:
1. Change port in connection string from `5432` to `6543`
2. Add `?pgbouncer=true` query parameter
3. Set `USE_CONNECTION_POOLING=true` environment variable

Example:
```
postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
```

## Troubleshooting

### Connection Timeout

**Problem**: Server can't connect to Supabase

**Solutions**:
- Verify your connection string is correct
- Check that your IP is not blocked (Supabase has IP restrictions)
- Ensure SSL is enabled (it should be automatic)
- Check Supabase project status in dashboard

### SSL Certificate Errors

**Problem**: SSL connection fails

**Solutions**:
- Ensure `ssl: { rejectUnauthorized: false }` is set (done automatically by our config)
- Check that you're using the correct port
- Verify your Supabase project is active

### Migration Script Fails

**Problem**: `migrate-supabase.js` can't connect

**Solutions**:
- Verify `DATABASE_URL` environment variable is set
- Check that the connection string format is correct
- Ensure you have network access to Supabase
- Try running with `NODE_ENV=development` for more verbose errors

### Tables Already Exist Errors

**Problem**: Migration says tables already exist

**Solutions**:
- This is normal if you've run the migration before
- The script uses `IF NOT EXISTS` so it's safe to run multiple times
- If you need to reset, drop tables manually in Supabase SQL Editor first

### Docker Compose Issues

**Problem**: Docker Compose tries to start local database when using Supabase

**Solutions**:
- Start services without the database profile:
  ```bash
  docker-compose up server client
  ```
- Or set `DATABASE_URL` and the server will use Supabase instead
- The local database service uses the `local-db` profile and won't start by default

## Security Best Practices

1. **Never commit connection strings to git**
   - Use `.env` files (which should be in `.gitignore`)
   - Use environment variables in production
   - Use secrets management in your deployment platform

2. **Use connection pooling in production**
   - Better performance and connection management
   - Reduces risk of connection limit issues

3. **Restrict database access**
   - Use Supabase's built-in connection pooling
   - Consider using Supabase's API layer for additional security
   - Enable Row Level Security (RLS) if needed

4. **Rotate passwords regularly**
   - Update connection strings when passwords change
   - Use strong, unique passwords

## Migration from Local/RDS Database

If you're migrating from a local Docker database or AWS RDS:

1. **Export data** (if you have existing data):
   ```bash
   pg_dump -h localhost -U postgres -d banana_pajama > backup.sql
   ```

2. **Set up Supabase** (follow steps above)

3. **Run migration script** to create schema

4. **Import data** (if needed):
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

5. **Update environment variables** to point to Supabase

6. **Test thoroughly** before switching production

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)

## Support

If you encounter issues:

1. Check this troubleshooting section
2. Review Supabase project logs in dashboard
3. Check server logs for detailed error messages
4. Verify your connection string format
5. Test connection with a PostgreSQL client (like `psql` or pgAdmin)


