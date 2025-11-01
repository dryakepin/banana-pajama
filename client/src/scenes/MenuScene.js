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
                console.log('🔊 Audio system status:', {
                    soundSystemReady: !!this.sound,
                    contextExists: !!this.sound?.context,
                    contextState: this.sound?.context?.state,
                    audioCache: this.cache?.audio?.exists('zombie-theme'),
                    isiOS
                });

                // For iOS: Resume context first, THEN create and play audio
                // CRITICAL: Everything must happen synchronously in this handler
                if (isiOS) {
                    console.log('🔊 iOS detected: Resuming context and playing synchronously');

                    // Step 1: Resume context (returns promise, but don't wait)
                    let resumePromise;
                    if (this.sound.context && this.sound.context.state === 'suspended') {
                        resumePromise = this.sound.context.resume();
                        console.log('🔊 iOS: Context resume() called');
                    } else if (this.sound.context) {
                        console.log('🔊 iOS: Context already active, state:', this.sound.context.state);
                    } else {
                        console.log('🔊 iOS: No WebAudio context, will use HTML5 Audio');
                    }

                    // Step 2: Create and play audio SYNCHRONOUSLY in user interaction handler
                    // This is CRITICAL - iOS only allows audio playback if initiated
                    // synchronously within a user interaction event handler
                    try {
                        // Check if audio is loaded
                        const audioLoaded = this.cache.audio.exists('zombie-theme');
                        console.log('🔊 iOS: Audio loaded check:', audioLoaded);
                        
                        if (!audioLoaded) {
                            console.error('🔊 iOS: Audio file not loaded! Cannot play.');
                            console.log('🔊 iOS: Available audio files:', this.cache.audio.getKeys());
                            return; // Can't play if not loaded
                        }
                        
                        // Stop any existing music first
                        if (this.backgroundMusic) {
                            this.backgroundMusic.stop();
                            this.backgroundMusic.destroy();
                            this.backgroundMusic = null;
                            console.log('🔊 iOS: Stopped existing music');
                        }

                        // Create new sound object synchronously
                        console.log('🔊 iOS: Creating audio object...');
                        this.backgroundMusic = this.sound.add('zombie-theme', {
                            loop: true,
                            volume: 0.5
                        });
                        console.log('🔊 iOS: Audio object created synchronously', {
                            soundExists: !!this.backgroundMusic,
                            soundType: this.backgroundMusic?.constructor?.name
                        });

                        // Play IMMEDIATELY (synchronously) - MUST be in user interaction handler
                        const playResult = this.backgroundMusic.play();
                        console.log('🔊 iOS: Audio play() called synchronously', {
                            returnedValue: playResult,
                            isPlayingImmediate: this.backgroundMusic?.isPlaying
                        });
                        
                        // Verify it's actually playing
                        setTimeout(() => {
                            console.log('🔊 iOS: Audio status check (after 100ms):', {
                                isPlaying: this.backgroundMusic?.isPlaying,
                                isPaused: this.backgroundMusic?.isPaused,
                                contextState: this.sound.context?.state,
                                volume: this.backgroundMusic?.volume,
                                soundExists: !!this.backgroundMusic
                            });
                            
                            // If not playing, try one more time
                            if (!this.backgroundMusic?.isPlaying) {
                                console.log('🔊 iOS: Audio not playing, attempting to resume...');
                                try {
                                    if (this.sound.context && this.sound.context.state === 'suspended') {
                                        this.sound.context.resume().then(() => {
                                            this.backgroundMusic.play();
                                            console.log('🔊 iOS: Retry play after context resume');
                                        });
                                    } else {
                                        this.backgroundMusic.play();
                                        console.log('🔊 iOS: Retry play without resume');
                                    }
                                } catch (retryErr) {
                                    console.error('🔊 iOS: Retry play failed:', retryErr);
                                }
                            }
                        }, 100);
                    } catch (error) {
                        console.error('🔊 iOS: Failed to play audio:', error);
                        console.error('🔊 iOS: Error details:', {
                            message: error.message,
                            stack: error.stack,
                            contextState: this.sound.context?.state,
                            soundSystemReady: !!this.sound,
                            audioLoaded: this.cache?.audio?.exists('zombie-theme')
                        });
                    }

                    // Log when resume completes (async, but audio should already be playing)
                    if (resumePromise) {
                        resumePromise.then(() => {
                            console.log('🔊 iOS: Audio context resumed successfully');
                            console.log('🔊 iOS: Final audio status:', {
                                contextState: this.sound.context?.state,
                                isPlaying: this.backgroundMusic?.isPlaying
                            });
                        }).catch(error => {
                            console.error('🔊 iOS: Failed to resume audio context:', error);
                        });
                    }
                } else {
                    // Other platforms: Resume context then play
                    if (this.sound.context) {
                        this.sound.context.resume().then(() => {
                            console.log('🔊 Audio context resumed, starting background music');
                            this.startMenuMusic();
                        }).catch(error => {
                            console.error('🔊 Failed to resume audio context:', error);
                        });
                    } else {
                        // No WebAudio context, use HTML5 Audio
                        this.startMenuMusic();
                    }
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