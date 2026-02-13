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
        this.load.image('loading_screen', 'assets/loading_screen.png');
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Loading screen background image
        const loadingScreen = this.add.image(width / 2, height / 2, 'loading_screen');
        loadingScreen.setDisplaySize(width, height);

        const buttonStyle = {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        };

        const newGameBtn = this.add.text(width / 2, height * 0.7, 'NEW GAME', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.startGame())
            .on('pointerover', () => newGameBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => newGameBtn.setStyle({ backgroundColor: '#333333' }));

        const highScoresBtn = this.add.text(width / 2, height * 0.8, 'HIGH SCORES', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showHighScores())
            .on('pointerover', () => highScoresBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => highScoresBtn.setStyle({ backgroundColor: '#333333' }));

        this.createScrollingText(width, height);

        // Start background music via shared manager
        this._audio = AudioManager.playMusic(this, 'zombie-theme', { volume: 0.5 });
    }

    createScrollingText(width, height) {
        const scrollText = 'WASD to Move \u2022 Mouse to aim \u2022 Made by Arthur, Valdemar, Kaare, and Claude \u2022 Survive as long as possible';
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
        this.scene.start('GameScene');
    }

    showHighScores() {
        if (this._audio) this._audio.cleanup();
        this.sound.stopAll();
        this.cleanupTweens();
        this.scene.start('HighScoreScene');
    }
}
