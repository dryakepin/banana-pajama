/**
 * Vercel Serverless Function: Database Initialization
 * Route: POST /api/init-db
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

    return new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false,
            // Supabase requires SSL but with custom certificate handling
        },
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
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

        // Create high_scores table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS high_scores (
                id SERIAL PRIMARY KEY,
                player_name VARCHAR(50) NOT NULL,
                score INTEGER NOT NULL CHECK (score >= 0),
                survival_time INTEGER NOT NULL CHECK (survival_time >= 0),
                zombies_killed INTEGER DEFAULT 0 CHECK (zombies_killed >= 0),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Create game_sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id SERIAL PRIMARY KEY,
                session_id UUID DEFAULT gen_random_uuid(),
                player_name VARCHAR(50),
                start_time TIMESTAMP DEFAULT NOW(),
                end_time TIMESTAMP,
                final_score INTEGER,
                survival_time INTEGER,
                zombies_killed INTEGER DEFAULT 0,
                power_ups_collected INTEGER DEFAULT 0,
                shots_fired INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);
            CREATE INDEX IF NOT EXISTS idx_high_scores_created_at ON high_scores(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_game_sessions_session_id ON game_sessions(session_id);
            CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at DESC);
        `);

        // Insert sample data if table is empty
        const count = await pool.query('SELECT COUNT(*) FROM high_scores');
        if (parseInt(count.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO high_scores (player_name, score, survival_time, zombies_killed) VALUES
                    ('ZombieSlayer', 200, 120, 20),
                    ('BananaPro', 175, 98, 18),
                    ('PajamaWarrior', 150, 85, 15),
                    ('SurvivalKing', 125, 72, 13),
                    ('DeadShot', 100, 65, 10),
                    ('NightHunter', 85, 58, 9),
                    ('CityDefender', 70, 45, 7),
                    ('ZombieHunter', 55, 38, 6),
                    ('LastStand', 40, 30, 4),
                    ('FinalHope', 25, 22, 3);
            `);
        }

        res.status(200).json({
            success: true,
            message: 'Database initialized successfully',
            tables_created: ['high_scores', 'game_sessions'],
            sample_data_inserted: parseInt(count.rows[0].count) === 0
        });

    } catch (error) {
        console.error('Database initialization error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initialize database',
            details: error.message
        });
    } finally {
        if (pool) await pool.end();
    }
};
