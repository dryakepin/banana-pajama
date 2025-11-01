# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the "Banana Pajama Zombie Shooter" - a **fully implemented and production-deployed** top-down survival game where players control a banana in pajamas shooting zombies in a dark, atmospheric city setting. The game is live on AWS and actively maintained.

## Project Status: PRODUCTION READY ✅

This is a complete, working game with:
- Full gameplay implementation with 4 zombie types and 6 power-ups
- Backend API with PostgreSQL database
- Production AWS deployment on ECS Fargate
- Docker containerization for local development
- Comprehensive mobile support with touch controls

## Project Architecture

### Frontend (IMPLEMENTED)
- **Game Engine**: Phaser.js 3.80.1
- **Build Tool**: Webpack 5 with dev server and hot reload
- **Platform**: Cross-platform (desktop + mobile) with extensive responsive design
- **Structure**: Scene-based architecture with 5 implemented scenes

**Client Folder Structure**:
```
client/
├── src/
│   ├── scenes/
│   │   ├── MenuScene.js          - Main menu with scrolling credits
│   │   ├── GameScene.js          - Core gameplay (1,598 lines)
│   │   ├── GameOverScene.js      - Death screen with stats
│   │   ├── HighScoreScene.js     - Leaderboard display
│   │   └── NameEntryScene.js     - High score name entry
│   ├── sprites/
│   │   ├── AnimatedZombie.js     - Advanced 5-state animated zombie
│   │   ├── BasicZombie.js        - Standard zombie
│   │   ├── TankZombie.js         - Heavy zombie with stun
│   │   ├── FastZombie.js         - Quick-moving zombie
│   │   ├── Bullet.js             - Projectile with pooling
│   │   └── PowerUp.js            - 6 power-up types
│   ├── world/
│   │   ├── TileMap.js            - Procedural city generation
│   │   └── Pathfinder.js         - A* pathfinding for AI
│   ├── ui/
│   │   └── VirtualJoystick.js    - Mobile touch controls
│   └── index.js                  - Game config & mobile fullscreen
├── assets/                        - All graphics and audio
└── dist/                          - Production builds
```

### Backend (IMPLEMENTED)
- **Server**: Express.js 4.18.2 with comprehensive middleware
- **Database**: PostgreSQL 15 with connection pooling
- **Security**: Helmet, CORS, rate limiting (100 req/15min)
- **Monitoring**: Morgan logging, health checks

**Server Structure**:
```
server/
├── index.js           - Main server (312 lines)
├── package.json       - Dependencies
└── (inline routes)    - All endpoints in main file
```

**Implemented API Endpoints**:
```
GET  /health                 - Basic health check
GET  /api/health            - Database connectivity check
POST /api/init-db           - Initialize database schema
GET  /api/highscores        - Fetch top 50 scores
POST /api/highscores        - Submit new score (validated)
POST /api/sessions/start    - Track game session start
POST /api/sessions/end      - Log session analytics
```

### Deployment (FULLY AUTOMATED)
- **Local Development**: Docker Compose with 4 services (DB, API, Client, Adminer)
- **Cloud**: AWS ECS Fargate with RDS PostgreSQL
- **CDN**: S3 + CloudFront for static assets
- **Load Balancing**: Application Load Balancer with health checks
- **Secrets**: AWS Secrets Manager for credentials
- **Automation**: 6 bash scripts for deploy/teardown/inspect

## Game Specifications

### Core Gameplay
- **Genre**: Top-down zombie survival shooter
- **Atmosphere**: Dark, moody city environment with eerie lighting
- **Player**: Banana character in pajamas with automatic shooting
- **Controls**: WASD/arrows + mouse (desktop), virtual joystick + auto-aim (mobile)

### Enemy Types (ALL IMPLEMENTED)

1. **Basic Zombie** (`BasicZombie.js`)
   - Health: 1 HP | Damage: 10 | Speed: Slow
   - Score: 10 points | Spawn: Every 2 seconds
   - Features: Smart pathfinding, obstacle avoidance

2. **Tank Zombie** (`TankZombie.js`)
   - Health: 3-5 HP | Damage: 25 | Speed: Very slow
   - Score: 50 points | Spawn: Every 8 seconds
   - Features: Stun effect when hit, high durability

3. **Fast Zombie** (`FastZombie.js`)
   - Health: 1 HP | Damage: 15 | Speed: Fast
   - Score: 25 points | Spawn: Every 3 seconds
   - Features: Aggressive pursuit, quick movement

4. **Animated Zombie** (`AnimatedZombie.js`) ⭐ NEW
   - Health: 2 HP | Damage: 20 | Speed: Medium
   - Score: 50 points | Spawn: Every 6 seconds
   - Features: 5-state animation system (appear, idle, walk, attack, die)
   - Assets: 42 individual animation frames
   - Power-up drops: 20% healing, 15% invincibility, 15% rapid fire

### Power-Up System (6 TYPES IMPLEMENTED)

Located in `PowerUp.js` with full visual feedback:

1. **Healing** 🥙 - Restore full HP
2. **Invincibility** 🛡️ - 10 seconds of immunity
3. **Point Boost** 🪙 - Instant +50/100/150 points
4. **Rapid Fire** 💥 - 2x fire rate for 15 seconds
5. **Dual Shot** 🔫 - Fire two bullets for 15 seconds
6. **Kill All** ☠️ - Eliminate all zombies instantly

Features: 30s lifetime, visual countdown, pulse effects, object pooling

### Technical Implementation

**Performance** (ALL IMPLEMENTED):
- ✅ Sprite pooling for bullets and zombies
- ✅ Object reuse to minimize garbage collection
- ✅ Maximum 50 concurrent zombies
- ✅ Smart pathfinding with 200ms cooldown
- ✅ Efficient Arcade Physics collision detection
- ✅ Target: 60 FPS desktop, 30+ FPS mobile

**Audio System**:
- ✅ Web Audio API with context unlock for mobile
- ✅ Background music (menu + game themes)
- ⚠️ Sound effects still needed (gun shots, zombie sounds)

**Progressive Difficulty**:
- ✅ Dynamic spawn rate increases over time
- ✅ Mixed zombie type spawning
- ✅ Self-adjusting based on performance

## Assets (COMPLETE)

### Graphics ✅

**Characters**:
- `assets/banana.png` (587 KB) - Player sprite
- `assets/crosshairs.png` (3 KB) - Aiming cursor
- `assets/loading_screen.png` (2.6 MB) - Loading screen

**Zombies**:
- `assets/zombie-1.png` (636 KB) - Basic zombie
- `assets/zombie-2.png` (783 KB) - Tank zombie
- `assets/zombie-3.png` (509 KB) - Fast zombie
- `assets/zombie-4/` - Animated zombie frames (42 total):
  - `appear/` - 11 frames
  - `idle/` - 6 frames
  - `walk/` - 10 frames
  - `attack/` - 7 frames
  - `die/` - 8 frames

**Power-Ups** (6 PNG files, 2-5 KB each):
- healing.png, invincibility.png, pointBoost.png
- rapidFire.png, dualShot.png, killAll.png

**Environment**:
- `assets/tiles/` - 8 building textures for procedural city

### Audio ✅

- `assets/zombie-game.mp3` (3.1 MB) - In-game music
- `assets/zombie-theme.mp3` (3.3 MB) - Menu music
- Audio context handling for iOS/Android browsers

**Still Needed**:
- Gun shot sounds with echo
- Zombie spawn/death sounds
- UI feedback sounds

## API Implementation (LIVE)

**Base URL**: `http://localhost:3000` (local) or AWS ALB endpoint (production)

**Implemented in**: `server/index.js` (312 lines)

### Endpoints

```javascript
// Health & Diagnostics
GET  /health                    // Basic uptime check
GET  /api/health               // Database connectivity check

// Database Management
POST /api/init-db              // Initialize schema (automated)

// High Score System
GET  /api/highscores           // Get top 50 players with stats
POST /api/highscores           // Submit new score
{
  "player_name": "string",     // Max 50 chars, required
  "score": "number",           // >= 0, required
  "survival_time": "number",   // seconds, >= 0
  "zombies_killed": "number"   // >= 0
}
// Returns: { success, rank, message }

// Game Analytics
POST /api/sessions/start       // Track game session start
{
  "player_name": "string"      // Optional
}
// Returns: { session_id }

POST /api/sessions/end         // Log session completion
{
  "session_id": "uuid",        // Required
  "final_score": "number",
  "survival_time": "number",
  "zombies_killed": "number",
  "power_ups_collected": "number",
  "shots_fired": "number"
}
```

**Security**:
- Rate limiting: 100 requests per 15 minutes per IP
- Input validation with sanitization
- CORS enabled with configurable origins
- Helmet.js for security headers

## Database Schema (PRODUCTION)

**Location**: `database/init.sql` (109 lines)

**PostgreSQL 15** with full schema:

```sql
-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- High Scores Table
CREATE TABLE high_scores (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    survival_time INTEGER NOT NULL CHECK (survival_time >= 0),
    zombies_killed INTEGER DEFAULT 0 CHECK (zombies_killed >= 0),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_high_scores_score ON high_scores(score DESC);
CREATE INDEX idx_high_scores_created_at ON high_scores(created_at DESC);

-- Game Sessions Table (Full Analytics)
CREATE TABLE game_sessions (
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

-- Leaderboard View (with calculated stats)
CREATE VIEW leaderboard AS
SELECT
    player_name,
    score,
    survival_time,
    zombies_killed,
    ROUND(score::decimal / NULLIF(survival_time, 0), 2) as score_per_second,
    ROUND((zombies_killed::decimal / NULLIF(survival_time, 0)) * 60, 2) as kills_per_minute,
    RANK() OVER (ORDER BY score DESC) as rank
FROM high_scores
ORDER BY score DESC
LIMIT 50;
```

**Features**:
- Sample data seeding (10 initial high scores)
- Performance indexes on critical columns
- Calculated statistics view for analytics
- Check constraints for data integrity

## Current Status

### Production Deployment ✅

**Status**: Fully deployed and operational

**Infrastructure**:
- AWS ECS Fargate running game services
- RDS PostgreSQL database (Multi-AZ capable)
- Application Load Balancer with health checks
- S3 + CloudFront for static asset delivery
- Secrets Manager for credential storage

**Local Development**:
```bash
# Start full stack
cd docker && docker-compose up -d

# Access points:
# - Game: http://localhost:8080
# - API: http://localhost:3000
# - DB Admin: http://localhost:8081
```

**Recent Commits**:
- ff87c9f: Audio handling + AWS deployment improvements
- f21b3ab: Code review fixes + animated zombie finalization
- e5e402b: Comprehensive animated zombie system (zombie-4)
- 2d5fde4: Fast Zombie + audio context fixes
- 399a2e2: Enhanced AWS teardown script

### Active Development Areas

**Current Focus**:
1. Sound effects implementation (gun shots, zombie sounds)
2. AWS infrastructure stability and monitoring
3. Performance optimization and bundle size reduction
4. Mobile fullscreen experience refinement

**Technical Debt**:
- Bundle size optimization (currently 1.2 MB with warnings)
- Need stable domain name (using dynamic IPs)
- Asset compression for production builds
- SSL certificate configuration

**Known Issues**:
- Database password authentication (deployment-specific)
- Some mobile browsers require user interaction for audio
- Fullscreen API inconsistencies across browsers

### Code Quality

**Strengths**:
- Well-organized modular architecture
- Extensive inline documentation
- Comprehensive error handling
- Object pooling for performance
- Clean separation of concerns

**Metrics**:
- ~15 client JavaScript files (~5,000+ lines)
- 5 game scenes fully implemented
- 7 sprite classes with AI
- 6 automated deployment scripts
- Full test coverage for critical paths

### Documentation

See also:
- `README.md` - Project overview and setup
- `banana_pajama_spec.txt` - Original design document
- `TODO.txt` - Active task tracking
- `AWS_DEPLOYMENT_LEARNINGS.txt` - AWS deployment knowledge
- `infrastructure/aws-setup.md` - AWS deployment guide