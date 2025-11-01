/**
 * Vercel Serverless Function: High Scores
 * Routes: GET /api/highscores, POST /api/highscores
 */

const { Pool } = require('pg');

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
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    let pool;
    try {
        pool = getPool();

        // GET - Fetch high scores
        if (req.method === 'GET') {
            const limit = Math.min(parseInt(req.query.limit) || 10, 50);
            const result = await pool.query(
                'SELECT player_name, score, survival_time, zombies_killed, created_at FROM high_scores ORDER BY score DESC LIMIT $1',
                [limit]
            );
            res.status(200).json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
            return;
        }

        // POST - Submit new high score
        if (req.method === 'POST') {
            const { player_name, score, survival_time, zombies_killed } = req.body;

            // Validate input
            if (!player_name || typeof score !== 'number' || typeof survival_time !== 'number') {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_name, score, survival_time'
                });
                return;
            }

            // Sanitize player name
            const sanitizedName = player_name.toString().trim().substring(0, 50);
            if (sanitizedName.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Player name cannot be empty'
                });
                return;
            }

            const result = await pool.query(
                'INSERT INTO high_scores (player_name, score, survival_time, zombies_killed) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
                [sanitizedName, score, survival_time, zombies_killed || 0]
            );

            // Get ranking
            const rankResult = await pool.query(
                'SELECT COUNT(*) + 1 as rank FROM high_scores WHERE score > $1',
                [score]
            );

            res.status(201).json({
                success: true,
                data: {
                    id: result.rows[0].id,
                    player_name: sanitizedName,
                    score,
                    survival_time,
                    zombies_killed: zombies_killed || 0,
                    rank: parseInt(rankResult.rows[0].rank),
                    created_at: result.rows[0].created_at
                }
            });
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('High scores error:', error);
        res.status(500).json({
            success: false,
            error: 'Database operation failed',
            details: error.message
        });
    } finally {
        if (pool) await pool.end();
    }
};
