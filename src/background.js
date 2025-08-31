// ============================================================================
// Background Script
// ============================================================================

import { StorageManager } from './popup/js/managers/StorageManager.js';

// Initialize storage when extension loads
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed, initializing storage...');
  await StorageManager.initializeStorage();
});

// Initialize storage when extension starts
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started, initializing storage...');
  await StorageManager.initializeStorage();
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'updateGptTheme') {
    try {
      await StorageManager.saveGptTheme(request.theme);
      console.log('GPT theme updated:', request.theme);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error updating GPT theme:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getGptTheme') {
    try {
      const gptTheme = await StorageManager.getGptTheme();
      sendResponse({ success: true, theme: gptTheme });
    } catch (error) {
      console.error('Error getting GPT theme:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// Initialize storage immediately
StorageManager.initializeStorage().then(() => {
  console.log('Background script storage initialized');
}).catch(error => {
  console.error('Background script storage initialization failed:', error);
});
