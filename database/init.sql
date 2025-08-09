-- Initialize database for Banana Pajama Zombie Shooter
-- This script runs when the PostgreSQL container starts

-- Create the main database if it doesn't exist
SELECT 'CREATE DATABASE banana_pajama'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'banana_pajama');

-- Connect to the database
\c banana_pajama;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- High Scores table
CREATE TABLE IF NOT EXISTS high_scores (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    survival_time INTEGER NOT NULL CHECK (survival_time >= 0),
    zombies_killed INTEGER DEFAULT 0 CHECK (zombies_killed >= 0),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Game Sessions table (for analytics)
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT uuid_generate_v4(),
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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_high_scores_created_at ON high_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_session_id ON game_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at DESC);

-- Insert some sample high scores for testing
INSERT INTO high_scores (player_name, score, survival_time, zombies_killed) VALUES
    ('ZombieSlayer', 15420, 892, 154),
    ('BananaPro', 12350, 745, 123),
    ('PajamaWarrior', 9870, 623, 98),
    ('SurvivalKing', 8450, 567, 84),
    ('DeadShot', 7230, 432, 72),
    ('NightHunter', 6100, 378, 61),
    ('CityDefender', 5240, 315, 52),
    ('ZombieHunter', 4380, 267, 43),
    ('LastStand', 3520, 198, 35),
    ('FinalHope', 2890, 145, 28)
ON CONFLICT DO NOTHING;

-- Create a view for leaderboard with additional stats
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    id,
    player_name,
    score,
    survival_time,
    zombies_killed,
    ROUND(score::decimal / GREATEST(survival_time, 1), 2) as score_per_second,
    ROUND(zombies_killed::decimal / GREATEST(survival_time, 1) * 60, 2) as kills_per_minute,
    created_at,
    ROW_NUMBER() OVER (ORDER BY score DESC) as rank
FROM high_scores
ORDER BY score DESC
LIMIT 50;

-- Grant permissions (adjust as needed for your setup)
-- Note: In production, create specific users with limited permissions
GRANT ALL PRIVILEGES ON DATABASE banana_pajama TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;