import Phaser from 'phaser';

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
        this.finalScore = 0;
        this.survivalTime = 0;
        this.zombiesKilled = 0;
        this.backgroundMusic = null;
        this.minHighScore = null; // Will store the minimum score needed for top 10
    }

    init(data) {
        this.finalScore = data.score || 0;
        this.survivalTime = data.time || 0;
        this.zombiesKilled = data.zombiesKilled || 0;
    }

    preload() {
        // Load any game over assets if needed
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    async create() {
        const { width, height } = this.cameras.main;

        // Dark background
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // Game Over title
        this.add.text(width / 2, height / 4, 'GAME OVER', {
            fontSize: '64px',
            fontFamily: 'Courier New, monospace',
            color: '#ff4444',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Banana split animation placeholder
        this.add.text(width / 2, height / 3, '🍌💥🍨', {
            fontSize: '48px',
            align: 'center'
        }).setOrigin(0.5);

        // Score display
        const minutes = Math.floor(this.survivalTime / 60);
        const seconds = this.survivalTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.add.text(width / 2, height / 2 - 20, `Final Score: ${this.finalScore.toLocaleString()}`, {
            fontSize: '28px',
            fontFamily: 'Courier New, monospace',
            color: '#00ff00',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 20, `Survival Time: ${timeString}`, {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffaa00',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 50, `Zombies Killed: ${this.zombiesKilled}`, {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ff6666',
            align: 'center'
        }).setOrigin(0.5);

        // Check for high score
        await this.checkHighScore();

        // Start background music (same as menu)
        this.startBackgroundMusic();
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
            console.log('🔊 GameOver audio context suspended, will start after user interaction');
            
            // Create a one-time event listener for any user interaction
            const unlockAudio = () => {
                console.log('🔊 GameOver user interaction detected, unlocking audio...');
                this.sound.context.resume().then(() => {
                    console.log('🔊 GameOver audio context resumed, starting background music');
                    this.startGameOverMusic();
                    
                    // Remove listeners after first interaction
                    this.input.off('pointerdown', unlockAudio);
                    this.input.keyboard?.off('keydown', unlockAudio);
                }).catch(error => {
                    console.error('🔊 GameOver failed to resume audio context:', error);
                });
            };
            
            // Listen for any pointer or keyboard interaction
            this.input.once('pointerdown', unlockAudio);
            if (this.input.keyboard) {
                this.input.keyboard.once('keydown', unlockAudio);
            }
        } else {
            // Audio context is already unlocked
            console.log('🔊 GameOver audio context ready, starting background music immediately');
            this.startGameOverMusic();
        }
    }
    
    startGameOverMusic() {
        try {
            this.backgroundMusic = this.sound.add('zombie-theme', {
                loop: true,
                volume: 0.5
            });
            this.backgroundMusic.play();
            console.log('🔊 GameOver music started successfully');
        } catch (error) {
            console.error('🔊 GameOver failed to start music:', error);
        }
    }

    restartGame() {
        // Stop music before switching to game
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        this.scene.start('GameScene');
    }

    async checkHighScore() {
        try {
            // Fetch current high scores to check if player qualifies
            const response = await fetch('/api/highscores?limit=10');
            if (!response.ok) {
                throw new Error(`Failed to fetch high scores: ${response.status}`);
            }
            
            const data = await response.json();
            const highScores = data.data || [];
            
            // Check if player's score qualifies for top 10
            const isHighScore = highScores.length < 10 || this.finalScore > (highScores[highScores.length - 1]?.score || 0);
            
            if (isHighScore) {
                // Player achieved a high score - transition to name entry
                this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 100, 
                    '🎉 NEW HIGH SCORE! 🎉', {
                    fontSize: '32px',
                    fontFamily: 'Courier New, monospace',
                    color: '#ffff00',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                
                // Wait a moment then transition to name entry
                this.time.delayedCall(2000, () => {
                    if (this.backgroundMusic) {
                        this.backgroundMusic.stop();
                    }
                    this.scene.start('NameEntryScene', {
                        score: this.finalScore,
                        time: this.survivalTime,
                        zombiesKilled: this.zombiesKilled
                    });
                });
            } else {
                // Regular game over - show standard buttons
                this.showGameOverButtons();
            }
        } catch (error) {
            console.error('Error checking high score:', error);
            // Fallback to normal game over if API fails
            this.showGameOverButtons();
        }
    }
    
    showGameOverButtons() {
        const { width, height } = this.cameras.main;
        
        const buttonStyle = {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        };
        
        // Try Again button
        const tryAgainBtn = this.add.text(width / 2, height * 0.75, 'TRY AGAIN', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.restartGame())
            .on('pointerover', () => tryAgainBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => tryAgainBtn.setStyle({ backgroundColor: '#333333' }));

        // Main Menu button
        const mainMenuBtn = this.add.text(width / 2, height * 0.85, 'MAIN MENU', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.returnToMenu())
            .on('pointerover', () => mainMenuBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => mainMenuBtn.setStyle({ backgroundColor: '#333333' }));
    }

    returnToMenu() {
        // Music continues since menu uses same theme
        this.scene.start('MenuScene');
    }
}