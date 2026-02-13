const { Pool } = require('pg');

/**
 * Database Connection Configuration
 * Supports multiple database providers:
 * - Local Docker Compose (PostgreSQL)
 * - Supabase (PostgreSQL)
 */
function createDatabasePool() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Check if using Supabase connection string
    if (process.env.DATABASE_URL) {
        const connectionString = process.env.DATABASE_URL;

        // Detect if it's a Supabase URL
        const isSupabase = connectionString.includes('supabase.co');

        // Configure SSL - Supabase needs rejectUnauthorized: false due to their cert setup
        // For other production hosts, enable full verification
        let sslConfig = false;
        if (isSupabase) {
            sslConfig = { rejectUnauthorized: false };
        } else if (isProduction) {
            sslConfig = { rejectUnauthorized: true };
        }

        return new Pool({
            connectionString,
            ssl: sslConfig,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    // Check if explicitly using Supabase with individual parameters
    if (process.env.DB_PROVIDER === 'supabase') {
        const usePooling = process.env.USE_CONNECTION_POOLING === 'true';
        const defaultPort = usePooling ? 6543 : 5432;

        return new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || defaultPort,
            database: process.env.DB_NAME || 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: { rejectUnauthorized: false }, // Supabase requires this
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    // Default: Local Docker Compose
    if (isProduction && !process.env.DB_PASSWORD) {
        console.error('DB_PASSWORD environment variable is required in production');
    }

    return new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'banana_pajama',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'banana_dev_password',
        ssl: isProduction ? { rejectUnauthorized: true } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
}

// Create the connection pool
const pool = createDatabasePool();

// Test database connection on module load
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        console.error('Check your database connection settings');
    } else {
        const provider = process.env.DB_PROVIDER || (process.env.DATABASE_URL ? 'supabase' : 'local');
        console.log(`Database connected successfully (${provider})`);
        release();
    }
});

// Handle pool errors gracefully - log and let the pool recover
pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
    // Don't crash - the pool will remove the dead client and create a new one
});

module.exports = pool;
