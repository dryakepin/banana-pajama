import Phaser from 'phaser';

export default class HighScoreScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HighScoreScene' });
        this.backgroundMusic = null;
        this.highScores = [];
        this.scrollContainer = null;
        this.scrollY = 0;
        this.maxScrollY = 0;
        this.isDragging = false;
        this.lastPointerY = 0;
        this.isMobile = false;
    }

    preload() {
        // Load background music if needed
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    async create() {
        const { width, height } = this.cameras.main;

        // Detect mobile
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       (('ontouchstart' in window) && (window.innerWidth <= 768 || window.innerHeight <= 768));

        // Responsive sizing for mobile
        const titleSize = this.isMobile ? '32px' : '48px';
        const titleY = this.isMobile ? height * 0.04 : 60;

        // Dark background
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // Title
        this.add.text(width / 2, titleY, 'HIGH SCORES', {
            fontSize: titleSize,
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center',
            stroke: '#000000',
            strokeThickness: this.isMobile ? 2 : 3
        }).setOrigin(0.5);

        // Loading message
        const loadingText = this.add.text(width / 2, height / 2, 'Loading high scores...', {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // Load high scores from server
        try {
            await this.loadHighScores();
            loadingText.destroy();
            this.setupScrollableContainer();
            this.displayHighScores();
            this.setupScrolling();
        } catch (error) {
            console.error('Failed to load high scores:', error);
            loadingText.setText('Failed to load high scores\nCheck your connection');
            loadingText.setStyle({ color: '#ff4444' });
        }

        // Back button - more compact on mobile
        const backBtnY = this.isMobile ? height - 40 : height - 60;
        const backBtnSize = this.isMobile ? '18px' : '24px';
        const backBtn = this.add.text(width / 2, backBtnY, 'BACK TO MENU', {
            fontSize: backBtnSize,
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: this.isMobile ? { x: 15, y: 8 } : { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.returnToMenu())
        .on('pointerover', () => backBtn.setStyle({ backgroundColor: '#555555' }))
        .on('pointerout', () => backBtn.setStyle({ backgroundColor: '#333333' }));

        // Keyboard shortcut
        this.input.keyboard.on('keydown-ESC', () => this.returnToMenu());

        // Start background music
        this.startBackgroundMusic();
    }

    async loadHighScores() {
        const response = await fetch('/api/highscores?limit=10');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        this.highScores = data.data || [];
    }

    setupScrollableContainer() {
        const { width, height } = this.cameras.main;
        
        // Create a container for scrollable content
        this.scrollContainer = this.add.container(0, 0);
        this.scrollY = 0;
        
        // Calculate responsive spacing for mobile - optimized for maximum score visibility
        const titleAreaHeight = this.isMobile ? height * 0.10 : 120;
        const buttonAreaHeight = this.isMobile ? height * 0.10 : 100;
        const maskStartY = this.isMobile ? height * 0.10 : 130;
        const maskHeight = height - titleAreaHeight - buttonAreaHeight;
        
        // Create a mask to limit visible area
        this.scrollMask = this.make.graphics();
        this.scrollMask.fillStyle(0x1a1a2e);
        this.scrollMask.fillRect(0, maskStartY, width, maskHeight);
        
        // Apply mask to container
        this.scrollContainer.setMask(this.scrollMask.createGeometryMask());
        
        // Store mask info for scrolling setup
        this.maskStartY = maskStartY;
        this.maskHeight = maskHeight;
    }

    displayHighScores() {
        const { width, height } = this.cameras.main;
        
        // Responsive sizing for mobile
        const lineHeight = this.isMobile ? 26 : 35;
        const headerSize = this.isMobile ? '14px' : '18px';
        const scoreSize = this.isMobile ? '16px' : '20px';
        
        // Calculate start positions responsively - tighter spacing
        const headerY = this.isMobile ? height * 0.08 : 120;
        const startY = this.isMobile ? height * 0.11 : 150;
        
        // Clear container if recreating
        if (this.scrollContainer && this.scrollContainer.list.length > 0) {
            this.scrollContainer.removeAll(true);
        }

        // Headers (outside scroll container, fixed position) - compact on mobile
        const rankX = this.isMobile ? width * 0.08 : width / 2 - 200;
        const playerX = this.isMobile ? width * 0.23 : width / 2 - 120;
        const scoreX = this.isMobile ? width * 0.55 : width / 2 + 50;
        const timeX = this.isMobile ? width * 0.70 : width / 2 + 130;
        const killsX = this.isMobile ? width * 0.85 : width / 2 + 220;

        this.add.text(rankX, headerY, 'RANK', {
            fontSize: headerSize,
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(playerX, headerY, 'PLAYER', {
            fontSize: headerSize,
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(scoreX, headerY, 'SCORE', {
            fontSize: headerSize,
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(timeX, headerY, 'TIME', {
            fontSize: headerSize,
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(killsX, headerY, 'KILLS', {
            fontSize: headerSize,
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        // Display each high score inside scroll container
        this.highScores.forEach((score, index) => {
            const y = index * lineHeight; // Relative to container start
            const rank = index + 1;
            
            // Rank with medal emojis for top 3
            let rankText = rank.toString();
            let rankColor = '#ffffff';
            
            if (rank === 1) {
                rankText = '🥇';
                rankColor = '#ffd700';
            } else if (rank === 2) {
                rankText = '🥈';
                rankColor = '#c0c0c0';
            } else if (rank === 3) {
                rankText = '🥉';
                rankColor = '#cd7f32';
            }

            // Use responsive positions from headers
            const rankX = this.isMobile ? width * 0.08 : width / 2 - 200;
            const playerX = this.isMobile ? width * 0.23 : width / 2 - 120;
            const scoreX = this.isMobile ? width * 0.55 : width / 2 + 50;
            const timeX = this.isMobile ? width * 0.70 : width / 2 + 130;
            const killsX = this.isMobile ? width * 0.85 : width / 2 + 220;

            // Rank - position relative to container
            const rankTextObj = this.add.text(0, 0, rankText, {
                fontSize: scoreSize,
                fontFamily: 'Courier New, monospace',
                color: rankColor,
                fontStyle: rank <= 3 ? 'bold' : 'normal'
            });
            rankTextObj.setPosition(rankX, y);
            this.scrollContainer.add(rankTextObj);

            // Player name (truncate if too long on mobile)
            const maxNameLength = this.isMobile ? 8 : 12;
            const playerName = score.player_name.length > maxNameLength 
                ? score.player_name.substring(0, maxNameLength) + '...'
                : score.player_name;
            
            const playerTextObj = this.add.text(0, 0, playerName, {
                fontSize: scoreSize,
                fontFamily: 'Courier New, monospace',
                color: '#ffffff'
            });
            playerTextObj.setPosition(playerX, y);
            this.scrollContainer.add(playerTextObj);

            // Score with formatting
            const scoreTextObj = this.add.text(0, 0, score.score.toLocaleString(), {
                fontSize: scoreSize,
                fontFamily: 'Courier New, monospace',
                color: '#00ff00'
            });
            scoreTextObj.setPosition(scoreX, y);
            this.scrollContainer.add(scoreTextObj);

            // Survival time formatted as MM:SS
            const minutes = Math.floor(score.survival_time / 60);
            const seconds = score.survival_time % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const timeTextObj = this.add.text(0, 0, timeString, {
                fontSize: scoreSize,
                fontFamily: 'Courier New, monospace',
                color: '#ffaa00'
            });
            timeTextObj.setPosition(timeX, y);
            this.scrollContainer.add(timeTextObj);

            // Zombie kills
            const killsTextObj = this.add.text(0, 0, score.zombies_killed.toString(), {
                fontSize: scoreSize,
                fontFamily: 'Courier New, monospace',
                color: '#ff6666'
            });
            killsTextObj.setPosition(killsX, y);
            this.scrollContainer.add(killsTextObj);
        });
        
        // Calculate max scroll based on content height
        const contentHeight = this.highScores.length * lineHeight;
        const visibleHeight = this.maskHeight || (height - 250);
        this.maxScrollY = Math.max(0, contentHeight - visibleHeight);
        
        // Set initial position
        this.scrollContainer.setY(startY);
        
        // Add scroll indicator if content overflows
        if (this.maxScrollY > 0 && this.isMobile) {
            this.addScrollIndicator();
        }

        // If no scores available
        if (this.highScores.length === 0) {
            this.add.text(width / 2, height / 2, 'No high scores yet!\nBe the first to set a record!', {
                fontSize: '24px',
                fontFamily: 'Courier New, monospace',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 10
            }).setOrigin(0.5);
        }
    }

    setupScrolling() {
        const { width, height } = this.cameras.main;
        
        if (!this.scrollContainer || this.maxScrollY <= 0) {
            return; // No scrolling needed
        }

        // Create a scrollable zone (invisible interactive area) - use calculated mask dimensions
        const zoneCenterY = (this.maskStartY || 130) + (this.maskHeight || (height - 250)) / 2;
        const zoneHeight = this.maskHeight || (height - 250);
        const scrollZone = this.add.zone(width / 2, zoneCenterY, width, zoneHeight);
        scrollZone.setInteractive({ useHandCursor: false });
        
        // Track scrolling state
        let touchStartY = 0;
        let touchStartTime = 0;
        let lastScrollY = this.scrollY;
        let scrollVelocity = 0;
        let momentumTween = null;
        
        // Pointer down - start tracking
        scrollZone.on('pointerdown', (pointer) => {
            // Stop any existing momentum
            if (momentumTween) {
                momentumTween.stop();
                momentumTween = null;
            }
            
            this.isDragging = true;
            this.lastPointerY = pointer.y;
            touchStartY = pointer.y;
            touchStartTime = Date.now();
            lastScrollY = this.scrollY;
        });

        // Pointer move - scroll while dragging
        scrollZone.on('pointermove', (pointer) => {
            if (this.isDragging && pointer.isDown) {
                const deltaY = pointer.y - this.lastPointerY;
                const timeDelta = Date.now() - touchStartTime;
                
                // Calculate velocity for momentum
                if (timeDelta > 0) {
                    scrollVelocity = -deltaY / timeDelta * 16;
                }
                
                // Update scroll position
                this.scrollY = Phaser.Math.Clamp(
                    this.scrollY - deltaY,
                    0,
                    this.maxScrollY
                );
                
                // Move container - use responsive startY
                const startY = this.isMobile ? this.cameras.main.height * 0.11 : 150;
                this.scrollContainer.setY(startY - this.scrollY);
                this.updateScrollIndicator();
                
                this.lastPointerY = pointer.y;
                touchStartTime = Date.now();
            }
        });

        // Pointer up - apply momentum (mobile) or stop (desktop)
        scrollZone.on('pointerup', () => {
            this.isDragging = false;
            
            // Apply momentum scrolling on mobile
            if (this.isMobile && Math.abs(scrollVelocity) > 0.5) {
                let remainingMomentum = scrollVelocity * 20;
                let currentMomentum = remainingMomentum;
                
                momentumTween = this.tweens.addCounter({
                    from: 0,
                    to: remainingMomentum,
                    duration: Math.min(800, Math.abs(remainingMomentum) * 2),
                    ease: 'Power2',
                    onUpdate: (tween) => {
                        const delta = tween.getValue() - (tween.getPreviousValue() || 0);
                        this.scrollY = Phaser.Math.Clamp(
                            this.scrollY - delta,
                            0,
                            this.maxScrollY
                        );
                        const startY = this.isMobile ? this.cameras.main.height * 0.11 : 150;
                        this.scrollContainer.setY(startY - this.scrollY);
                        this.updateScrollIndicator();
                        
                        // Apply friction
                        currentMomentum *= 0.92;
                        if (Math.abs(currentMomentum) < 0.1) {
                            tween.stop();
                        }
                    },
                    onComplete: () => {
                        momentumTween = null;
                    }
                });
            }
            
            scrollVelocity = 0;
        });

        // Mouse wheel scrolling (for desktop)
        if (!this.isMobile) {
            scrollZone.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
                this.scrollY = Phaser.Math.Clamp(
                    this.scrollY - deltaY * 0.5, // Scale wheel sensitivity
                    0,
                    this.maxScrollY
                );
                const startY = this.isMobile ? this.cameras.main.height * 0.11 : 150;
                this.scrollContainer.setY(startY - this.scrollY);
                this.updateScrollIndicator();
            });
        }
    }

    addScrollIndicator() {
        const { width, height } = this.cameras.main;
        
        // Add text hint for mobile - more compact
        if (this.isMobile) {
            const hintY = this.isMobile ? height * 0.09 : 120;
            const hintText = this.add.text(width / 2, hintY, '↓ Swipe ↓', {
                fontSize: '12px',
                fontFamily: 'Courier New, monospace',
                color: '#888888',
                align: 'center'
            }).setOrigin(0.5);
            
            // Fade out after 2 seconds
            this.tweens.add({
                targets: hintText,
                alpha: 0,
                duration: 1500,
                delay: 2000,
                onComplete: () => hintText.destroy()
            });
        }
        
        // Add scrollbar indicator (optional visual feedback) - use responsive positioning
        const scrollbarX = width - (this.isMobile ? 10 : 15);
        const scrollbarCenterY = (this.maskStartY || 180) + (this.maskHeight || (height - 320)) / 2;
        this.scrollBar = this.add.rectangle(scrollbarX, scrollbarCenterY, this.isMobile ? 3 : 4, 60, 0x888888, 0.5);
        this.scrollBar.setDepth(1000);
        this.updateScrollIndicator();
    }

    updateScrollIndicator() {
        if (!this.scrollBar || this.maxScrollY <= 0) return;
        
        const { height } = this.cameras.main;
        const scrollAreaHeight = this.maskHeight || (height - 250);
        const lineHeight = this.isMobile ? 26 : 35;
        const contentHeight = this.highScores.length * lineHeight;
        const scrollbarHeight = Math.max(20, scrollAreaHeight * (scrollAreaHeight / (contentHeight + scrollAreaHeight)));
        const scrollbarStartY = this.maskStartY || 130;
        const scrollbarY = scrollbarStartY + (scrollAreaHeight * (this.scrollY / this.maxScrollY)) + scrollbarHeight / 2;
        
        this.scrollBar.setY(scrollbarY);
        this.scrollBar.setDisplaySize(this.isMobile ? 3 : 4, scrollbarHeight);
        
        // Update opacity based on scroll position
        if (this.scrollY > 5 || this.scrollY < this.maxScrollY - 5) {
            this.scrollBar.setAlpha(0.7);
        } else {
            this.scrollBar.setAlpha(0.3);
        }
    }

    startBackgroundMusic() {
        // Stop any existing music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Start menu theme music with proper audio context handling
        this.initializeAudio();
    }

    initializeAudio() {
        // Check if audio context needs to be unlocked
        if (this.sound.context && this.sound.context.state === 'suspended') {
            console.log('🔊 HighScore audio context suspended, will start after user interaction');
            
            // Create a one-time event listener for any user interaction
            const unlockAudio = () => {
                console.log('🔊 HighScore user interaction detected, unlocking audio...');
                this.sound.context.resume().then(() => {
                    console.log('🔊 HighScore audio context resumed, starting background music');
                    this.startHighScoreMusic();
                    
                    // Remove listeners after first interaction
                    this.input.off('pointerdown', unlockAudio);
                    this.input.keyboard?.off('keydown', unlockAudio);
                }).catch(error => {
                    console.error('🔊 HighScore failed to resume audio context:', error);
                });
            };
            
            // Listen for any pointer or keyboard interaction
            this.input.once('pointerdown', unlockAudio);
            if (this.input.keyboard) {
                this.input.keyboard.once('keydown', unlockAudio);
            }
        } else {
            // Audio context is already unlocked
            console.log('🔊 HighScore audio context ready, starting background music immediately');
            this.startHighScoreMusic();
        }
    }
    
    startHighScoreMusic() {
        try {
            this.backgroundMusic = this.sound.add('zombie-theme', {
                loop: true,
                volume: 0.3
            });
            this.backgroundMusic.play();
            console.log('🔊 HighScore music started successfully');
        } catch (error) {
            console.error('🔊 HighScore failed to start music:', error);
        }
    }

    returnToMenu() {
        // Music continues since menu uses same theme
        this.scene.start('MenuScene');
    }
}