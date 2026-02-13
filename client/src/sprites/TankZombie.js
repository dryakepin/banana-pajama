import Phaser from 'phaser';
import SoundEffects from '../utils/SoundEffects.js';

export default class TankZombie extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'zombie2'); // Use tank zombie sprite
        
        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Tank Zombie properties based on specification
        this.maxHealth = 5; // 5 shots to kill
        this.health = this.maxHealth;
        this.damage = 25; // Higher damage than basic zombie
        this.speed = 25; // Very slow movement (half of basic zombie)
        this.scoreValue = 50; // High points when killed
        this.attackRange = 35; // Slightly larger attack range
        this.attackCooldown = 1200; // Slower attacks (1.2 seconds)
        this.lastAttackTime = 0;
        
        // Visual properties - tank zombie is bigger
        this.setScale(0.16); // Double the size of basic zombie (0.08 * 2)
        // No tint - use original sprite colors
        
        // Physics properties - tank is heavier
        this.setCollideWorldBounds(true);
        this.setBounce(0.05); // Less bouncy than basic zombie
        this.body.setSize(this.width * 0.8, this.height * 0.8); // Larger hitbox
        this.body.setMass(2); // Heavier mass
        
        // AI state
        this.target = null;
        this.isActive = true;
        this.isDead = false;
        this.lastPathfindTime = 0;
        this.pathfindCooldown = 300; // Slower pathfinding updates
        
        // Tank-specific properties
        this.isStunned = false;
        this.stunDuration = 0;
        this.damageFlashTimer = 0;

        // Walk animation state
        this._walkTimer = 0;
        this._baseScale = 0.16;
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        if (!this.isActive || this.isDead) return;
        
        // Handle stun effect
        if (this.isStunned) {
            this.stunDuration -= delta;
            if (this.stunDuration <= 0) {
                this.isStunned = false;
            }
            return; // Don't move while stunned
        }
        
        // Handle damage flash effect
        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer -= delta;
            if (this.damageFlashTimer <= 0) {
                this.clearTint(); // Back to original sprite colors
            }
        }
        
        this.moveTowardsPlayer();
        this.checkPlayerCollision();
    }
    
    moveTowardsPlayer() {
        if (!this.scene.player || this.isDead || this.isStunned) return;
        
        const player = this.scene.player;
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        // Only move if not too close (to prevent jittering)
        if (distance > this.attackRange) {
            let velocityX = 0;
            let velocityY = 0;
            
            // Try smart pathfinding first
            if (this.scene.tileMap) {
                const currentTime = this.scene.time.now;
                
                // Only recalculate path periodically for performance
                if (currentTime - this.lastPathfindTime > this.pathfindCooldown) {
                    const moveResult = this.getSmartMove(player.x, player.y);
                    if (moveResult) {
                        velocityX = moveResult.x;
                        velocityY = moveResult.y;
                    }
                    this.lastPathfindTime = currentTime;
                } else {
                    // Use last calculated velocity
                    velocityX = this.body.velocity.x;
                    velocityY = this.body.velocity.y;
                }
            }
            
            // Fallback to direct movement if no smart move found
            if (velocityX === 0 && velocityY === 0) {
                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                velocityX = Math.cos(angle) * this.speed;
                velocityY = Math.sin(angle) * this.speed;
            }
            
            this.setVelocity(velocityX, velocityY);
            
            // Advance walk animation timer
            this._walkTimer += this.scene.game.loop.delta;

            // Handle sprite rotation and flipping based on movement direction
            if (velocityX !== 0 || velocityY !== 0) {
                const angle = Math.atan2(velocityY, velocityX);
                const wobble = Math.sin(this._walkTimer * 0.003) * 0.08;

                // Flip sprite vertically when moving left and adjust rotation
                if (velocityX < 0) {
                    this.setFlipY(true);
                    this.setRotation(angle + wobble);
                } else {
                    this.setFlipY(false);
                    this.setRotation(angle + wobble);
                }
            }

            // Scale bob while moving - heavier bob for tank
            const bob = Math.sin(this._walkTimer * 0.003) * 0.012;
            this.setScale(this._baseScale + bob);
        } else {
            // Stop moving when in attack range
            this.setVelocity(0, 0);
            this.setScale(this._baseScale);
        }
    }
    
    // Tank zombie uses similar pathfinding but with different parameters
    getSmartMove(targetX, targetY) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const moveDistance = 40; // Larger movement steps for tank
        
        // Try direct movement first
        let nextX = this.x + Math.cos(angle) * moveDistance;
        let nextY = this.y + Math.sin(angle) * moveDistance;
        
        if (this.scene.tileMap.isWalkable(nextX, nextY)) {
            return {
                x: Math.cos(angle) * this.speed,
                y: Math.sin(angle) * this.speed
            };
        }
        
        // Try alternative angles if direct path is blocked
        const alternatives = [
            angle + Math.PI / 6,   // 30 degrees right
            angle - Math.PI / 6,   // 30 degrees left
            angle + Math.PI / 3,   // 60 degrees right
            angle - Math.PI / 3,   // 60 degrees left
            angle + Math.PI / 2,   // 90 degrees right
            angle - Math.PI / 2    // 90 degrees left
        ];
        
        for (const altAngle of alternatives) {
            nextX = this.x + Math.cos(altAngle) * moveDistance;
            nextY = this.y + Math.sin(altAngle) * moveDistance;
            
            if (this.scene.tileMap.isWalkable(nextX, nextY)) {
                return {
                    x: Math.cos(altAngle) * this.speed,
                    y: Math.sin(altAngle) * this.speed
                };
            }
        }
        
        // If all else fails, try to move away from walls
        return this.getWallAvoidanceMove();
    }
    
    // Tank zombie wall avoidance (similar to basic zombie but slower)
    getWallAvoidanceMove() {
        const checkDistance = 80; // Larger check distance for tank
        const directions = [
            { x: 1, y: 0 },   // Right
            { x: -1, y: 0 },  // Left
            { x: 0, y: 1 },   // Down
            { x: 0, y: -1 },  // Up
        ];
        
        for (const dir of directions) {
            const testX = this.x + dir.x * checkDistance;
            const testY = this.y + dir.y * checkDistance;
            
            if (this.scene.tileMap.isWalkable(testX, testY)) {
                return {
                    x: dir.x * this.speed * 0.3, // Move very slowly when avoiding walls
                    y: dir.y * this.speed * 0.3
                };
            }
        }
        
        // Complete fallback - don't move
        return { x: 0, y: 0 };
    }
    
    checkPlayerCollision() {
        if (!this.scene.player || this.isDead) return;
        
        const player = this.scene.player;
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        // Attack player if in range and cooldown is over
        if (distance <= this.attackRange) {
            const currentTime = this.scene.time.now;
            if (currentTime - this.lastAttackTime >= this.attackCooldown) {
                this.attackPlayer();
                this.lastAttackTime = currentTime;
            }
        }
    }
    
    attackPlayer() {
        if (!this.scene.player || this.isDead) return;
        
        // Damage the player (higher damage than basic zombie)
        this.scene.damagePlayer(this.damage);
        
        // Visual feedback for attack - tank zombie glows red longer
        this.setTint(0xff2222); // Bright red flash
        this.scene.time.delayedCall(400, () => {
            if (!this.isDead) {
                this.clearTint(); // Back to original sprite colors
            }
        });
        
        // Screen shake for powerful tank attack
        this.scene.cameras.main.shake(300, 0.02);
        
        SoundEffects.playZombieAttack();
    }
    
    takeDamage(damage) {
        if (this.isDead) return false;
        
        this.health -= damage;
        
        // Visual feedback for taking damage - longer flash for tank
        this.setTint(0xffffff); // White flash
        this.damageFlashTimer = 200;
        
        // Tank zombie gets briefly stunned when taking damage
        this.isStunned = true;
        this.stunDuration = 150; // 150ms stun
        
        // Stop movement when stunned
        this.setVelocity(0, 0);
        
        if (this.health <= 0) {
            this.die();
            return true; // Tank zombie died
        }
        
        return false; // Tank zombie still alive
    }
    
    die() {
        if (this.isDead) return;

        SoundEffects.playZombieDeath('tank');

        this.isDead = true;
        this.isActive = false;

        // Stop movement
        this.setVelocity(0, 0);

        // Death animation/effect - tank zombie has more dramatic death
        this.setTint(0x333333); // Darker gray out
        this.setAlpha(0.8);
        this.setScale(this._baseScale);

        // Tank zombie explodes with screen shake
        this.scene.cameras.main.shake(400, 0.03);

        // Add score to player (higher score for tank)
        this.scene.addScore(this.scoreValue);

        // Track zombie kill
        this.scene.addZombieKill();

        // Tank zombies have better power-up drops based on updated spec
        const dropChance = Math.random();
        if (dropChance < 0.05) {
            // 5% chance for healing
            this.scene.spawnPowerUp(this.x, this.y, 'healing');
        } else if (dropChance < 0.20) {
            // 15% chance for invincibility
            this.scene.spawnPowerUp(this.x, this.y, 'invincibility');
        } else if (dropChance < 0.24) {
            // 4% chance for kill all (rare)
            this.scene.spawnPowerUp(this.x, this.y, 'killAll');
        } else if (dropChance < 0.34) {
            // 10% chance for dual shot
            this.scene.spawnPowerUp(this.x, this.y, 'dualShot');
        }

        // Remove after longer delay (tank is bigger, takes longer to disappear)
        this.scene.time.delayedCall(800, () => {
            this.destroy();
        });
    }
    
    // Reset tank zombie for object pooling
    reset(x, y) {
        this.setPosition(x, y);
        this.health = this.maxHealth;
        this.isDead = false;
        this.isActive = true;
        this.isStunned = false;
        this.stunDuration = 0;
        this.damageFlashTimer = 0;
        this.clearTint(); // Use original sprite colors
        this.setAlpha(1);
        this.setVelocity(0, 0);
        this.setScale(this._baseScale);
        this._walkTimer = 0;
        this.lastAttackTime = 0;
        this.lastPathfindTime = 0;
    }
    
    destroy() {
        this.isActive = false;
        super.destroy();
    }
}