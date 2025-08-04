import Phaser from 'phaser';
import Bullet from '../sprites/Bullet.js';
import BasicZombie from '../sprites/BasicZombie.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.score = 0;
        this.gameTime = 0;
        this.hp = 100;
        this.crosshair = null;
        this.bullets = null;
        this.zombies = null;
        this.zombieSpawnTimer = null;
        this.zombieSpawnRate = 2000; // Start spawning every 2 seconds
        this.backgroundMusic = null;
    }

    preload() {
        // Load game assets
        this.load.image('banana', 'assets/banana.png');
        this.load.image('crosshair', 'assets/crosshairs.png');
        this.load.image('zombie1', 'assets/zombie-1.png');
        this.load.audio('zombie-game', 'assets/zombie-game.mp3');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Reset game state when starting new game
        this.score = 0;
        this.gameTime = 0;
        this.hp = 100;

        // Create large world bounds for infinite scrolling feel
        this.physics.world.setBounds(-10000, -10000, 20000, 20000);

        // Dark city background (much larger for scrolling)
        this.add.rectangle(0, 0, 20000, 20000, 0x0f0f23);

        // Create player (banana) at world center
        this.player = this.physics.add.sprite(0, 0, 'banana');
        this.player.setScale(0.1);
        // Remove world bounds collision for infinite feel
        this.player.setCollideWorldBounds(false);

        // Set camera to follow player and keep them centered
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setDeadzone(0, 0); // No deadzone = always centered

        // Create cursor keys
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');

        // Create crosshair
        this.crosshair = this.add.image(0, 0, 'crosshair');
        this.crosshair.setDepth(1000); // Always on top

        // Create bullets group
        this.bullets = this.physics.add.group({
            classType: Bullet,
            maxSize: 50,
            runChildUpdate: true
        });

        // Create zombies group
        this.zombies = this.physics.add.group({
            classType: BasicZombie,
            maxSize: 50,
            runChildUpdate: true
        });

        // Set up collision detection
        this.physics.add.overlap(this.bullets, this.zombies, this.bulletHitZombie, null, this);

        // Hide default cursor and use custom crosshair
        this.input.setDefaultCursor('none');

        // Create UI
        this.createUI();

        // Start game timer
        this.gameTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });

        // Start zombie spawning
        this.zombieSpawnTimer = this.time.addEvent({
            delay: this.zombieSpawnRate,
            callback: this.spawnZombie,
            callbackScope: this,
            loop: true
        });

        // Mouse controls for aiming
        this.input.on('pointermove', (pointer) => {
            // Convert screen coordinates to world coordinates
            const worldX = pointer.x + this.cameras.main.scrollX;
            const worldY = pointer.y + this.cameras.main.scrollY;
            
            // Update crosshair position
            this.crosshair.setPosition(worldX, worldY);
            
            // Player always faces mouse cursor
            const angle = Phaser.Math.Angle.Between(
                this.player.x, this.player.y,
                worldX, worldY
            );
            this.player.setRotation(angle);
        });

        // Mouse click to shoot
        this.input.on('pointerdown', (pointer) => {
            const worldX = pointer.x + this.cameras.main.scrollX;
            const worldY = pointer.y + this.cameras.main.scrollY;
            this.shoot(worldX, worldY);
        });

        // Instructions
        this.add.text(width / 2, height - 30, 'WASD to move • Mouse to aim • Click to shoot • ESC for menu', {
            fontSize: '14px',
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);

        // ESC to return to menu
        this.input.keyboard.on('keydown-ESC', () => {
            // Stop game music before returning to menu
            if (this.backgroundMusic) {
                this.backgroundMusic.stop();
            }
            this.scene.start('MenuScene');
        });

        // Start background music
        this.startBackgroundMusic();
    }

    createUI() {
        const { width } = this.cameras.main;

        // HP Bar
        this.hpBarBg = this.add.rectangle(100, 30, 200, 20, 0x333333);
        this.hpBarBg.setScrollFactor(0);
        this.hpBarFill = this.add.rectangle(100, 30, 200, 20, 0x44ff44);
        this.hpBarFill.setScrollFactor(0);

        this.add.text(20, 20, 'HP:', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff'
        }).setScrollFactor(0);

        // Score
        this.scoreText = this.add.text(width / 2, 30, 'Score: 0', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);

        // Timer
        this.timerText = this.add.text(width - 20, 30, 'Time: 00:00', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: 'right'
        }).setOrigin(1, 0).setScrollFactor(0);
    }

    update() {
        this.handleMovement();
        this.updateUI();
        this.updateCrosshair();
    }

    handleMovement() {
        const speed = 200;
        let velocityX = 0;
        let velocityY = 0;

        // WASD movement
        if (this.wasd.A.isDown || this.cursors.left.isDown) {
            velocityX = -speed;
        } else if (this.wasd.D.isDown || this.cursors.right.isDown) {
            velocityX = speed;
        }

        if (this.wasd.W.isDown || this.cursors.up.isDown) {
            velocityY = -speed;
        } else if (this.wasd.S.isDown || this.cursors.down.isDown) {
            velocityY = speed;
        }

        this.player.setVelocity(velocityX, velocityY);
    }

    updateUI() {
        // Update HP bar
        const hpPercent = this.hp / 100;
        this.hpBarFill.scaleX = hpPercent;
        
        // Change color based on HP
        if (hpPercent > 0.6) {
            this.hpBarFill.setFillStyle(0x44ff44); // Green
        } else if (hpPercent > 0.3) {
            this.hpBarFill.setFillStyle(0xffff44); // Yellow
        } else {
            this.hpBarFill.setFillStyle(0xff4444); // Red
        }

        // Update score
        this.scoreText.setText(`Score: ${this.score}`);
    }

    updateTimer() {
        this.gameTime++;
        this.score++; // 1 point per second survival bonus
        
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = this.gameTime % 60;
        this.timerText.setText(`Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }

    updateCrosshair() {
        // Keep crosshair at mouse position in world coordinates
        const pointer = this.input.activePointer;
        if (pointer) {
            const worldX = pointer.x + this.cameras.main.scrollX;
            const worldY = pointer.y + this.cameras.main.scrollY;
            this.crosshair.setPosition(worldX, worldY);
        }
    }

    shoot(targetX, targetY) {
        // Get bullet from pool or create new one
        let bullet = this.bullets.getFirstDead();
        
        if (!bullet) {
            bullet = new Bullet(this, 0, 0);
            this.bullets.add(bullet);
        }
        
        // Fire bullet from player position to target
        bullet.fire(this.player.x, this.player.y, targetX, targetY);
        
        // Add shooting sound effect here later
        // this.sound.play('gunshot');
    }

    spawnZombie() {
        const { width, height } = this.cameras.main;
        const camera = this.cameras.main;
        
        // Get camera bounds in world coordinates
        const cameraLeft = camera.scrollX;
        const cameraRight = camera.scrollX + width;
        const cameraTop = camera.scrollY;
        const cameraBottom = camera.scrollY + height;
        
        // Choose random edge to spawn from (relative to camera view)
        const edge = Phaser.Math.Between(0, 3); // 0=top, 1=right, 2=bottom, 3=left
        let x, y;
        
        switch (edge) {
            case 0: // Top
                x = Phaser.Math.Between(cameraLeft, cameraRight);
                y = cameraTop - 50;
                break;
            case 1: // Right
                x = cameraRight + 50;
                y = Phaser.Math.Between(cameraTop, cameraBottom);
                break;
            case 2: // Bottom
                x = Phaser.Math.Between(cameraLeft, cameraRight);
                y = cameraBottom + 50;
                break;
            case 3: // Left
                x = cameraLeft - 50;
                y = Phaser.Math.Between(cameraTop, cameraBottom);
                break;
        }
        
        // Get zombie from pool or create new one
        let zombie = this.zombies.getFirstDead();
        if (!zombie) {
            zombie = new BasicZombie(this, x, y);
            this.zombies.add(zombie);
        } else {
            zombie.reset(x, y);
        }
    }

    bulletHitZombie(bullet, zombie) {
        if (!bullet.active || zombie.isDead) return;
        
        // Damage zombie
        const zombieDied = zombie.takeDamage(bullet.damage);
        
        // Destroy bullet
        bullet.destroy();
        
        // If zombie died, it handles its own scoring
    }

    damagePlayer(damage) {
        this.hp -= damage;
        
        // Clamp HP to 0-100 range
        this.hp = Math.max(0, this.hp);
        
        // Check for game over
        if (this.hp <= 0) {
            this.gameOver();
        }
        
        // Visual feedback for player damage
        this.cameras.main.shake(200, 0.01);
    }

    addScore(points) {
        this.score += points;
    }

    startBackgroundMusic() {
        // Stop any existing music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Start game music
        this.backgroundMusic = this.sound.add('zombie-game', {
            loop: true,
            volume: 0.4 // Slightly quieter during gameplay
        });
        this.backgroundMusic.play();
    }

    gameOver() {
        // Stop spawning zombies
        if (this.zombieSpawnTimer) {
            this.zombieSpawnTimer.destroy();
        }
        
        // Stop game music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        this.scene.start('GameOverScene', { 
            score: this.score, 
            time: this.gameTime 
        });
    }
}