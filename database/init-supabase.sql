-- Supabase-Compatible Database Schema for Banana Pajama Zombie Shooter
-- This script is designed to run in Supabase SQL Editor
-- It does NOT include database creation or connection commands
-- The existing database/init.sql remains unchanged for local Docker Compose

-- Enable UUID extension (if not already enabled)
-- Note: Supabase typically has this enabled by default
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
-- Note: Using ON CONFLICT DO NOTHING in case samples already exist
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
    ('FinalHope', 25, 22, 3)
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

-- Note: GRANT statements are not included here as Supabase manages permissions
-- The authenticated user running this script will have appropriate permissions

