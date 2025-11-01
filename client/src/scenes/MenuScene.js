import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this.backgroundMusic = null;
        this.scrollingText = null;
        this.scrollTween = null;
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

        // Scrolling text with instructions and credits
        this.createScrollingText(width, height);

        // Start background music
        this.startBackgroundMusic();
    }

    createScrollingText(width, height) {
        const scrollText = 'WASD to Move • Mouse to aim • Made by Arthur, Valdemar, Kaare, and Claude • Survive as long as possible';
        
        // Create a seamless scrolling text by duplicating it with separator
        const seamlessText = scrollText + ' • ' + scrollText;
        
        // Create the scrolling text
        this.scrollingText = this.add.text(0, height * 0.95, seamlessText, {
            fontSize: '16px',
            fontFamily: 'Courier New, monospace',
            color: '#cccccc'
        });

        // Get the width of a single instance of the text (including separator)
        const singleTextWidth = this.scrollingText.width / 2;
        
        // Start positioned so the text begins at the left edge
        this.scrollingText.x = 0;

        // Create the tween for smooth scrolling
        this.scrollTween = this.tweens.add({
            targets: this.scrollingText,
            x: -singleTextWidth, // Move left by exactly one text width
            duration: 12000, // 12 seconds for smoother scrolling
            ease: 'Linear',
            repeat: -1, // Loop forever
            onRepeat: () => {
                // Reset position to start the seamless loop
                this.scrollingText.x = 0;
            }
        });
    }

    startBackgroundMusic() {
        // Stop any existing music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Initialize audio - will start after user interaction
        this.initializeAudio();
    }

    initializeAudio() {
        // Detect iOS
        const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        console.log('🔊 Initializing audio...', { isiOS, contextState: this.sound.context?.state });

        // Check if audio context needs to be unlocked
        if (this.sound.context && this.sound.context.state === 'suspended') {
            console.log('🔊 Audio context suspended, will start after user interaction');

            // Create a one-time event listener for any user interaction
            const unlockAudio = () => {
                console.log('🔊 User interaction detected, unlocking audio...');

                // For iOS: Resume context first, THEN create and play audio
                if (isiOS) {
                    console.log('🔊 iOS detected: Resuming context and playing synchronously');

                    // Resume context synchronously (don't wait for promise)
                    const resumePromise = this.sound.context.resume();

                    // Create and play audio synchronously in the same event handler
                    try {
                        if (!this.backgroundMusic) {
                            this.backgroundMusic = this.sound.add('zombie-theme', {
                                loop: true,
                                volume: 0.5
                            });
                            console.log('🔊 iOS: Audio object created');
                        }

                        // Play immediately (synchronously) - critical for iOS
                        this.backgroundMusic.play();
                        console.log('🔊 iOS: Audio play() called synchronously');
                    } catch (error) {
                        console.error('🔊 iOS: Failed to play audio:', error);
                    }

                    // Log when resume completes (async)
                    resumePromise.then(() => {
                        console.log('🔊 iOS: Audio context resumed successfully');
                        console.log('🔊 Audio context state:', this.sound.context.state);
                        console.log('🔊 Music playing:', this.backgroundMusic?.isPlaying);
                    }).catch(error => {
                        console.error('🔊 iOS: Failed to resume audio context:', error);
                    });
                } else {
                    // Other platforms: Resume context then play
                    this.sound.context.resume().then(() => {
                        console.log('🔊 Audio context resumed, starting background music');
                        this.startMenuMusic();
                    }).catch(error => {
                        console.error('🔊 Failed to resume audio context:', error);
                    });
                }

                // Remove listeners after first interaction
                this.input.off('pointerdown', unlockAudio);
                this.input.keyboard?.off('keydown', unlockAudio);
            };

            // Listen for any pointer or keyboard interaction
            this.input.once('pointerdown', unlockAudio);
            if (this.input.keyboard) {
                this.input.keyboard.once('keydown', unlockAudio);
            }
        } else {
            // Audio context is already unlocked
            console.log('🔊 Audio context ready, starting background music immediately');
            this.startMenuMusic();
        }
    }

    startMenuMusic() {
        try {
            if (!this.backgroundMusic) {
                this.backgroundMusic = this.sound.add('zombie-theme', {
                    loop: true,
                    volume: 0.5
                });
            }
            this.backgroundMusic.play();
            console.log('🔊 Menu music started successfully');
        } catch (error) {
            console.error('🔊 Failed to start menu music:', error);
        }
    }

    cleanupTweens() {
        // Clean up scrolling text tween
        if (this.scrollTween) {
            this.scrollTween.destroy();
            this.scrollTween = null;
        }
        if (this.scrollingText) {
            this.scrollingText = null;
        }
    }

    startGame() {
        // Stop ALL audio before switching scenes
        this.sound.stopAll();
        this.cleanupTweens();
        this.scene.start('GameScene');
    }

    showHighScores() {
        // Stop ALL audio before switching scenes
        this.sound.stopAll();
        this.cleanupTweens();
        this.scene.start('HighScoreScene');
    }
}