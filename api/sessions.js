/**
 * Vercel Serverless Function: Game Sessions
 * Routes: POST /api/sessions/start, POST /api/sessions/end
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
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    let pool;
    try {
        pool = getPool();

        // Extract endpoint from URL path
        const urlPath = req.url || '';

        // POST /api/sessions/start
        if (urlPath.includes('/start')) {
            const { player_name } = req.body || {};
            const result = await pool.query(
                'INSERT INTO game_sessions (player_name, start_time) VALUES ($1, NOW()) RETURNING session_id',
                [player_name || 'Anonymous']
            );
            res.status(200).json({
                success: true,
                session_id: result.rows[0].session_id
            });
            return;
        }

        // POST /api/sessions/end
        if (urlPath.includes('/end')) {
            const { session_id, final_score, survival_time, zombies_killed, power_ups_collected, shots_fired } = req.body || {};

            if (!session_id) {
                res.status(400).json({
                    success: false,
                    error: 'Session ID is required'
                });
                return;
            }

            await pool.query(
                `UPDATE game_sessions
                 SET end_time = NOW(), final_score = $2, survival_time = $3,
                     zombies_killed = $4, power_ups_collected = $5, shots_fired = $6
                 WHERE session_id = $1`,
                [session_id, final_score, survival_time, zombies_killed, power_ups_collected, shots_fired]
            );

            res.status(200).json({ success: true });
            return;
        }

        res.status(404).json({ error: 'Invalid session endpoint' });

    } catch (error) {
        console.error('Session tracking error:', error);
        res.status(500).json({
            success: false,
            error: 'Session operation failed',
            details: error.message
        });
    } finally {
        if (pool) await pool.end();
    }
};
