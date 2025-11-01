const { Pool } = require('pg');

/**
 * Database Connection Configuration
 * Supports multiple database providers:
 * - Local Docker Compose (PostgreSQL)
 * - AWS RDS (PostgreSQL)
 * - Supabase (PostgreSQL)
 */
function createDatabasePool() {
    // Check if using Supabase connection string
    if (process.env.DATABASE_URL) {
        const connectionString = process.env.DATABASE_URL;
        
        // Detect if it's a Supabase URL
        const isSupabase = connectionString.includes('supabase.co');
        
        // Configure SSL - Supabase requires SSL
        const sslConfig = isSupabase 
            ? { rejectUnauthorized: false }
            : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false);

        return new Pool({
            connectionString,
            ssl: sslConfig,
            // Connection pool settings
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
            ssl: { rejectUnauthorized: false }, // Supabase requires SSL
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    // Default: Local Docker Compose or AWS RDS
    return new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'banana_pajama',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'banana_dev_password',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
        console.error('❌ Error connecting to database:', err.message);
        console.error('   Check your database connection settings');
    } else {
        const provider = process.env.DB_PROVIDER || (process.env.DATABASE_URL ? 'supabase' : 'local');
        console.log(`✅ Database connected successfully (${provider})`);
        release();
    }
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;


