# iOS Debugging Guide

This guide explains how to view console logs and debug issues on iOS Safari.

## Prerequisites

1. **Mac computer** with Safari installed
2. **iPhone/iPad** connected via USB cable
3. **iOS device** must be trusted on your Mac

## Step 1: Enable Developer Mode on iPhone

1. On your iPhone, go to **Settings** → **Privacy & Security**
2. Scroll down and find **Developer Mode** (may need to enable it first)
3. Turn on **Developer Mode**
4. Restart your iPhone if prompted

## Step 2: Enable Web Inspector on iPhone

1. On your iPhone, go to **Settings** → **Safari**
2. Scroll down to **Advanced** section
3. Turn on **Web Inspector**

## Step 3: Enable Develop Menu in Safari on Mac

1. Open **Safari** on your Mac
2. Go to **Safari** → **Settings** (or **Preferences**)
3. Click on the **Advanced** tab
4. Check **"Show Develop menu in menu bar"**

## Step 4: Connect and Debug

1. **Connect your iPhone to your Mac** via USB cable
2. **Unlock your iPhone** (may need to trust the computer)
3. On your iPhone, **open Safari** and navigate to your game
4. On your Mac, open **Safari**
5. Click **Develop** in the menu bar
6. You should see your iPhone listed (e.g., "Kaare's iPhone")
7. Hover over your iPhone name to see open tabs
8. Click on the tab with your game (e.g., "Banana Pajama Zombie Shooter")
9. A **Web Inspector window** will open showing:
   - **Console tab**: All console.log messages
   - **Elements tab**: DOM inspection
   - **Network tab**: Network requests
   - **Sources tab**: JavaScript debugging

## Viewing Console Logs

1. In the Web Inspector window, click the **Console** tab
2. You'll see all `console.log()`, `console.error()`, etc. messages
3. Look for messages starting with 🔊 (audio-related) or 🍎 (iOS-specific)

## Common Log Messages to Look For

### Audio-Related Logs:
- `🔊 Audio context suspended, resuming...`
- `🔊 iOS: Audio object created synchronously`
- `🔊 iOS: Audio play() called synchronously`
- `🔊 iOS: Audio status check:`
- `🔊 iOS: Dummy audio played to unlock audio`

### iOS Fullscreen Logs:
- `🍎 iOS: Game ready, applying initial fullscreen fix`
- `🍎 iOS: Applying immediate CSS fullscreen`
- `🎮 iOS: Force resized Phaser to...`

## Alternative: Remote Console (No Mac Required)

If you don't have a Mac, you can use a remote console service:

1. Add this to your HTML temporarily (for debugging only):
```html
<script>
// Simple remote console - sends logs to a server
// Replace with your logging endpoint
function remoteLog(level, ...args) {
  fetch('https://your-logging-endpoint.com/log', {
    method: 'POST',
    body: JSON.stringify({ level, args, timestamp: Date.now() }),
    headers: { 'Content-Type': 'application/json' }
  }).catch(() => {});
}
// Override console
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  remoteLog('log', ...args);
};
</script>
```

## Quick Test: Force Audio Playback

To test if audio files are loading correctly, temporarily add this to your game's MenuScene after the scene is created:

```javascript
// Temporary test - remove after debugging
if (isiOS) {
    setTimeout(() => {
        try {
            const testSound = this.sound.add('zombie-theme', { volume: 0.5 });
            testSound.play();
            console.log('🔊 TEST: Manual audio play attempted');
        } catch (err) {
            console.error('🔊 TEST: Manual audio play failed:', err);
        }
    }, 2000);
}
```

## Troubleshooting

### Web Inspector Not Showing Device
- Make sure USB cable is properly connected
- Trust the computer on your iPhone
- Restart Safari on both Mac and iPhone
- Check that Developer Mode is enabled on iPhone

### No Console Output
- Make sure you're on the correct tab in Web Inspector
- Check that "Preserve Log" is enabled in Console settings
- Try refreshing the page and watching console again

### Audio Context Issues
- Look for `contextState: 'suspended'` in logs
- Check if `isPlaying: true` after play() is called
- Verify audio files are loading (check Network tab)

## What to Share for Support

When reporting audio issues, please share:
1. Console logs (especially 🔊 prefixed messages)
2. Any error messages (🔊 TEST or console.error)
3. Audio context state (`contextState` in logs)
4. Whether `isPlaying: true` appears after play()
5. Browser version (iOS Safari version)

