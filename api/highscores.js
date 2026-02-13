/**
 * Vercel Serverless Function: High Scores
 * Routes: GET /api/highscores, POST /api/highscores
 */
const { getPool } = require('./lib/db');
const { setCorsHeaders, handleOptions, checkRateLimit, sanitizePlayerName } = require('./lib/middleware');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    setCorsHeaders(req, res);
    if (!checkRateLimit(req, res)) return;

    let pool;
    try {
        pool = getPool();

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

        if (req.method === 'POST') {
            const { player_name, score, survival_time, zombies_killed } = req.body;

            if (!player_name || typeof score !== 'number' || typeof survival_time !== 'number') {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_name, score, survival_time'
                });
                return;
            }

            if (score < 0 || score > 50000 || !Number.isFinite(score)) {
                res.status(400).json({ success: false, error: 'Invalid score value' });
                return;
            }
            if (survival_time < 0 || survival_time > 7200 || !Number.isFinite(survival_time)) {
                res.status(400).json({ success: false, error: 'Invalid survival_time value' });
                return;
            }
            const kills = zombies_killed || 0;
            if (kills < 0 || kills > 10000 || !Number.isFinite(kills)) {
                res.status(400).json({ success: false, error: 'Invalid zombies_killed value' });
                return;
            }

            const sanitizedName = sanitizePlayerName(player_name);
            if (sanitizedName.length === 0) {
                res.status(400).json({ success: false, error: 'Player name cannot be empty' });
                return;
            }

            const result = await pool.query(
                'INSERT INTO high_scores (player_name, score, survival_time, zombies_killed) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
                [sanitizedName, score, survival_time, kills]
            );

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
                    zombies_killed: kills,
                    rank: parseInt(rankResult.rows[0].rank),
                    created_at: result.rows[0].created_at
                }
            });
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('High scores error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Database operation failed'
        });
    } finally {
        if (pool) await pool.end();
    }
};
