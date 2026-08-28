#!/usr/bin/env node

/**
 * Supabase Migration Script
 * 
 * This script runs the Supabase-compatible database schema migration.
 * It can be run from the command line or used programmatically.
 * 
 * Usage:
 *   node scripts/migrate-supabase.js
 * 
 * Environment Variables:
 *   DATABASE_URL - Supabase connection string (recommended)
 *   OR
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Individual connection parameters
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SQL_FILE = path.join(__dirname, '..', 'database', 'init-supabase.sql');

// Create database connection pool
function createPool() {
    if (process.env.DATABASE_URL) {
        return new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    }

    if (process.env.DB_PROVIDER === 'supabase' || process.env.DB_HOST?.includes('supabase.co')) {
        return new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: { rejectUnauthorized: false }
        });
    }

    throw new Error('No Supabase connection configured. Set DATABASE_URL or DB_PROVIDER=supabase with credentials.');
}

async function runMigration() {
    console.log('🚀 Starting Supabase migration...\n');

    // Check if SQL file exists
    if (!fs.existsSync(SQL_FILE)) {
        console.error(`❌ Error: Migration file not found: ${SQL_FILE}`);
        process.exit(1);
    }

    // Read SQL file
    const sql = fs.readFileSync(SQL_FILE, 'utf8');
    
    // Create connection pool
    let pool;
    try {
        pool = createPool();
        console.log('✅ Database connection established');
    } catch (error) {
        console.error('❌ Failed to create database connection:', error.message);
        console.error('\nMake sure you have set:');
        console.error('  - DATABASE_URL (recommended), or');
        console.error('  - DB_PROVIDER=supabase with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
        process.exit(1);
    }

    // Apply the whole file as ONE multi-statement query inside a transaction.
    //
    // Do not split on ';' here. The previous implementation did, then dropped
    // any fragment starting with '--'; because splitting on ';' leaves each
    // statement prefixed by its preceding comment block, that silently
    // discarded most of the schema -- including the high_scores RLS enable --
    // while still exiting 0. See DB-1 in CODEBASE_REVIEW.md.
    //
    // pg sends a parameterless query over the simple query protocol, which
    // accepts multiple statements. Wrapping it in BEGIN/COMMIT makes the
    // migration all-or-nothing: a fresh database is either fully provisioned
    // or completely untouched, never half-built.
    let client;
    try {
        client = await pool.connect();

        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log(`\n✅ Migration applied: ${path.basename(SQL_FILE)}`);
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('   (rollback also failed:', rollbackError.message + ')');
            }
        }

        console.error('\n❌ Migration failed, rolled back. Nothing was applied.');
        console.error(`   ${error.message}`);
        if (error.position) {
            // Postgres reports a 1-based byte offset into the statement it
            // choked on; turn it into a line number in the source file.
            const line = sql.slice(0, parseInt(error.position, 10)).split('\n').length;
            console.error(`   near ${path.basename(SQL_FILE)}:${line}`);
        }
        if (error.hint) {
            console.error(`   hint: ${error.hint}`);
        }

        process.exitCode = 1;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration()
        .then(() => process.exit(process.exitCode || 0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };


