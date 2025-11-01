const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const pool = require('./config/database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Health check routes
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Banana Pajama Zombie Shooter API'
    });
});

app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        const dbResult = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            service: 'Banana Pajama Zombie Shooter API',
            database: 'connected',
            dbTime: dbResult.rows[0].now
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            timestamp: new Date().toISOString(),
            service: 'Banana Pajama Zombie Shooter API',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Database initialization route (development/setup only)
app.post('/api/init-db', async (req, res) => {
    try {
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

        res.json({
            success: true,
            message: 'Database initialized successfully',
            tables_created: ['high_scores', 'game_sessions'],
            sample_data_inserted: parseInt(count.rows[0].count) === 0
        });

    } catch (error) {
        console.error('Error initializing database:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initialize database',
            details: error.message
        });
    }
});

// High Score API Routes
app.get('/api/highscores', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const result = await pool.query(
            'SELECT player_name, score, survival_time, zombies_killed, created_at FROM high_scores ORDER BY score DESC LIMIT $1',
            [limit]
        );
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching high scores:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch high scores' 
        });
    }
});

app.post('/api/highscores', async (req, res) => {
    try {
        const { player_name, score, survival_time, zombies_killed } = req.body;
        
        // Validate input
        if (!player_name || typeof score !== 'number' || typeof survival_time !== 'number') {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields: player_name, score, survival_time' 
            });
        }

        // Sanitize player name
        const sanitizedName = player_name.toString().trim().substring(0, 50);
        if (sanitizedName.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Player name cannot be empty' 
            });
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
    } catch (error) {
        console.error('Error saving high score:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to save high score' 
        });
    }
});

// Game session tracking (optional)
app.post('/api/sessions/start', async (req, res) => {
    try {
        const { player_name } = req.body;
        const result = await pool.query(
            'INSERT INTO game_sessions (player_name, start_time) VALUES ($1, NOW()) RETURNING session_id',
            [player_name || 'Anonymous']
        );
        res.json({
            success: true,
            session_id: result.rows[0].session_id
        });
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to start session' 
        });
    }
});

app.post('/api/sessions/end', async (req, res) => {
    try {
        const { session_id, final_score, survival_time, zombies_killed, power_ups_collected, shots_fired } = req.body;
        
        if (!session_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Session ID is required' 
            });
        }

        await pool.query(
            `UPDATE game_sessions 
             SET end_time = NOW(), final_score = $2, survival_time = $3, 
                 zombies_killed = $4, power_ups_collected = $5, shots_fired = $6
             WHERE session_id = $1`,
            [session_id, final_score, survival_time, zombies_killed, power_ups_collected, shots_fired]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to end session' 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong!'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        message: 'The requested resource was not found'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    const dbProvider = process.env.DB_PROVIDER || (process.env.DATABASE_URL ? 'supabase' : 'local');
    const dbInfo = process.env.DATABASE_URL 
        ? 'Supabase (connection string)' 
        : `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`;
    
    console.log(`🍌 Banana Pajama API Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
    console.log(`🎮 Client URL: ${process.env.CORS_ORIGIN || 'http://localhost:8080'}`);
    console.log(`🗄️ Database: ${dbInfo} (${dbProvider})`);
});