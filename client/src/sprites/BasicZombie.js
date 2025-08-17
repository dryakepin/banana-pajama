import Phaser from 'phaser';

export default class BasicZombie extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'zombie1');
        
        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Zombie properties based on specification
        this.maxHealth = 1; // Dies in 1 hit
        this.health = this.maxHealth;
        this.damage = 10; // Damage to player
        this.speed = 50; // Slow movement
        this.scoreValue = 10; // Points when killed
        this.attackRange = 30; // Distance to damage player
        this.attackCooldown = 1000; // 1 second between attacks
        this.lastAttackTime = 0;
        
        // Visual properties
        this.setScale(0.1); // Match player size
        this.setTint(0x88ff88); // Light green tint
        
        // Physics properties
        this.setCollideWorldBounds(true);
        this.setBounce(0.1);
        this.body.setSize(this.width * 0.7, this.height * 0.7); // Smaller hitbox
        
        // AI state
        this.target = null;
        this.isActive = true;
        this.isDead = false;
        this.lastPathfindTime = 0;
        this.pathfindCooldown = 200; // Recalculate movement every 200ms
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        if (!this.isActive || this.isDead) return;
        
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
            
            // Handle sprite rotation and flipping based on movement direction
            if (velocityX !== 0 || velocityY !== 0) {
                const angle = Math.atan2(velocityY, velocityX);
                
                // Flip sprite vertically when moving left and adjust rotation
                if (velocityX < 0) {
                    // Moving left - flip vertically to face left
                    this.setFlipY(true);
                    this.setRotation(angle);
                } else {
                    // Moving right - normal orientation
                    this.setFlipY(false);
                    this.setRotation(angle);
                }
            }
        } else {
            // Stop moving when in attack range
            this.setVelocity(0, 0);
        }
    }
    
    // Simplified smart movement - try direct path, then alternatives
    getSmartMove(targetX, targetY) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const moveDistance = 32; // Move in 32 pixel steps
        
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
            angle + Math.PI / 4,   // 45 degrees right
            angle - Math.PI / 4,   // 45 degrees left
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
                    x: Math.cos(altAngle) * this.speed,
                    y: Math.sin(altAngle) * this.speed
                };
            }
        }
        
        // If all else fails, try to move away from walls
        return this.getWallAvoidanceMove();
    }
    
    // Simple wall avoidance - move away from nearest wall
    getWallAvoidanceMove() {
        const checkDistance = 64;
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
                    x: dir.x * this.speed * 0.5, // Move slower when avoiding walls
                    y: dir.y * this.speed * 0.5
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
        
        // Damage the player
        this.scene.damagePlayer(this.damage);
        
        // Visual feedback for attack
        this.setTint(0xff4444); // Red flash
        this.scene.time.delayedCall(200, () => {
            if (!this.isDead) {
                this.setTint(0x88ff88); // Back to green
            }
        });
        
        // TODO: Add attack sound effect
        // this.scene.sound.play('zombieAttack');
    }
    
    takeDamage(damage) {
        if (this.isDead) return false;
        
        this.health -= damage;
        
        // Visual feedback for taking damage
        this.setTint(0xffffff); // White flash
        this.scene.time.delayedCall(100, () => {
            if (!this.isDead) {
                this.setTint(0x88ff88); // Back to green
            }
        });
        
        if (this.health <= 0) {
            this.die();
            return true; // Zombie died
        }
        
        return false; // Zombie still alive
    }
    
    die() {
        if (this.isDead) return;
        
        this.isDead = true;
        this.isActive = false;
        
        // Stop movement
        this.setVelocity(0, 0);
        
        // Death animation/effect
        this.setTint(0x666666); // Gray out
        this.setAlpha(0.7);
        
        // Add score to player
        this.scene.addScore(this.scoreValue);
        
        // Track zombie kill
        this.scene.addZombieKill();
        
        // Basic zombie power-up drops based on updated spec
        const dropChance = Math.random();
        if (dropChance < 0.15) {
            // 15% chance for point boost (from all zombie types)
            this.scene.spawnPowerUp(this.x, this.y, 'pointBoost');
        } else if (dropChance < 0.25) {
            // 10% chance for dual shot (from all zombie types)
            this.scene.spawnPowerUp(this.x, this.y, 'dualShot');
        }
        
        // Remove after short delay
        this.scene.time.delayedCall(500, () => {
            this.destroy();
        });
        
        // TODO: Add death sound effect
        // this.scene.sound.play('zombieDeath');
        
        // TODO: Add death particle effect
        // this.scene.add.particles(this.x, this.y, 'blood', {...});
    }
    
    // Reset zombie for object pooling
    reset(x, y) {
        this.setPosition(x, y);
        this.health = this.maxHealth;
        this.isDead = false;
        this.isActive = true;
        this.setTint(0x88ff88);
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