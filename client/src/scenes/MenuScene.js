import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this.backgroundMusic = null;
    }

    preload() {
        // Load menu assets
        this.load.image('loading_screen', 'assets/loading_screen.png');
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Loading screen background image
        const loadingScreen = this.add.image(width / 2, height / 2, 'loading_screen');
        loadingScreen.setDisplaySize(width, height);

        // Menu buttons
        const buttonStyle = {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        };

        // New Game button
        const newGameBtn = this.add.text(width / 2, height * 0.7, 'NEW GAME', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.startGame())
            .on('pointerover', () => newGameBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => newGameBtn.setStyle({ backgroundColor: '#333333' }));

        // High Scores button
        const highScoresBtn = this.add.text(width / 2, height * 0.8, 'HIGH SCORES', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showHighScores())
            .on('pointerover', () => highScoresBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => highScoresBtn.setStyle({ backgroundColor: '#333333' }));

        // Instructions
        this.add.text(width / 2, height * 0.95, 'WASD to move • Mouse to aim • Survive as long as possible!', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            align: 'center'
        }).setOrigin(0.5);

        // Start background music
        this.startBackgroundMusic();
    }

    startBackgroundMusic() {
        // Stop any existing music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Start menu theme music
        this.backgroundMusic = this.sound.add('zombie-theme', {
            loop: true,
            volume: 0.5
        });
        this.backgroundMusic.play();
    }

    startGame() {
        // Stop menu music before switching scenes
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        this.scene.start('GameScene');
    }

    showHighScores() {
        // TODO: Implement high scores display
        console.log('High scores coming soon!');
    }
}