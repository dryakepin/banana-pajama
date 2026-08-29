/**
 * Vercel Serverless Function: Health Check
 * Route: /api/health
 */

const { Pool } = require('pg');
const { setCorsHeaders, handleOptions } = require('./lib/middleware');

// Create database connection
function getPool() {
    // Support multiple environment variable names from Vercel-Supabase integration
    const connectionString = process.env.DATABASE_URL ||
                            process.env.POSTGRES_URL ||
                            process.env.POSTGRES_PRISMA_URL;

    if (!connectionString) {
        throw new Error('Database connection string not found. Please set DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL environment variable');
    }

    // Ensure the connection string uses postgresql:// protocol
    const normalizedConnectionString = connectionString.replace(/^postgres:\/\//, 'postgresql://');

    return new Pool({
        connectionString: normalizedConnectionString,
        ssl: {
            rejectUnauthorized: false,
        },
        max: 1, // Serverless functions should use minimal connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
}

module.exports = async (req, res) => {
    // SEC-2: this handler used to set its own CORS headers, pairing
    // Allow-Origin: * with Allow-Credentials: true -- a combination browsers
    // reject outright for credentialed requests. It now shares the one
    // allowlist in lib/middleware, so there is a single source of CORS truth.
    setCorsHeaders(req, res);

    if (handleOptions(req, res)) {
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    let pool;
    try {
        pool = getPool();
        const dbResult = await pool.query('SELECT NOW()');

        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            service: 'Banana Pajama Zombie Shooter API',
            database: 'connected',
            dbTime: dbResult.rows[0].now
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            service: 'Banana Pajama Zombie Shooter API',
            database: 'disconnected',
            error: error.message
        });
    } finally {
        if (pool) await pool.end();
    }
};
