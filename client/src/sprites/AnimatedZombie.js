import Phaser from 'phaser';

export default class AnimatedZombie extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'zombie4-appear-1');
        
        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Zombie properties based on specification
        this.maxHealth = 2; // Medium health
        this.health = this.maxHealth;
        this.damage = 20; // Higher damage than basic zombie
        this.speed = 75; // Medium speed
        this.scoreValue = 50; // Higher points when killed
        this.attackRange = 30; // Distance to damage player
        this.attackCooldown = 1200; // 1.2 seconds between attacks
        this.lastAttackTime = 0;
        
        // Animation state management
        this.animationState = 'spawning';
        this.isAttacking = false;
        this.isDying = false;
        this.isSpawning = true;
        this.needsSpawnAnimation = false;
        
        // Visual properties
        this.setScale(0.3); // Larger scale to match other zombies (they use 0.1 but are bigger sprites)
        this.setFlipX(true); // Mirror horizontally so zombie faces the correct direction
        this.setTint(0xaa88ff); // Purple tint for animated zombie
        
        // Physics properties
        this.setCollideWorldBounds(true);
        this.setBounce(0.1);
        this.body.setSize(this.width * 0.7, this.height * 0.7); // Smaller hitbox
        
        // AI state
        this.target = null;
        this.isActive = false; // Start inactive during spawn
        this.lastPathfindTime = 0;
        this.pathfindCooldown = 200;
        
        // Animation event listeners
        this.setupAnimationEvents();
        
        // Start with appear animation - use a flag to start animation on next update
        this.needsSpawnAnimation = true;
    }
    
    setupAnimationEvents() {
        // When appear animation completes, switch to idle and activate zombie
        this.on('animationcomplete-zombie4-appear', () => {
            this.animationState = 'idle';
            this.isSpawning = false;
            this.isActive = true;
            if (this.anims) {
                this.play('zombie4-idle');
            }
            console.log('Animated zombie spawn completed');
        });
        
        // When attack animation completes, return to movement
        this.on('animationcomplete-zombie4-attack', () => {
            this.isAttacking = false;
            this.resumeMovementAnimation();
        });
        
        // When die animation completes, handle cleanup
        this.on('animationcomplete-zombie4-die', () => {
            this.handleDeathComplete();
        });
        
        // Handle animation interruptions gracefully
        this.on('animationstart', (anim) => {
            console.log(`Animated zombie: ${anim.key} started`);
        });
    }
    
    // Helper method for safe animation playing
    safePlayAnimation(animationKey) {
        if (this.anims && this.scene.anims.exists(animationKey)) {
            this.play(animationKey);
            return true;
        }
        console.warn(`Animation not found or not ready: ${animationKey}`);
        return false;
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        // Handle spawn animation flag with validation
        if (this.needsSpawnAnimation && this.anims && this.scene.anims.exists('zombie4-appear')) {
            this.needsSpawnAnimation = false;
            this.play('zombie4-appear');
        }
        
        // Don't update logic during spawning or death
        if (this.isDying || this.isSpawning || !this.isActive) return;
        
        this.moveTowardsPlayer();
        this.checkPlayerCollision();
        this.updateAnimation();
    }
    
    moveTowardsPlayer() {
        if (!this.scene.player || this.isDying || this.isAttacking) return;
        
        const player = this.scene.player;
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        // Only move if not too close (to prevent jittering)
        if (distance > this.attackRange) {
            let velocityX = 0;
            let velocityY = 0;
            
            // Try smart pathfinding first
            if (this.scene.tileMap) {
                const currentTime = this.scene.time.now;
                
                if (currentTime - this.lastPathfindTime > this.pathfindCooldown) {
                    const moveResult = this.getSmartMove(player.x, player.y);
                    if (moveResult) {
                        velocityX = moveResult.x;
                        velocityY = moveResult.y;
                    }
                    this.lastPathfindTime = currentTime;
                } else {
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
            
            // Only set velocity if physics body exists
            if (this.body) {
                this.setVelocity(velocityX, velocityY);
            }
            
            // Handle sprite flipping based on movement direction
            // Since we start with FlipX(true), we need to adjust the logic
            if (velocityX < 0) {
                this.setFlipX(false); // Moving left - don't flip (or flip opposite)
            } else if (velocityX > 0) {
                this.setFlipX(true); // Moving right - maintain flip
            }
        } else {
            // Stop moving when in attack range
            if (this.body) {
                this.setVelocity(0, 0);
            }
        }
    }
    
    updateAnimation() {
        if (this.isAttacking || this.isDying || this.isSpawning) return;
        
        // Switch between walk and idle based on movement
        const isMoving = this.body.velocity.x !== 0 || this.body.velocity.y !== 0;
        
        if (isMoving) {
            if (this.animationState !== 'walking') {
                this.animationState = 'walking';
                if (this.anims) {
                    this.play('zombie4-walk');
                }
            }
        } else {
            if (this.animationState !== 'idle') {
                this.animationState = 'idle';
                if (this.anims) {
                    this.play('zombie4-idle');
                }
            }
        }
    }
    
    resumeMovementAnimation() {
        // Resume appropriate animation based on current movement state
        const isMoving = this.body.velocity.x !== 0 || this.body.velocity.y !== 0;
        
        if (isMoving) {
            this.animationState = 'walking';
            if (this.anims) {
                this.play('zombie4-walk');
            }
        } else {
            this.animationState = 'idle';
            if (this.anims) {
                this.play('zombie4-idle');
            }
        }
    }
    
    // Smart movement (same as other zombies)
    getSmartMove(targetX, targetY) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const moveDistance = 32;
        
        let nextX = this.x + Math.cos(angle) * moveDistance;
        let nextY = this.y + Math.sin(angle) * moveDistance;
        
        if (this.scene.tileMap.isWalkable(nextX, nextY)) {
            return {
                x: Math.cos(angle) * this.speed,
                y: Math.sin(angle) * this.speed
            };
        }
        
        const alternatives = [
            angle + Math.PI / 4,
            angle - Math.PI / 4,
            angle + Math.PI / 2,
            angle - Math.PI / 2,
            angle + Math.PI * 3/4,
            angle - Math.PI * 3/4
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
        
        return this.getWallAvoidanceMove();
    }
    
    getWallAvoidanceMove() {
        const checkDistance = 64;
        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];
        
        for (const dir of directions) {
            const testX = this.x + dir.x * checkDistance;
            const testY = this.y + dir.y * checkDistance;
            
            if (this.scene.tileMap.isWalkable(testX, testY)) {
                return {
                    x: dir.x * this.speed * 0.5,
                    y: dir.y * this.speed * 0.5
                };
            }
        }
        
        return { x: 0, y: 0 };
    }
    
    checkPlayerCollision() {
        if (!this.scene.player || this.isDying || this.isAttacking) return;
        
        const player = this.scene.player;
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        if (distance <= this.attackRange) {
            const currentTime = this.scene.time.now;
            if (currentTime - this.lastAttackTime >= this.attackCooldown) {
                this.attackPlayer();
                this.lastAttackTime = currentTime;
            }
        }
    }
    
    attackPlayer() {
        if (this.isAttacking || this.isDying || this.isSpawning) return;
        
        console.log('Animated zombie attacking player');
        this.isAttacking = true;
        this.animationState = 'attacking';
        
        // Stop movement during attack
        if (this.body) {
            this.setVelocity(0, 0);
        }
        
        if (this.anims) {
            this.play('zombie4-attack');
        }
        
        // Deal damage immediately (could be delayed to specific frame if desired)
        this.scene.damagePlayer(this.damage);
    }
    
    takeDamage(damage) {
        if (this.isDying) return false;
        
        this.health -= damage;
        
        // Visual feedback for taking damage (brief white flash)
        const originalTint = this.tint;
        this.setTint(0xffffff);
        this.scene.time.delayedCall(100, () => {
            if (!this.isDying) {
                this.setTint(originalTint);
            }
        });
        
        if (this.health <= 0) {
            this.die();
            return true; // Zombie died
        }
        
        return false; // Zombie still alive
    }
    
    die() {
        if (this.isDying) return;
        
        console.log('Animated zombie dying');
        this.isDying = true;
        this.isActive = false;
        this.animationState = 'dying';
        
        // Stop all movement
        if (this.body) {
            this.setVelocity(0, 0);
        }
        
        // Play death animation
        if (this.anims) {
            this.play('zombie4-die');
        }
        
        // Add score to player immediately
        this.scene.addScore(this.scoreValue);
        this.scene.addZombieKill();
        
        // Enhanced power-up drops for animated zombie
        const dropChance = Math.random();
        if (dropChance < 0.20) {
            // 20% chance for healing (unique to animated zombie)
            this.scene.spawnPowerUp(this.x, this.y, 'healing');
        } else if (dropChance < 0.35) {
            // 15% chance for invincibility (rare drop)
            this.scene.spawnPowerUp(this.x, this.y, 'invincibility');
        } else if (dropChance < 0.50) {
            // 15% chance for rapid fire
            this.scene.spawnPowerUp(this.x, this.y, 'rapidFire');
        }
    }
    
    handleDeathComplete() {
        // Death animation finished, clean up
        console.log('Animated zombie death animation complete');
        
        // Fade out effect
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                // For object pooling, don't destroy - just deactivate
                this.setActive(false);
                this.setVisible(false);
                console.log('Animated zombie deactivated for pooling reuse');
            }
        });
    }
    
    // Helper method to check if zombie can be damaged
    isVulnerableToAttack() {
        return this.active && !this.isDying && this.health > 0;
    }
    
    // Reset zombie for object pooling
    reset(x, y) {
        this.setPosition(x, y);
        this.health = this.maxHealth;
        this.isDying = false;
        this.isSpawning = true;
        this.isActive = false;
        this.isAttacking = false;
        this.animationState = 'spawning';
        this.needsSpawnAnimation = false;
        this.setTint(0xaa88ff);
        this.setAlpha(1);
        this.setFlipX(true); // Maintain horizontal flip for correct direction
        
        // Reactivate for pooling
        this.setActive(true);
        this.setVisible(true);
        
        // Cancel any existing tweens to prevent memory leaks
        if (this.scene.tweens) {
            this.scene.tweens.killTweensOf(this);
        }
        
        // Only set velocity if physics body exists
        if (this.body) {
            this.setVelocity(0, 0);
        }
        
        this.lastAttackTime = 0;
        this.lastPathfindTime = 0;
        
        // Restart spawn animation - use a flag to start animation on next update
        this.needsSpawnAnimation = true;
    }
    
    destroy() {
        this.isActive = false;
        // Clean up event listeners
        this.removeAllListeners();
        super.destroy();
    }
}