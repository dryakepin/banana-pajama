import Phaser from 'phaser';
import SoundEffects from '../utils/SoundEffects.js';

export default class PowerUp extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, powerUpType) {
        const textureKey = `powerup-${powerUpType}`;
        
        super(scene, x, y, textureKey);
        
        this.scene = scene;
        this.powerUpType = powerUpType;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set up texture immediately - assets are guaranteed to be loaded
        this.setupTexture();
        
        // Physics properties
        this.setCollideWorldBounds(false);
        this.body.setSize(24, 24); // Smaller hitbox for easier pickup
        
        // Visual properties
        this.setScale(0.8);
        this.setDepth(100); // Above ground but below UI
        
        // Power-up properties
        this.isActive = true;
        this.lifetime = 30000; // 30 seconds before disappearing
        this.pulseTimer = 0;
        
        // Start lifetime timer
        this.lifetimeTimer = scene.time.delayedCall(this.lifetime, () => {
            this.destroy();
        });
        
        // Add subtle glow/pulse effect
        this.pulseDirection = 1;
        this.baseTint = 0xffffff;
        this.glowTint = 0xffff88; // Slight yellow glow
        this.usingActualAsset = false; // Track if we're using actual asset
    }
    
    setupTexture() {
        const textureKey = `powerup-${this.powerUpType}`;
        
        // Check if the actual asset exists and is valid
        if (this.scene.textures.exists(textureKey)) {
            const texture = this.scene.textures.get(textureKey);
            
            // Use the actual asset if it's valid
            if (texture && texture.source && texture.source[0] && texture.source[0].width > 0) {
                this.setTexture(textureKey);
                this.usingActualAsset = true;
                this.clearTint(); // Ensure no tint on actual assets
                this.setAlpha(1.0); // Ensure full opacity
                console.log(`✅ Using actual asset for ${this.powerUpType}`);
                return;
            }
        }
        
        // If asset doesn't exist or is invalid, create and use fallback
        console.log(`⚠️ Using fallback texture for ${this.powerUpType}`);
        this.createFallbackTexture();
        this.usingActualAsset = false;
    }
    
    createFallbackTexture() {
        const textureKey = `powerup-${this.powerUpType}`;
        const fallbackKey = `${textureKey}-fallback`;
        
        if (!this.scene.textures.exists(fallbackKey)) {
            const graphics = this.scene.add.graphics();
            
            // Create default black circle fallback
            graphics.fillStyle(0x222222); // Dark gray/black circle
            graphics.fillCircle(12, 12, 10);
            
            // Add a subtle colored ring based on power-up type
            let ringColor = 0x666666; // Default gray
            switch (this.powerUpType) {
                case 'healing':
                    ringColor = 0x44ff44; // Green
                    break;
                case 'invincibility':
                    ringColor = 0x4444ff; // Blue
                    break;
                case 'pointBoost':
                    ringColor = 0xffff44; // Yellow
                    break;
                case 'rapidFire':
                    ringColor = 0xff4444; // Red
                    break;
                case 'dualShot':
                    ringColor = 0xff8844; // Orange
                    break;
                case 'killAll':
                    ringColor = 0x8844ff; // Purple
                    break;
            }
            
            graphics.lineStyle(2, ringColor);
            graphics.strokeCircle(12, 12, 10);
            
            graphics.generateTexture(fallbackKey, 24, 24);
            graphics.destroy();
        }
        
        this.setTexture(fallbackKey);
    }
    
    update(time, delta) {
        if (!this.isActive) return;
        
        // Pulse effect
        this.pulseTimer += delta;
        const pulseSpeed = 2000; // 2 second cycle
        const pulseIntensity = Math.sin(this.pulseTimer / pulseSpeed * Math.PI * 2);
        
        // Only apply visual effects to fallback textures, NEVER to actual assets
        if (!this.usingActualAsset) {
            // Simple tint pulsing for fallback textures only
            const tintIntensity = 0.8 + pulseIntensity * 0.2; // 0.6 to 1.0
            this.setTint(this.glowTint);
            this.setAlpha(tintIntensity);
        } else {
            // For actual assets, ensure no tinting is ever applied
            this.clearTint();
            this.setAlpha(1.0);
        }
        
        // Slight scale pulse for all power-ups (this is safe for all textures)
        const scalePulse = 0.8 + pulseIntensity * 0.1; // 0.7 to 0.9
        this.setScale(scalePulse);
    }
    
    // Called when player picks up the power-up
    pickup(player) {
        if (!this.isActive) return false;
        
        this.isActive = false;
        
        // Clear lifetime timer
        if (this.lifetimeTimer) {
            this.lifetimeTimer.destroy();
        }
        
        // Apply power-up effect based on type
        this.applyEffect(player);
        
        SoundEffects.playPowerupPickup();
        
        // Visual pickup effect (quick scale up then destroy)
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                this.destroy();
            }
        });
        
        return true;
    }
    
    applyEffect(player) {
        // This will be overridden by specific power-up types or handled in GameScene
        console.log(`Applied ${this.powerUpType} power-up effect`);
        
        switch (this.powerUpType) {
            case 'healing':
                this.scene.healPlayer(100); // Full heal
                break;
                
            case 'invincibility':
                this.scene.makePlayerInvincible(10000); // 10 seconds
                break;
                
            case 'pointBoost':
                // Random point boost: +50, +100, or +150
                const bonusPoints = [50, 100, 150][Math.floor(Math.random() * 3)];
                this.scene.addScore(bonusPoints);
                break;
                
            case 'rapidFire':
                this.scene.activateRapidFire(15000); // 15 seconds
                break;
                
            case 'dualShot':
                this.scene.activateDualShot(15000); // 15 seconds
                break;
                
            case 'killAll':
                this.scene.killAllZombies();
                break;
        }
    }
    
    // Reset power-up for object pooling
    reset(x, y, powerUpType) {
        this.setPosition(x, y);
        this.powerUpType = powerUpType;
        this.isActive = true;
        this.pulseTimer = 0;
        this.setAlpha(1);
        this.setVisible(true);
        this.setActive(true);
        this.clearTint(); // Clear any existing tint
        this.setAlpha(1.0); // Reset to full opacity
        
        // Clear old timer
        if (this.lifetimeTimer) {
            this.lifetimeTimer.destroy();
        }
        
        // Set up texture immediately - assets are guaranteed to be loaded  
        this.setupTexture();
        
        // Start new lifetime timer
        this.lifetimeTimer = this.scene.time.delayedCall(this.lifetime, () => {
            this.destroy();
        });
    }
    
    destroy() {
        this.isActive = false;
        
        // Clear any pending timers
        if (this.lifetimeTimer) {
            this.lifetimeTimer.destroy();
        }
        
        // Reset to pool (Phaser group will handle this automatically)
        this.setActive(false);
        this.setVisible(false);
    }
}