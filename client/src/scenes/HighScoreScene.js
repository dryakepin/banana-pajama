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

        // Dark background
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // Title
        this.add.text(width / 2, 80, 'HIGH SCORES', {
            fontSize: '48px',
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Trophy emoji
        this.add.text(width / 2, 130, '🏆', {
            fontSize: '32px',
            align: 'center'
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

        // Back button
        const backBtn = this.add.text(width / 2, height - 80, 'BACK TO MENU', {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.returnToMenu())
        .on('pointerover', () => backBtn.setStyle({ backgroundColor: '#555555' }))
        .on('pointerout', () => backBtn.setStyle({ backgroundColor: '#333333' }));

        // Keyboard shortcut
        this.input.keyboard.on('keydown-ESC', () => this.returnToMenu());

        // Instructions
        this.add.text(width / 2, height - 40, 'ESC to return to main menu', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5);

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
        
        // Create a mask to limit visible area
        const maskHeight = height - 320; // Leave space for title and buttons
        this.scrollMask = this.make.graphics();
        this.scrollMask.fillStyle(0x1a1a2e);
        this.scrollMask.fillRect(0, 180, width, maskHeight);
        
        // Apply mask to container
        this.scrollContainer.setMask(this.scrollMask.createGeometryMask());
    }

    displayHighScores() {
        const { width, height } = this.cameras.main;
        const startY = 200;
        const lineHeight = 35;
        
        // Clear container if recreating
        if (this.scrollContainer && this.scrollContainer.list.length > 0) {
            this.scrollContainer.removeAll(true);
        }

        // Headers (outside scroll container, fixed position)
        const headerY = startY - 30;
        this.add.text(width / 2 - 200, headerY, 'RANK', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 - 120, headerY, 'PLAYER', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 + 50, headerY, 'SCORE', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 + 130, headerY, 'TIME', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 + 220, headerY, 'KILLS', {
            fontSize: '18px',
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

            // Rank - position relative to container
            const rankTextObj = this.add.text(0, 0, rankText, {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: rankColor,
                fontStyle: rank <= 3 ? 'bold' : 'normal'
            });
            rankTextObj.setPosition(width / 2 - 200, y);
            this.scrollContainer.add(rankTextObj);

            // Player name (truncate if too long on mobile)
            const maxNameLength = this.isMobile ? 10 : 12;
            const playerName = score.player_name.length > maxNameLength 
                ? score.player_name.substring(0, maxNameLength) + '...'
                : score.player_name;
            
            const playerTextObj = this.add.text(0, 0, playerName, {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#ffffff'
            });
            playerTextObj.setPosition(width / 2 - 120, y);
            this.scrollContainer.add(playerTextObj);

            // Score with formatting
            const scoreTextObj = this.add.text(0, 0, score.score.toLocaleString(), {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#00ff00'
            });
            scoreTextObj.setPosition(width / 2 + 50, y);
            this.scrollContainer.add(scoreTextObj);

            // Survival time formatted as MM:SS
            const minutes = Math.floor(score.survival_time / 60);
            const seconds = score.survival_time % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const timeTextObj = this.add.text(0, 0, timeString, {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#ffaa00'
            });
            timeTextObj.setPosition(width / 2 + 130, y);
            this.scrollContainer.add(timeTextObj);

            // Zombie kills
            const killsTextObj = this.add.text(0, 0, score.zombies_killed.toString(), {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#ff6666'
            });
            killsTextObj.setPosition(width / 2 + 220, y);
            this.scrollContainer.add(killsTextObj);
        });
        
        // Calculate max scroll based on content height
        const contentHeight = this.highScores.length * lineHeight;
        const visibleHeight = height - 320; // Space for title, headers, buttons
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

        // Create a scrollable zone (invisible interactive area)
        const scrollZone = this.add.zone(width / 2, 180 + (height - 320) / 2, width, height - 320);
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
                
                // Move container
                this.scrollContainer.setY(200 - this.scrollY);
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
                        this.scrollContainer.setY(200 - this.scrollY);
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
                this.scrollContainer.setY(200 - this.scrollY);
                this.updateScrollIndicator();
            });
        }
    }

    addScrollIndicator() {
        const { width, height } = this.cameras.main;
        
        // Add text hint for mobile
        if (this.isMobile) {
            const hintText = this.add.text(width / 2, 170, 'Swipe to scroll', {
                fontSize: '14px',
                fontFamily: 'Courier New, monospace',
                color: '#888888',
                align: 'center'
            }).setOrigin(0.5);
            
            // Fade out after 3 seconds
            this.tweens.add({
                targets: hintText,
                alpha: 0,
                duration: 2000,
                delay: 3000,
                onComplete: () => hintText.destroy()
            });
        }
        
        // Add scrollbar indicator (optional visual feedback)
        this.scrollBar = this.add.rectangle(width - 15, 180 + (height - 320) / 2, 4, 60, 0x888888, 0.5);
        this.scrollBar.setDepth(1000);
        this.updateScrollIndicator();
    }

    updateScrollIndicator() {
        if (!this.scrollBar || this.maxScrollY <= 0) return;
        
        const { height } = this.cameras.main;
        const scrollAreaHeight = height - 320;
        const scrollbarHeight = Math.max(30, scrollAreaHeight * (scrollAreaHeight / (this.highScores.length * 35 + scrollAreaHeight)));
        const scrollbarY = 180 + (scrollAreaHeight * (this.scrollY / this.maxScrollY)) + scrollbarHeight / 2;
        
        this.scrollBar.setY(scrollbarY);
        this.scrollBar.setDisplaySize(4, scrollbarHeight);
        
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