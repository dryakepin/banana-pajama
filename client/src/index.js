import Phaser from 'phaser';

// Import scenes
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

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
    scene: [MenuScene, GameScene, GameOverScene],
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

// Request fullscreen on mobile
const requestFullscreen = () => {
    const element = document.documentElement;
    
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
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
            requestFullscreen();
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