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

        // Responsive positioning based on screen height
        const isMobile = height < 600;
        const titleY = isMobile ? height * 0.08 : 100;
        const emojiY = isMobile ? height * 0.15 : 150;

        // New High Score title
        this.add.text(width / 2, titleY, 'NEW HIGH SCORE!', {
            fontSize: isMobile ? '28px' : '48px',
            fontFamily: 'Courier New, monospace',
            color: '#ffff00',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Celebration emojis
        this.add.text(width / 2, emojiY, '🎉 🏆 🎉', {
            fontSize: isMobile ? '24px' : '32px',
            align: 'center'
        }).setOrigin(0.5);

        // Score information with responsive positioning
        const scoreY = isMobile ? height * 0.25 : 220;
        const timeY = isMobile ? height * 0.32 : 260;
        const killsY = isMobile ? height * 0.39 : 300;
        const promptY = isMobile ? height * 0.48 : 380;
        const inputY = isMobile ? height * 0.56 : 430;
        const countY = isMobile ? height * 0.63 : 480;
        const instructY = isMobile ? height * 0.72 : 550;
        const buttonY = isMobile ? height * 0.85 : 620;

        const minutes = Math.floor(this.scoreData.time / 60);
        const seconds = this.scoreData.time % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.add.text(width / 2, scoreY, `Score: ${this.scoreData.score.toLocaleString()}`, {
            fontSize: isMobile ? '20px' : '28px',
            fontFamily: 'Courier New, monospace',
            color: '#00ff00',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(width / 2, timeY, `Survival Time: ${timeString}`, {
            fontSize: isMobile ? '16px' : '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffaa00',
            align: 'center'
        }).setOrigin(0.5);

        if (this.scoreData.zombiesKilled) {
            this.add.text(width / 2, killsY, `Zombies Killed: ${this.scoreData.zombiesKilled}`, {
                fontSize: isMobile ? '16px' : '24px',
                fontFamily: 'Courier New, monospace',
                color: '#ff6666',
                align: 'center'
            }).setOrigin(0.5);
        }

        // Name entry prompt
        this.add.text(width / 2, promptY, 'Enter your name:', {
            fontSize: isMobile ? '18px' : '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // Name input display
        this.nameText = this.add.text(width / 2, inputY, '', {
            fontSize: isMobile ? '24px' : '32px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 15, y: 8 },
            fixedWidth: isMobile ? width * 0.8 : 400,
            align: 'center'
        }).setOrigin(0.5);

        // Character count display
        this.characterCountText = this.add.text(width / 2, countY, `0/${this.maxNameLength}`, {
            fontSize: isMobile ? '12px' : '16px',
            fontFamily: 'Courier New, monospace',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5);

        // Instructions
        this.add.text(width / 2, instructY, 'Type your name and press ENTER to save\nESC to skip', {
            fontSize: isMobile ? '14px' : '18px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc',
            align: 'center',
            lineSpacing: 5
        }).setOrigin(0.5);

        // Submit and skip buttons
        const buttonSpacing = isMobile ? 80 : 100;
        const submitBtn = this.add.text(width / 2 - buttonSpacing, buttonY, 'SUBMIT', {
            fontSize: isMobile ? '18px' : '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#006600',
            padding: { x: 15, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.submitScore())
        .on('pointerover', () => submitBtn.setStyle({ backgroundColor: '#008800' }))
        .on('pointerout', () => submitBtn.setStyle({ backgroundColor: '#006600' }));

        const skipBtn = this.add.text(width / 2 + buttonSpacing, buttonY, 'SKIP', {
            fontSize: isMobile ? '18px' : '24px',
            fontFamily: 'Courier New, monospace',
            color: '#ffffff',
            backgroundColor: '#660000',
            padding: { x: 15, y: 8 }
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
        // Detect mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (('ontouchstart' in window) && (window.innerWidth <= 768 || window.innerHeight <= 768));

        if (isMobile) {
            // Create HTML input element for mobile keyboard
            this.createMobileInput();
        } else {
            // Desktop keyboard handling
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
    }

    createMobileInput() {
        // Disable Phaser keyboard input to prevent conflicts
        if (this.input.keyboard) {
            this.input.keyboard.enabled = false;
        }

        // Hide the Phaser name text since we'll use the native input
        this.nameText.setVisible(false);

        // Create a native HTML input element for mobile keyboard
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'text'; // Explicitly set input mode for mobile keyboards
        input.maxLength = this.maxNameLength;
        input.style.position = 'fixed';
        input.style.left = '50%';
        input.style.top = '50%';
        input.style.transform = 'translate(-50%, -50%)';
        input.style.width = '80%';
        input.style.maxWidth = '400px';
        input.style.fontSize = '24px';
        input.style.padding = '10px';
        input.style.border = '2px solid #ffffff';
        input.style.backgroundColor = '#333333';
        input.style.color = '#ffffff';
        input.style.fontFamily = 'Courier New, monospace';
        input.style.textAlign = 'center';
        input.style.zIndex = '100000';
        input.style.borderRadius = '5px';
        input.style.outline = 'none';
        input.placeholder = 'Enter your name';
        input.autocomplete = 'off';
        input.autocorrect = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        input.value = this.playerName || '';

        // Prevent any event bubbling that might interfere
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Prevent Phaser from receiving keyboard events

            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
                this.submitScore();
            }
        }, true); // Use capture phase

        input.addEventListener('keyup', (e) => {
            e.stopPropagation(); // Prevent Phaser from receiving keyboard events
        }, true);

        input.addEventListener('keypress', (e) => {
            e.stopPropagation(); // Prevent Phaser from receiving keyboard events
        }, true);

        // Handle input events - multiple events for better compatibility
        input.addEventListener('input', (e) => {
            this.playerName = e.target.value;
            this.characterCountText.setText(`${this.playerName.length}/${this.maxNameLength}`);

            // Update character count color
            if (this.playerName.length >= this.maxNameLength) {
                this.characterCountText.setColor('#ff6666');
            } else {
                this.characterCountText.setColor('#888888');
            }
        });

        // Also handle change event as fallback
        input.addEventListener('change', (e) => {
            this.playerName = e.target.value;
            this.characterCountText.setText(`${this.playerName.length}/${this.maxNameLength}`);
        });

        // Add to DOM and focus
        document.body.appendChild(input);
        this.mobileInput = input;

        // Focus after a small delay to ensure it works on iOS
        setTimeout(() => {
            input.focus();
            // iOS Safari requires additional click to focus
            input.click();
        }, 100);
    }

    cleanupMobileInput() {
        if (this.mobileInput) {
            this.mobileInput.remove();
            this.mobileInput = null;
        }

        // Re-enable Phaser keyboard input
        if (this.input.keyboard) {
            this.input.keyboard.enabled = true;
        }

        // Show the Phaser name text again (in case we return to this scene)
        if (this.nameText) {
            this.nameText.setVisible(true);
        }
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

        // Cleanup mobile input if it exists
        this.cleanupMobileInput();

        // Disable input during submission
        this.input.keyboard.removeAllListeners();
        
        // Show saving message
        const { width, height } = this.cameras.main;
        const isMobile = height < 600;
        const messageY = isMobile ? height * 0.95 : 700;
        const savingText = this.add.text(width / 2, messageY, 'Saving score...', {
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
        this.cleanupMobileInput();
        this.proceedToMenu();
    }

    showErrorMessage(message) {
        const { width, height } = this.cameras.main;
        const isMobile = height < 600;
        const errorY = isMobile ? height * 0.68 : 520;
        const errorText = this.add.text(width / 2, errorY, message, {
            fontSize: isMobile ? '14px' : '18px',
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
        // Clean up mobile input
        this.cleanupMobileInput();
        super.destroy();
    }
}