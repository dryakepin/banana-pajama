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
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        if (!this.isActive || this.isDead) return;
        
        this.moveTowardsPlayer();
        this.checkPlayerCollision();
    }
    
    moveTowardsPlayer() {
        if (!this.scene.player || this.isDead) return;
        
        // Calculate direction to player
        const player = this.scene.player;
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        // Only move if not too close (to prevent jittering)
        if (distance > this.attackRange) {
            // Calculate velocity towards player
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            
            this.setVelocity(
                Math.cos(angle) * this.speed,
                Math.sin(angle) * this.speed
            );
            
            // Face the player
            this.setRotation(angle);
        } else {
            // Stop moving when in attack range
            this.setVelocity(0, 0);
        }
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
    }
    
    destroy() {
        this.isActive = false;
        super.destroy();
    }
}