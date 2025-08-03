# 🍌 Banana Pajama Zombie Shooter

A dark and atmospheric top-down zombie survival game where you play as a banana in pajamas shooting zombies in a dystopian city. Built with Phaser.js and Node.js.

## 🎮 Game Features

- **Top-down zombie survival** gameplay
- **Dark atmospheric** city environment with moody lighting
- **Cross-platform** support (desktop + mobile)
- **Progressive difficulty** with increasing zombie spawn rates
- **Multiple zombie types** with different behaviors
- **High score system** with leaderboards
- **Responsive controls** (WASD + mouse on desktop, virtual joystick on mobile)

## 🏗️ Tech Stack

### Frontend
- **Phaser.js 3** - HTML5 game framework
- **Webpack** - Module bundler and dev server
- **HTML5 Canvas** - Cross-platform rendering

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **PostgreSQL** - Database for high scores
- **CORS & Helmet** - Security middleware

### Deployment
- **Docker** - Containerization
- **AWS** - Cloud hosting (EC2, RDS, S3, CloudFront)
- **Nginx** - Reverse proxy and static serving

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- PostgreSQL (for database features)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd banana-pajama
   ```

2. **Install dependencies**
   ```bash
   # Install client dependencies
   cd client
   npm install
   
   # Install server dependencies
   cd ../server
   npm install
   ```

3. **Start development servers**
   ```bash
   # Start game client (port 3000)
   cd client
   npm run dev
   
   # Start API server (port 3001) - in another terminal
   cd server
   npm run dev
   ```

4. **Open the game**
   - Navigate to `http://localhost:3000`
   - The game should load with the menu screen

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