# Clickbait Ninja Chrome Extension

A Chrome extension that provides instant content summaries when hovering over links, helping users avoid clickbait and make informed decisions about which links to follow.

## Features

- 🥷 **Instant Summaries**: Hover over any link to see a 5-sentence summary
- ⚡ **Fast Performance**: Uses Chrome's built-in Summarizer API
- 🎯 **Smart Caching**: Remembers summaries for 10 minutes
- 🛡️ **Privacy Focused**: No external API calls, all processing happens locally
- 🌐 **Universal**: Works on any website with HTTP/HTTPS links

## Development

### Prerequisites

- Node.js 18+ 
- Chrome 138+ (for Summarizer API)

### Setup

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Run tests
npm test

# Watch mode for development
npm run watch
```

### Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this directory
4. The extension should now be active

### Project Structure

```
├── manifest.json          # Extension manifest (Manifest V3)
├── src/
│   ├── background.ts      # Service worker
│   ├── content.ts         # Content script
│   └── types.ts           # TypeScript definitions
├── assets/                # Icons and static assets
├── tests/                 # Test files
├── dist/                  # Compiled JavaScript (generated)
└── popup.html             # Extension popup UI
```

## Requirements

This extension requires Chrome 138+ for the built-in Summarizer API. On older versions, the extension will gracefully degrade and show appropriate error messages.

## License

MIT License - see LICENSE file for details.