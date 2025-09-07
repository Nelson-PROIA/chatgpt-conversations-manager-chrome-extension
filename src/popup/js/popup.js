// ============================================================================
// Main Popup Logic (Modular Version)
// ============================================================================

import { PAGES, BATCH_SIZE_CONFIG } from './constants/index.js';
import { checkChatGPTStatus, getChatGPTTheme } from './utils/chatgpt.js';
import { showLoadingSkeleton, hideLoadingSkeleton, getElements } from './utils/ui.js';
import { ComponentLoader } from './utils/components.js';
import { ThemeManager } from './managers/ThemeManager.js';
import { NavigationManager } from './managers/NavigationManager.js';
import { SettingsManager } from './managers/SettingsManager.js';
import { StateManager } from './managers/StateManager.js';
import { StorageManager } from './managers/StorageManager.js';

const stateManager = new StateManager();

NavigationManager.setState(stateManager);
SettingsManager.setState(stateManager);

function disableNavigationButtons() {
  const elements = getElements();
  
  // Hide settings button but keep it in layout
  if (elements.settingsGear) {
    elements.settingsGear.style.visibility = 'hidden';
    elements.settingsGear.style.pointerEvents = 'none';
  }
  
  // Hide back button but keep it in layout
  if (elements.backBtn) {
    elements.backBtn.style.visibility = 'hidden';
    elements.backBtn.style.pointerEvents = 'none';
  }
}

function enableNavigationButtons() {
  const elements = getElements();
  
  // Show settings button
  if (elements.settingsGear) {
    elements.settingsGear.style.visibility = 'visible';
    elements.settingsGear.style.pointerEvents = 'auto';
  }
  
  // Show back button
  if (elements.backBtn) {
    elements.backBtn.style.visibility = 'visible';
    elements.backBtn.style.pointerEvents = 'auto';
  }
}

async function initialize() {
  try {
    // Initialize storage first
    await StorageManager.initializeStorage();
    
    // Wait for StateManager to load initial state
    await stateManager.loadInitialState();
    
    // Apply theme FIRST to minimize flash
    await ThemeManager.loadTheme();
    
    await ComponentLoader.loadAllComponents();
    // Keep loading component visible as default state
    ComponentLoader.hideAllComponentsExceptLoading();
    
    // Now that components are loaded, disable navigation buttons
    disableNavigationButtons();
    
    
    await checkChatGPTStatusAndShowTab();
    setupEventListeners();
    
    // Mark initialization as complete and re-enable navigation buttons
    NavigationManager.setInitializationComplete();
    enableNavigationButtons();
  } catch (error) {
    console.error('Initialization error:', error);
    NavigationManager.showGeneralTab();
    // Mark initialization as complete and re-enable navigation buttons even on error
    NavigationManager.setInitializationComplete();
    enableNavigationButtons();
  }
}

async function checkChatGPTStatusAndShowTab() {
  // Check if we have pending changes
  const pendingChanges = await StorageManager.getPendingChanges();
  
  console.log('Checking for pending changes:', pendingChanges);
  
  // If we have pending changes, show settings page and reapply them
  if (Object.keys(pendingChanges).length > 0) {
    console.log('Found pending changes, showing settings page');
    // Mark initialization as complete first to allow navigation
    NavigationManager.setInitializationComplete();
    enableNavigationButtons();
    await NavigationManager.showSettingsPage();
    return;
  }
  
  // Otherwise check ChatGPT status and show appropriate tab
  const result = await checkChatGPTStatus();
  
  if (result.isLoggedIn) {
    if (result.tab) {
      const theme = await getChatGPTTheme(result.tab);
      if (theme) {
        await ThemeManager.updateGptTheme(theme);
        stateManager.setGptTheme(theme);
      }
    }
    
    updateUserInfo(result.userInfo);
    NavigationManager.showChatGPTTab();
  } else {
    NavigationManager.showGeneralTab();
  }
}

function updateUserInfo(userInfo) {
  const elements = getElements();
  
  if (elements.userPlan) {
    elements.userPlan.textContent = userInfo.planType === 'plus' ? 'Plus' : 'Free';
  }
  
  if (elements.userEmail) {
    elements.userEmail.textContent = userInfo.email;
  }
}

function setupEventListeners() {
  const elements = getElements();
  
  // Listen for messages from background script (for theme refresh)
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message && message.source === 'background' && message.action === 'refreshTheme') {
      console.log('Received theme refresh message from background script');
      await ThemeManager.refreshTheme();
      sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
  });
  
  if (elements.settingsGear) {
    console.log('Settings button found, adding event listener');
    elements.settingsGear.addEventListener('click', async () => {
      console.log('Settings button clicked');
      await NavigationManager.showSettingsPage();
    });
  } else {
    console.log('Settings button not found!');
  }

  if (elements.backBtn) {
    elements.backBtn.addEventListener('click', async () => {
      await NavigationManager.goBack();
    });
  }

  if (elements.openChatgptBtn) {
    elements.openChatgptBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://chatgpt.com' });
    });
  }

  if (elements.openManagerBtn) {
    elements.openManagerBtn.addEventListener('click', () => {
      chrome.tabs.sendMessage(
        chrome.tabs.query({ active: true, currentWindow: true })[0].id,
        { action: 'openManager' }
      );
    });
  }

  // Settings events
  if (elements.saveSettingsBtn) {
    elements.saveSettingsBtn.addEventListener('click', () => {
      SettingsManager.saveSettings();
    });
  }

  // Theme selection
  const themeButtons = elements.themeButtons;
  if (themeButtons.length > 0) {
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        ThemeManager.selectTheme(theme);
      });
    });
  }

  // Setup settings event listeners
  SettingsManager.setupSettingsEventListeners();
}

// Start the application
document.addEventListener('DOMContentLoaded', initialize);
