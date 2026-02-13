const { Pool } = require('pg');

/**
 * Shared database pool factory for Vercel serverless functions.
 * Creates a pool with minimal connections suitable for serverless.
 */
function getPool() {
    const connectionString = process.env.DATABASE_URL ||
                            process.env.POSTGRES_URL ||
                            process.env.POSTGRES_PRISMA_URL;

    if (!connectionString) {
        throw new Error('Database connection string not found. Set DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL');
    }

    const normalizedConnectionString = connectionString.replace(/^postgres:\/\//, 'postgresql://');
    const isSupabase = normalizedConnectionString.includes('supabase.co');

    return new Pool({
        connectionString: normalizedConnectionString,
        ssl: isSupabase
            ? { rejectUnauthorized: false }
            : { rejectUnauthorized: true },
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
}

module.exports = { getPool };
