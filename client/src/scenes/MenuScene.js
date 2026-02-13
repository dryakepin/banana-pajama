import Phaser from 'phaser';
import AudioManager from '../utils/AudioManager.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this._audio = null;
        this.scrollingText = null;
        this.scrollTween = null;
    }

    preload() {
        this.load.image('loading_screen', 'assets/loading_screen.jpg');
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Loading screen background image
        this.loadingScreen = this.add.image(width / 2, height / 2, 'loading_screen');
        this.loadingScreen.setDisplaySize(width, height);

        const buttonStyle = {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        };

        this.newGameBtn = this.add.text(width / 2, height * 0.7, 'NEW GAME', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.startGame())
            .on('pointerover', () => this.newGameBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => this.newGameBtn.setStyle({ backgroundColor: '#333333' }));

        this.highScoresBtn = this.add.text(width / 2, height * 0.8, 'HIGH SCORES', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showHighScores())
            .on('pointerover', () => this.highScoresBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => this.highScoresBtn.setStyle({ backgroundColor: '#333333' }));

        this.createScrollingText(width, height);

        // Handle viewport resize (mobile browsers changing UI, orientation, etc.)
        this.scale.on('resize', this.handleResize, this);

        // Start background music via shared manager
        this._audio = AudioManager.playMusic(this, 'zombie-theme', { volume: 0.2 });
    }

    handleResize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        // Reposition and resize background
        if (this.loadingScreen) {
            this.loadingScreen.setPosition(width / 2, height / 2);
            this.loadingScreen.setDisplaySize(width, height);
        }

        // Reposition buttons
        if (this.newGameBtn) {
            this.newGameBtn.setPosition(width / 2, height * 0.7);
        }
        if (this.highScoresBtn) {
            this.highScoresBtn.setPosition(width / 2, height * 0.8);
        }

        // Reposition scroll text
        if (this.scrollingText) {
            this.scrollingText.y = height * 0.95;
        }
    }

    createScrollingText(width, height) {
        /* global __BUILD_VERSION__, __BUILD_DATE__ */
        const version = typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev';
        const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';
        const scrollText = `WASD to Move \u2022 Mouse to aim \u2022 Made by Arthur, Valdemar, Kaare, and Claude \u2022 Survive as long as possible \u2022 v${version} (${buildDate})`;
        const seamlessText = scrollText + ' \u2022 ' + scrollText;

        this.scrollingText = this.add.text(0, height * 0.95, seamlessText, {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc'
        });

        const singleTextWidth = this.scrollingText.width / 2;
        this.scrollingText.x = 0;

        this.scrollTween = this.tweens.add({
            targets: this.scrollingText,
            x: -singleTextWidth,
            duration: 12000,
            ease: 'Linear',
            repeat: -1,
            onRepeat: () => {
                this.scrollingText.x = 0;
            }
        });
    }

    cleanupTweens() {
        if (this.scrollTween) {
            this.scrollTween.destroy();
            this.scrollTween = null;
        }
        this.scrollingText = null;
    }

    startGame() {
        if (this._audio) this._audio.cleanup();
        this.sound.stopAll();
        this.cleanupTweens();
        this.scale.off('resize', this.handleResize, this);
        this.scene.start('GameScene');
    }

    showHighScores() {
        if (this._audio) this._audio.cleanup();
        this.sound.stopAll();
        this.cleanupTweens();
        this.scale.off('resize', this.handleResize, this);
        this.scene.start('HighScoreScene');
    }
}
