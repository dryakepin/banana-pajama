import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.score = 0;
        this.gameTime = 0;
        this.hp = 100;
    }

    preload() {
        // Load game assets
        this.load.image('banana', 'assets/banana.png');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Dark city background
        this.add.rectangle(width / 2, height / 2, width, height, 0x0f0f23);

        // Create player (banana)
        this.player = this.physics.add.sprite(width / 2, height / 2, 'banana');
        this.player.setScale(0.1);
        this.player.setCollideWorldBounds(true);

        // Create cursor keys
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');

        // Create UI
        this.createUI();

        // Start game timer
        this.gameTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });

        // Mouse controls for aiming
        this.input.on('pointermove', (pointer) => {
            // Player always faces mouse cursor
            const angle = Phaser.Math.Angle.Between(
                this.player.x, this.player.y,
                pointer.x + this.cameras.main.scrollX,
                pointer.y + this.cameras.main.scrollY
            );
            this.player.setRotation(angle);
        });

        // Instructions
        this.add.text(width / 2, height - 30, 'WASD to move • Mouse to aim • ESC for menu', {
            fontSize: '14px',
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);

        // ESC to return to menu
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('MenuScene');
        });
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

        // Score
        this.scoreText = this.add.text(width / 2, 30, 'Score: 0', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);

        // Timer
        this.timerText = this.add.text(width - 20, 30, 'Time: 00:00', {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: 'right'
        }).setOrigin(1, 0).setScrollFactor(0);
    }

    update() {
        this.handleMovement();
        this.updateUI();
    }

    handleMovement() {
        const speed = 200;
        let velocityX = 0;
        let velocityY = 0;

        // WASD movement
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

    gameOver() {
        this.scene.start('GameOverScene', { 
            score: this.score, 
            time: this.gameTime 
        });
    }
}