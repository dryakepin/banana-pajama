import Phaser from 'phaser';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, null);
        
        // Create a red circle for the bullet
        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Create bullet texture if it doesn't exist
        if (!scene.textures.exists('bullet')) {
            const graphics = scene.add.graphics();
            graphics.fillStyle(0xff0000); // Red color
            graphics.fillCircle(3, 3, 3); // 3 pixel radius, centered
            graphics.generateTexture('bullet', 6, 6);
            graphics.destroy();
        }
        
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
        
        // Check collision with buildings
        if (this.scene.tileMap && !this.scene.tileMap.isWalkable(this.x, this.y)) {
            this.destroy();
            return;
        }
        
        // Check if bullet is far from camera view (world coordinates)
        const camera = this.scene.cameras.main;
        const cameraLeft = camera.scrollX - 100;
        const cameraRight = camera.scrollX + camera.width + 100;
        const cameraTop = camera.scrollY - 100;
        const cameraBottom = camera.scrollY + camera.height + 100;
        
        if (this.x < cameraLeft || this.x > cameraRight || 
            this.y < cameraTop || this.y > cameraBottom) {
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