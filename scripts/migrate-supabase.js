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

    // Split SQL into individual statements
    // Remove comments and split by semicolons
    const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    try {
        for (const statement of statements) {
            if (statement.length === 0) continue;

            try {
                await pool.query(statement);
                successCount++;
                console.log(`  ✓ Executed: ${statement.substring(0, 60)}...`);
            } catch (error) {
                // Some errors are expected (e.g., IF NOT EXISTS conflicts)
                if (error.message.includes('already exists') || error.message.includes('duplicate')) {
                    console.log(`  ⚠ Skipped (already exists): ${statement.substring(0, 60)}...`);
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`  ✗ Error: ${error.message}`);
                    console.error(`    Statement: ${statement.substring(0, 100)}...`);
                }
            }
        }

        console.log(`\n✅ Migration completed!`);
        console.log(`   Successful: ${successCount}`);
        if (errorCount > 0) {
            console.log(`   Errors: ${errorCount}`);
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };


