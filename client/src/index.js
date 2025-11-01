import Phaser from 'phaser';

// Import scenes
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import HighScoreScene from './scenes/HighScoreScene.js';
import NameEntryScene from './scenes/NameEntryScene.js';

// Detect mobile device for configuration
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 (('ontouchstart' in window) && (window.innerWidth <= 768 || window.innerHeight <= 768));

// Game configuration optimized for landscape mobile
const config = {
    type: Phaser.AUTO,
    width: isMobile ? Math.max(window.innerWidth, window.innerHeight) : 1024,
    height: isMobile ? Math.min(window.innerWidth, window.innerHeight) : 768,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Top-down game, no gravity
            debug: false
        }
    },
    scene: [MenuScene, GameScene, GameOverScene, HighScoreScene, NameEntryScene],
    scale: {
        mode: isMobile ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: true,
        fullscreenTarget: document.body,
        min: {
            width: 480,  // Minimum landscape width
            height: 320  // Minimum landscape height
        },
        max: {
            width: 1920,
            height: 1080
        }
    },
    input: {
        activePointers: 3, // Support multi-touch for mobile
        touch: {
            target: null,
            capture: true
        },
        smoothFactor: 0.2
    },
    audio: {
        disableWebAudio: false,
        // iOS Safari has issues with WebAudio - use HTML5 Audio as fallback
        // Phaser will automatically fall back to HTML5 Audio if WebAudio fails
        noAudio: false
    },
    dom: {
        createContainer: true
    },
    render: {
        powerPreference: 'high-performance',
        antialias: false, // Disable for mobile performance
        transparent: false,
        clearBeforeRender: true
    }
};

// Hide loading screen when game starts
const hideLoadingScreen = () => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
};

// Unlock audio context on first user interaction
const unlockAudioContext = () => {
    if (!game || !game.sound) {
        console.log('🔊 Game or sound system not ready');
        return;
    }
    
    // Try to unlock WebAudio context if it exists
    if (game.sound.context) {
        if (game.sound.context.state === 'suspended') {
            console.log('🔊 Audio context suspended, resuming...');
            const resumePromise = game.sound.context.resume();
            
            // For iOS: Also try to start a dummy sound to unlock
            if (isiOS) {
                // iOS requires synchronous play in user interaction handler
                // Create a silent audio element to unlock
                try {
                    const audio = new Audio();
                    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
                    audio.volume = 0.01;
                    const playPromise = audio.play();
                    if (playPromise) {
                        playPromise.then(() => {
                            console.log('🔊 iOS: Dummy audio played to unlock audio');
                            audio.pause();
                            audio.remove();
                        }).catch(err => {
                            console.log('🔊 iOS: Dummy audio play failed (expected):', err.message);
                        });
                    }
                } catch (err) {
                    console.log('🔊 iOS: Could not create dummy audio:', err.message);
                }
            }
            
            resumePromise.then(() => {
                console.log('🔊 Audio context unlocked successfully');
            }).catch(error => {
                console.error('🔊 Failed to resume audio context:', error);
            });
        } else {
            console.log('🔊 Audio context already unlocked, state:', game.sound.context.state);
        }
    } else {
        console.log('🔊 No WebAudio context (using HTML5 Audio fallback)');
    }
};

// Initialize the game
const game = new Phaser.Game(config);

// Setup Phaser Scale Manager events for fullscreen
game.events.once('ready', () => {
    hideLoadingScreen();
    setupPhaserFullscreenEvents();
    
    // iOS: Apply fullscreen fix immediately when game is ready
    // This ensures the game starts in fullscreen mode from the beginning
    if (isiOS && isMobile) {
        console.log('🍎 iOS: Game ready, applying initial fullscreen fix');
        setTimeout(() => {
            tryAndroidCSSTricks();
        }, 100);
    }
});

// Phaser Scale Manager event setup
const setupPhaserFullscreenEvents = () => {
    if (game && game.scale) {
        console.log('🎮 Setting up Phaser fullscreen events');
        
        // Listen for fullscreen events
        game.scale.on('enterfullscreen', () => {
            console.log('✅ Entered fullscreen via Phaser Scale Manager');
            document.body.classList.add('phaser-fullscreen');
            
            // Force landscape orientation if supported
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape-primary').catch(err => {
                    console.log('Orientation lock failed after fullscreen:', err);
                });
            }
            
            // Update viewport height
            setViewportHeight();
        });
        
        game.scale.on('leavefullscreen', () => {
            console.log('❌ Left fullscreen via Phaser Scale Manager');
            document.body.classList.remove('phaser-fullscreen');
            setViewportHeight();
        });
        
        game.scale.on('fullscreenunsupported', () => {
            console.log('⚠️ Phaser fullscreen unsupported - using CSS fallbacks');
            // Automatically apply CSS-based fullscreen for unsupported devices
            tryAndroidCSSTricks();
        });
        
        // Handle resize events from Phaser
        game.scale.on('resize', (gameSize, baseSize, displaySize, resolution) => {
            console.log('📱 Phaser resize event:', {
                gameSize: `${gameSize.width}x${gameSize.height}`,
                displaySize: `${displaySize.width}x${displaySize.height}`,
                windowSize: `${window.innerWidth}x${window.innerHeight}`
            });
            
            // Update CSS viewport height on resize
            setViewportHeight();
        });
        
        // Log fullscreen capabilities
        console.log('🔍 Phaser fullscreen capabilities:', {
            available: game.scale.fullscreen.available,
            active: game.scale.isFullscreen,
            element: game.scale.fullscreen.element
        });
    }
};

// Mobile viewport height fix
const setViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
};

// Detect Android specifically with browser details
const isAndroid = /Android/i.test(navigator.userAgent);
const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isChrome = /Chrome/i.test(navigator.userAgent);
const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
const isFirefox = /Firefox/i.test(navigator.userAgent);

// Comprehensive fullscreen detection
const isInFullscreen = () => {
    // Check multiple fullscreen APIs
    const domFullscreen = !!(document.fullscreenElement || 
                           document.webkitFullscreenElement || 
                           document.mozFullScreenElement || 
                           document.msFullscreenElement);
    
    // Check Phaser fullscreen state
    const phaserFullscreen = game && game.scale && game.scale.isFullscreen;
    
    // Check if we're in a PWA standalone mode
    const standalone = window.navigator.standalone || 
                      window.matchMedia('(display-mode: standalone)').matches;
    
    // Check CSS-based fullscreen states
    const cssFullscreen = document.body.classList.contains('phaser-fullscreen') ||
                         document.body.classList.contains('android-fullscreen') ||
                         document.body.classList.contains('ios-fullscreen');
    
    return {
        dom: domFullscreen,
        phaser: phaserFullscreen,
        standalone: standalone,
        css: cssFullscreen,
        any: domFullscreen || phaserFullscreen || standalone || cssFullscreen
    };
};

// Debug function for comprehensive fullscreen status
const debugFullscreenStatus = () => {
    const fullscreenStatus = isInFullscreen();
    
    console.log('🔍 Comprehensive Fullscreen Status:', {
        ...fullscreenStatus,
        'window.innerHeight': window.innerHeight,
        'window.innerWidth': window.innerWidth,
        'screen.height': screen.height,
        'screen.width': screen.width,
        'screen.availHeight': screen.availHeight,
        'screen.availWidth': screen.availWidth,
        'devicePixelRatio': window.devicePixelRatio,
        'orientation': screen.orientation?.type || 'unknown',
        'document.body.classList': Array.from(document.body.classList),
        'canvas.dimensions': (() => {
            const canvas = document.querySelector('canvas');
            return canvas ? {
                width: canvas.width,
                height: canvas.height,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
                style: canvas.style.cssText
            } : 'No canvas found';
        })()
    });
};

console.log('Browser detection:', {
    isAndroid,
    isiOS,
    isChrome,
    isSamsung,
    isFirefox,
    userAgent: navigator.userAgent
});

// Debug fullscreen every few seconds on mobile
if (isMobile) {
    setInterval(debugFullscreenStatus, 5000);
    
    // Also debug when fullscreen state might change
    document.addEventListener('fullscreenchange', debugFullscreenStatus);
    document.addEventListener('webkitfullscreenchange', debugFullscreenStatus);
    document.addEventListener('mozfullscreenchange', debugFullscreenStatus);
    document.addEventListener('msfullscreenchange', debugFullscreenStatus);
    
    // Debug on visibility change (app switching)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('👁️ App became visible - checking fullscreen status');
            setTimeout(debugFullscreenStatus, 100);
        }
    });
}

// Phaser-based fullscreen request with native Scale Manager
const requestPhaserFullscreen = () => {
    if (game && game.scale) {
        console.log('🎮 Using Phaser Scale Manager for fullscreen');
        
        try {
            if (game.scale.fullscreen.available) {
                console.log('✅ Phaser fullscreen available - requesting');
                game.scale.startFullscreen();
                return true;
            } else {
                console.log('❌ Phaser fullscreen not available - using fallback');
                return false;
            }
        } catch (err) {
            console.log('❌ Phaser fullscreen error:', err);
            return false;
        }
    }
    return false;
};

// Request fullscreen on mobile with Phaser integration
const requestFullscreen = () => {
    const element = document.documentElement;
    
    // Try Phaser fullscreen first if available
    if (requestPhaserFullscreen()) {
        // Phaser fullscreen succeeded, also handle orientation
        setTimeout(() => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape-primary').catch(err => {
                    console.log('Orientation lock failed:', err);
                });
            }
        }, 100);
        return;
    }
    
    // Fallback to DOM API for Android
    if (isAndroid) {
        console.log('Android detected - trying DOM fullscreen methods');
        
        // Method 1: Standard Fullscreen API
        if (element.requestFullscreen) {
            try {
                const fullscreenPromise = element.requestFullscreen();
                
                if (fullscreenPromise && typeof fullscreenPromise.then === 'function') {
                    fullscreenPromise.then(() => {
                        console.log('✅ Android fullscreen success with requestFullscreen');
                        if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape-primary').catch(err => {
                                console.log('Orientation lock failed:', err);
                            });
                        }
                    }).catch(err => {
                        console.log('❌ Android requestFullscreen failed:', err);
                        tryAndroidAlternatives();
                    });
                } else {
                    console.log('✅ Android fullscreen called (no Promise returned)');
                    setTimeout(() => {
                        if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape-primary').catch(err => {
                                console.log('Orientation lock failed:', err);
                            });
                        }
                    }, 100);
                }
            } catch (err) {
                console.log('❌ Android requestFullscreen exception:', err);
                tryAndroidAlternatives();
            }
        } else {
            tryAndroidAlternatives();
        }
    } else {
        // iOS and other browsers - use DOM API fallback
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        } else {
            console.log('❌ No fullscreen API available - using CSS fallback');
            tryAndroidCSSTricks();
        }
    }
};

// Android-specific fullscreen alternatives
const tryAndroidAlternatives = () => {
    const element = document.documentElement;
    
    // Method 2: Webkit prefix (older Android browsers)
    if (element.webkitRequestFullscreen) {
        try {
            const webkitPromise = element.webkitRequestFullscreen();
            
            // Check if webkitRequestFullscreen returns a Promise
            if (webkitPromise && typeof webkitPromise.then === 'function') {
                webkitPromise.then(() => {
                    console.log('✅ Android fullscreen success with webkitRequestFullscreen');
                }).catch(err => {
                    console.log('❌ Android webkitRequestFullscreen failed:', err);
                    tryAndroidCSSTricks();
                });
            } else {
                // webkitRequestFullscreen doesn't return a Promise, assume it worked
                console.log('✅ Android webkit fullscreen called (no Promise returned)');
            }
        } catch (err) {
            console.log('❌ Android webkitRequestFullscreen exception:', err);
            tryAndroidCSSTricks();
        }
    } else if (element.webkitRequestFullScreen) {
        try {
            element.webkitRequestFullScreen();
            console.log('✅ Android webkitRequestFullScreen called');
        } catch (err) {
            console.log('❌ Android webkitRequestFullScreen exception:', err);
            tryAndroidCSSTricks();
        }
    } else {
        tryAndroidCSSTricks();
    }
};

// Force Phaser to resize to current viewport dimensions
const forcePhaserResize = () => {
    if (game && game.scale) {
        // Use the actual viewport dimensions, ensuring landscape orientation
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        const landscapeWidth = Math.max(currentWidth, currentHeight);
        const landscapeHeight = Math.min(currentWidth, currentHeight);
        
        // Force Phaser to update game size
        game.scale.resize(landscapeWidth, landscapeHeight);
        game.scale.setGameSize(landscapeWidth, landscapeHeight);
        
        console.log(`🎮 iOS: Force resized Phaser to ${landscapeWidth}x${landscapeHeight} (window: ${currentWidth}x${currentHeight})`);
        
        // Also update the canvas element directly
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.width = `${landscapeWidth}px`;
            canvas.style.height = `${landscapeHeight}px`;
        }
    }
};

// CSS-based fullscreen simulation for Android and iOS
const tryAndroidCSSTricks = () => {
    const platform = isiOS ? 'iOS' : (isAndroid ? 'Android' : 'Other');
    console.log(`🔧 ${platform}: Falling back to CSS fullscreen simulation`);
    
    // Add platform-specific CSS class for fullscreen simulation
    if (isiOS) {
        document.body.classList.add('ios-fullscreen');
        
        // iOS-specific: Force immediate viewport correction and Phaser resize
        console.log('🍎 iOS: Applying immediate fullscreen fix');
        
        // Hide Safari UI bars immediately
        window.scrollTo(0, 1);
        setTimeout(() => {
            window.scrollTo(0, 0);
            setViewportHeight();
        }, 100);
        
        // Force Phaser resize immediately and repeatedly to catch viewport changes
        const applyiOSFullscreen = () => {
            // Get actual viewport dimensions (accounting for Safari UI)
            const actualWidth = window.innerWidth;
            const actualHeight = window.innerHeight;
            const landscapeWidth = Math.max(actualWidth, actualHeight);
            const landscapeHeight = Math.min(actualWidth, actualHeight);
            
            // Update Phaser game size
            forcePhaserResize();
            
            // Force canvas to full viewport
            const canvas = document.querySelector('canvas');
            const gameContainer = document.getElementById('game-container');
            
            if (canvas) {
                canvas.style.position = 'fixed';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.width = '100vw';
                canvas.style.height = '100dvh';
                canvas.style.height = '-webkit-fill-available';
                canvas.style.zIndex = '100001';
                canvas.style.margin = '0';
                canvas.style.padding = '0';
                canvas.style.border = 'none';
                
                console.log('🍎 iOS: Applied canvas fullscreen styles');
            }
            
            if (gameContainer) {
                gameContainer.style.width = '100vw';
                gameContainer.style.height = '100dvh';
                gameContainer.style.height = '-webkit-fill-available';
                gameContainer.style.position = 'fixed';
                gameContainer.style.top = '0';
                gameContainer.style.left = '0';
                gameContainer.style.margin = '0';
                gameContainer.style.padding = '0';
            }
        };
        
        // Apply immediately
        applyiOSFullscreen();
        
        // Apply again after a short delay to catch Safari UI changes
        setTimeout(applyiOSFullscreen, 100);
        setTimeout(applyiOSFullscreen, 300);
        setTimeout(applyiOSFullscreen, 600);
        setTimeout(applyiOSFullscreen, 1000);
        
        // Listen for resize events and continuously update
        const handleiOSResize = () => {
            setTimeout(() => {
                applyiOSFullscreen();
                setViewportHeight();
            }, 100);
        };
        
        // Remove old listeners if any
        window.removeEventListener('resize', handleiOSResize);
        window.removeEventListener('orientationchange', handleiOSResize);
        
        // Add resize listeners for continuous updates
        window.addEventListener('resize', handleiOSResize, { passive: true });
        window.addEventListener('orientationchange', handleiOSResize, { passive: true });
        
        // Also listen for scroll events (Safari UI can change on scroll)
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(applyiOSFullscreen, 150);
        }, { passive: true });
        
    } else {
        document.body.classList.add('android-fullscreen');
    }
    
    // Chrome Mobile specific tricks
    if (isChrome && isAndroid) {
        console.log('🔧 Chrome Mobile: Applying Chrome-specific fullscreen tricks');
        
        // Force viewport meta tag update for Chrome
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.content = 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover, minimal-ui';
        }
        
        // Chrome address bar hiding technique
        const hideAddressBar = () => {
            if (window.innerHeight < screen.availHeight) {
                window.scrollTo(0, 1);
                setTimeout(() => {
                    window.scrollTo(0, 0);
                    // Update viewport height after scroll
                    setViewportHeight();
                }, 100);
            }
        };
        
        // Chrome-specific fullscreen CSS
        document.body.style.setProperty('height', '100vh', 'important');
        document.body.style.setProperty('height', '100dvh', 'important');
        document.body.style.setProperty('overflow', 'hidden', 'important');
        
        // Try multiple times for Chrome
        hideAddressBar();
        setTimeout(hideAddressBar, 500);
        setTimeout(hideAddressBar, 1000);
        setTimeout(hideAddressBar, 2000);
        
        // Force game canvas to full screen dimensions with Phaser integration
        setTimeout(() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.position = 'fixed';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.width = '100vw';
                canvas.style.height = '100vh';
                canvas.style.height = '100dvh';
                canvas.style.zIndex = '100001';
                canvas.style.margin = '0';
                canvas.style.padding = '0';
                canvas.style.border = 'none';
                
                console.log('🔧 Chrome: Force applied canvas fullscreen styles with dvh');
                
                // Also update Phaser's scale if available
                if (game && game.scale) {
                    const newWidth = window.innerWidth;
                    const newHeight = window.innerHeight;
                    game.scale.setGameSize(newWidth, newHeight);
                    console.log(`🎮 Updated Phaser game size to ${newWidth}x${newHeight}`);
                }
            }
        }, 500);
        
        // Additional Chrome address bar hiding on orientation change with Phaser integration
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                hideAddressBar();
                
                // Force re-apply canvas styles after orientation change
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.style.height = '100dvh';
                    canvas.style.width = '100vw';
                }
                
                // Update Phaser scale after orientation change
                if (game && game.scale) {
                    const newWidth = window.innerWidth;
                    const newHeight = window.innerHeight;
                    game.scale.setGameSize(newWidth, newHeight);
                    console.log(`🎮 Orientation change: Updated Phaser to ${newWidth}x${newHeight}`);
                }
            }, 200);
        });
    } else if (!isiOS) {
        // General Android address bar hiding
        setTimeout(() => {
            window.scrollTo(0, 1);
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 100);
        }, 300);
    }
};

// Hide browser UI on scroll (iOS Safari trick)
const hideBrowserUI = () => {
    if (isMobile && window.innerHeight < screen.height) {
        window.scrollTo(0, 1);
        setTimeout(() => window.scrollTo(0, 0), 100);
    }
};

// Show install banner on mobile if not in standalone mode
if (isMobile) {
    // Check if already in standalone mode (PWA installed)
    const isStandalone = window.navigator.standalone ||
                         window.matchMedia('(display-mode: standalone)').matches;

    // Check if user has dismissed the banner before
    const bannerDismissed = localStorage.getItem('installBannerDismissed');

    if (!isStandalone && !bannerDismissed) {
        // Show install banner after a delay
        setTimeout(() => {
            const banner = document.getElementById('install-banner');
            const instructions = document.getElementById('install-instructions');
            const dismissBtn = document.getElementById('dismiss-banner');

            if (banner && instructions && dismissBtn) {
                // Set platform-specific instructions
                if (isiOS) {
                    instructions.textContent = 'Tap Share (⎵) → Add to Home Screen';
                } else if (isAndroid) {
                    instructions.textContent = 'Tap Menu (⋮) → Add to Home Screen or Install App';
                } else {
                    instructions.textContent = 'Add this page to your home screen for fullscreen mode';
                }

                // Show the banner
                banner.classList.add('show');

                // Dismiss button handler
                dismissBtn.addEventListener('click', () => {
                    banner.classList.remove('show');
                    localStorage.setItem('installBannerDismissed', 'true');
                });

                // Auto-hide after 10 seconds
                setTimeout(() => {
                    if (banner.classList.contains('show')) {
                        banner.classList.remove('show');
                    }
                }, 10000);
            }
        }, 3000); // Show after 3 seconds
    }
}

// Handle orientation changes on mobile
if (isMobile) {
    // Set initial viewport height
    setViewportHeight();
    
    // Request fullscreen and unlock audio on first user interaction
    let fullscreenRequested = false;
    const requestFullscreenOnce = () => {
        if (!fullscreenRequested) {
            fullscreenRequested = true;
            
            // Unlock audio context on first user interaction - CRITICAL for iOS
            // Must be called synchronously in user interaction handler
            unlockAudioContext();
            
            // For iOS: Also try to unlock audio by creating a dummy sound
            // This must happen synchronously in the user interaction handler
            if (isiOS && game && game.sound) {
                console.log('🔊 iOS: Attempting to unlock audio system...', {
                    soundSystemReady: !!game.sound,
                    contextExists: !!game.sound.context,
                    contextState: game.sound.context?.state,
                    scenesReady: game.scene?.scenes?.length > 0
                });
                
                try {
                    // Try to create and play a very short silent sound to unlock audio
                    // This must be done synchronously in the click/touch handler
                    // Note: Sound may not be loaded yet, but we'll try anyway
                    if (game.cache && game.cache.audio && game.cache.audio.exists('zombie-theme')) {
                        const testSound = game.sound.add('zombie-theme', { volume: 0.01 });
                        testSound.play();
                        setTimeout(() => {
                            testSound.stop();
                            testSound.destroy();
                        }, 100);
                        console.log('🔊 iOS: Test sound played to unlock audio system');
                    } else {
                        console.log('🔊 iOS: Audio not loaded yet, will unlock when scene plays audio');
                    }
                } catch (err) {
                    console.log('🔊 iOS: Test sound failed (may need scene to be ready):', err.message);
                    console.log('🔊 iOS: Full error:', err);
                }
            }
            
            if (isAndroid) {
                console.log('Android: Requesting fullscreen with Phaser + fallbacks');
                
                // Chrome Mobile needs special handling
                if (isChrome) {
                    console.log('Chrome Mobile: Using enhanced fullscreen approach');
                    
                    // Try Phaser fullscreen first, then DOM API
                    requestFullscreen();
                    
                    // Check status and apply CSS fallback if needed
                    setTimeout(() => {
                        const phaserFullscreen = game && game.scale && game.scale.isFullscreen;
                        const domFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
                        
                        console.log('Chrome Mobile: Checking fullscreen status...', {
                            phaser: phaserFullscreen,
                            dom: !!domFullscreen
                        });
                        
                        if (!phaserFullscreen && !domFullscreen) {
                            console.log('Chrome Mobile: APIs failed, applying CSS fullscreen');
                            tryAndroidCSSTricks();
                        } else {
                            console.log('Chrome Mobile: Fullscreen API succeeded');
                        }
                    }, 500);
                    
                } else {
                    // Other Android browsers
                    requestFullscreen();
                    setTimeout(() => {
                        const phaserFullscreen = game && game.scale && game.scale.isFullscreen;
                        const domFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
                        
                        if (!phaserFullscreen && !domFullscreen) {
                            console.log('Android: Fullscreen APIs failed, using CSS fallback');
                            tryAndroidCSSTricks();
                        }
                    }, 1000);
                }
            } else {
                // iOS and other platforms
                requestFullscreen();
                
                // For iOS, immediately apply CSS fullscreen since native fullscreen always fails
                if (isiOS) {
                    console.log('🍎 iOS: Applying immediate CSS fullscreen (native API not available)');
                    // Apply immediately, not after delay - iOS needs immediate correction
                    tryAndroidCSSTricks();
                }
            }
            
            hideBrowserUI();
            document.removeEventListener('touchstart', requestFullscreenOnce);
            document.removeEventListener('click', requestFullscreenOnce);
        }
    };
    
    document.addEventListener('touchstart', requestFullscreenOnce, { passive: true });
    document.addEventListener('click', requestFullscreenOnce);
    
    const handleOrientationChange = () => {
        // Update viewport height calculations
        setViewportHeight();
        
        // Force landscape dimensions
        const landscapeWidth = Math.max(window.innerWidth, window.innerHeight);
        const landscapeHeight = Math.min(window.innerWidth, window.innerHeight);
        
        // Resize the game to landscape dimensions
        game.scale.resize(landscapeWidth, landscapeHeight);
        
        // Hide browser UI
        setTimeout(hideBrowserUI, 100);
        
        console.log(`Orientation changed - resized to: ${landscapeWidth}x${landscapeHeight}`);
    };
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
        // Small delay to allow the viewport to update
        setTimeout(handleOrientationChange, 500);
    });
    
    // Also listen for resize events
    window.addEventListener('resize', () => {
        setViewportHeight();
        setTimeout(handleOrientationChange, 100);
    });
    
    // Lock orientation to landscape if supported
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
            console.log('Could not lock orientation:', err);
        });
    }
    
    // Initial setup
    setTimeout(() => {
        handleOrientationChange();
        hideBrowserUI();
    }, 100);
}

// Export for debugging
window.game = game;