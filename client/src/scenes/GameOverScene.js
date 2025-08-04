import Phaser from 'phaser';

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
        this.finalScore = 0;
        this.survivalTime = 0;
        this.backgroundMusic = null;
    }

    init(data) {
        this.finalScore = data.score || 0;
        this.survivalTime = data.time || 0;
    }

    preload() {
        // Load any game over assets if needed
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    create() {
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

        this.add.text(width / 2, height / 2, `Final Score: ${this.finalScore}\\nSurvival Time: ${timeString}`, {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: 'center',
            lineSpacing: 10
        }).setOrigin(0.5);

        // Check if this is a high score (placeholder logic)
        const isHighScore = this.finalScore > 1000; // TODO: Check against actual high scores
        
        if (isHighScore) {
            this.add.text(width / 2, height * 0.65, 'NEW HIGH SCORE!', {
                fontSize: '32px',
                fontFamily: 'Courier New, monospace',
                color: '#ffff00',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            // TODO: Add name input for high score
        }

        // Buttons
        const buttonStyle = {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        };

        // Try Again button
        const tryAgainBtn = this.add.text(width / 2 - 100, height * 0.8, 'TRY AGAIN', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.restartGame())
            .on('pointerover', () => tryAgainBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => tryAgainBtn.setStyle({ backgroundColor: '#333333' }));

        // Main Menu button
        const mainMenuBtn = this.add.text(width / 2 + 100, height * 0.8, 'MAIN MENU', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.returnToMenu())
            .on('pointerover', () => mainMenuBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => mainMenuBtn.setStyle({ backgroundColor: '#333333' }));

        // Keyboard shortcuts
        this.input.keyboard.on('keydown-SPACE', () => this.restartGame());
        this.input.keyboard.on('keydown-ESC', () => this.returnToMenu());

        // Instructions
        this.add.text(width / 2, height * 0.95, 'SPACE to play again • ESC for main menu', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5);

        // Start background music (same as menu)
        this.startBackgroundMusic();
    }

    startBackgroundMusic() {
        // Stop any existing music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Start menu theme music (same as menu screen)
        this.backgroundMusic = this.sound.add('zombie-theme', {
            loop: true,
            volume: 0.5
        });
        this.backgroundMusic.play();
    }

    restartGame() {
        // Stop music before switching to game
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        this.scene.start('GameScene');
    }

    returnToMenu() {
        // Music continues since menu uses same theme
        this.scene.start('MenuScene');
    }
}