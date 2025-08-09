# 🍌 Banana Pajama Zombie Shooter

A thrilling top-down zombie survival game where you control a banana in pajamas fighting zombies in a dark cityscape. Built with Phaser.js 3 and designed for both desktop and mobile platforms.

## 🎮 Game Features

### 🍌 Player Character
- Yellow banana wearing blue striped pajamas
- 360-degree movement in top-down perspective
- Armed with a powerful pistol
- 100 HP survival system

### 🧟 Zombie Types
- **Basic Zombie** (Green): 1 HP, 10 damage, slow movement
- **Tank Zombie** (Dark): 5 HP, 25 damage, very slow, gets stunned when hit
- **Fast Zombie** (Light Green): 1 HP, 15 damage, fast movement *(coming soon)*

### 🎁 Power-up System
- **Healing** 🥙: Full HP restoration
- **Invincibility** 🛡️: 10 seconds of immunity
- **Point Boost** 🪙: Instant score bonus (+50/100/150)
- **Rapid Fire** 💥: Double firing rate for 15 seconds
- **Dual Shot** 🔫🔫: Fire two bullets simultaneously for 15 seconds
- **Kill All** ☠️: Instantly eliminate all visible zombies

### 🎯 Game Mechanics
- **Desktop Controls**: WASD/Arrow keys to move, mouse to aim and shoot, SPACE to pause
- **Mobile Controls**: Virtual joystick for movement, automatic targeting, pause button
- **Progressive Difficulty**: Increasing spawn rates and zombie variety over time
- **Persistent High Scores**: Global leaderboard system
- **Power-up Indicators**: Visual countdown timers under HP bar

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
- **Git** - For cloning the repository

### 1. Clone Repository
```bash
git clone https://github.com/dryakepin/banana-pajama.git
cd banana-pajama
```

### 2. Start Development Environment
```bash
# Run the automated setup script
./scripts/deploy-local.sh

# Or manually with Docker Compose
cd docker
docker-compose up -d
```

### 3. Access the Game
- 🎮 **Game**: http://localhost:8080
- 🔧 **API**: http://localhost:3000
- 📊 **Database Admin**: http://localhost:8081
  - Server: `database`
  - Username: `postgres`
  - Password: `banana_dev_password`

## 🎯 Game Controls

### Desktop
- **WASD** or **Arrow Keys** - Move player
- **Mouse** - Aim and auto-shoot at cursor position
- **ESC** - Return to menu

### Mobile
- **Virtual Joystick** - Move player (left side of screen)
- **Auto-aim** - Automatically targets nearest zombie
- **Tap** - Alternative shooting control

## 🧟 Enemy Types

1. **Basic Zombie** (Green)
   - 1 hit to kill
   - 10 damage to player
   - Slow movement
   - High spawn rate

2. **Tank Zombie** (Dark green/gray)
   - 3-5 hits to kill
   - 25 damage to player
   - Very slow movement
   - Low spawn rate

3. **Fast Zombie** (Light green)
   - 1 hit to kill
   - 15 damage to player
   - Fast movement
   - Medium spawn rate

## 📊 Scoring System

- **Basic Zombie**: 10 points
- **Tank Zombie**: 50 points  
- **Fast Zombie**: 25 points
- **Survival Bonus**: 1 point per second

## 🛠️ Development Commands

### Client Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm test         # Run tests
```

### Server Commands
```bash
npm run dev      # Start with nodemon
npm start        # Start production server
npm run lint     # Run ESLint
npm test         # Run tests
npm run db:migrate # Run database migrations
npm run db:seed    # Seed database
```

## 📁 Project Structure

```
banana-pajama/
├── client/                 # Phaser.js game frontend
│   ├── src/scenes/        # Game scenes (Menu, Game, GameOver)
│   ├── src/sprites/       # Player and enemy classes
│   ├── assets/            # Images, sounds, fonts
│   └── dist/              # Built game files
├── server/                # Node.js Express API
│   ├── routes/            # API endpoints
│   ├── models/            # Database models
│   └── middleware/        # Express middleware
├── database/              # PostgreSQL migrations
├── docker/                # Docker configuration
└── infrastructure/        # AWS deployment scripts
```

## 🎨 Art & Audio Specifications

### Graphics
- **Sprites**: 32x32 to 64x64 pixels, PNG format with alpha
- **Color Palette**: Dark grays, blues, and greens for atmosphere
- **Lighting**: Dim/moody with streetlight shadows

### Audio
- **Background Music**: Ambient, atmospheric, looped
- **Sound Effects**: Gunshots with echo, zombie spawn/death sounds
- **3D Audio**: Positional audio that fades with distance

## 🌐 API Endpoints

```javascript
GET  /api/highscores          // Get top 10 players
POST /api/highscores          // Submit new high score
POST /api/sessions/start      // Start game session
POST /api/sessions/end        // Log game completion
GET  /health                  // Server health check
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## 🚀 Deployment

The game is designed to deploy on AWS with:
- **EC2** - Application servers
- **RDS PostgreSQL** - Database
- **S3 + CloudFront** - Static asset CDN
- **Application Load Balancer** - Traffic distribution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 Game Design Document

For detailed game specifications, see [banana_pajama_spec.txt](banana_pajama_spec.txt).

## 🔧 Development Notes

- The game uses sprite pooling for performance optimization
- Maximum 50 concurrent zombies to maintain 60 FPS
- Progressive loading prioritizes critical game assets
- High score queries are indexed for fast leaderboard responses

---

**Happy zombie hunting! 🧟‍♂️🍌**