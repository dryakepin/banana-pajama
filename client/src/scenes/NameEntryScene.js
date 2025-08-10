import Phaser from 'phaser';

export default class NameEntryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'NameEntryScene' });
        this.backgroundMusic = null;
        this.playerName = '';
        this.maxNameLength = 20;
        this.scoreData = null;
        this.nameText = null;
        this.cursor = '|';
        this.cursorTimer = null;
        this.showCursor = true;
    }

    init(data) {
        this.scoreData = data;
    }

    preload() {
        // Load background music if needed
        this.load.audio('zombie-theme', 'assets/zombie-theme.mp3');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Dark background
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // New High Score title
        this.add.text(width / 2, 100, 'NEW HIGH SCORE!', {
            fontSize: '48px',
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Celebration emojis
        this.add.text(width / 2, 150, '🎉 🏆 🎉', {
            fontSize: '32px',
            align: 'center'
        }).setOrigin(0.5);

        // Score information
        const minutes = Math.floor(this.scoreData.time / 60);
        const seconds = this.scoreData.time % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.add.text(width / 2, 220, `Score: ${this.scoreData.score.toLocaleString()}`, {
            fontSize: '28px',
            fontFamily: 'Courier New, monospace',
            color: '#00ff00',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(width / 2, 260, `Survival Time: ${timeString}`, {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffaa00',
            align: 'center'
        }).setOrigin(0.5);

        if (this.scoreData.zombiesKilled) {
            this.add.text(width / 2, 300, `Zombies Killed: ${this.scoreData.zombiesKilled}`, {
                fontSize: '24px',
                fontFamily: 'Courier New, monospace',
                color: '#ff6666',
                align: 'center'
            }).setOrigin(0.5);
        }

        // Name entry prompt
        this.add.text(width / 2, 380, 'Enter your name:', {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // Name input display
        this.nameText = this.add.text(width / 2, 430, '', {
            fontSize: '32px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 },
            fixedWidth: 400,
            align: 'center'
        }).setOrigin(0.5);

        // Character count display
        this.characterCountText = this.add.text(width / 2, 480, `0/${this.maxNameLength}`, {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5);

        // Instructions
        this.add.text(width / 2, 550, 'Type your name and press ENTER to save\nESC to skip', {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            align: 'center',
            lineSpacing: 5
        }).setOrigin(0.5);

        // Submit and skip buttons
        const submitBtn = this.add.text(width / 2 - 100, 620, 'SUBMIT', {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#006600',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.submitScore())
        .on('pointerover', () => submitBtn.setStyle({ backgroundColor: '#008800' }))
        .on('pointerout', () => submitBtn.setStyle({ backgroundColor: '#006600' }));

        const skipBtn = this.add.text(width / 2 + 100, 620, 'SKIP', {
            fontSize: '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#660000',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.skipScore())
        .on('pointerover', () => skipBtn.setStyle({ backgroundColor: '#880000' }))
        .on('pointerout', () => skipBtn.setStyle({ backgroundColor: '#660000' }));

        // Set up keyboard input
        this.setupKeyboardInput();

        // Start cursor blinking timer
        this.cursorTimer = this.time.addEvent({
            delay: 500,
            callback: this.toggleCursor,
            callbackScope: this,
            loop: true
        });

        // Update display
        this.updateNameDisplay();

        // Start background music
        this.startBackgroundMusic();
    }

    setupKeyboardInput() {
        // Handle text input
        this.input.keyboard.on('keydown', (event) => {
            const key = event.key;
            
            if (key === 'Enter') {
                this.submitScore();
            } else if (key === 'Escape') {
                this.skipScore();
            } else if (key === 'Backspace') {
                if (this.playerName.length > 0) {
                    this.playerName = this.playerName.slice(0, -1);
                    this.updateNameDisplay();
                }
            } else if (key.length === 1 && this.playerName.length < this.maxNameLength) {
                // Only allow alphanumeric characters and basic symbols
                if (/^[a-zA-Z0-9 \-_.]$/.test(key)) {
                    this.playerName += key;
                    this.updateNameDisplay();
                }
            }
        });
    }

    updateNameDisplay() {
        const displayName = this.playerName + (this.showCursor ? this.cursor : ' ');
        this.nameText.setText(displayName);
        this.characterCountText.setText(`${this.playerName.length}/${this.maxNameLength}`);
        
        // Update character count color based on limit
        if (this.playerName.length >= this.maxNameLength) {
            this.characterCountText.setColor('#ff6666');
        } else {
            this.characterCountText.setColor('#888888');
        }
    }

    toggleCursor() {
        this.showCursor = !this.showCursor;
        this.updateNameDisplay();
    }

    async submitScore() {
        // Validate name
        const trimmedName = this.playerName.trim();
        if (trimmedName.length === 0) {
            // Show error message
            this.showErrorMessage('Please enter a name!');
            return;
        }

        // Disable input during submission
        this.input.keyboard.removeAllListeners();
        
        // Show saving message
        const savingText = this.add.text(this.cameras.main.width / 2, 700, 'Saving score...', {
            fontSize: '20px',
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center'
        }).setOrigin(0.5);

        try {
            const response = await fetch('/api/highscores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    player_name: trimmedName,
                    score: this.scoreData.score,
                    survival_time: this.scoreData.time,
                    zombies_killed: this.scoreData.zombiesKilled || 0
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Score saved successfully:', result);

            // Success message
            savingText.setText(`Score saved! You're rank #${result.data.rank}!`);
            savingText.setColor('#00ff00');

            // Wait a moment then proceed
            this.time.delayedCall(2000, () => {
                this.proceedToMenu();
            });

        } catch (error) {
            console.error('Failed to save score:', error);
            savingText.setText('Failed to save score. Check connection.');
            savingText.setColor('#ff4444');
            
            // Re-enable input after error
            this.time.delayedCall(2000, () => {
                savingText.destroy();
                this.setupKeyboardInput();
            });
        }
    }

    skipScore() {
        this.proceedToMenu();
    }

    showErrorMessage(message) {
        const errorText = this.add.text(this.cameras.main.width / 2, 520, message, {
            fontSize: '18px',
            fontFamily: 'Courier New, monospace',
            color: '#ff4444',
            align: 'center'
        }).setOrigin(0.5);

        // Remove error message after 3 seconds
        this.time.delayedCall(3000, () => {
            errorText.destroy();
        });
    }

    proceedToMenu() {
        // Clean up timer
        if (this.cursorTimer) {
            this.cursorTimer.destroy();
        }
        
        // Go to main menu
        this.scene.start('MenuScene');
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

    destroy() {
        // Clean up timer when scene is destroyed
        if (this.cursorTimer) {
            this.cursorTimer.destroy();
        }
        super.destroy();
    }
}