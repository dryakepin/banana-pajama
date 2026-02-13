import Phaser from 'phaser';
import AudioManager from '../utils/AudioManager.js';

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
        this.finalScore = 0;
        this.survivalTime = 0;
        this.zombiesKilled = 0;
        this._audio = null;
    }

    init(data) {
        this.finalScore = data.score || 0;
        this.survivalTime = data.time || 0;
        this.zombiesKilled = data.zombiesKilled || 0;
    }

    preload() {
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    async create() {
        const { width, height } = this.cameras.main;

        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        this.add.text(width / 2, height / 4, 'GAME OVER', {
            fontSize: '64px',
            fontFamily: 'Courier New, monospace',
            color: '#ff4444',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 3, '\uD83C\uDF4C\uD83D\uDCA5\uD83C\uDF68', {
            fontSize: '48px',
            align: 'center'
        }).setOrigin(0.5);

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

        await this.checkHighScore();

        this._audio = AudioManager.playMusic(this, 'zombie-theme', { volume: 0.5 });
    }

    restartGame() {
        if (this._audio) this._audio.cleanup();
        this.sound.stopAll();
        this.scene.start('GameScene');
    }

    async checkHighScore() {
        try {
            const response = await fetch('/api/highscores?limit=10');
            if (!response.ok) {
                throw new Error(`Failed to fetch high scores: ${response.status}`);
            }

            const data = await response.json();
            const highScores = data.data || [];

            const isHighScore = highScores.length < 10 || this.finalScore > (highScores[highScores.length - 1]?.score || 0);

            if (isHighScore) {
                this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 100,
                    'NEW HIGH SCORE!', {
                    fontSize: '32px',
                    fontFamily: 'Courier New, monospace',
                    color: '#ffff00',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 2
                }).setOrigin(0.5);

                this.time.delayedCall(2000, () => {
                    if (this._audio) this._audio.cleanup();
                    this.sound.stopAll();
                    this.scene.start('NameEntryScene', {
                        score: this.finalScore,
                        time: this.survivalTime,
                        zombiesKilled: this.zombiesKilled
                    });
                });
            } else {
                this.showGameOverButtons();
            }
        } catch (error) {
            console.error('Error checking high score:', error);
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

        const tryAgainBtn = this.add.text(width / 2, height * 0.75, 'TRY AGAIN', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.restartGame())
            .on('pointerover', () => tryAgainBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => tryAgainBtn.setStyle({ backgroundColor: '#333333' }));

        const mainMenuBtn = this.add.text(width / 2, height * 0.85, 'MAIN MENU', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.returnToMenu())
            .on('pointerover', () => mainMenuBtn.setStyle({ backgroundColor: '#555555' }))
            .on('pointerout', () => mainMenuBtn.setStyle({ backgroundColor: '#333333' }));
    }

    returnToMenu() {
        this.scene.start('MenuScene');
    }
}
