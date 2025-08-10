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
        min: {
            width: 480,  // Minimum landscape width
            height: 320  // Minimum landscape height
        },
        max: {
            width: 1920,
            height: 1080
        }
    },
    audio: {
        disableWebAudio: false
    },
    dom: {
        createContainer: true
    }
};

// Hide loading screen when game starts
const hideLoadingScreen = () => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
};

// Initialize the game
const game = new Phaser.Game(config);

// Hide loading screen once the first scene is ready
game.events.once('ready', hideLoadingScreen);

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

// Debug function for fullscreen status
const debugFullscreenStatus = () => {
    console.log('🔍 Fullscreen Debug Status:', {
        'document.fullscreenElement': !!document.fullscreenElement,
        'document.webkitFullscreenElement': !!document.webkitFullscreenElement,
        'document.mozFullScreenElement': !!document.mozFullScreenElement,
        'document.msFullscreenElement': !!document.msFullscreenElement,
        'window.innerHeight': window.innerHeight,
        'screen.height': screen.height,
        'screen.availHeight': screen.availHeight,
        'document.body.classList': Array.from(document.body.classList),
        'canvas.style': document.querySelector('canvas')?.style.cssText || 'No canvas found'
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
    setInterval(debugFullscreenStatus, 3000);
}

// Request fullscreen on mobile with Android-specific handling
const requestFullscreen = () => {
    const element = document.documentElement;
    
    // For Android, try multiple approaches
    if (isAndroid) {
        console.log('Android detected - trying multiple fullscreen methods');
        
        // Method 1: Standard Fullscreen API
        if (element.requestFullscreen) {
            try {
                // Try without navigationUI first for better compatibility
                const fullscreenPromise = element.requestFullscreen();
                
                // Check if requestFullscreen returns a Promise
                if (fullscreenPromise && typeof fullscreenPromise.then === 'function') {
                    fullscreenPromise.then(() => {
                        console.log('✅ Android fullscreen success with requestFullscreen');
                        // Force screen orientation after fullscreen
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
                    // requestFullscreen doesn't return a Promise, assume it worked
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
        // iOS and other browsers
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
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

// Android CSS-based fullscreen simulation
const tryAndroidCSSTricks = () => {
    console.log('🔧 Android: Falling back to CSS fullscreen simulation');
    
    // Add Android-specific CSS class for fullscreen simulation
    document.body.classList.add('android-fullscreen');
    
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
        
        // Force game canvas to full screen dimensions
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
            }
        }, 500);
        
        // Additional Chrome address bar hiding on orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                hideAddressBar();
                // Force re-apply canvas styles after orientation change
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.style.height = '100dvh';
                    canvas.style.width = '100vw';
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
    
    // Request fullscreen on first user interaction
    let fullscreenRequested = false;
    const requestFullscreenOnce = () => {
        if (!fullscreenRequested) {
            fullscreenRequested = true;
            
            if (isAndroid) {
                console.log('Android: Requesting fullscreen with multiple fallbacks');
                
                // Chrome Mobile needs special handling
                if (isChrome) {
                    console.log('Chrome Mobile: Using Chrome-specific fullscreen approach');
                    
                    // For Chrome, try fullscreen API but don't wait long
                    requestFullscreen();
                    
                    // Apply CSS tricks quickly for Chrome since API often fails
                    setTimeout(() => {
                        console.log('Chrome Mobile: Checking fullscreen status...');
                        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                            console.log('Chrome Mobile: API failed, applying CSS fullscreen');
                            tryAndroidCSSTricks();
                        } else {
                            console.log('Chrome Mobile: Fullscreen API succeeded');
                        }
                    }, 500); // Shorter timeout for Chrome
                    
                } else {
                    // Other Android browsers
                    requestFullscreen();
                    setTimeout(() => {
                        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                            console.log('Android: Fullscreen API failed, using CSS fallback');
                            tryAndroidCSSTricks();
                        }
                    }, 1000);
                }
            } else {
                requestFullscreen();
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