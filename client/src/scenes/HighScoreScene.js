import Phaser from 'phaser';

export default class HighScoreScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HighScoreScene' });
        this.backgroundMusic = null;
        this.highScores = [];
    }

    preload() {
        // Load background music if needed
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    async create() {
        const { width, height } = this.cameras.main;

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
            this.displayHighScores();
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

    displayHighScores() {
        const { width, height } = this.cameras.main;
        const startY = 200;
        const lineHeight = 35;

        // Headers
        this.add.text(width / 2 - 200, startY - 30, 'RANK', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 - 120, startY - 30, 'PLAYER', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 + 50, startY - 30, 'SCORE', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 + 130, startY - 30, 'TIME', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        this.add.text(width / 2 + 220, startY - 30, 'KILLS', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            fontStyle: 'bold'
        });

        // Display each high score
        this.highScores.forEach((score, index) => {
            const y = startY + (index * lineHeight);
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

            // Rank
            this.add.text(width / 2 - 200, y, rankText, {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: rankColor,
                fontStyle: rank <= 3 ? 'bold' : 'normal'
            });

            // Player name (truncate if too long)
            const playerName = score.player_name.length > 12 
                ? score.player_name.substring(0, 12) + '...'
                : score.player_name;
            
            this.add.text(width / 2 - 120, y, playerName, {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#ffffff'
            });

            // Score with formatting
            this.add.text(width / 2 + 50, y, score.score.toLocaleString(), {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#00ff00'
            });

            // Survival time formatted as MM:SS
            const minutes = Math.floor(score.survival_time / 60);
            const seconds = score.survival_time % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            this.add.text(width / 2 + 130, y, timeString, {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#ffaa00'
            });

            // Zombie kills
            this.add.text(width / 2 + 220, y, score.zombies_killed.toString(), {
                fontSize: '20px',
                fontFamily: 'Courier New, monospace',
                color: '#ff6666'
            });
        });

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

    startBackgroundMusic() {
        // Stop any existing music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Start menu theme music
        this.backgroundMusic = this.sound.add('zombie-theme', {
            loop: true,
            volume: 0.3
        });
        this.backgroundMusic.play();
    }

    returnToMenu() {
        // Music continues since menu uses same theme
        this.scene.start('MenuScene');
    }
}