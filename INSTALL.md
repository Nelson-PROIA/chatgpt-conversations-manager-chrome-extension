# Installation Guide

## Quick Start

1. **Download the Extension**
   - Download all files from this repository
   - Keep them in a folder together

2. **Open Chrome Extensions**
   - Type `chrome://extensions/` in your Chrome address bar
   - Or go to Chrome Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - Click "Select Folder"

5. **Verify Installation**
   - You should see "ChatGPT Conversations Manager" in your extensions list
   - The extension icon should appear in your Chrome toolbar

## Icon Setup

The extension includes an SVG icon file. To create the required PNG icons:

1. **Convert SVG to PNG**
   - Use an online SVG to PNG converter
   - Or use tools like Inkscape, GIMP, or Photoshop
   - Create icons in these sizes: 16x16, 48x48, 128x128

2. **Place Icons**
   - Save them as `icon16.svg`, `icon48.svg`, and `icon128.svg`
   - Put them in the `icons/` folder

## Testing the Extension

1. **Go to ChatGPT**
   - Navigate to [chat.openai.com](https://chat.openai.com)
   - Make sure you're logged in

2. **Look for the Button**
   - A "Manage Conversations" button should appear in the sidebar
   - It will be at the top of the left navigation panel

3. **Click the Extension Icon**
   - Click the extension icon in your Chrome toolbar
   - This should open the conversations manager modal

## Troubleshooting

### Extension Button Not Visible
- Refresh the ChatGPT page
- Check if the extension is enabled in `chrome://extensions/`
- Look for any error messages in the browser console

### Conversations Not Loading
- Ensure you have conversations in your ChatGPT sidebar
- Try refreshing the page
- Check if you're on the correct ChatGPT domain

### Permission Errors
- Make sure the extension has the necessary permissions
- Try disabling and re-enabling the extension

## File Structure

Your extension folder should look like this:

```
chatgpt-conversations-manager/
├── manifest.json
├── content.js
├── background.js
├── styles.css
├── popup.html
├── icons/
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   └── icon128.svg
├── README.md
├── INSTALL.md
└── package.json
```

## Updating the Extension

To update the extension:

1. Download the new files
2. Replace the old files in your extension folder
3. Go to `chrome://extensions/`
4. Click the refresh icon on the extension card
5. Or disable and re-enable the extension

## Uninstalling

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "ChatGPT Conversations Manager"
3. Click "Remove"
4. Confirm the removal

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify all files are in the correct locations
3. Ensure the extension is properly loaded
4. Check if ChatGPT's UI has changed

## Notes

- This extension only works on `chat.openai.com`
- It requires conversations to be visible in the sidebar
- The extension integrates with ChatGPT's existing UI
- All actions are performed through ChatGPT's native interface
