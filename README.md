# YT Equity Plus

A browser extension that reveals private equity ownership information for YouTube channels. See who really owns that YouTube channel.

## Features

- Works with uBlock Origin enabled
- Compatible with both Chrome and Firefox
- Shows investment status (funding/acquisition)
- Displays funding/acquiring firm information
- Links to official sources

## Installation

### Build from Source

1. Clone this repository
2. Run the build script:
   ```bash
   node build.js
   ```

### Chrome Installation

1. Build the extension (creates `build/chrome/` folder)
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `build/chrome/` folder

### Firefox Installation

1. Build the extension (creates `build/firefox/` folder)
2. Open `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file in `build/firefox/`

**Note:** Firefox temporary add-ons are removed when you restart Firefox. For permanent installation, the extension needs to be signed through Mozilla's developer portal.

## Usage

1. Navigate to any YouTube video or channel page
2. Look for the monocle (🧐) button near the channel info
3. Click the button to see ownership information
4. A popup will display:
   - Investment status (Independent/Funded/Acquired)
   - Funding/acquiring firm details (if applicable)
   - Link to official source

## Build Commands

```bash
# Build both Chrome and Firefox versions
node build.js

# Build only Chrome version
node build.js chrome

# Build only Firefox version
node build.js firefox

# Clean build directory
node build.js clean

# Using npm scripts
npm run build          # Build both versions
npm run build:chrome   # Chrome only
npm run build:firefox  # Firefox only
npm run clean          # Clean builds
```

## Browser Support

- **Chrome**: Manifest V3
- **Firefox**: Manifest V3 (requires Firefox 109+)

## Troubleshooting

### Extension Not Working

- Check browser console (F12 → Console) for "YT Equity Plus" debug messages
- Verify the extension is enabled in your browser's extension manager
- Try refreshing the YouTube page

### Button Not Appearing

- Make sure you're on a valid YouTube page (video or channel)
- Check if the channel identifier is being detected (see console logs)
- Try different YouTube pages

### Data Not Loading

- Check browser console for data loading errors
- Verify `data/channels.json` file exists in the extension folder

## Development

The extension uses a unified `content.js` file that works across both Chrome and Firefox by detecting the available browser APIs automatically.

Debug logging can be viewed in the browser console with the prefix "YT Equity Plus:".

## Credits

Fork of [kamo-chip/yt-equity](https://github.com/Kamo-Chip/yt-equity) with improvements for:

- uBlock Origin compatibility
- Firefox support
- Enhanced build system
- Better debugging
