export default class VirtualJoystick {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.radius = 60;
        this.knobRadius = 25;
        
        this.isDragging = false;
        this.knobX = x;
        this.knobY = y;
        
        // Input vector (-1 to 1 for both x and y)
        this.inputVector = { x: 0, y: 0 };
        
        this.createJoystick();
        this.setupInput();
    }
    
    createJoystick() {
        // Create base circle (outer ring) - more visible on mobile
        this.base = this.scene.add.graphics();
        this.base.lineStyle(4, 0x888888, 0.9); // Thicker, more visible border
        this.base.fillStyle(0x333333, 0.6);    // More opaque background
        this.base.fillCircle(this.x, this.y, this.radius);
        this.base.strokeCircle(this.x, this.y, this.radius);
        this.base.setScrollFactor(0);
        this.base.setDepth(1000);
        
        // Create knob (inner circle) - more visible on mobile
        this.knob = this.scene.add.graphics();
        this.knob.lineStyle(3, 0xaaaaaa, 1.0);  // Thicker, fully opaque border
        this.knob.fillStyle(0x666666, 0.8);     // More opaque fill
        this.knob.fillCircle(this.x, this.y, this.knobRadius);
        this.knob.strokeCircle(this.x, this.y, this.knobRadius);
        this.knob.setScrollFactor(0);
        this.knob.setDepth(1001);
        
        // Setup input handling
        this.setupInput();
    }
    
    setupInput() {
        // Make the base and knob interactive but don't handle events here
        // Events will be handled by the GameScene for multi-touch support
        this.base.setInteractive(new Phaser.Geom.Circle(this.x, this.y, this.radius), Phaser.Geom.Circle.Contains);
        this.knob.setInteractive(new Phaser.Geom.Circle(this.x, this.y, this.knobRadius), Phaser.Geom.Circle.Contains);
    }
    
    // Methods to be called by GameScene for proper multi-touch handling
    handlePointerDown(pointer) {
        this.isDragging = true;
        this.updateKnobPosition(pointer.x, pointer.y);
    }
    
    handlePointerMove(pointer) {
        if (this.isDragging) {
            this.updateKnobPosition(pointer.x, pointer.y);
        }
    }
    
    handlePointerUp(pointer) {
        this.isDragging = false;
        this.resetKnob();
    }
    
    updateKnobPosition(pointerX, pointerY) {
        // Calculate distance from center
        const deltaX = pointerX - this.x;
        const deltaY = pointerY - this.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance <= this.radius) {
            // Within bounds, move knob to pointer position
            this.knobX = pointerX;
            this.knobY = pointerY;
        } else {
            // Outside bounds, clamp to edge
            const angle = Math.atan2(deltaY, deltaX);
            this.knobX = this.x + Math.cos(angle) * this.radius;
            this.knobY = this.y + Math.sin(angle) * this.radius;
        }
        
        // Update visual position
        this.updateKnobGraphics();
        
        // Calculate input vector (-1 to 1)
        this.inputVector.x = (this.knobX - this.x) / this.radius;
        this.inputVector.y = (this.knobY - this.y) / this.radius;
    }
    
    resetKnob() {
        this.knobX = this.x;
        this.knobY = this.y;
        this.inputVector.x = 0;
        this.inputVector.y = 0;
        this.updateKnobGraphics();
    }
    
    updateKnobGraphics() {
        this.knob.clear();
        this.knob.lineStyle(3, 0xaaaaaa, 1.0);  // Match the initial style
        this.knob.fillStyle(0x666666, 0.8);     // Match the initial style
        this.knob.fillCircle(this.knobX, this.knobY, this.knobRadius);
        this.knob.strokeCircle(this.knobX, this.knobY, this.knobRadius);
    }
    
    getInputVector() {
        return this.inputVector;
    }
    
    getIsDragging() {
        return this.isDragging;
    }
    
    setVisible(visible) {
        this.base.setVisible(visible);
        this.knob.setVisible(visible);
    }
    
    destroy() {
        if (this.base) {
            this.base.destroy();
        }
        if (this.knob) {
            this.knob.destroy();
        }
    }
}