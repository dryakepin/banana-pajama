import Phaser from 'phaser';
import SoundEffects from '../utils/SoundEffects.js';

export default class FastZombie extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'zombie3');
        
        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Fast Zombie properties based on specification
        this.maxHealth = 1; // Dies in 1 hit (same as basic)
        this.health = this.maxHealth;
        this.damage = 15; // Higher damage than basic zombie
        this.speed = 100; // Fast movement (double basic zombie's speed)
        this.scoreValue = 25; // Medium points when killed
        this.attackRange = 25; // Smaller attack range (gets in close fast)
        this.attackCooldown = 800; // Faster attacks (0.8 seconds)
        this.lastAttackTime = 0;
        
        // Visual properties
        this.setScale(0.12); // Slightly larger than basic zombie
        // No tint - use original sprite colors from zombie-3.png
        
        // Physics properties
        this.setCollideWorldBounds(true);
        this.setBounce(0.2); // More bouncy than basic zombie (agitated movement)
        this.body.setSize(this.width * 0.6, this.height * 0.6); // Smaller hitbox (harder to hit)
        
        // AI state
        this.target = null;
        this.isActive = true;
        this.isDead = false;
        this.lastPathfindTime = 0;
        this.pathfindCooldown = 100; // Very frequent pathfinding updates for agility
        
        // Fast zombie specific properties
        this.aggressionLevel = 1.2; // Multiplier for speed when player is close
        this.sprintRange = 200; // Distance at which fast zombie "sprints"
        this.zigzagTimer = 0;
        this.zigzagDirection = 1;
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        if (!this.isActive || this.isDead) return;
        
        // Handle zigzag movement pattern
        this.zigzagTimer += delta;
        if (this.zigzagTimer > 300) { // Change direction every 300ms
            this.zigzagDirection *= -1;
            this.zigzagTimer = 0;
        }
        
        this.moveTowardsPlayer();
        this.checkPlayerCollision();
    }
    
    moveTowardsPlayer() {
        if (!this.scene.player || this.isDead) return;
        
        const player = this.scene.player;
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        // Only move if not too close (to prevent jittering)
        if (distance > this.attackRange) {
            let velocityX = 0;
            let velocityY = 0;
            
            // Determine current speed based on distance to player
            const currentSpeed = distance < this.sprintRange ? 
                this.speed * this.aggressionLevel : this.speed;
            
            // Try smart pathfinding first
            if (this.scene.tileMap) {
                const currentTime = this.scene.time.now;
                
                // Very frequent pathfinding updates for fast zombie agility
                if (currentTime - this.lastPathfindTime > this.pathfindCooldown) {
                    const moveResult = this.getSmartMove(player.x, player.y, currentSpeed);
                    if (moveResult) {
                        velocityX = moveResult.x;
                        velocityY = moveResult.y;
                    }
                    this.lastPathfindTime = currentTime;
                } else {
                    // Use last calculated velocity but adjust for current speed
                    const currentVelMagnitude = Math.sqrt(
                        this.body.velocity.x * this.body.velocity.x + 
                        this.body.velocity.y * this.body.velocity.y
                    );
                    if (currentVelMagnitude > 0) {
                        velocityX = (this.body.velocity.x / currentVelMagnitude) * currentSpeed;
                        velocityY = (this.body.velocity.y / currentVelMagnitude) * currentSpeed;
                    }
                }
            }
            
            // Fallback to direct movement with zigzag pattern
            if (velocityX === 0 && velocityY === 0) {
                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                
                // Add zigzag movement for erratic fast zombie behavior
                const zigzagAngle = angle + (this.zigzagDirection * Math.PI / 8); // 22.5 degree offset
                
                velocityX = Math.cos(zigzagAngle) * currentSpeed;
                velocityY = Math.sin(zigzagAngle) * currentSpeed;
            }
            
            this.setVelocity(velocityX, velocityY);
            
            // Handle sprite rotation and flipping with more dramatic movement
            if (velocityX !== 0 || velocityY !== 0) {
                const angle = Math.atan2(velocityY, velocityX);
                
                // Fast zombie has more exaggerated rotation
                if (velocityX < 0) {
                    this.setFlipY(true);
                    this.setRotation(angle + Math.sin(this.zigzagTimer / 100) * 0.3); // Slight wobble
                } else {
                    this.setFlipY(false);
                    this.setRotation(angle + Math.sin(this.zigzagTimer / 100) * 0.3);
                }
            }
        } else {
            // Stop moving when in attack range
            this.setVelocity(0, 0);
        }
    }
    
    // Fast zombie has more aggressive pathfinding
    getSmartMove(targetX, targetY, currentSpeed) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const moveDistance = 24; // Smaller steps for more precise movement
        
        // Try direct movement first
        let nextX = this.x + Math.cos(angle) * moveDistance;
        let nextY = this.y + Math.sin(angle) * moveDistance;
        
        if (this.scene.tileMap.isWalkable(nextX, nextY)) {
            return {
                x: Math.cos(angle) * currentSpeed,
                y: Math.sin(angle) * currentSpeed
            };
        }
        
        // Try more alternative angles for better agility
        const alternatives = [
            angle + Math.PI / 8,   // 22.5 degrees right
            angle - Math.PI / 8,   // 22.5 degrees left
            angle + Math.PI / 4,   // 45 degrees right
            angle - Math.PI / 4,   // 45 degrees left
            angle + Math.PI / 3,   // 60 degrees right
            angle - Math.PI / 3,   // 60 degrees left
            angle + Math.PI / 2,   // 90 degrees right
            angle - Math.PI / 2,   // 90 degrees left
            angle + Math.PI * 3/4, // 135 degrees right
            angle - Math.PI * 3/4  // 135 degrees left
        ];
        
        for (const altAngle of alternatives) {
            nextX = this.x + Math.cos(altAngle) * moveDistance;
            nextY = this.y + Math.sin(altAngle) * moveDistance;
            
            if (this.scene.tileMap.isWalkable(nextX, nextY)) {
                return {
                    x: Math.cos(altAngle) * currentSpeed,
                    y: Math.sin(altAngle) * currentSpeed
                };
            }
        }
        
        // If all else fails, try to move away from walls
        return this.getWallAvoidanceMove(currentSpeed);
    }
    
    // Fast zombie wall avoidance with higher speed
    getWallAvoidanceMove(currentSpeed) {
        const checkDistance = 48; // Medium check distance
        const directions = [
            { x: 1, y: 0 },   // Right
            { x: -1, y: 0 },  // Left
            { x: 0, y: 1 },   // Down
            { x: 0, y: -1 },  // Up
            { x: 0.7, y: 0.7 },   // Diagonal down-right
            { x: -0.7, y: 0.7 },  // Diagonal down-left
            { x: 0.7, y: -0.7 },  // Diagonal up-right
            { x: -0.7, y: -0.7 }  // Diagonal up-left
        ];
        
        for (const dir of directions) {
            const testX = this.x + dir.x * checkDistance;
            const testY = this.y + dir.y * checkDistance;
            
            if (this.scene.tileMap.isWalkable(testX, testY)) {
                return {
                    x: dir.x * (currentSpeed || this.speed) * 0.7, // Maintain good speed when avoiding walls
                    y: dir.y * (currentSpeed || this.speed) * 0.7
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
        
        // Damage the player (medium damage)
        this.scene.damagePlayer(this.damage);
        
        // Visual feedback for attack - fast zombie has quick, intense flash
        this.setTint(0xff2222); // Bright red flash
        this.scene.time.delayedCall(150, () => {
            if (!this.isDead) {
                this.clearTint(); // Back to original sprite colors
            }
        });
        
        // Quick screen shake for fast zombie attack
        this.scene.cameras.main.shake(200, 0.015);
        
        SoundEffects.playZombieAttack();
    }
    
    takeDamage(damage) {
        if (this.isDead) return false;
        
        this.health -= damage;
        
        // Visual feedback for taking damage
        this.setTint(0xffffff); // White flash
        this.scene.time.delayedCall(80, () => { // Very quick flash
            if (!this.isDead) {
                this.clearTint(); // Back to original sprite colors
            }
        });
        
        // Fast zombie gets a brief speed boost when damaged (panic response)
        this.aggressionLevel = 1.5;
        this.scene.time.delayedCall(500, () => {
            this.aggressionLevel = 1.2; // Back to normal aggression
        });
        
        if (this.health <= 0) {
            this.die();
            return true; // Fast zombie died
        }
        
        return false; // Fast zombie still alive
    }
    
    die() {
        if (this.isDead) return;

        SoundEffects.playZombieDeath('fast');

        this.isDead = true;
        this.isActive = false;

        // Stop movement
        this.setVelocity(0, 0);

        // Death animation/effect
        this.setTint(0x444444); // Dark gray out
        this.setAlpha(0.6);

        // Add score to player (medium score)
        this.scene.addScore(this.scoreValue);

        // Track zombie kill
        this.scene.addZombieKill();

        // Fast zombie power-up drops (medium drop rates)
        const dropChance = Math.random();
        if (dropChance < 0.08) {
            // 8% chance for speed boost (unique to fast zombie)
            this.scene.spawnPowerUp(this.x, this.y, 'speedBoost');
        } else if (dropChance < 0.18) {
            // 10% chance for dual shot
            this.scene.spawnPowerUp(this.x, this.y, 'dualShot');
        } else if (dropChance < 0.28) {
            // 10% chance for point boost
            this.scene.spawnPowerUp(this.x, this.y, 'pointBoost');
        }

        // Remove quickly (fast zombie disappears fast)
        this.scene.time.delayedCall(300, () => {
            this.destroy();
        });
    }
    
    // Reset fast zombie for object pooling
    reset(x, y) {
        this.setPosition(x, y);
        this.health = this.maxHealth;
        this.isDead = false;
        this.isActive = true;
        this.aggressionLevel = 1.2;
        this.zigzagTimer = 0;
        this.zigzagDirection = 1;
        this.clearTint(); // Use original sprite colors
        this.setAlpha(1);
        this.setVelocity(0, 0);
        this.lastAttackTime = 0;
        this.lastPathfindTime = 0;
    }
    
    destroy() {
        this.isActive = false;
        super.destroy();
    }
}