/**
 * Vercel Serverless Function: Health Check
 * Route: /api/health
 */

const { Pool } = require('pg');

// Create database connection
function getPool() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    return new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 1, // Serverless functions should use minimal connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
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
