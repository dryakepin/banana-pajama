# Zombie Assets

This folder contains all zombie-related assets for the Banana Pajama Zombie Shooter game.

## Zombie Types

### Static Zombies (Single Images)
- `zombie-1.png` - Basic Zombie (1 HP, 10 damage, slow, 10 points)
- `zombie-2.png` - Tank Zombie (5 HP, 25 damage, very slow, 50 points)  
- `zombie-3.png` - Fast Zombie (1 HP, 15 damage, fast, 25 points)

### Animated Zombies (Multiple Frames)
- `zombie-4/` - Animated Zombie (2 HP, 20 damage, medium speed, 50 points)

## Asset Guidelines

### Static Zombies
- **Format**: PNG with transparency
- **Size**: Recommended 64x64 pixels
- **Style**: Dark, atmospheric, fits the night city theme
- **Scaling**: Sprites are scaled down to 0.1 in-game

### Animated Zombies  
- **Frames**: 10 frames for smooth animation
- **Format**: Individual PNG files or single spritesheet
- **Timing**: 8 FPS for natural walking motion
- **Loop**: Continuous animation

## File Organization

```
zombies/
├── README.md
├── zombie-1.png          # Basic Zombie
├── zombie-2.png          # Tank Zombie  
├── zombie-3.png          # Fast Zombie
└── zombie-4/             # Animated Zombie
    ├── README.md
    ├── frame-01.png      # Animation frames
    ├── frame-02.png
    └── ...
    └── frame-10.png
```

## Implementation Notes

- All zombies use Phaser.Physics.Arcade.Sprite
- Static zombies use simple texture loading
- Animated zombies use Phaser animation system with anims.create()
- Zombie classes are in `/src/sprites/` folder