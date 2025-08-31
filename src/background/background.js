/**
 * ChatGPT Conversations Manager - Background Script
 * Handles extension lifecycle and inter-script communication
 */

// ============================================================================
// Constants
// ============================================================================

const EXTENSION_NAME = 'ChatGPT Conversations Manager';
const CHATGPT_DOMAIN = 'chatgpt.com';

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
      const settings = await chrome.storage.sync.get();
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
      await chrome.storage.sync.set(request.settings);
      sendResponse({
        success: true
      });
    } catch (error) {
      sendResponse({ error: 'Failed to save settings' });
    }
  }
}

// ============================================================================
// Storage Management
// ============================================================================

class StorageManager {
  static async getDefaultSettings() {
    return {
      theme: 'light',
      batchSize: 50,
      isCustomBatchSize: false,
      preventDelete: true,
      preventArchive: true
    };
  }

  static async initializeStorage() {
    try {
      const settings = await chrome.storage.sync.get();
      const defaultSettings = await this.getDefaultSettings();
      
      // Set default values for missing settings
      const updatedSettings = { ...defaultSettings, ...settings };
      await chrome.storage.sync.set(updatedSettings);
      
      console.log('Storage initialized with settings:', updatedSettings);
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  static async getSettings() {
    try {
      const defaultSettings = await this.getDefaultSettings();
      const settings = await chrome.storage.sync.get(defaultSettings);
      return { ...defaultSettings, ...settings };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return await this.getDefaultSettings();
    }
  }

  static async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      console.log('Settings saved:', settings);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
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
// Initialization
// ============================================================================

class BackgroundScript {
  static async initialize() {
    try {
      // Initialize storage
      await StorageManager.initializeStorage();
      
      // Initialize extension lifecycle
      ExtensionLifecycle.initialize();
      
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
