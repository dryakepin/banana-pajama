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

// Detect iOS specifically (needed for audio config)
const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);

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
        // CRITICAL: Disable WebAudio on iOS - it has major issues
        // Force HTML5 Audio which is more reliable on iOS Safari
        disableWebAudio: isiOS || false,
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
        return;
    }
    
    // Try to unlock WebAudio context if it exists
    if (game.sound.context) {
        if (game.sound.context.state === 'suspended') {
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
                            audio.pause();
                            audio.remove();
                        }).catch(() => {});
                    }
                } catch (e) {
                    // Silent audio unlock failed - expected on some browsers
                }
            }
            
            resumePromise.then(() => {}).catch(() => {});
        }
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
        setTimeout(() => {
            tryAndroidCSSTricks();
        }, 100);
    }
});

// Phaser Scale Manager event setup
const setupPhaserFullscreenEvents = () => {
    if (game && game.scale) {
        
        // Listen for fullscreen events
        game.scale.on('enterfullscreen', () => {
            document.body.classList.add('phaser-fullscreen');
            
            // Force landscape orientation if supported
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape-primary').catch(err => {
                });
            }
            
            // Update viewport height
            setViewportHeight();
        });
        
        game.scale.on('leavefullscreen', () => {
            document.body.classList.remove('phaser-fullscreen');
            setViewportHeight();
        });
        
        game.scale.on('fullscreenunsupported', () => {
            // Automatically apply CSS-based fullscreen for unsupported devices
            tryAndroidCSSTricks();
        });
        
        // Handle resize events from Phaser
        game.scale.on('resize', () => {
            setViewportHeight();
        });
    }
};

// Mobile viewport height fix
const setViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
};

// Detect browser details (isiOS and isAndroid already defined above)
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

// Phaser-based fullscreen request with native Scale Manager
const requestPhaserFullscreen = () => {
    if (game && game.scale) {
        
        try {
            if (game.scale.fullscreen.available) {
                game.scale.startFullscreen();
                return true;
            } else {
                return false;
            }
        } catch (err) {
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
                });
            }
        }, 100);
        return;
    }
    
    // Fallback to DOM API for Android
    if (isAndroid) {
        
        // Method 1: Standard Fullscreen API
        if (element.requestFullscreen) {
            try {
                const fullscreenPromise = element.requestFullscreen();
                
                if (fullscreenPromise && typeof fullscreenPromise.then === 'function') {
                    fullscreenPromise.then(() => {
                        if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape-primary').catch(err => {
                            });
                        }
                    }).catch(err => {
                        tryAndroidAlternatives();
                    });
                } else {
                    setTimeout(() => {
                        if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape-primary').catch(err => {
                            });
                        }
                    }, 100);
                }
            } catch (err) {
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
                }).catch(err => {
                    tryAndroidCSSTricks();
                });
            } else {
                // webkitRequestFullscreen doesn't return a Promise, assume it worked
            }
        } catch (err) {
            tryAndroidCSSTricks();
        }
    } else if (element.webkitRequestFullScreen) {
        try {
            element.webkitRequestFullScreen();
        } catch (err) {
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
    
    // Add platform-specific CSS class for fullscreen simulation
    if (isiOS) {
        document.body.classList.add('ios-fullscreen');
        
        // iOS-specific: Force immediate viewport correction and Phaser resize
        
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
                
                
                // Also update Phaser's scale if available
                if (game && game.scale) {
                    const newWidth = window.innerWidth;
                    const newHeight = window.innerHeight;
                    game.scale.setGameSize(newWidth, newHeight);
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
                    }
                } catch (e) {
                    // Audio unlock attempt failed - non-critical
                }
            }
            
            if (isAndroid) {
                
                // Chrome Mobile needs special handling
                if (isChrome) {
                    
                    // Try Phaser fullscreen first, then DOM API
                    requestFullscreen();
                    
                    // Check status and apply CSS fallback if needed
                    setTimeout(() => {
                        const phaserFullscreen = game && game.scale && game.scale.isFullscreen;
                        const domFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

                        if (!phaserFullscreen && !domFullscreen) {
                            tryAndroidCSSTricks();
                        }
                    }, 500);
                    
                } else {
                    // Other Android browsers
                    requestFullscreen();
                    setTimeout(() => {
                        const phaserFullscreen = game && game.scale && game.scale.isFullscreen;
                        const domFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
                        
                        if (!phaserFullscreen && !domFullscreen) {
                            tryAndroidCSSTricks();
                        }
                    }, 1000);
                }
            } else {
                // iOS and other platforms
                requestFullscreen();
                
                // For iOS, immediately apply CSS fullscreen since native fullscreen always fails
                if (isiOS) {
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
        });
    }
    
    // Initial setup
    setTimeout(() => {
        handleOrientationChange();
        hideBrowserUI();
    }, 100);
}

