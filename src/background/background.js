/**
 * ChatGPT Conversations Manager - Background Script
 * Handles extension lifecycle and inter-script communication
 */

// ============================================================================
// Constants
// ============================================================================

const EXTENSION_NAME = 'ChatGPT Conversations Manager';
const CHATGPT_DOMAIN = 'chatgpt.com';

// Storage keys (matching popup constants)
const STORAGE_KEYS = {
  SETTINGS: 'settings',
  PENDING_CHANGES: 'pendingChanges',
  GPT_THEME: 'gptTheme'
};

// Default settings (shared with modal and popup)
const DEFAULT_SETTINGS = {
  theme: 'light',
  batchSize: 50,
  isCustomBatchSize: false,
  preventDelete: true,
  preventArchive: true
};

// Batch size configuration (matching popup constants)
const BATCH_SIZE_CONFIG = {
  MIN: 1,
  MAX: 250
};

// ============================================================================
// Simple Storage Helper for Background Script
// ============================================================================

class BackgroundStorageHelper {
  static async getSettings() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      if (result[STORAGE_KEYS.SETTINGS] && result[STORAGE_KEYS.SETTINGS].values) {
        return result[STORAGE_KEYS.SETTINGS].values;
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  static async saveSettings(settings) {
    try {
      // Get current storage structure
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      const currentStorage = result[STORAGE_KEYS.SETTINGS] || { values: DEFAULT_SETTINGS, changes: {} };
      
      // Update values and clear changes
      await chrome.storage.sync.set({ 
        [STORAGE_KEYS.SETTINGS]: {
          values: settings,
          changes: {}
        }
      });
      
      console.log('Settings saved by background script:', settings);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  static async initializeStorage() {
    try {
      // Check if we need to migrate from old flat storage
      const allStorage = await chrome.storage.sync.get();
      console.log('Background script - Current storage state:', allStorage);
      
      if (allStorage.theme || allStorage.batchSize || allStorage.preventDelete || allStorage.preventArchive) {
        console.log('Background script - Migrating from old flat storage structure...');
        
        // Extract old settings
        const oldSettings = {
          theme: allStorage.theme || DEFAULT_SETTINGS.theme,
          batchSize: allStorage.batchSize || DEFAULT_SETTINGS.batchSize,
          preventDelete: allStorage.preventDelete !== undefined ? allStorage.preventDelete : DEFAULT_SETTINGS.preventDelete,
          preventArchive: allStorage.preventArchive !== undefined ? allStorage.preventArchive : DEFAULT_SETTINGS.preventArchive
        };
        
        // Save to new structured storage
        await chrome.storage.sync.set({
          [STORAGE_KEYS.SETTINGS]: oldSettings,
          [STORAGE_KEYS.PENDING_CHANGES]: {},
          [STORAGE_KEYS.GPT_THEME]: allStorage.gptTheme || null
        });
        
        // Clear old flat storage
        await chrome.storage.sync.remove(['theme', 'batchSize', 'preventDelete', 'preventArchive', 'isCustomBatchSize']);
        
        console.log('Background script - Migration completed:', oldSettings);
      } else {
        // Ensure new structured storage exists
        const { settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
        if (!settings) {
          await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
        }
        
        const { pendingChanges } = await chrome.storage.sync.get(STORAGE_KEYS.PENDING_CHANGES);
        if (!pendingChanges) {
          await chrome.storage.sync.set({ [STORAGE_KEYS.PENDING_CHANGES]: {} });
        }
        
        const { gptTheme } = await chrome.storage.sync.get(STORAGE_KEYS.GPT_THEME);
        if (!gptTheme) {
          await chrome.storage.sync.set({ [STORAGE_KEYS.GPT_THEME]: null });
        }
      }
      
      console.log('Background script - Storage initialized successfully');
    } catch (error) {
      console.error('Background script - Error initializing storage:', error);
    }
  }
}

// ============================================================================
// Extension Lifecycle Management
// ============================================================================

class ExtensionLifecycle {
  static initialize() {
    console.log(`${EXTENSION_NAME} initialized`);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize extension state
    this.initializeState();
  }

  static setupEventListeners() {
    // Extension installation
    chrome.runtime.onInstalled.addListener(this.handleInstallation.bind(this));
    
    // Extension startup
    chrome.runtime.onStartup.addListener(this.handleStartup.bind(this));
    
    // Tab updates
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Tab activation
    chrome.tabs.onActivated.addListener(this.handleTabActivation.bind(this));
    
    // Extension icon click
    chrome.action.onClicked.addListener(this.handleIconClick.bind(this));
  }

  static initializeState() {
    // Extension state initialized - icon handled by manifest
    console.log('Extension state initialized');
  }

  static handleInstallation(details) {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
      // First time installation
      this.showWelcomeMessage();
    } else if (details.reason === 'update') {
      // Extension updated
      this.showUpdateMessage();
    }
  }

  static handleStartup() {
    console.log('Extension started');
  }

  static handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      this.handleTabComplete(tabId, tab);
    }
  }

  static handleTabActivation(activeInfo) {
    this.updateExtensionIcon(activeInfo.tabId);
  }

  static handleIconClick(tab) {
    // Icon click handled by manifest popup configuration
    console.log('Extension icon clicked for tab:', tab.id);
  }

  static async handleTabComplete(tabId, tab) {
    if (this.isChatGPTTab(tab.url)) {
      // Inject content script if not already injected
      await this.ensureContentScriptInjected(tabId);
      
      // Tab handling complete
      console.log('ChatGPT tab detected and handled');
    }
  }

  static isChatGPTTab(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === CHATGPT_DOMAIN || urlObj.hostname.endsWith(`.${CHATGPT_DOMAIN}`);
    } catch (error) {
      return false;
    }
  }

  static async ensureContentScriptInjected(tabId) {
    try {
      // Check if content script is already injected
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    } catch (error) {
      // Content script not injected, inject it
      await this.injectContentScript(tabId);
    }
  }

  static async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['src/content/content.css']
      });
      
      console.log('Content script injected for tab:', tabId);
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }

  static updateExtensionIcon(tabId = null) {
    // Chrome will automatically use the icon from manifest.json
    // No need to manually set icons that could cause errors
    console.log('Icon update requested - using manifest icon');
  }



  static showWelcomeMessage() {
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.svg',
      title: EXTENSION_NAME,
      message: 'Welcome! Click the extension icon to manage your ChatGPT conversations.'
    });
  }

  static showUpdateMessage() {
    // Show update notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.svg',
      title: EXTENSION_NAME,
      message: 'Extension updated successfully!'
    });
  }
}

// ============================================================================
// Message Handling
// ============================================================================

class MessageHandler {
  static handleMessage(request, sender, sendResponse) {
    console.log('Background received message:', request);
    
    switch (request.action) {
      case 'ping':
        this.handlePing(sendResponse);
        break;
      case 'getTabInfo':
        this.handleGetTabInfo(sender, sendResponse);
        break;
      case 'openTab':
        this.handleOpenTab(request, sendResponse);
        break;
      case 'getSettings':
        this.handleGetSettings(sendResponse);
        break;
      case 'saveSettings':
        this.handleSaveSettings(request, sendResponse);
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
    
    // Return true to indicate async response
    return true;
  }

  static handlePing(sendResponse) {
    sendResponse({ status: 'pong' });
  }

  static async handleGetTabInfo(sender, sendResponse) {
    try {
      const tab = await chrome.tabs.get(sender.tab.id);
      sendResponse({
        success: true,
        tab: {
          id: tab.id,
          url: tab.url,
          title: tab.title
        }
      });
    } catch (error) {
      sendResponse({ error: 'Failed to get tab info' });
    }
  }

  static async handleOpenTab(request, sendResponse) {
    try {
      const tab = await chrome.tabs.create({
        url: request.url,
        active: request.active !== false
      });
      
      sendResponse({
        success: true,
        tabId: tab.id
      });
    } catch (error) {
      sendResponse({ error: 'Failed to open tab' });
    }
  }

  static async handleGetSettings(sendResponse) {
    try {
      const settings = await BackgroundStorageHelper.getSettings();
      sendResponse({
        success: true,
        settings
      });
    } catch (error) {
      sendResponse({ error: 'Failed to get settings' });
    }
  }

  static async handleSaveSettings(request, sendResponse) {
    try {
      // Use simple storage approach for background script
      await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: request.settings });
      sendResponse({
        success: true
      });
    } catch (error) {
      sendResponse({ error: 'Failed to save settings' });
    }
  }
}



// ============================================================================
// Error Handling
// ============================================================================

class ErrorHandler {
  static handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    // Log error for debugging
    this.logError(error, context);
    
    // Show user-friendly error message if needed
    this.showErrorMessage(error, context);
  }

  static logError(error, context) {
    // In a production environment, you might want to send this to a logging service
    const errorLog = {
      timestamp: new Date().toISOString(),
      context,
      error: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent
    };
    
    console.log('Error logged:', errorLog);
  }

  static showErrorMessage(error, context) {
    // Show error notification to user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon.svg',
      title: `${EXTENSION_NAME} - Error`,
      message: `An error occurred: ${error.message}`
    });
  }
}

// ============================================================================
// URL Change Detection and Popup Refresh
// ============================================================================

class PopupRefreshManager {
  static initialize() {
    // Listen for tab updates (URL changes, page loads, etc.)
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Listen for tab activation (when user switches tabs)
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    
    console.log('Popup refresh manager initialized');
  }

  static async handleTabUpdate(tabId, changeInfo, tab) {
    // Only process if the tab is complete and has a URL
    if (changeInfo.status === 'complete' && tab.url) {
      await this.checkAndRefreshPopup(tab);
    }
  }

  static async handleTabActivated(activeInfo) {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url) {
        await this.checkAndRefreshPopup(tab);
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  static async checkAndRefreshPopup(tab) {
    try {
      // Check if this is a ChatGPT URL
      const isChatGPTUrl = this.isChatGPTUrl(tab.url);
      
      if (isChatGPTUrl) {
        // Get current settings to check if theme is set to ChatGPT
        const settings = await BackgroundStorageHelper.getSettings();
        
        if (settings.theme === 'chatgpt') {
          // Detect the theme from the ChatGPT page
          const detectedTheme = await this.detectChatGPTTheme(tab.id);
          
          if (detectedTheme) {
            // Update the gptTheme in storage
            await chrome.storage.sync.set({ [STORAGE_KEYS.GPT_THEME]: detectedTheme });
            
            // Notify popup to refresh if it's open
            await this.notifyPopupRefresh();
            
            console.log('ChatGPT theme detected and updated:', detectedTheme);
          }
        }
      }
    } catch (error) {
      console.error('Error checking popup refresh:', error);
    }
  }

  static isChatGPTUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'chatgpt.com' || 
             urlObj.hostname === 'chat.openai.com' ||
             urlObj.hostname === 'chatgpt.azure.com';
    } catch (error) {
      return false;
    }
  }

  static async detectChatGPTTheme(tabId) {
    try {
      // Inject content script to detect theme
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Check for dark mode indicators
          const isDark = document.documentElement.classList.contains('dark') ||
                        document.body.classList.contains('dark') ||
                        document.documentElement.getAttribute('data-theme') === 'dark' ||
                        document.body.getAttribute('data-theme') === 'dark';
          
          return isDark ? 'dark' : 'light';
        }
      });
      
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting ChatGPT theme:', error);
      return null;
    }
  }

  static async notifyPopupRefresh() {
    try {
      // Use runtime.sendMessage to notify popup instead of deprecated getViews
      // The popup will receive this message through the runtime message listener
      chrome.runtime.sendMessage({ 
        action: 'refreshTheme',
        source: 'background'
      }).catch(() => {
        // Popup might not be open, which is fine
        console.log('Popup not open, theme refresh message sent');
      });
      
      console.log('Theme refresh message sent to popup');
    } catch (error) {
      console.error('Error notifying popup refresh:', error);
    }
  }
}

// ============================================================================
// Initialization
// ============================================================================

class BackgroundScript {
  static async initialize() {
    try {
      // Initialize storage using the background storage helper
      await BackgroundStorageHelper.initializeStorage();
      
      // Initialize extension lifecycle
      ExtensionLifecycle.initialize();
      
      // Initialize popup refresh manager
      PopupRefreshManager.initialize();
      
      // Setup message listener
      chrome.runtime.onMessage.addListener(MessageHandler.handleMessage);
      
      console.log('Background script initialized successfully');
    } catch (error) {
      ErrorHandler.handleError(error, 'BackgroundScript.initialize');
    }
  }
}

// Initialize the background script
BackgroundScript.initialize();
