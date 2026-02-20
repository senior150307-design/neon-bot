-- NEON Game Database Schema
-- PostgreSQL version 14+

-- Drop existing tables if they exist
DROP MATERIALIZED VIEW IF EXISTS leaderboard_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_weekly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_alltime CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    -- Game data
    total_coins BIGINT DEFAULT 0,
    current_level INT DEFAULT 1,
    highest_level INT DEFAULT 1,
    total_score BIGINT DEFAULT 0,
    highest_score BIGINT DEFAULT 0,
    
    -- Inventory (JSON)
    inventory JSONB DEFAULT '[]'::jsonb,
    achievements JSONB DEFAULT '[]'::jsonb,
    
    -- Statistics
    games_played INT DEFAULT 0,
    total_playtime INT DEFAULT 0,
    bricks_destroyed INT DEFAULT 0,
    bosses_defeated INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    last_played TIMESTAMP DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_total_score ON users(total_score DESC);
CREATE INDEX idx_users_highest_score ON users(highest_score DESC);

-- Game sessions table
CREATE TABLE game_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session data
    difficulty VARCHAR(20),
    final_score BIGINT,
    level_reached INT,
    coins_earned BIGINT,
    
    -- Game mode
    game_mode VARCHAR(50) DEFAULT 'normal',
    is_boss_rush BOOLEAN DEFAULT FALSE,
    
    -- Statistics
    bricks_destroyed INT DEFAULT 0,
    bosses_defeated INT DEFAULT 0,
    powerups_collected JSONB DEFAULT '{}'::jsonb,
    cheats_used JSONB DEFAULT '[]'::jsonb,
    
    -- Timing
    duration INT, -- seconds
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- Indexes for game_sessions table
CREATE INDEX idx_sessions_user_score ON game_sessions(user_id, final_score DESC);
CREATE INDEX idx_sessions_ended_at ON game_sessions(ended_at DESC);
CREATE INDEX idx_sessions_user_ended ON game_sessions(user_id, ended_at DESC);

-- Leaderboard: Daily (materialized view for performance)
CREATE MATERIALIZED VIEW leaderboard_daily AS
SELECT 
    u.id,
    u.telegram_id,
    u.username,
    u.first_name,
    COALESCE(SUM(gs.final_score), 0) as daily_score,
    COUNT(gs.id) as games_today,
    RANK() OVER (ORDER BY COALESCE(SUM(gs.final_score), 0) DESC) as rank
FROM users u
LEFT JOIN game_sessions gs ON u.id = gs.user_id 
    AND gs.ended_at >= CURRENT_DATE
    AND gs.ended_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY u.id, u.telegram_id, u.username, u.first_name
ORDER BY daily_score DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_leaderboard_daily_id ON leaderboard_daily(id);

-- Leaderboard: Weekly
CREATE MATERIALIZED VIEW leaderboard_weekly AS
SELECT 
    u.id,
    u.telegram_id,
    u.username,
    u.first_name,
    COALESCE(SUM(gs.final_score), 0) as weekly_score,
    COUNT(gs.id) as games_this_week,
    RANK() OVER (ORDER BY COALESCE(SUM(gs.final_score), 0) DESC) as rank
FROM users u
LEFT JOIN game_sessions gs ON u.id = gs.user_id 
    AND gs.ended_at >= date_trunc('week', CURRENT_DATE)
GROUP BY u.id, u.telegram_id, u.username, u.first_name
ORDER BY weekly_score DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_leaderboard_weekly_id ON leaderboard_weekly(id);

-- Leaderboard: All-time
CREATE MATERIALIZED VIEW leaderboard_alltime AS
SELECT 
    u.id,
    u.telegram_id,
    u.username,
    u.first_name,
    u.highest_score,
    u.total_score,
    u.games_played,
    RANK() OVER (ORDER BY u.highest_score DESC) as rank
FROM users u
WHERE u.highest_score > 0
ORDER BY u.highest_score DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_leaderboard_alltime_id ON leaderboard_alltime(id);

-- Rewards table
CREATE TABLE rewards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    
    -- Reward info
    reward_type VARCHAR(50), -- 'daily_top5', 'weekly_top5', 'achievement', 'bonus'
    amount BIGINT,
    leaderboard_rank INT,
    leaderboard_period VARCHAR(20), -- 'daily', 'weekly', 'monthly'
    
    -- Status
    claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Indexes for rewards table
CREATE INDEX idx_rewards_user_unclaimed ON rewards(user_id, claimed);
CREATE INDEX idx_rewards_expires ON rewards(expires_at);

-- Function to refresh leaderboards
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_weekly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_alltime;
END;
$$ LANGUAGE plpgsql;

-- Function to distribute daily rewards
CREATE OR REPLACE FUNCTION distribute_daily_rewards()
RETURNS void AS $$
DECLARE
    reward_amounts INT[] := ARRAY[50000, 30000, 20000, 10000, 5000];
    top_user RECORD;
    reward_rank INT := 1;
BEGIN
    FOR top_user IN 
        SELECT * FROM leaderboard_daily 
        WHERE rank <= 5 
        ORDER BY rank
    LOOP
        INSERT INTO rewards (
            user_id, 
            reward_type, 
            amount, 
            leaderboard_rank, 
            leaderboard_period,
            expires_at
        ) VALUES (
            top_user.id,
            'daily_top5',
            reward_amounts[reward_rank],
            reward_rank,
            'daily',
            NOW() + INTERVAL '7 days'
        );
        
        reward_rank := reward_rank + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to distribute weekly rewards
CREATE OR REPLACE FUNCTION distribute_weekly_rewards()
RETURNS void AS $$
DECLARE
    reward_amounts INT[] := ARRAY[100000, 75000, 50000, 30000, 20000];
    top_user RECORD;
    reward_rank INT := 1;
BEGIN
    FOR top_user IN 
        SELECT * FROM leaderboard_weekly 
        WHERE rank <= 5 
        ORDER BY rank
    LOOP
        INSERT INTO rewards (
            user_id, 
            reward_type, 
            amount, 
            leaderboard_rank, 
            leaderboard_period,
            expires_at
        ) VALUES (
            top_user.id,
            'weekly_top5',
            reward_amounts[reward_rank],
            reward_rank,
            'weekly',
            NOW() + INTERVAL '14 days'
        );
        
        reward_rank := reward_rank + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Initial data (optional)
-- You can add some test data here if needed

COMMENT ON TABLE users IS 'Telegram users who play the game';
COMMENT ON TABLE game_sessions IS 'Individual game session records';
COMMENT ON TABLE rewards IS 'Rewards earned by users from leaderboards and achievements';
COMMENT ON MATERIALIZED VIEW leaderboard_daily IS 'Top 100 players by daily score';
COMMENT ON MATERIALIZED VIEW leaderboard_weekly IS 'Top 100 players by weekly score';
COMMENT ON MATERIALIZED VIEW leaderboard_alltime IS 'Top 100 players by highest score ever';
