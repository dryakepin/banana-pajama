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
        disableWebAudio: false
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
    if (game && game.sound && game.sound.context && game.sound.context.state === 'suspended') {
        console.log('🔊 Audio context suspended, resuming after user interaction...');
        game.sound.context.resume().then(() => {
            console.log('🔊 Audio context unlocked successfully');
        }).catch(error => {
            console.error('🔊 Failed to resume audio context:', error);
        });
    } else {
        console.log('🔊 Audio context already unlocked or unavailable');
    }
};

// Initialize the game
const game = new Phaser.Game(config);

// Setup Phaser Scale Manager events for fullscreen
game.events.once('ready', () => {
    hideLoadingScreen();
    setupPhaserFullscreenEvents();
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

// CSS-based fullscreen simulation for Android and iOS
const tryAndroidCSSTricks = () => {
    const platform = isiOS ? 'iOS' : (isAndroid ? 'Android' : 'Other');
    console.log(`🔧 ${platform}: Falling back to CSS fullscreen simulation`);
    
    // Add platform-specific CSS class for fullscreen simulation
    if (isiOS) {
        document.body.classList.add('ios-fullscreen');
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
    } else {
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

// Handle orientation changes on mobile
if (isMobile) {
    // Set initial viewport height
    setViewportHeight();
    
    // Request fullscreen and unlock audio on first user interaction
    let fullscreenRequested = false;
    const requestFullscreenOnce = () => {
        if (!fullscreenRequested) {
            fullscreenRequested = true;
            
            // Unlock audio context on first user interaction
            unlockAudioContext();
            
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
                
                // For iOS, always apply additional optimizations since native fullscreen often fails
                if (isiOS) {
                    setTimeout(() => {
                        console.log('iOS: Applying additional viewport optimizations');
                        tryAndroidCSSTricks(); // Use same CSS tricks for iOS
                    }, 800);
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