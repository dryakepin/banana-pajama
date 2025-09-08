import Phaser from 'phaser';
import Bullet from '../sprites/Bullet.js';
import BasicZombie from '../sprites/BasicZombie.js';
import TankZombie from '../sprites/TankZombie.js';
import FastZombie from '../sprites/FastZombie.js';
import AnimatedZombie from '../sprites/AnimatedZombie.js';
import PowerUp from '../sprites/PowerUp.js';
import TileMap from '../world/TileMap.js';
import VirtualJoystick from '../ui/VirtualJoystick.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.score = 0;
        this.gameTime = 0;
        this.zombiesKilled = 0;
        this.hp = 100;
        this.crosshair = null;
        this.bullets = null;
        this.zombies = null;
        this.tankZombies = null;
        this.fastZombies = null;
        this.powerUps = null;
        this.zombieSpawnTimer = null;
        this.tankZombieSpawnTimer = null;
        this.fastZombieSpawnTimer = null;
        this.animatedZombieSpawnTimer = null;
        this.zombieSpawnRate = 2000; // Start spawning every 2 seconds
        this.tankZombieSpawnRate = 8000; // Tank zombies spawn every 8 seconds
        this.fastZombieSpawnRate = 3000; // Fast zombies spawn every 3 seconds for testing
        this.animatedZombieSpawnRate = 6000; // Animated zombies spawn every 6 seconds (less frequent due to complexity)
        this.backgroundMusic = null;
        this.tileMap = null;
        this.virtualJoystick = null;
        this.isMobile = false;
        this.joystickPointerId = null; // Track which pointer is controlling joystick
        this.aimingPointerId = null;   // Track which pointer is aiming
        this.lastShotTime = 0; // Track when last shot was fired
        this.shotCooldown = 400; // 400ms between shots
        
        // Power-up states
        this.isInvincible = false;
        this.invincibilityEndTime = 0;
        this.rapidFireActive = false;
        this.rapidFireEndTime = 0;
        this.dualShotActive = false;
        this.dualShotEndTime = 0;
        
        // Pause system
        this.isPaused = false;
        this.pauseDialog = null;
        this.pauseButton = null;
        
        // Power-up indicators
        this.powerUpIndicators = {};
    }

    preload() {
        // Load game assets
        this.load.image('banana', 'assets/banana.png');
        this.load.image('crosshair', 'assets/crosshairs.png');
        this.load.image('zombie1', 'assets/zombies/zombie-1.png');
        this.load.image('zombie2', 'assets/zombies/zombie-2.png');
        this.load.image('zombie3', 'assets/zombies/zombie-3.png');
        
        // Load animated zombie (zombie-4) frames
        // Appear animation (11 frames)
        for (let i = 1; i <= 11; i++) {
            this.load.image(`zombie4-appear-${i}`, `assets/zombies/zombie-4/appear/appear_${i}.png`);
        }
        
        // Idle animation (6 frames)  
        for (let i = 1; i <= 6; i++) {
            this.load.image(`zombie4-idle-${i}`, `assets/zombies/zombie-4/idle/idle_${i}.png`);
        }
        
        // Walk animation (10 frames)
        for (let i = 1; i <= 10; i++) {
            this.load.image(`zombie4-walk-${i}`, `assets/zombies/zombie-4/walk/go_${i}.png`);
        }
        
        // Attack animation (7 frames)
        for (let i = 1; i <= 7; i++) {
            this.load.image(`zombie4-attack-${i}`, `assets/zombies/zombie-4/attack/hit_${i}.png`);
        }
        
        // Die animation (8 frames)
        for (let i = 1; i <= 8; i++) {
            this.load.image(`zombie4-die-${i}`, `assets/zombies/zombie-4/die/die_${i}.png`);
        }
        this.load.audio('zombie-game', 'assets/zombie-game.mp3');
        
        // Load power-up assets with fallback handling
        this.load.image('powerup-healing', 'assets/powerups/healing.png');
        this.load.image('powerup-invincibility', 'assets/powerups/invincibility.png');
        this.load.image('powerup-pointBoost', 'assets/powerups/pointBoost.png');
        this.load.image('powerup-rapidFire', 'assets/powerups/rapidFire.png');
        this.load.image('powerup-dualShot', 'assets/powerups/dualShot.png');
        this.load.image('powerup-killAll', 'assets/powerups/killAll.png');
        
        // Load tile PNG assets
        this.load.image('street-png', 'assets/tiles/tile-street.png');
        this.load.image('sidewalk-png', 'assets/tiles/tile-sidewalk.png');
        this.load.image('building-png', 'assets/tiles/tile-building.png');
        this.load.image('park-png', 'assets/tiles/tile-park.png');
        this.load.image('intersection-png', 'assets/tiles/tile-intersection.png');
        this.load.image('residential-png', 'assets/tiles/tile-residential.png');
        this.load.image('commercial-png', 'assets/tiles/tile-commercial.png');
        this.load.image('industrial-png', 'assets/tiles/tile-industrial.png');
        
        // Handle load errors gracefully
        this.load.on('loaderror', (file) => {
            console.log(`⚠️  Asset not found, using fallback: ${file.src}`);
            console.log(`Failed to load: ${file.key}`);
        });
        
        this.load.on('filecomplete', (key, type, data) => {
            if (key.endsWith('-png')) {
                console.log(`✅ Loaded tile asset: ${key}`);
            }
            if (key.startsWith('powerup-')) {
                console.log(`✅ Loaded power-up asset: ${key}`);
            }
        });
        
        // Assets are fully loaded when preload completes - Phaser handles this automatically
        console.log('🎯 Preload phase completed - all assets guaranteed to be loaded');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Detect mobile device - more accurate detection
        // Don't use touch support alone as laptops can have touchscreens
        this.isMobile = this.sys.game.device.os.android || 
                       this.sys.game.device.os.iOS || 
                       this.sys.game.device.os.windowsPhone ||
                       /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       // Only consider it mobile if it's a small screen AND has touch
                       (('ontouchstart' in window) && (window.innerWidth <= 768 || window.innerHeight <= 768));
                       
        // TEMPORARY: Uncomment the line below to force mobile mode for desktop testing  
        // this.isMobile = true;
        
        console.log('Mobile detection:', {
            android: this.sys.game.device.os.android,
            iOS: this.sys.game.device.os.iOS,
            userAgent: navigator.userAgent,
            ontouchstart: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            isSmallScreen: (window.innerWidth <= 768 || window.innerHeight <= 768),
            isMobile: this.isMobile,
            detectionMethod: 'improved'
        });

        // Create animations for animated zombie (zombie-4)
        this.createAnimatedZombieAnimations();

        // Reset game state when starting new game
        this.score = 0;
        this.gameTime = 0;
        this.hp = 100;

        // Create large world bounds for infinite scrolling feel
        this.physics.world.setBounds(-10000, -10000, 20000, 20000);

        // Initialize tile-based world
        this.tileMap = new TileMap(this);

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

        // Create crosshair (larger for mobile)
        this.crosshair = this.add.image(0, 0, 'crosshair');
        this.crosshair.setDepth(1000); // Always on top
        if (this.isMobile) {
            this.crosshair.setScale(1.5); // Make crosshair larger on mobile
            this.crosshair.setVisible(false); // Hide crosshair initially on mobile
        }

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

        // Create tank zombies group
        this.tankZombies = this.physics.add.group({
            classType: TankZombie,
            maxSize: 10, // Fewer tank zombies
            runChildUpdate: true
        });

        // Create fast zombies group
        this.fastZombies = this.physics.add.group({
            classType: FastZombie,
            maxSize: 20, // Medium number of fast zombies
            runChildUpdate: true
        });

        // Create animated zombies group
        this.animatedZombies = this.physics.add.group({
            classType: AnimatedZombie,
            maxSize: 15, // Limited due to animation complexity
            runChildUpdate: true
        });

        // Create power-ups group
        this.powerUps = this.physics.add.group({
            classType: PowerUp,
            maxSize: 20, // Limit number of power-ups on screen
            runChildUpdate: true
        });

        // Set up collision detection
        this.physics.add.overlap(this.bullets, this.zombies, this.bulletHitZombie, null, this);
        this.physics.add.overlap(this.bullets, this.tankZombies, this.bulletHitTankZombie, null, this);
        this.physics.add.overlap(this.bullets, this.fastZombies, this.bulletHitFastZombie, null, this);
        this.physics.add.overlap(this.bullets, this.animatedZombies, this.bulletHitAnimatedZombie, null, this);
        this.physics.add.overlap(this.player, this.powerUps, this.playerPickupPowerUp, null, this);

        // Hide default cursor and use custom crosshair
        this.input.setDefaultCursor('none');

        // Create UI
        this.createUI();

        // Virtual joystick will be created dynamically on mobile when user first touches
        if (this.isMobile) {
            console.log(`Mobile device detected - dynamic joystick will be created on first touch`);
            console.log(`Screen dimensions: ${width}x${height}`);
        }

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

        // Start tank zombie spawning
        this.tankZombieSpawnTimer = this.time.addEvent({
            delay: this.tankZombieSpawnRate,
            callback: this.spawnTankZombie,
            callbackScope: this,
            loop: true
        });

        // Start fast zombie spawning
        this.fastZombieSpawnTimer = this.time.addEvent({
            delay: this.fastZombieSpawnRate,
            callback: this.spawnFastZombie,
            callbackScope: this,
            loop: true
        });

        // Start animated zombie spawning
        this.animatedZombieSpawnTimer = this.time.addEvent({
            delay: this.animatedZombieSpawnRate,
            callback: this.spawnAnimatedZombie,
            callbackScope: this,
            loop: true
        });

        if (this.isMobile) {
            // Multi-touch handling for mobile
            this.setupMobileControls();
        } else {
            // Desktop mouse controls
            this.setupDesktopControls();
        }

        // Instructions (different for mobile vs desktop)
        const instructionText = this.isMobile ? 
            'Touch & hold to create joystick • Second finger to aim & shoot • Tap ⏸ to pause' :
            'WASD to move • Mouse to aim • Click to shoot • SPACE to pause • ESC for menu';
            
        const fontSize = this.isMobile ? '16px' : '14px'; // Larger text on mobile
        
        this.add.text(width / 2, height - 30, instructionText, {
            fontSize: fontSize,
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);

        // ESC to return to menu
        this.input.keyboard.on('keydown-ESC', () => {
            // Stop ALL audio before returning to menu
            this.sound.stopAll();
            this.scene.start('MenuScene');
        });
        
        // SPACE to pause/unpause (desktop only)
        this.input.keyboard.on('keydown-SPACE', () => {
            this.togglePause();
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

        // Power-up indicators (below HP bar)
        this.createPowerUpIndicators();

        // Score
        this.scoreText = this.add.text(width / 2, 30, 'Score: 0', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);

        // Timer (adjust position based on mobile/desktop)
        const timerX = this.isMobile ? width / 2 : width - 20;
        const timerY = this.isMobile ? 60 : 30;
        const timerAlign = this.isMobile ? 'center' : 'right';
        const timerOriginX = this.isMobile ? 0.5 : 1;
        
        this.timerText = this.add.text(timerX, timerY, 'Time: 00:00', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: timerAlign
        }).setOrigin(timerOriginX, 0).setScrollFactor(0);
        
        // Mobile pause button (top-right corner)
        if (this.isMobile) {
            this.pauseButton = this.add.text(width - 20, 30, '⏸', {
                fontSize: '24px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(1, 0).setScrollFactor(0);
            
            this.pauseButton.setInteractive({ useHandCursor: true });
            this.pauseButton.on('pointerdown', () => {
                this.togglePause();
            });
        }
    }

    update() {
        // Don't update game logic if paused
        if (this.isPaused) {
            return;
        }
        
        this.handleMovement();
        this.updateUI();
        this.updatePowerUps();
        this.updatePowerUpIndicators();
        
        // Only update crosshair automatically on desktop
        if (!this.isMobile) {
            this.updateCrosshair();
        }
        
        // Update tile map based on player position
        if (this.tileMap && this.player) {
            this.tileMap.update(this.player.x, this.player.y);
        }
    }

    handleMovement() {
        const speed = 200;
        let velocityX = 0;
        let velocityY = 0;

        if (this.isMobile && this.virtualJoystick) {
            // Use virtual joystick for mobile
            const input = this.virtualJoystick.getInputVector();
            velocityX = input.x * speed;
            velocityY = input.y * speed;
        } else {
            // WASD/Arrow key movement for desktop
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
        }

        // Check collision with buildings before moving
        if (this.tileMap) {
            const futureX = this.player.x + (velocityX * this.game.loop.delta / 1000);
            const futureY = this.player.y + (velocityY * this.game.loop.delta / 1000);
            
            // Check collision in X direction
            if (velocityX !== 0 && !this.tileMap.isWalkable(futureX, this.player.y)) {
                velocityX = 0;
            }
            
            // Check collision in Y direction
            if (velocityY !== 0 && !this.tileMap.isWalkable(this.player.x, futureY)) {
                velocityY = 0;
            }
            
            // Check diagonal collision
            if (velocityX !== 0 && velocityY !== 0 && !this.tileMap.isWalkable(futureX, futureY)) {
                // If diagonal is blocked, try each axis separately
                if (this.tileMap.isWalkable(futureX, this.player.y)) {
                    velocityY = 0;
                } else if (this.tileMap.isWalkable(this.player.x, futureY)) {
                    velocityX = 0;
                } else {
                    velocityX = 0;
                    velocityY = 0;
                }
            }
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
            
            // Update crosshair color based on line of sight
            if (this.tileMap && this.hasLineOfSight(this.player.x, this.player.y, worldX, worldY)) {
                this.crosshair.setTint(0xffffff); // White - clear shot
            } else {
                this.crosshair.setTint(0xff4444); // Red - blocked shot
            }
        }
    }

    shoot(targetX, targetY) {
        // Check shot cooldown (modified by rapid fire)
        const currentTime = this.time.now;
        const effectiveCooldown = this.rapidFireActive ? this.shotCooldown / 2 : this.shotCooldown;
        if (currentTime - this.lastShotTime < effectiveCooldown) {
            return; // Still in cooldown, don't fire
        }
        
        // Check line of sight before firing
        if (this.tileMap && !this.hasLineOfSight(this.player.x, this.player.y, targetX, targetY)) {
            // Don't fire if there's a building in the way
            return;
        }
        
        // Get bullet from pool or create new one
        let bullet = this.bullets.getFirstDead();
        
        if (!bullet) {
            bullet = new Bullet(this, 0, 0);
            this.bullets.add(bullet);
        }
        
        // Fire bullet from player position to target
        bullet.fire(this.player.x, this.player.y, targetX, targetY);
        
        // Dual shot - fire second bullet with slight offset
        if (this.dualShotActive) {
            this.time.delayedCall(50, () => {
                let secondBullet = this.bullets.getFirstDead();
                if (!secondBullet) {
                    secondBullet = new Bullet(this, 0, 0);
                    this.bullets.add(secondBullet);
                }
                // Slight offset for second bullet
                const offsetX = Math.random() * 20 - 10;
                const offsetY = Math.random() * 20 - 10;
                secondBullet.fire(this.player.x, this.player.y, targetX + offsetX, targetY + offsetY);
            });
        }
        
        // Update last shot time
        this.lastShotTime = currentTime;
        
        // Add shooting sound effect here later
        // this.sound.play('gunshot');
    }
    
    // Check if there's a clear line of sight between two points
    hasLineOfSight(startX, startY, endX, endY) {
        const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
        const steps = Math.ceil(distance / 16); // Check every 16 pixels
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const checkX = startX + (endX - startX) * t;
            const checkY = startY + (endY - startY) * t;
            
            if (!this.tileMap.isWalkable(checkX, checkY)) {
                return false; // Line of sight blocked
            }
        }
        
        return true; // Clear line of sight
    }
    
    // Helper method to check if pointer is over virtual joystick
    isPointerOverJoystick(pointer) {
        if (!this.virtualJoystick) return false;
        
        const distance = Phaser.Math.Distance.Between(
            pointer.x, pointer.y, 
            this.virtualJoystick.x, this.virtualJoystick.y
        );
        
        return distance <= this.virtualJoystick.radius;
    }
    
    setupMobileControls() {
        // Enable multi-touch
        this.input.addPointer(2); // Allow up to 3 total pointers (default 1 + 2 more)
        
        this.input.on('pointerdown', (pointer) => {
            if (!this.virtualJoystick && this.joystickPointerId === null) {
                // First touch - create joystick at touch location
                console.log(`Creating dynamic joystick at (${pointer.x}, ${pointer.y})`);
                this.virtualJoystick = new VirtualJoystick(this, pointer.x, pointer.y);
                this.joystickPointerId = pointer.id;
                this.virtualJoystick.handlePointerDown(pointer);
            } else if (this.isPointerOverJoystick(pointer) && this.joystickPointerId === null) {
                // Touch is on existing joystick - show it and activate
                this.joystickPointerId = pointer.id;
                if (this.virtualJoystick) {
                    this.virtualJoystick.setVisible(true);
                    this.virtualJoystick.handlePointerDown(pointer);
                }
            } else if (this.aimingPointerId === null) {
                // This touch is for aiming/shooting (second touch or touch away from joystick)
                this.aimingPointerId = pointer.id;
                this.handleAimingTouch(pointer);
            }
        });
        
        this.input.on('pointermove', (pointer) => {
            if (pointer.id === this.joystickPointerId && this.virtualJoystick) {
                // Update joystick
                this.virtualJoystick.handlePointerMove(pointer);
            } else if (pointer.id === this.aimingPointerId) {
                // Update aiming
                this.handleAimingTouch(pointer);
            }
        });
        
        this.input.on('pointerup', (pointer) => {
            if (pointer.id === this.joystickPointerId) {
                // Release joystick - hide it when not in use
                this.joystickPointerId = null;
                if (this.virtualJoystick) {
                    this.virtualJoystick.handlePointerUp(pointer);
                    // Hide joystick after a short delay if no other touches
                    this.time.delayedCall(1000, () => {
                        if (this.joystickPointerId === null && this.virtualJoystick) {
                            this.virtualJoystick.setVisible(false);
                        }
                    });
                }
            } else if (pointer.id === this.aimingPointerId) {
                // Release aiming and shoot
                const worldX = pointer.x + this.cameras.main.scrollX;
                const worldY = pointer.y + this.cameras.main.scrollY;
                this.shoot(worldX, worldY);
                this.aimingPointerId = null;
                
                // Hide crosshair when aiming ends on mobile
                if (this.isMobile) {
                    this.crosshair.setVisible(false);
                }
            }
        });
        
        // Handle when pointers leave the screen
        this.input.on('pointerupoutside', (pointer) => {
            if (pointer.id === this.joystickPointerId) {
                this.joystickPointerId = null;
                if (this.virtualJoystick) {
                    this.virtualJoystick.handlePointerUp(pointer);
                    // Hide joystick when finger leaves screen
                    this.time.delayedCall(500, () => {
                        if (this.joystickPointerId === null && this.virtualJoystick) {
                            this.virtualJoystick.setVisible(false);
                        }
                    });
                }
            } else if (pointer.id === this.aimingPointerId) {
                this.aimingPointerId = null;
                
                // Hide crosshair when aiming finger leaves screen on mobile
                if (this.isMobile) {
                    this.crosshair.setVisible(false);
                }
            }
        });
    }
    
    setupDesktopControls() {
        // Standard mouse controls for desktop
        this.input.on('pointermove', (pointer) => {
            const worldX = pointer.x + this.cameras.main.scrollX;
            const worldY = pointer.y + this.cameras.main.scrollY;
            
            // Update crosshair position
            this.crosshair.setPosition(worldX, worldY);
            
            // Update crosshair color based on line of sight
            if (this.tileMap && this.hasLineOfSight(this.player.x, this.player.y, worldX, worldY)) {
                this.crosshair.setTint(0xffffff); // White - clear shot
            } else {
                this.crosshair.setTint(0xff4444); // Red - blocked shot
            }
            
            // Calculate angle and handle sprite flipping
            const angle = Phaser.Math.Angle.Between(
                this.player.x, this.player.y,
                worldX, worldY
            );
            
            // Flip sprite based on crosshair position and adjust rotation
            if (worldX < this.player.x) {
                // Crosshair is to the left - flip sprite vertically to face left
                this.player.setFlipY(true);
                this.player.setRotation(angle);
            } else {
                // Crosshair is to the right - normal orientation
                this.player.setFlipY(false);
                this.player.setRotation(angle);
            }
        });

        this.input.on('pointerdown', (pointer) => {
            const worldX = pointer.x + this.cameras.main.scrollX;
            const worldY = pointer.y + this.cameras.main.scrollY;
            this.shoot(worldX, worldY);
        });
    }
    
    handleAimingTouch(pointer) {
        const worldX = pointer.x + this.cameras.main.scrollX;
        const worldY = pointer.y + this.cameras.main.scrollY;
        
        // Show crosshair when aiming starts
        if (!this.crosshair.visible) {
            this.crosshair.setVisible(true);
        }
        
        // Update crosshair position
        this.crosshair.setPosition(worldX, worldY);
        
        // Update crosshair color based on line of sight
        if (this.tileMap && this.hasLineOfSight(this.player.x, this.player.y, worldX, worldY)) {
            this.crosshair.setTint(0xffffff); // White - clear shot
        } else {
            this.crosshair.setTint(0xff4444); // Red - blocked shot
        }
        
        // Calculate angle and handle sprite flipping
        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            worldX, worldY
        );
        
        // Flip sprite based on crosshair position and adjust rotation
        if (worldX < this.player.x) {
            // Crosshair is to the left - flip sprite vertically to face left
            this.player.setFlipY(true);
            this.player.setRotation(angle);
        } else {
            // Crosshair is to the right - normal orientation
            this.player.setFlipY(false);
            this.player.setRotation(angle);
        }
    }

    spawnZombie() {
        console.log('Spawning basic zombie...');
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
        
        // Find walkable spawn position
        if (this.tileMap && !this.tileMap.isWalkable(x, y)) {
            const walkablePos = this.tileMap.getNearestWalkablePosition(x, y);
            x = walkablePos.x;
            y = walkablePos.y;
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

    spawnTankZombie() {
        console.log('Spawning tank zombie...');
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
                y = cameraTop - 80; // Spawn further away for tank zombies
                break;
            case 1: // Right
                x = cameraRight + 80;
                y = Phaser.Math.Between(cameraTop, cameraBottom);
                break;
            case 2: // Bottom
                x = Phaser.Math.Between(cameraLeft, cameraRight);
                y = cameraBottom + 80;
                break;
            case 3: // Left
                x = cameraLeft - 80;
                y = Phaser.Math.Between(cameraTop, cameraBottom);
                break;
        }
        
        // Find walkable spawn position
        if (this.tileMap && !this.tileMap.isWalkable(x, y)) {
            const walkablePos = this.tileMap.getNearestWalkablePosition(x, y);
            x = walkablePos.x;
            y = walkablePos.y;
        }
        
        // Get tank zombie from pool or create new one
        let tankZombie = this.tankZombies.getFirstDead();
        if (!tankZombie) {
            tankZombie = new TankZombie(this, x, y);
            this.tankZombies.add(tankZombie);
        } else {
            tankZombie.reset(x, y);
        }
    }

    spawnFastZombie() {
        console.log('Spawning FAST zombie...');
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
                y = cameraTop - 60; // Medium spawn distance
                break;
            case 1: // Right
                x = cameraRight + 60;
                y = Phaser.Math.Between(cameraTop, cameraBottom);
                break;
            case 2: // Bottom
                x = Phaser.Math.Between(cameraLeft, cameraRight);
                y = cameraBottom + 60;
                break;
            case 3: // Left
                x = cameraLeft - 60;
                y = Phaser.Math.Between(cameraTop, cameraBottom);
                break;
        }
        
        // Find walkable spawn position
        if (this.tileMap && !this.tileMap.isWalkable(x, y)) {
            const walkablePos = this.tileMap.getNearestWalkablePosition(x, y);
            x = walkablePos.x;
            y = walkablePos.y;
        }
        
        // Get fast zombie from pool or create new one
        let fastZombie = this.fastZombies.getFirstDead();
        console.log('fastZombie from pool:', fastZombie);
        if (!fastZombie) {
            console.log('Creating new FastZombie at position:', x, y);
            try {
                fastZombie = new FastZombie(this, x, y);
                console.log('FastZombie created successfully:', fastZombie);
                this.fastZombies.add(fastZombie);
                console.log('FastZombie added to group');
            } catch (error) {
                console.error('Error creating FastZombie:', error);
                return;
            }
        } else {
            console.log('Resetting existing FastZombie');
            fastZombie.reset(x, y);
        }
    }

    spawnAnimatedZombie() {
        console.log('Spawning ANIMATED zombie...');
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
        
        // Spawn inside screen boundaries to show animation, but at edges for dramatic entrance
        const margin = 50; // Distance from screen edge
        
        switch (edge) {
            case 0: // Top edge, inside screen
                x = Phaser.Math.Between(cameraLeft + margin, cameraRight - margin);
                y = cameraTop + margin;
                break;
            case 1: // Right edge, inside screen
                x = cameraRight - margin;
                y = Phaser.Math.Between(cameraTop + margin, cameraBottom - margin);
                break;
            case 2: // Bottom edge, inside screen
                x = Phaser.Math.Between(cameraLeft + margin, cameraRight - margin);
                y = cameraBottom - margin;
                break;
            case 3: // Left edge, inside screen
                x = cameraLeft + margin;
                y = Phaser.Math.Between(cameraTop + margin, cameraBottom - margin);
                break;
        }
        
        console.log('Attempting to spawn animated zombie at:', x, y);
        
        // Get animated zombie from pool or create new one
        let animatedZombie = this.animatedZombies.getFirstDead();
        console.log('animatedZombie from pool:', animatedZombie);
        if (!animatedZombie) {
            console.log('Creating new AnimatedZombie at position:', x, y);
            try {
                animatedZombie = new AnimatedZombie(this, x, y);
                console.log('AnimatedZombie created successfully:', animatedZombie);
                this.animatedZombies.add(animatedZombie);
                console.log('AnimatedZombie added to group');
            } catch (error) {
                console.error('Error creating AnimatedZombie:', error);
                return;
            }
        } else {
            console.log('Resetting existing AnimatedZombie');
            animatedZombie.reset(x, y);
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

    bulletHitTankZombie(bullet, tankZombie) {
        if (!bullet.active || tankZombie.isDead) return;
        
        // Damage tank zombie
        const tankZombieDied = tankZombie.takeDamage(bullet.damage);
        
        // Destroy bullet
        bullet.destroy();
        
        // If tank zombie died, it handles its own scoring
    }

    bulletHitFastZombie(bullet, fastZombie) {
        if (!bullet.active || fastZombie.isDead) return;
        
        // Damage fast zombie
        const fastZombieDied = fastZombie.takeDamage(bullet.damage);
        
        // Destroy bullet
        bullet.destroy();
        
        // If fast zombie died, it handles its own scoring
    }

    bulletHitAnimatedZombie(bullet, animatedZombie) {
        if (!bullet.active || !animatedZombie.isVulnerableToAttack()) return;
        
        console.log('Bullet hit animated zombie');
        
        // Damage animated zombie
        const animatedZombieDied = animatedZombie.takeDamage(bullet.damage);
        
        // Destroy bullet
        bullet.destroy();
        
        // If animated zombie died, it handles its own scoring and animation
    }

    damagePlayer(damage) {
        // Check invincibility
        if (this.isInvincible) {
            console.log('Player is invincible - no damage taken');
            return;
        }
        
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

    addZombieKill() {
        this.zombiesKilled++;
    }

    startBackgroundMusic() {
        // Stop any existing music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Start game music with proper audio context handling
        this.initializeGameAudio();
    }
    
    initializeGameAudio() {
        // Check if audio context needs to be unlocked
        if (this.sound.context && this.sound.context.state === 'suspended') {
            console.log('🔊 Audio context suspended in game, will start after user interaction');
            
            // Create a one-time event listener for any user interaction
            const unlockGameAudio = () => {
                console.log('🔊 User interaction detected in game, unlocking audio...');
                this.sound.context.resume().then(() => {
                    console.log('🔊 Game audio context resumed, starting background music');
                    this.startGameMusic();
                    
                    // Remove listeners after first interaction
                    this.input.off('pointerdown', unlockGameAudio);
                    this.input.keyboard?.off('keydown', unlockGameAudio);
                }).catch(error => {
                    console.error('🔊 Failed to resume game audio context:', error);
                });
            };
            
            // Listen for any pointer or keyboard interaction
            this.input.once('pointerdown', unlockGameAudio);
            if (this.input.keyboard) {
                this.input.keyboard.once('keydown', unlockGameAudio);
            }
        } else {
            // Audio context is already unlocked
            console.log('🔊 Game audio context ready, starting background music immediately');
            this.startGameMusic();
        }
    }
    
    startGameMusic() {
        // Stop any existing music from all sources
        this.sound.stopAll();
        
        try {
            this.backgroundMusic = this.sound.add('zombie-game', {
                loop: true,
                volume: 0.4 // Slightly quieter during gameplay
            });
            this.backgroundMusic.play();
            console.log('🔊 Game music started successfully');
        } catch (error) {
            console.error('🔊 Failed to start game music:', error);
        }
    }

    gameOver() {
        // Stop spawning zombies
        if (this.zombieSpawnTimer) {
            this.zombieSpawnTimer.destroy();
        }
        
        // Stop spawning tank zombies
        if (this.tankZombieSpawnTimer) {
            this.tankZombieSpawnTimer.destroy();
        }
        
        // Stop spawning fast zombies
        if (this.fastZombieSpawnTimer) {
            this.fastZombieSpawnTimer.destroy();
        }
        
        // Stop spawning animated zombies
        if (this.animatedZombieSpawnTimer) {
            this.animatedZombieSpawnTimer.destroy();
        }
        
        // Stop all game audio
        this.sound.stopAll();
        
        // Clean up tile map
        if (this.tileMap) {
            this.tileMap.destroy();
        }
        
        // Clean up virtual joystick
        if (this.virtualJoystick) {
            this.virtualJoystick.destroy();
        }
        
        this.scene.start('GameOverScene', { 
            score: this.score, 
            time: this.gameTime,
            zombiesKilled: this.zombiesKilled
        });
    }
    
    // Power-up system methods
    updatePowerUps() {
        const currentTime = this.time.now;
        
        // Check power-up expiration
        if (this.isInvincible && currentTime > this.invincibilityEndTime) {
            this.isInvincible = false;
            console.log('Invincibility expired');
        }
        
        if (this.rapidFireActive && currentTime > this.rapidFireEndTime) {
            this.rapidFireActive = false;
            console.log('Rapid fire expired');
        }
        
        if (this.dualShotActive && currentTime > this.dualShotEndTime) {
            this.dualShotActive = false;
            console.log('Dual shot expired');
        }
    }
    
    spawnPowerUp(x, y, type) {
        // Get power-up from pool or create new one
        let powerUp = this.powerUps.getFirstDead();
        if (!powerUp) {
            powerUp = new PowerUp(this, x, y, type);
            this.powerUps.add(powerUp);
        } else {
            powerUp.reset(x, y, type);
        }
        
        console.log(`Spawned ${type} power-up at (${x}, ${y})`);
    }
    
    playerPickupPowerUp(player, powerUp) {
        if (!powerUp.isActive) return;
        
        powerUp.pickup(player);
        console.log(`Player picked up ${powerUp.powerUpType} power-up`);
    }
    
    // Power-up effect methods
    healPlayer(amount) {
        this.hp = Math.min(100, this.hp + amount);
        console.log(`Player healed for ${amount} HP. Current HP: ${this.hp}`);
    }
    
    makePlayerInvincible(duration) {
        this.isInvincible = true;
        this.invincibilityEndTime = this.time.now + duration;
        console.log(`Player is invincible for ${duration/1000} seconds`);
        
        // Show power-up indicator
        this.showPowerUpIndicator('invincibility', duration);
        
        // Visual feedback - make player blink
        this.player.setTint(0x88ff88);
        this.time.delayedCall(duration, () => {
            if (!this.isInvincible) {
                this.player.clearTint();
            }
        });
    }
    
    activateRapidFire(duration) {
        this.rapidFireActive = true;
        this.rapidFireEndTime = this.time.now + duration;
        console.log(`Rapid fire active for ${duration/1000} seconds`);
        
        // Show power-up indicator
        this.showPowerUpIndicator('rapidFire', duration);
    }
    
    activateDualShot(duration) {
        this.dualShotActive = true;
        this.dualShotEndTime = this.time.now + duration;
        console.log(`Dual shot active for ${duration/1000} seconds`);
        
        // Show power-up indicator
        this.showPowerUpIndicator('dualShot', duration);
    }
    
    killAllZombies() {
        console.log('Kill all zombies activated!');
        
        // Kill all basic zombies
        this.zombies.children.entries.forEach(zombie => {
            if (zombie.active && !zombie.isDead) {
                zombie.die();
            }
        });
        
        // Kill all tank zombies
        this.tankZombies.children.entries.forEach(zombie => {
            if (zombie.active && !zombie.isDead) {
                zombie.die();
            }
        });
        
        // Kill all fast zombies
        this.fastZombies.children.entries.forEach(zombie => {
            if (zombie.active && !zombie.isDead) {
                zombie.die();
            }
        });
        
        // Kill all animated zombies
        this.animatedZombies.children.entries.forEach(zombie => {
            if (zombie.active && !zombie.isDying) {
                zombie.die();
            }
        });
        
        // Screen flash effect
        this.cameras.main.flash(300, 255, 255, 255);
    }
    
    // Pause system methods
    togglePause() {
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }
    
    pauseGame() {
        this.isPaused = true;
        
        // Pause physics
        this.physics.world.pause();
        
        // Pause background music
        if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
            this.backgroundMusic.pause();
        }
        
        // Stop all timers
        this.time.paused = true;
        
        // Show pause dialog
        this.showPauseDialog();
        
        console.log('Game paused');
    }
    
    resumeGame() {
        this.isPaused = false;
        
        // Resume physics
        this.physics.world.resume();
        
        // Resume background music
        if (this.backgroundMusic && this.backgroundMusic.isPaused) {
            this.backgroundMusic.resume();
        }
        
        // Resume timers
        this.time.paused = false;
        
        // Hide pause dialog
        this.hidePauseDialog();
        
        console.log('Game resumed');
    }
    
    showPauseDialog() {
        const { width, height } = this.cameras.main;
        
        // Semi-transparent overlay
        this.pauseDialog = this.add.group();
        
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        overlay.setScrollFactor(0);
        this.pauseDialog.add(overlay);
        
        // Dialog box with border
        const dialogBorder = this.add.rectangle(width / 2, height / 2, 404, 254, 0xffffff, 1);
        dialogBorder.setScrollFactor(0);
        this.pauseDialog.add(dialogBorder);
        
        const dialogBg = this.add.rectangle(width / 2, height / 2, 400, 250, 0x333333, 0.9);
        dialogBg.setScrollFactor(0);
        this.pauseDialog.add(dialogBg);
        
        // Pause title
        const pauseTitle = this.add.text(width / 2, height / 2 - 80, 'GAME PAUSED', {
            fontSize: '32px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);
        this.pauseDialog.add(pauseTitle);
        
        // Resume button
        const resumeButton = this.add.text(width / 2, height / 2 - 20, 'Press here to resume', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#44ff44',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);
        resumeButton.setInteractive({ useHandCursor: true });
        resumeButton.on('pointerdown', () => {
            this.resumeGame();
        });
        resumeButton.on('pointerover', () => {
            resumeButton.setColor('#88ff88');
        });
        resumeButton.on('pointerout', () => {
            resumeButton.setColor('#44ff44');
        });
        this.pauseDialog.add(resumeButton);
        
        // Back to menu button
        const menuButton = this.add.text(width / 2, height / 2 + 40, 'Back to menu', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#ff4444',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);
        menuButton.setInteractive({ useHandCursor: true });
        menuButton.on('pointerdown', () => {
            // Stop ALL audio before returning to menu
            this.sound.stopAll();
            this.scene.start('MenuScene');
        });
        menuButton.on('pointerover', () => {
            menuButton.setColor('#ff8888');
        });
        menuButton.on('pointerout', () => {
            menuButton.setColor('#ff4444');
        });
        this.pauseDialog.add(menuButton);
        
        // Instructions for resuming
        const instructions = this.isMobile ? 
            'Tap "Press here to resume" or the ⏸ button' :
            'Press SPACE or click "Press here to resume"';
            
        const instructionText = this.add.text(width / 2, height / 2 + 80, instructions, {
            fontSize: '14px',
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);
        this.pauseDialog.add(instructionText);
    }
    
    hidePauseDialog() {
        if (this.pauseDialog) {
            this.pauseDialog.clear(true, true);
            this.pauseDialog = null;
        }
    }
    
    // Power-up indicator system
    createPowerUpIndicators() {
        // Position indicators below HP bar
        const indicatorY = 55; // Below HP bar at y=30+20
        const iconSize = 20;
        const spacing = 25;
        let startX = 20; // Align with HP label
        
        // Create indicator slots for each power-up type
        const powerUpTypes = ['invincibility', 'rapidFire', 'dualShot'];
        
        powerUpTypes.forEach((type, index) => {
            const x = startX + (index * spacing);
            
            // Create icon background (initially hidden)
            const bg = this.add.rectangle(x + iconSize/2, indicatorY, iconSize + 4, iconSize + 4, 0x333333, 0.8);
            bg.setScrollFactor(0);
            bg.setVisible(false);
            
            // Create the icon (try to use actual power-up texture, fallback to text)
            let icon;
            const textureKey = `powerup-${type}`;
            if (this.textures.exists(textureKey)) {
                icon = this.add.image(x + iconSize/2, indicatorY, textureKey);
                icon.setScale(iconSize / 32); // Assuming 32px source images
            } else {
                // Fallback to emoji/text icons
                const iconText = this.getPowerUpEmoji(type);
                icon = this.add.text(x + iconSize/2, indicatorY, iconText, {
                    fontSize: '16px',
                    fontFamily: 'Arial, sans-serif'
                }).setOrigin(0.5);
            }
            
            icon.setScrollFactor(0);
            icon.setVisible(false);
            
            // Timer text (shows remaining time)
            const timerText = this.add.text(x + iconSize/2, indicatorY + 15, '', {
                fontSize: '10px',
                fontFamily: 'Courier New, monospace',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0);
            timerText.setVisible(false);
            
            // Store references
            this.powerUpIndicators[type] = {
                background: bg,
                icon: icon,
                timer: timerText,
                isVisible: false
            };
        });
    }
    
    getPowerUpEmoji(type) {
        const emojis = {
            'invincibility': '🛡️',
            'rapidFire': '💥', 
            'dualShot': '🔫'
        };
        return emojis[type] || '?';
    }
    
    showPowerUpIndicator(type, duration) {
        const indicator = this.powerUpIndicators[type];
        if (!indicator) return;
        
        indicator.background.setVisible(true);
        indicator.icon.setVisible(true);
        indicator.timer.setVisible(true);
        indicator.isVisible = true;
        indicator.endTime = this.time.now + duration;
        
        // Add subtle pulse effect
        this.tweens.add({
            targets: [indicator.background, indicator.icon],
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Power2',
            yoyo: true
        });
    }
    
    hidePowerUpIndicator(type) {
        const indicator = this.powerUpIndicators[type];
        if (!indicator) return;
        
        indicator.background.setVisible(false);
        indicator.icon.setVisible(false);
        indicator.timer.setVisible(false);
        indicator.isVisible = false;
    }
    
    updatePowerUpIndicators() {
        const currentTime = this.time.now;
        
        // Update each indicator
        Object.keys(this.powerUpIndicators).forEach(type => {
            const indicator = this.powerUpIndicators[type];
            if (indicator.isVisible && indicator.endTime) {
                const remainingTime = Math.max(0, indicator.endTime - currentTime);
                
                if (remainingTime <= 0) {
                    this.hidePowerUpIndicator(type);
                } else {
                    // Update timer display
                    const seconds = Math.ceil(remainingTime / 1000);
                    indicator.timer.setText(seconds.toString());
                    
                    // Flash when almost expired (last 3 seconds)
                    if (seconds <= 3) {
                        const flashAlpha = Math.sin(currentTime / 100) * 0.5 + 0.5; // 0.0 to 1.0
                        indicator.icon.setAlpha(0.5 + flashAlpha * 0.5);
                    } else {
                        indicator.icon.setAlpha(1.0);
                    }
                }
            }
        });
    }
    
    createAnimatedZombieAnimations() {
        console.log('Creating animated zombie animations...');
        
        // Appear animation (11 frames) - plays once when spawning
        const appearFrames = [];
        for (let i = 1; i <= 11; i++) {
            appearFrames.push({ key: `zombie4-appear-${i}` });
        }
        this.anims.create({
            key: 'zombie4-appear',
            frames: appearFrames,
            frameRate: 12,
            repeat: 0 // Play once
        });
        
        // Idle animation (6 frames) - loops while not moving
        const idleFrames = [];
        for (let i = 1; i <= 6; i++) {
            idleFrames.push({ key: `zombie4-idle-${i}` });
        }
        this.anims.create({
            key: 'zombie4-idle',
            frames: idleFrames,
            frameRate: 6,
            repeat: -1 // Loop forever
        });
        
        // Walk animation (10 frames) - loops while moving
        const walkFrames = [];
        for (let i = 1; i <= 10; i++) {
            walkFrames.push({ key: `zombie4-walk-${i}` });
        }
        this.anims.create({
            key: 'zombie4-walk',
            frames: walkFrames,
            frameRate: 8,
            repeat: -1 // Loop forever
        });
        
        // Attack animation (7 frames) - plays once per attack
        const attackFrames = [];
        for (let i = 1; i <= 7; i++) {
            attackFrames.push({ key: `zombie4-attack-${i}` });
        }
        this.anims.create({
            key: 'zombie4-attack',
            frames: attackFrames,
            frameRate: 14,
            repeat: 0 // Play once
        });
        
        // Die animation (8 frames) - plays once when killed
        const dieFrames = [];
        for (let i = 1; i <= 8; i++) {
            dieFrames.push({ key: `zombie4-die-${i}` });
        }
        this.anims.create({
            key: 'zombie4-die',
            frames: dieFrames,
            frameRate: 10,
            repeat: 0 // Play once
        });
        
        console.log('Animated zombie animations created successfully');
    }
    
}