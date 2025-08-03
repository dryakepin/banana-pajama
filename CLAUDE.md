# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the "Banana Pajama Zombie Shooter" - a top-down survival game where players control a banana in pajamas shooting zombies in a dark, atmospheric city setting. The project is currently in the planning phase with only specification documents.

## Project Architecture

Based on the specification (`banana_pajama_spec.txt`), this will be a full-stack web game with:

### Frontend (Planned)
- **Game Engine**: Phaser.js 3 for HTML5 Canvas-based gameplay
- **Platform**: Cross-platform (desktop + mobile) with responsive design
- **Structure**: Scene-based architecture (Game, Menu, GameOver scenes)
- **Client folder structure**:
  - `client/src/scenes/` - Game scenes
  - `client/src/sprites/` - Player and enemy classes
  - `client/assets/` - Images, sounds, fonts
  - `client/dist/` - Built game files

### Backend (Planned)
- **Server**: Node.js with Express.js
- **Database**: PostgreSQL for high scores and analytics
- **API**: RESTful endpoints for high scores and game sessions
- **Server folder structure**:
  - `server/routes/api.js` - API endpoints
  - `server/models/` - Database models
  - `server/middleware/` - CORS, logging

### Deployment (Planned)
- **Local Development**: Docker Desktop, Homebrew packages
- **Cloud**: AWS (EC2, RDS, S3 + CloudFront)
- **Web Proxy**: Nginx

## Game Specifications

### Core Gameplay
- **Genre**: Top-down zombie survival shooter
- **Atmosphere**: Dark, moody city environment with eerie lighting
- **Player**: Banana character in pajamas with automatic shooting
- **Controls**: WASD/arrows + mouse (desktop), virtual joystick + auto-aim (mobile)

### Enemy Types
1. **Basic Zombie** (1 hit, 10 damage, slow, high spawn rate)
2. **Tank Zombie** (3-5 hits, 25 damage, very slow, low spawn rate)
3. **Fast Zombie** (1 hit, 15 damage, fast, medium spawn rate)

### Technical Requirements
- **Performance**: 60 FPS target on both platforms
- **Audio**: Web Audio API with 3D positional sound
- **Progressive difficulty**: Increasing spawn rates and zombie speed over time
- **Optimization**: Sprite pooling, culling, limited concurrent zombies (max 50)

## Development Assets Needed

### Graphics
- Character sprites (32x48px banana in pajamas)
- Zombie sprites for 3 enemy types
- Dark city environment tiles and buildings
- UI elements (HP bar, buttons, fonts)
- Animation sprite sheets

### Audio
- Ambient atmospheric background music (looped)
- Gun shot sound effects with echo
- Zombie spawn sounds (described as "chips crushed with hammer")
- Zombie death sounds (wet/crunchy)
- Game over dramatic chord

## API Design (Planned)

```javascript
// High Score System
GET  /api/highscores          // Get top 10 players
POST /api/highscores          // Submit new high score
{
  "player_name": "string",
  "score": "number", 
  "survival_time": "number"
}

// Game Analytics (optional)
POST /api/sessions/start      // Start game session
POST /api/sessions/end        // Log game completion
```

## Database Schema (Planned)

```sql
-- High Scores
CREATE TABLE high_scores (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    survival_time INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Game Sessions (analytics)
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT gen_random_uuid(),
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    final_score INTEGER,
    zombies_killed INTEGER
);
```

## Current Status

This repository currently contains only planning documents. The actual game implementation has not been started yet. When beginning development, follow the technical specifications and folder structure outlined in `banana_pajama_spec.txt`.