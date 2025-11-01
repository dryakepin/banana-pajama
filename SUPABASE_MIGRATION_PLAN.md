# Supabase Database Migration Plan

## Overview
This document outlines the plan to add Supabase support as a database deployment option for Banana Pajama Zombie Shooter. Supabase is a PostgreSQL-based platform that provides a managed database service with additional features like real-time subscriptions, authentication, and storage.

## ✅ Backward Compatibility Guarantee

**IMPORTANT**: All changes maintain full backward compatibility with the existing local Docker Compose setup:
- `database/init.sql` remains **completely unchanged** - continues to work with local development
- New `database/init-supabase.sql` is a separate file for Supabase deployments only
- Local development workflow remains identical - no breaking changes
- Existing Docker Compose setup continues to work exactly as before

## Current Database Architecture

### Current Setup
- **Database**: PostgreSQL 15
- **Connection Library**: `pg` (node-postgres)
- **Connection Method**: Individual environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- **SSL**: Conditionally enabled in production only
- **Initialization**: `database/init.sql` script executed on container startup

### Database Schema
1. **Tables**:
   - `high_scores`: Player high score records
   - `game_sessions`: Game session analytics
   
2. **Extensions**:
   - `uuid-ossp`: For UUID generation
   
3. **Views**:
   - `leaderboard`: Computed leaderboard view with rankings

### Deployment Targets
- **Local**: Docker Compose with PostgreSQL container
- **Production**: AWS RDS PostgreSQL instance

## Supabase Compatibility Analysis

### ✅ Compatible Features
- PostgreSQL 15 (Supabase runs PostgreSQL)
- All SQL syntax and table definitions
- `uuid-ossp` extension (pre-installed on Supabase)
- Standard PostgreSQL connection using `pg` library
- All table structures, indexes, and constraints

### ⚠️ Required Changes

#### 1. Database Initialization Script (`database/init.sql`)
**Issues:**
- Line 5-6: `CREATE DATABASE` command won't work (Supabase database already exists)
- Line 9: `\c banana_pajama;` is a psql meta-command, not valid SQL
- Lines 77-79: `GRANT` statements may fail (Supabase manages permissions differently)

**Solutions:**
- Remove database creation commands
- Remove `\c` connection switching
- Make GRANT statements optional or remove them
- Create a Supabase-specific version of init script

#### 2. Connection Configuration (`server/index.js`)
**Current:**
```javascript
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

**Changes Needed:**
- Support Supabase connection string format (`DATABASE_URL`)
- Always enable SSL for Supabase connections
- Support connection pooling port (6543) vs direct connection (5432)
- Add Supabase-specific connection parameters

#### 3. Environment Variables
**Current Variables:**
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

**Additional Variables Needed:**
- `DATABASE_URL` (Supabase connection string format)
- `DB_PROVIDER` or `DATABASE_TYPE` (to distinguish Supabase from RDS/local)
- `USE_CONNECTION_POOLING` (boolean for Supabase connection pooling)

#### 4. Docker Compose Configuration
**Changes Needed:**
- Make database service optional when using Supabase
- Add conditional database service based on environment variable
- Update server service to work with or without local database

## Implementation Plan

### Backward Compatibility Strategy

**Dual-Script Approach:**
- `database/init.sql` - **UNCHANGED** - Continues to work with local Docker Compose
  - Used automatically by Docker Compose on container startup
  - Contains psql meta-commands (`\c`) that work in Docker entrypoint context
  - Creates database, switches to it, then runs schema setup
  - Full backward compatibility maintained - no modifications needed
  
- `database/init-supabase.sql` - **NEW FILE** - For Supabase deployments
  - Pure SQL only (no psql meta-commands)
  - No database creation (database already exists in Supabase)
  - Can be run directly in Supabase SQL Editor or via migration tool
  - Extracts all schema logic from init.sql

**Why Two Scripts?**
- Docker Compose requires psql-specific commands that don't work in Supabase
- Supabase needs pure SQL that doesn't work in Docker initialization
- Both scripts share the same schema logic but differ in initialization commands
- This approach ensures both environments work correctly without compromise

### Phase 1: Database Script Adaptation

**IMPORTANT: Backward Compatibility Requirement**
- The existing `database/init.sql` MUST continue to work with local Docker Compose setup
- No changes to `init.sql` that would break local development
- Create a separate Supabase-compatible script for Supabase deployments

#### 1.1 Create Supabase-Compatible Schema Script
**File**: `database/init-supabase.sql`
- **NEW FILE** - Does NOT replace existing `init.sql`
- Extract all schema definition logic from `init.sql`
- Remove database creation commands (database already exists in Supabase)
- Remove connection switching commands (`\c` - psql meta-command, not valid SQL)
- Remove or make GRANT statements optional (Supabase manages permissions)
- Keep all table, index, and view creation logic
- Ensure UUID extension is optional (already available in Supabase)
- Can be run directly in Supabase SQL editor

#### 1.2 Maintain Existing Script (No Breaking Changes)
**File**: `database/init.sql`
- **UNCHANGED** - Continues to work with Docker Compose
- Docker Compose automatically runs this script on container initialization
- Uses psql meta-commands that work in Docker entrypoint context
- No modifications needed - maintains full backward compatibility

### Phase 2: Server Connection Logic Updates

#### 2.1 Enhance Database Connection Configuration
**File**: `server/index.js`

**Changes:**
1. Support both connection string and individual parameters
2. Detect Supabase (via `DATABASE_URL` or `DB_PROVIDER`)
3. Always enable SSL for Supabase
4. Support connection pooling port option
5. Add better error handling for connection failures

**Implementation Approach:**
```javascript
// Pseudocode
if (process.env.DATABASE_URL) {
    // Parse connection string (Supabase format)
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: {...} });
} else if (process.env.DB_PROVIDER === 'supabase') {
    // Supabase with individual parameters
    pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || (process.env.USE_POOLING === 'true' ? 6543 : 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
    });
} else {
    // Existing logic for RDS/local
}
```

#### 2.2 Create Database Configuration Module
**New File**: `server/config/database.js`
- Centralize database connection logic
- Support multiple providers (local, RDS, Supabase)
- Handle connection string parsing
- Export connection pool instance

### Phase 3: Environment Configuration

#### 3.1 Environment Variable Documentation
**File**: `.env.example` or `ENV_VARIABLES.md`
- Document all database connection options
- Include Supabase-specific variables
- Provide example values for each provider

#### 3.2 Docker Compose Updates
**File**: `docker/docker-compose.yml`

**Changes:**
1. Make database service conditional
2. Add environment variable to skip database service
3. Update server service to not depend on database when using Supabase

**Implementation:**
```yaml
services:
  database:
    # Only create if not using Supabase
    profiles: ["local-db"]
    # ... existing config

  server:
    depends_on:
      - condition: service_healthy
        service: database
      # Conditional based on DB_PROVIDER
```

### Phase 4: Migration and Deployment Scripts

#### 4.1 Create Supabase Migration Script
**New File**: `scripts/migrate-supabase.js` or `scripts/supabase-setup.sh`
- Execute Supabase-compatible schema
- Run migrations from `database/init-supabase.sql`
- Handle errors gracefully
- Provide feedback on migration status

#### 4.2 Create Deployment Documentation
**New File**: `docs/SUPABASE_DEPLOYMENT.md`
- Step-by-step Supabase setup instructions
- How to obtain connection credentials
- Connection string format
- Environment variable configuration
- Troubleshooting guide

### Phase 5: Testing and Validation

#### 5.1 Local Testing
- Test connection with Supabase using local environment
- Verify all queries work correctly
- Test high score insertion and retrieval
- Verify session tracking

#### 5.2 Schema Validation
- Ensure all tables are created correctly
- Verify indexes are in place
- Test view creation (`leaderboard`)
- Validate UUID generation

## Detailed Implementation Checklist

### Database Scripts
- [ ] Create `database/init-supabase.sql` (NEW Supabase-compatible version)
- [ ] **Verify `database/init.sql` remains UNCHANGED** (for local Docker Compose)
- [ ] Extract schema-only logic to Supabase script (no database creation)
- [ ] Remove `\c banana_pajama;` connection switching from Supabase script
- [ ] Make GRANT statements optional or remove from Supabase script
- [ ] Verify UUID extension availability note
- [ ] Test Supabase script execution on Supabase
- [ ] Test local Docker Compose still works with original `init.sql`

### Server Code
- [ ] Create `server/config/database.js` configuration module
- [ ] Add support for `DATABASE_URL` connection string
- [ ] Add `DB_PROVIDER` detection logic
- [ ] Implement Supabase-specific SSL configuration
- [ ] Add connection pooling port support (6543)
- [ ] Update `server/index.js` to use new configuration module
- [ ] Add better error messages for connection failures
- [ ] Test connection with Supabase credentials

### Docker Configuration
- [ ] Update `docker/docker-compose.yml` to make database optional
- [ ] Add conditional database service dependency
- [ ] Add `DB_PROVIDER` environment variable support
- [ ] Update docker-compose documentation

### Scripts and Tooling
- [ ] Create `scripts/migrate-supabase.js` migration script
- [ ] Create `scripts/supabase-setup.sh` setup script
- [ ] Add Supabase connection testing utility
- [ ] Create schema validation script

### Documentation
- [ ] Create `docs/SUPABASE_DEPLOYMENT.md` deployment guide
- [ ] Update `README.md` with Supabase setup instructions
- [ ] Update `.env.example` with Supabase variables
- [ ] Add troubleshooting section for Supabase issues

### Testing
- [ ] Test database connection with Supabase
- [ ] Verify high score operations work
- [ ] Verify session tracking works
- [ ] Test leaderboard view
- [ ] Verify UUID generation in game_sessions
- [ ] Test connection pooling vs direct connection
- [ ] Validate SSL connection security

## Supabase-Specific Considerations

### Connection Options
1. **Direct Connection** (Port 5432):
   - Standard PostgreSQL connection
   - More connections available
   - Direct to database instance

2. **Connection Pooling** (Port 6543):
   - Recommended for serverless/server applications
   - Better connection management
   - Handles connection limits better

### SSL Configuration
- Supabase requires SSL connections
- Use `{ rejectUnauthorized: false }` for development
- Consider certificate validation for production

### Environment Variables Format
Supabase provides connection string in format:
```
postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
```

Or connection pooling:
```
postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
```

### Database Name
- Supabase typically uses `postgres` as the database name (not `banana_pajama`)
- Tables will be created in the `public` schema
- Consider adding a schema prefix if needed for organization

## Migration Path

### Option 1: Dual Support (Recommended)
- Support both Supabase and existing database options
- Use environment variables to switch between providers
- Allows gradual migration without breaking existing deployments

### Option 2: Supabase-First
- Make Supabase the primary/default option
- Keep local Docker database as development fallback
- Requires updating all deployment documentation

## Risk Assessment

### Low Risk
- Schema compatibility (PostgreSQL to PostgreSQL)
- Query compatibility (standard SQL)
- Connection library compatibility (`pg` works with Supabase)

### Medium Risk
- Connection string parsing
- SSL configuration differences
- Environment variable management
- Migration script execution

### Mitigation
- Thorough testing with Supabase test project
- Fallback to existing database option if issues arise
- Clear documentation and error messages
- Step-by-step migration guide

## Timeline Estimate

- **Phase 1** (Database Scripts): 1-2 hours
- **Phase 2** (Server Updates): 2-3 hours
- **Phase 3** (Environment Config): 1 hour
- **Phase 4** (Scripts & Docs): 2-3 hours
- **Phase 5** (Testing): 2-3 hours

**Total Estimated Time**: 8-12 hours

## Success Criteria

1. ✅ Server connects successfully to Supabase database
2. ✅ All database operations (CRUD) work correctly
3. ✅ Schema migration completes without errors
4. ✅ High scores can be saved and retrieved
5. ✅ Game sessions can be tracked
6. ✅ Leaderboard view works correctly
7. ✅ Documentation is clear and complete
8. ✅ Existing local/RDS deployments still work

## Next Steps

1. Review and approve this plan
2. Create Supabase test project
3. Begin Phase 1 implementation (database scripts)
4. Test each phase before proceeding
5. Document findings and adjust plan as needed

