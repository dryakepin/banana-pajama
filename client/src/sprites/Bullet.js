import Phaser from 'phaser';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, null);
        
        // Create a red circle for the bullet
        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Create red dot graphics
        this.graphics = scene.add.graphics();
        this.graphics.fillStyle(0xff0000); // Red color
        this.graphics.fillCircle(0, 0, 3); // 3 pixel radius
        
        // Convert graphics to texture
        this.graphics.generateTexture('bullet', 6, 6);
        this.graphics.destroy();
        
        // Set the texture
        this.setTexture('bullet');
        
        // Physics properties
        this.setCollideWorldBounds(false);
        this.body.setSize(6, 6);
        
        // Bullet properties
        this.speed = 600;
        this.damage = 10;
        this.active = false;
        this.targetX = 0;
        this.targetY = 0;
    }
    
    fire(startX, startY, targetX, targetY) {
        this.setPosition(startX, startY);
        this.setActive(true);
        this.setVisible(true);
        this.active = true;
        
        // Store target position
        this.targetX = targetX;
        this.targetY = targetY;
        
        // Calculate direction and velocity
        const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
        const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
        
        // Set velocity towards target
        this.setVelocity(
            Math.cos(angle) * this.speed,
            Math.sin(angle) * this.speed
        );
        
        // Calculate time to reach target and set up destruction timer
        const timeToTarget = (distance / this.speed) * 1000; // Convert to milliseconds
        
        this.scene.time.delayedCall(timeToTarget, () => {
            this.destroy();
        });
    }
    
    update() {
        if (!this.active) return;
        
        // Check if bullet is out of bounds
        const camera = this.scene.cameras.main;
        if (this.x < -50 || this.x > camera.width + 50 || 
            this.y < -50 || this.y > camera.height + 50) {
            this.destroy();
        }
    }
    
    destroy() {
        this.active = false;
        this.setActive(false);
        this.setVisible(false);
        
        // Return to pool or actually destroy
        if (this.scene && this.scene.bulletPool) {
            this.scene.bulletPool.releaseObject(this);
        } else {
            super.destroy();
        }
    }
}