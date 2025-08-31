# ChatGPT Conversations Manager

A Chrome extension that provides an easy way to manage ChatGPT conversations with bulk selection and actions.

## Features

- **Bulk Selection**: Select multiple conversations at once with "Select All" functionality
- **Bulk Actions**: Delete, archive, and unarchive conversations in bulk
- **Search**: Filter conversations by title or ID
- **Pagination**: Load conversations in configurable batches
- **Theme Support**: Light, dark, system, and ChatGPT theme integration
- **Settings**: Configurable batch size and action prevention settings
- **Modern UI**: Clean, responsive interface with proper theming

## Project Structure

```
chatgpt-conversations-manager/
├── manifest.json                 # Extension manifest
├── README.md                     # Project documentation
├── INSTALL.md                    # Installation guide
├── src/
│   ├── popup/                    # Extension popup UI
│   │   ├── popup.html           # Popup HTML structure
│   │   ├── popup.css            # Popup styles
│   │   └── popup.js             # Popup logic
│   ├── content/                  # Content script for ChatGPT pages
│   │   ├── content.js           # Content script logic
│   │   └── content.css          # Modal and button styles
│   └── background/               # Background script
│       └── background.js        # Extension lifecycle management
└── icons/                        # Extension icons
    └── icon.svg                  # Extension icon (SVG format)
```

## Architecture

### Modular Design

The extension follows a modular architecture with clear separation of concerns:

#### **Popup Module** (`src/popup/`)
- **popup.html**: Clean HTML structure with semantic markup
- **popup.css**: Component-based CSS with theme system
- **popup.js**: Modular JavaScript with class-based architecture

#### **Content Script Module** (`src/content/`)
- **content.js**: Handles ChatGPT page integration and modal management
- **content.css**: Styles for the injected button and modal

#### **Background Script Module** (`src/background/`)
- **background.js**: Extension lifecycle and inter-script communication

### Key Classes

#### Popup (`src/popup/popup.js`)
- `PopupState`: Manages popup state and settings
- `StorageManager`: Handles Chrome storage operations
- `ThemeManager`: Manages theme switching and application
- `SettingsManager`: Handles settings form and validation
- `NavigationManager`: Manages tab navigation and display
- `EventHandlers`: Centralized event listener management

#### Content Script (`src/content/content.js`)
- `ContentState`: Manages modal and conversation state
- `APIManager`: Handles all ChatGPT API interactions
- `ModalManager`: Creates and manages the conversations modal
- `ConversationManager`: Handles conversation loading, rendering, and actions
- `ButtonManager`: Manages the injected sidebar button
- `MessageHandler`: Handles inter-script communication

#### Background Script (`src/background/background.js`)
- `ExtensionLifecycle`: Manages extension installation and updates
- `MessageHandler`: Handles background script message routing
- `StorageManager`: Manages extension-wide storage operations
- `ErrorHandler`: Centralized error handling and logging

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension will appear in your Chrome toolbar

## Usage

### Basic Usage
1. Go to [ChatGPT](https://chatgpt.com) and log in
2. Look for the "Manage Conversations" button in the left sidebar
3. Click it to open the conversations manager modal
4. Use "Select All" to choose multiple conversations
5. Perform bulk actions: delete, archive, or unarchive

### Settings
- Click the extension icon in the toolbar to open the popup
- Use the settings gear to configure:
  - **Theme**: Light, dark, system, or ChatGPT theme
  - **Batch Size**: Number of conversations to load per batch
  - **Action Prevention**: Toggle confirmation dialogs for actions

## Development

### File Organization

The project follows modern development practices:

- **Separation of Concerns**: Each file has a single responsibility
- **Modular Architecture**: Classes and functions are organized by purpose
- **Component-Based CSS**: Styles are organized by component
- **Clean Code**: Consistent naming conventions and documentation

### Adding New Features

1. **New UI Component**: Add HTML to appropriate file, CSS to component section, JS to relevant class
2. **New API Endpoint**: Add to `APIManager` class in content script
3. **New Setting**: Add to `DEFAULT_SETTINGS` and update relevant managers
4. **New Theme**: Add CSS variables and theme classes

### Code Style

- **JavaScript**: ES6+ with classes, async/await, and proper error handling
- **CSS**: Component-based with clear section comments
- **HTML**: Semantic markup with proper accessibility attributes
- **Comments**: JSDoc-style comments for classes and complex functions

## API Integration

The extension integrates with ChatGPT's backend API:

- **Authentication**: Uses `/api/auth/session` for access tokens
- **Conversations**: Fetches from `/backend-api/conversations`
- **Actions**: DELETE/PATCH requests to `/backend-api/conversation/{id}`
- **Settings**: Reads from `/backend-api/settings/user`

## Browser Compatibility

- **Chrome**: 88+ (Manifest V3)
- **Edge**: 88+ (Chromium-based)
- **Other Chromium browsers**: Should work with Manifest V3 support

## Security

- **Content Security Policy**: Strict CSP for extension pages
- **API Authorization**: Proper Bearer token authentication
- **Input Validation**: All user inputs are validated
- **Error Handling**: Comprehensive error handling without exposing sensitive data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues, feature requests, or questions:
1. Check the existing issues
2. Create a new issue with detailed information
3. Include browser version and extension version

---

**Note**: This extension is not affiliated with OpenAI or ChatGPT. It's a third-party tool for managing ChatGPT conversations.
