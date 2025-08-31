/**
 * ChatGPT Conversations Manager - Popup Script
 * Handles the extension popup UI and user interactions
 */

// ============================================================================
// Constants
// ============================================================================

const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
  CHATGPT: 'chatgpt'
};

const BATCH_SIZE_CONFIG = {
  MIN: 1,
  MAX: 250,
  PRESETS: [10, 50, 100]
};

const DEFAULT_SETTINGS = {
  theme: THEMES.LIGHT,
  batchSize: 50,
  isCustomBatchSize: false,
  preventDelete: true,
  preventArchive: true,
  gptTheme: null
};

// ============================================================================
// State Management
// ============================================================================

class PopupState {

  constructor() {
    this.currentTheme = THEMES.LIGHT;
    this.currentBatchSize = 50;
    this.isCustomBatchSize = false;
    this.previousBatchSize = 50;
    this.previousWasCustom = false;
    this.currentPage = 'main';
    this.pendingChanges = {}; // Simple object to track pending changes
    this.originalSettings = {}; // Reference values when entering settings
    this.gptTheme = null;
  }

  setTheme(theme) {
    this.currentTheme = theme;
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.body.className = `theme-${theme}`;
  }

  setBatchSize(size) {
    this.currentBatchSize = size;
  }

  setCustomBatchSize(isCustom) {
    this.isCustomBatchSize = isCustom;
  }

  setCurrentPage(page) {
    this.currentPage = page;
    // Save current page to storage
    this.saveCurrentPageToStorage(page);
  }

  // Save current page to storage
  async saveCurrentPageToStorage(page) {
    try {
      // Load existing popup state to preserve unsavedChanges
      const existingState = await StorageManager.loadPopupState();
      const unsavedChanges = existingState && existingState.unsavedChanges ? existingState.unsavedChanges : {};
      
      await StorageManager.savePopupState(page, unsavedChanges);
      console.log('Saved current page to storage:', page);
    } catch (error) {
      console.error('Error saving current page:', error);
    }
  }

  setGptTheme(theme) {
    this.gptTheme = theme;
  }

  // Smart change tracking - compare with original values
  addPendingChange(key, value) {
    // If value is same as original, remove from pending changes
    if (this.originalSettings[key] === value) {
      delete this.pendingChanges[key];
      console.log('Removed pending change (reverted to original):', key, value);
    } else {
      // If value is different, add to pending changes
      this.pendingChanges[key] = value;
      console.log('Added pending change:', key, value);
    }
    
    // Save pending changes to extension storage
    this.savePendingChangesToStorage();
    
    // Update save button state
    SettingsManager.updateSaveButtonState();
  }

  // Check if there are pending changes
  hasPendingChanges() {
    return Object.keys(this.pendingChanges).length > 0;
  }

  // Clear pending changes and original settings (when saving or leaving)
  async clearPendingChanges() {
    this.pendingChanges = {};
    this.originalSettings = {};
    
    // Clear from extension storage (keep currentPage, clear only unsavedChanges)
    try {
      await StorageManager.savePopupState(this.currentPage, {});
      console.log('Cleared pending changes and original settings from storage');
    } catch (error) {
      console.error('Error clearing pending changes from storage:', error);
    }
  }

  // Get pending changes for display
  getPendingChanges() {
    return { ...this.pendingChanges };
  }

  // Set original settings as reference when entering settings page
  setOriginalSettings(settings) {
    this.originalSettings = { ...settings };
    console.log('Set original settings as reference:', this.originalSettings);
  }

  // Save pending changes to extension storage (only unsavedChanges, not currentPage)
  async savePendingChangesToStorage() {
    try {
      // Load existing popup state to preserve currentPage
      const existingState = await StorageManager.loadPopupState();
      const currentPage = existingState ? existingState.currentPage : this.currentPage;
      
      // Always save an object (empty {} if no changes, not null)
      const unsavedChanges = Object.keys(this.pendingChanges).length > 0 ? this.pendingChanges : {};
      await StorageManager.savePopupState(currentPage, unsavedChanges);
      console.log('Saved pending changes to storage:', unsavedChanges);
    } catch (error) {
      console.error('Error saving pending changes:', error);
    }
  }

  // Restore pending changes from extension storage
  async restorePendingChangesFromStorage() {
    try {
      const popupState = await StorageManager.loadPopupState();
      if (popupState && popupState.unsavedChanges) {
        this.pendingChanges = { ...popupState.unsavedChanges };
        console.log('Restored pending changes from storage:', this.pendingChanges);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error restoring pending changes:', error);
      return false;
    }
  }

}

const state = new PopupState();

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {

  // Tabs
  generalTab: document.getElementById('general-tab'),
  chatgptTab: document.getElementById('chatgpt-tab'),
  settingsPage: document.getElementById('settings-page'),
  loadingSkeleton: document.getElementById('loading-skeleton'),
  
  // Header actions
  backBtn: document.getElementById('back-btn'),
  settingsGear: document.getElementById('settings-gear'),
  
  // Action buttons
  openChatgptBtn: document.getElementById('open-chatgpt-btn'),
  openManagerBtn: document.getElementById('open-manager-btn'),
  
  // Settings elements
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  
  // Theme buttons - use function to get fresh elements
  get themeButtons() { return document.querySelectorAll('[data-theme]'); },
  
  // Batch size elements - use function to get fresh elements
  get batchInput() { return document.getElementById('batch-size'); },
  get batchPresets() { return document.querySelectorAll('[data-value]'); },
  
  // Action prevention toggles
  preventDelete: document.getElementById('prevent-delete'),
  preventArchive: document.getElementById('prevent-archive')

};

// Debug: Log element availability
console.log('🔍 DOM Elements loaded:', {
  generalTab: !!elements.generalTab,
  chatgptTab: !!elements.chatgptTab,
  settingsPage: !!elements.settingsPage,
  backBtn: !!elements.backBtn,
  settingsGear: !!elements.settingsGear,
  openChatgptBtn: !!elements.openChatgptBtn,
  openManagerBtn: !!elements.openManagerBtn,
  saveSettingsBtn: !!elements.saveSettingsBtn,
  cancelSettingsBtn: !!elements.cancelSettingsBtn
});

// Function to refresh DOM elements if they're not found
function refreshDOMElements() {
  console.log('🔄 Refreshing DOM elements...');
  
  // Refresh tab elements
  elements.generalTab = document.getElementById('general-tab');
  elements.chatgptTab = document.getElementById('chatgpt-tab');
  elements.settingsPage = document.getElementById('settings-page');
  elements.loadingSkeleton = document.getElementById('loading-skeleton');
  
  // Refresh header elements
  elements.backBtn = document.getElementById('back-btn');
  elements.settingsGear = document.getElementById('settings-gear');
  
  // Refresh action buttons
  elements.openChatgptBtn = document.getElementById('open-chatgpt-btn');
  elements.openManagerBtn = document.getElementById('open-manager-btn');
  
  // Refresh settings elements
  elements.saveSettingsBtn = document.getElementById('save-settings-btn');
  
  console.log('🔍 DOM Elements after refresh:', {
    generalTab: !!elements.generalTab,
    chatgptTab: !!elements.chatgptTab,
    settingsPage: !!elements.settingsPage,
    backBtn: !!elements.backBtn,
    settingsGear: !!elements.settingsGear,
    openChatgptBtn: !!elements.openChatgptBtn,
    openManagerBtn: !!elements.openManagerBtn,
    saveSettingsBtn: !!elements.saveSettingsBtn
  });
}

// ============================================================================
// Storage Management
// ============================================================================

class StorageManager {

  static async getSettings() {
    try {
      const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);

      return { ...DEFAULT_SETTINGS, ...result };
    } catch (error) {
      console.error('Error loading settings:', error);

      return DEFAULT_SETTINGS;
    }
  }

  static async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);

      return true;
    } catch (error) {
      console.error('Error saving settings:', error);

      return false;
    }
  }

  static async savePopupState(page, unsavedChanges) {
    try {
      const popupState = {
        popupState: {
          currentPage: page,
          unsavedChanges: unsavedChanges,
          timestamp: Date.now()
        }
      };
      
      console.log('💾 Saving popup state to storage:', popupState);
      await chrome.storage.local.set(popupState);
      console.log('✅ Popup state saved successfully');
      return true;
    } catch (error) {
      console.error('💥 Error saving popup state:', error);
      return false;
    }
  }

  static async loadPopupState() {
    try {
      console.log('📂 Loading popup state from storage...');
      const result = await chrome.storage.local.get('popupState');
      console.log('📦 Raw storage result:', result);
      
      const popupState = result.popupState || null;
      console.log('🔍 Extracted popup state:', popupState);
      
      return popupState;
    } catch (error) {
      console.error('💥 Error loading popup state:', error);
      return null;
    }
  }

}

// ============================================================================
// Theme Management
// ============================================================================

class ThemeManager {
  
  static async loadAndApplyTheme() {
    const settings = await StorageManager.getSettings();
    
    console.log('Loading theme:', settings.theme);
    
    // Store GPT theme in state
    state.setGptTheme(settings.gptTheme);
    
    // Apply the actual theme based on selection
    let actualTheme = settings.theme;
    
    if (settings.theme === THEMES.SYSTEM) {
      // Check system preference
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
    } else if (settings.theme === THEMES.CHATGPT) {
      // Use stored GPT theme if available, otherwise fallback to system
      if (settings.gptTheme) {
        actualTheme = settings.gptTheme;
      } else {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
      }
    }
    
    // Apply theme to DOM without state change first
    document.body.className = `theme-${actualTheme}`;
    console.log('Applied theme to DOM:', document.body.className);
    
    // Then update state
    state.setTheme(settings.theme);
    state.currentBatchSize = settings.batchSize;
    
    // Update UI to reflect current theme
    this.updateThemeButtons(settings.theme);
    
    // Load settings form after theme is applied
    await SettingsManager.loadSettingsForm();
    
    // Listen for system theme changes
    this.setupSystemThemeListener();
  }

  static async loadSettings() {
    const settings = await StorageManager.getSettings();
    state.currentTheme = settings.theme;
    state.currentBatchSize = settings.batchSize;
    
    // Update UI to reflect current theme
    this.updateThemeButtons(settings.theme);
  }

  static updateThemeButtons(activeTheme) {
    const themeButtons = elements.themeButtons;
    console.log('Updating theme buttons:', activeTheme, 'Found buttons:', themeButtons.length);
    if (themeButtons.length > 0) {
      themeButtons.forEach(btn => {
        const theme = btn.dataset.theme;
        btn.classList.toggle('active', theme === activeTheme);
        
        // Handle disabled state for GPT theme
        if (theme === THEMES.CHATGPT) {
          btn.disabled = !state.gptTheme;
          btn.classList.toggle('disabled', !state.gptTheme);
        }
        
        console.log('Theme button:', theme, 'Active:', theme === activeTheme, 'Disabled:', btn.disabled);
      });
    }
  }

  static async selectTheme(theme) {
    console.log('Selecting theme:', theme);
    
    // Update the state and UI
    state.setTheme(theme);
    this.updateThemeButtons(theme);
    
    // Apply the actual theme based on selection
    let actualTheme = theme;
    
    if (theme === THEMES.SYSTEM) {
      // Check system preference
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
    } else if (theme === THEMES.CHATGPT) {
      // Use stored GPT theme if available, otherwise fallback to system
      if (state.gptTheme) {
        actualTheme = state.gptTheme;
      } else {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
      }
    }
    
    // Apply theme to DOM immediately for user feedback
    document.body.className = `theme-${actualTheme}`;
    console.log('Applied theme to DOM:', document.body.className);
    
    // Add to pending changes
    state.addPendingChange('theme', theme);
    
    console.log('Theme changed to:', theme);
  }

  // Update GPT theme from ChatGPT website
  static async updateGptTheme(gptTheme) {
    console.log('Updating GPT theme:', gptTheme);
    state.setGptTheme(gptTheme);
    
    // Update UI to enable GPT theme button if it was disabled
    this.updateThemeButtons(state.currentTheme);
    
    // Save to storage
    const settings = await StorageManager.getSettings();
    settings.gptTheme = gptTheme;
    await chrome.storage.sync.set(settings);
    
    console.log('GPT theme updated and saved:', gptTheme);
  }

  // Listen for system theme changes
  static setupSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e) => {
      // Only update if current theme is system
      if (state.currentTheme === THEMES.SYSTEM) {
        const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
        document.body.className = `theme-${newTheme}`;
        console.log('System theme changed, applied:', newTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleThemeChange);
  }
}

// ============================================================================
// Settings Management
// ============================================================================

class SettingsManager {
  static async loadSettingsForm() {
    const settings = await StorageManager.getSettings();
    console.log('Loading settings form with settings:', settings);
    
    // Store original settings as reference for change detection
    state.setOriginalSettings(settings);
    
    // Update state with loaded settings
    state.currentTheme = settings.theme;
    state.currentBatchSize = settings.batchSize;
    state.isCustomBatchSize = settings.isCustomBatchSize || false;
    state.setGptTheme(settings.gptTheme || null);
    
    console.log('Updated state:', {
      theme: state.currentTheme,
      batchSize: state.currentBatchSize,
      isCustom: state.isCustomBatchSize
    });
    
    // Update UI elements
    if (elements.batchInput) {
      console.log('Batch input found, updating...');
      // Check if it's a preset value or custom
      if (settings.isCustomBatchSize) {
        elements.batchInput.value = settings.batchSize;
        this.updatePresetButtons('custom');
      } else {
        elements.batchInput.value = '';
        this.updatePresetButtons(settings.batchSize);
      }
    } else {
      console.log('No batch input found, updating presets only');
      this.updatePresetButtons(settings.batchSize);
    }
    
    if (elements.preventDelete) {
      elements.preventDelete.checked = settings.preventDelete;
    }
    if (elements.preventArchive) {
      elements.preventArchive.checked = settings.preventArchive;
    }
    
    // Update save button state after loading settings
    this.updateSaveButtonState();
  }

  static updatePresetButtons(selectedValue) {
    const batchPresets = elements.batchPresets;
    console.log('Updating batch presets:', selectedValue, 'Found buttons:', batchPresets.length);
    if (batchPresets.length > 0) {
      batchPresets.forEach(btn => {
        const value = parseInt(btn.dataset.value);
        btn.classList.toggle('active', value === selectedValue);
        console.log('Batch button:', value, 'Active:', value === selectedValue);
      });
    }

    // Handle custom field state
    const customWrapper = document.querySelector('.custom-batch-wrapper');
    if (customWrapper) {
      if (selectedValue === 'custom') {
        customWrapper.classList.add('active');
        console.log('Custom wrapper set to active');
      } else {
        customWrapper.classList.remove('active');
        console.log('Custom wrapper set to inactive');
      }
    }
  }

  static async saveSettings() {
    const batchSize = parseInt(elements.batchInput?.value) || 50;
    const isCustom = !BATCH_SIZE_CONFIG.PRESETS.includes(batchSize);
    
    const newSettings = {
      theme: state.currentTheme,
      batchSize: batchSize,
      isCustomBatchSize: isCustom,
      preventDelete: elements.preventDelete?.checked || true,
      preventArchive: elements.preventArchive?.checked || true
    };

    const success = await StorageManager.saveSettings(newSettings);
    
    if (success) {
      // Apply the saved theme to the DOM
      document.body.className = `theme-${newSettings.theme}`;
      
      // Clear pending changes and original settings since settings are saved
      await state.clearPendingChanges();
      
      // Go back to main page and update popup state
      await NavigationManager.goBackWithoutConfirmation();
      
      // Small delay to ensure we're back on main page
      setTimeout(() => {
        this.showToast('Settings saved successfully!');
      }, 100);
    } else {
      this.showToast('Failed to save settings. Please try again.');
    }
  }

  // Simple method to check if there are pending changes
  static hasPendingChanges() {
    return state.hasPendingChanges();
  }

  // Update save button state based on pending changes
  static updateSaveButtonState() {
    if (elements.saveSettingsBtn) {
      const hasChanges = this.hasPendingChanges();
      elements.saveSettingsBtn.disabled = !hasChanges;
      elements.saveSettingsBtn.classList.toggle('disabled', !hasChanges);
      console.log('Save button state updated:', hasChanges ? 'enabled' : 'disabled');
    }
  }

  // Apply pending changes to UI elements
  static async applyPendingChangesToUI() {
    const pendingChanges = state.getPendingChanges();
    console.log('Applying pending changes to UI:', pendingChanges);
    
    // Apply theme if changed
    if (pendingChanges.theme) {
      state.setTheme(pendingChanges.theme);
      ThemeManager.updateThemeButtons(pendingChanges.theme);
      
      // Apply the actual theme based on selection
      let actualTheme = pendingChanges.theme;
      if (pendingChanges.theme === THEMES.SYSTEM) {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
    } else if (pendingChanges.theme === THEMES.CHATGPT) {
        if (state.gptTheme) {
          actualTheme = state.gptTheme;
        } else {
          actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
        }
      }
      document.body.className = `theme-${actualTheme}`;
    }
    
    // Apply batch size if changed
    if (pendingChanges.batchSize !== undefined) {
      state.currentBatchSize = pendingChanges.batchSize;
      if (pendingChanges.isCustomBatchSize) {
        if (elements.batchInput) {
          elements.batchInput.value = pendingChanges.batchSize;
        }
        this.updatePresetButtons('custom');
      } else {
        if (elements.batchInput) {
          elements.batchInput.value = '';
        }
        this.updatePresetButtons(pendingChanges.batchSize);
      }
    }
    
    // Apply toggles if changed
    if (pendingChanges.preventDelete !== undefined && elements.preventDelete) {
      elements.preventDelete.checked = pendingChanges.preventDelete;
    }
    if (pendingChanges.preventArchive !== undefined && elements.preventArchive) {
      elements.preventArchive.checked = pendingChanges.preventArchive;
    }
    
    console.log('Applied pending changes to UI successfully');
  }

  // Revert to original settings (when user confirms leaving/canceling)
  static async revertToOriginalSettings() {
    const originalSettings = state.originalSettings;
    console.log('Reverting to original settings:', originalSettings);
    
    // Revert theme
    if (originalSettings.theme) {
      state.setTheme(originalSettings.theme);
      ThemeManager.updateThemeButtons(originalSettings.theme);
      
      // Apply the actual theme based on selection
      let actualTheme = originalSettings.theme;
      if (originalSettings.theme === THEMES.SYSTEM) {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
      } else if (originalSettings.theme === THEMES.CHATGPT) {
        if (state.gptTheme) {
          actualTheme = state.gptTheme;
        } else {
          actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
        }
      }
      document.body.className = `theme-${actualTheme}`;
    }
    
    // Revert batch size
    if (originalSettings.batchSize !== undefined) {
      state.currentBatchSize = originalSettings.batchSize;
      state.isCustomBatchSize = originalSettings.isCustomBatchSize || false;
      
      if (elements.batchInput) {
        if (originalSettings.isCustomBatchSize) {
          elements.batchInput.value = originalSettings.batchSize;
          this.updatePresetButtons('custom');
        } else {
          elements.batchInput.value = '';
          this.updatePresetButtons(originalSettings.batchSize);
        }
      }
    }
    
    // Revert toggles
    if (originalSettings.preventDelete !== undefined && elements.preventDelete) {
      elements.preventDelete.checked = originalSettings.preventDelete;
    }
    if (originalSettings.preventArchive !== undefined && elements.preventArchive) {
      elements.preventArchive.checked = originalSettings.preventArchive;
    }
    
    console.log('Reverted to original settings successfully');
  }

  static showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.querySelector('.toast-message');
    
    if (toast && toastMessage) {
      toastMessage.textContent = message;
      toast.style.display = 'block';
      
      // Hide toast after 3 seconds with slide-out animation
      setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease-in';
        setTimeout(() => {
          toast.style.display = 'none';
          toast.style.animation = 'toastSlideIn 0.3s ease-out';
        }, 300);
      }, 3000);
    }
  }

  static restoreUnsavedChanges(changes) {
    if (!changes) return;
    
    // Restore theme
    state.setTheme(changes.theme);
    state.currentBatchSize = changes.batchSize;
    state.isCustomBatchSize = changes.isCustomBatchSize;
    
    // Update UI
    ThemeManager.updateThemeButtons(changes.theme);
    document.body.className = `theme-${changes.theme}`;
    
    // Restore batch size
    if (elements.batchInput) {
      if (changes.isCustomBatchSize) {
        elements.batchInput.value = changes.batchSize;
        this.updatePresetButtons('custom');
      } else {
        elements.batchInput.value = '';
        this.updatePresetButtons(changes.batchSize);
      }
    }
    
    // Restore toggles
    if (elements.preventDelete) {
      elements.preventDelete.checked = changes.preventDelete;
    }
    if (elements.preventArchive) {
      elements.preventArchive.checked = changes.preventArchive;
    }
    
    // Mark as changed
    state.markSettingsChanged();
    state.originalSettings = { ...changes };
    
    console.log('Restored unsaved changes:', changes);
  }
}

// ============================================================================
// Navigation Management
// ============================================================================

class NavigationManager {
  static showGeneralTab() {
    console.log('🏠 Showing general tab...');
    
    // Refresh elements if they're not found
    if (!elements.generalTab || !elements.chatgptTab || !elements.settingsPage) {
      console.log('⚠️ Some elements not found, refreshing DOM elements...');
      refreshDOMElements();
    }
    
    console.log('🔍 Elements found:', {
      generalTab: !!elements.generalTab,
      chatgptTab: !!elements.chatgptTab,
      settingsPage: !!elements.settingsPage,
      backBtn: !!elements.backBtn,
      settingsGear: !!elements.settingsGear
    });
    
    if (!elements.generalTab) {
      console.error('💥 General tab element still not found after refresh!');
      return;
    }
    
    elements.generalTab.style.display = 'flex';
    elements.chatgptTab.style.display = 'none';
    elements.settingsPage.style.display = 'none';
    elements.backBtn.style.display = 'none';
    elements.settingsGear.style.display = 'flex';
    
    console.log('✅ General tab display updated');
    state.setCurrentPage('main');
  }

  static showChatGPTTab() {
    console.log('🤖 Showing ChatGPT tab...');
    
    // Refresh elements if they're not found
    if (!elements.chatgptTab || !elements.generalTab || !elements.settingsPage) {
      console.log('⚠️ Some elements not found, refreshing DOM elements...');
      refreshDOMElements();
    }
    
    console.log('🔍 Elements found:', {
      generalTab: !!elements.generalTab,
      chatgptTab: !!elements.chatgptTab,
      settingsPage: !!elements.settingsPage,
      backBtn: !!elements.backBtn,
      settingsGear: !!elements.settingsGear
    });
    
    if (!elements.chatgptTab) {
      console.error('💥 ChatGPT tab element still not found after refresh!');
      return;
    }
    
    elements.generalTab.style.display = 'none';
    elements.chatgptTab.style.display = 'flex';
    elements.settingsPage.style.display = 'none';
    elements.backBtn.style.display = 'none';
    elements.settingsGear.style.display = 'flex';
    
    console.log('✅ ChatGPT tab display updated');
    state.setCurrentPage('chatgpt');
  }

  static async showSettingsPage() {
    // Hide all main content and skeleton
    elements.generalTab.style.display = 'none';
    elements.chatgptTab.style.display = 'none';
    elements.settingsPage.style.display = 'flex';
    elements.backBtn.style.display = 'flex';
    elements.settingsGear.style.display = 'none';
    
    // Hide loading skeleton if it's visible
    hideLoadingSkeleton();
    
    // Cancel any ongoing ChatGPT status check
    state.cancelChatGPTCheck = true;
    
    state.setCurrentPage('settings');
    
    await SettingsManager.loadSettingsForm();
  }

  static async goBack() {
    if (state.hasPendingChanges()) {
      return this.showConfirmationModal(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        'Yes, Leave',
        'Keep Editing'
      );
    } else {
      await checkChatGPTStatus();
    }
  }

  static async cancelSettings() {
    if (state.hasPendingChanges()) {
      return this.showConfirmationModal(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to cancel?',
        'Yes, Cancel',
        'Keep Editing'
      );
    } else {
      await this.goBack();
    }
  }

  static async showConfirmationModal(title, message, confirmText, cancelText) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-action-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    
    if (modal && titleEl && messageEl && confirmBtn && cancelBtn) {
      // Set modal content
      titleEl.textContent = title;
      messageEl.textContent = message;
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      
      // Show modal
      modal.style.display = 'flex';
      
      // Return a promise that resolves when user makes a choice
      return new Promise((resolve) => {
        const handleConfirm = () => {
          modal.style.display = 'none';
          confirmBtn.removeEventListener('click', handleConfirm);
          cancelBtn.removeEventListener('click', handleCancel);
          resolve('confirm');
        };
        
        const handleCancel = () => {
          modal.style.display = 'none';
          confirmBtn.removeEventListener('click', handleConfirm);
          cancelBtn.removeEventListener('click', handleCancel);
          resolve('cancel');
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
      });
    }
    
    return 'cancel'; // Default to cancel if modal elements not found
  }

  static async goBackWithoutConfirmation() {
    // This method is called after user confirms leaving settings
    // We need to determine which page to go back to based on ChatGPT status
    state.cancelChatGPTCheck = false; // Reset cancellation flag
    await checkChatGPTStatus();
  }
}

// ============================================================================
// ChatGPT Status Management
// ============================================================================

async function checkChatGPTStatus() {
  const tab = await getCurrentTab();
  
  if (!await isOnChatGPT(tab)) {
    NavigationManager.showGeneralTab();
    return;
  }

  showLoadingSkeleton();
  
  let response;
  try {
    response = await fetch('https://chatgpt.com/api/auth/session', {
      method: 'GET',
      credentials: 'include'
    });
  } catch (error) {
    redirectToTab('general');
    return;
  }
  
  if (response.ok) {
    const sessionData = await response.json();
    
    if (sessionData.user && sessionData.accessToken) {
      const userInfo = {
        email: sessionData.user.email,
        planType: sessionData.account?.planType || 'free'
      };
      
      const themeResponse = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => localStorage.getItem('theme')
      });
      
      if (themeResponse?.[0]?.result) {
        await ThemeManager.updateGptTheme(themeResponse[0].result);
      }
      
      redirectToTab('chatgpt');
      updateUserInfo(userInfo);
      return;
    }
  }
  
  redirectToTab('general');
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function redirectToTab(tabType) {
  hideLoadingSkeleton();
  
  if (state.cancelChatGPTCheck) return;
  
  if (tabType === 'general') {
    NavigationManager.showGeneralTab();
  } else if (tabType === 'chatgpt') {
    NavigationManager.showChatGPTTab();
  }
}

async function isOnChatGPT(tab) {
  if (!tab || !tab.url) return false;
  
  const chatgptPatterns = [
    'chatgpt.com',
    'chat.openai.com',
    'chatgpt.azure.com'
  ];
  
  return chatgptPatterns.some(pattern => tab.url.includes(pattern));
}

// ============================================================================
// Event Handlers
// ============================================================================

class EventHandlers {
  static setupEventListeners() {
    // Navigation events
    if (elements.settingsGear) {
      elements.settingsGear.addEventListener('click', async () => {
        await NavigationManager.showSettingsPage();
      });
    }

    if (elements.backBtn) {
      elements.backBtn.addEventListener('click', async () => {
        const result = await NavigationManager.goBack();

        if (result === 'confirm') {
          await SettingsManager.revertToOriginalSettings();
          await state.clearPendingChanges();

          await checkChatGPTStatus();
        }
      });
    }

    // Action buttons
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
    console.log('Setting up theme buttons:', themeButtons.length);
    if (themeButtons.length > 0) {
      themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const theme = btn.dataset.theme;
          console.log('Theme button clicked:', theme);
          ThemeManager.selectTheme(theme);
        });
      });
    }

    // Custom batch wrapper click
    const customWrapper = document.querySelector('.custom-batch-wrapper');
    if (customWrapper) {
      // Update tooltip with configurable bounds
      customWrapper.title = `Enter a number between ${BATCH_SIZE_CONFIG.MIN} and ${BATCH_SIZE_CONFIG.MAX}`;
      
      // Update input attributes with configurable bounds
      if (elements.batchInput) {
        elements.batchInput.min = BATCH_SIZE_CONFIG.MIN;
        elements.batchInput.max = BATCH_SIZE_CONFIG.MAX;
      }
      
      customWrapper.addEventListener('click', () => {
        if (elements.batchInput) {
          elements.batchInput.focus();
        }
      });
    }

    // Batch size input
    if (elements.batchInput) {
      // Store previous value when focusing
      elements.batchInput.addEventListener('focus', (e) => {
        // Store the current valid value as previous
        if (state.isCustomBatchSize && state.currentBatchSize >= BATCH_SIZE_CONFIG.MIN && state.currentBatchSize <= BATCH_SIZE_CONFIG.MAX) {
          // Previous was custom with valid value
          state.previousBatchSize = state.currentBatchSize;
          state.previousWasCustom = true;
        } else {
          // Previous was preset
          state.previousBatchSize = state.currentBatchSize;
          state.previousWasCustom = false;
        }
      });

      elements.batchInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value >= BATCH_SIZE_CONFIG.MIN && value <= BATCH_SIZE_CONFIG.MAX) {
          // Mark custom as active when typing valid value
          SettingsManager.updatePresetButtons('custom');
          state.setCustomBatchSize(true);
          // Don't mark as changed yet - wait for blur
        } else if (e.target.value === '') {
          // If cleared, keep custom selected but don't mark as changed yet
          SettingsManager.updatePresetButtons('custom');
          state.setCustomBatchSize(true);
          // Don't mark as changed yet - wait for blur
        }
      });

              // Handle focus out - validate and save or revert
        elements.batchInput.addEventListener('blur', async (e) => {
          const value = parseInt(e.target.value);
          
          if (e.target.value === '' || value < BATCH_SIZE_CONFIG.MIN || value > BATCH_SIZE_CONFIG.MAX) {
            // Invalid or empty - revert to previous selection
            if (state.previousWasCustom && state.previousBatchSize >= BATCH_SIZE_CONFIG.MIN && state.previousBatchSize <= BATCH_SIZE_CONFIG.MAX) {
              // If previous was custom with valid value, restore it
              elements.batchInput.value = state.previousBatchSize;
              state.currentBatchSize = state.previousBatchSize;
              state.setCustomBatchSize(true);
              SettingsManager.updatePresetButtons('custom');
              // No change - don't mark as changed
            } else {
              // If previous was preset, revert to preset
              elements.batchInput.value = '';
              state.currentBatchSize = state.previousBatchSize;
              state.setCustomBatchSize(false);
              SettingsManager.updatePresetButtons(state.previousBatchSize);
              // No change - don't mark as changed
            }
          } else {
            // Valid value - save it and mark as changed
            state.currentBatchSize = value;
            state.setCustomBatchSize(true);
            
            // Add to pending changes
            state.addPendingChange('batchSize', value);
            state.addPendingChange('isCustomBatchSize', true);
          }
        });
    }

            // Batch size presets
        const batchPresets = elements.batchPresets;
        console.log('Setting up batch presets:', batchPresets.length);
        if (batchPresets.length > 0) {
          batchPresets.forEach(btn => {
            btn.addEventListener('click', async () => {
              const value = parseInt(btn.dataset.value);
              console.log('Batch preset clicked:', value);
              // Clear custom input and set preset value
              if (elements.batchInput) {
                elements.batchInput.value = '';
              }
              SettingsManager.updatePresetButtons(value);
              state.setCustomBatchSize(false);
              state.currentBatchSize = value;
              
              // Add to pending changes
              state.addPendingChange('batchSize', value);
              state.addPendingChange('isCustomBatchSize', false);
              
              console.log('Batch size changed to:', value);
            });
          });
        }

            // Action prevention toggles
        if (elements.preventDelete && elements.preventArchive) {
          [elements.preventDelete, elements.preventArchive].forEach(toggle => {
            toggle.addEventListener('change', async () => {
              // Add to pending changes
              const key = toggle.id === 'prevent-delete' ? 'preventDelete' : 'preventArchive';
              state.addPendingChange(key, toggle.checked);
            });
          });
        }
  }
}

// ============================================================================
// Loading State Management
// ============================================================================

function showLoadingSkeleton() {
    if (elements.generalTab) elements.generalTab.style.display = 'none';
  if (elements.chatgptTab) elements.chatgptTab.style.display = 'none';
  if (elements.settingsPage) elements.settingsPage.style.display = 'none';
  
  if (elements.loadingSkeleton) {
    elements.loadingSkeleton.style.display = 'flex';
  }
}

function hideLoadingSkeleton() {  
  if (elements.loadingSkeleton) {
    elements.loadingSkeleton.style.display = 'none';
  }
}

// ============================================================================
// User Info Management
// ============================================================================

function updateUserInfo(userInfo) {
  try {
    const emailElement = document.getElementById('user-email');
    const planElement = document.getElementById('user-plan');
    
    if (emailElement) {
      emailElement.textContent = userInfo.email;
    }
    
    if (planElement) {
      // Format plan type nicely
      const planText = userInfo.planType === 'plus' ? 'Plus Plan' : 
                      userInfo.planType === 'team' ? 'Team Plan' : 
                      userInfo.planType === 'enterprise' ? 'Enterprise Plan' : 
                      'Free Plan';
      planElement.textContent = planText;
    }
    
    console.log('✅ Updated user info in UI:', userInfo);
  } catch (error) {
    console.error('💥 Error updating user info:', error);
  }
}

// ============================================================================
// Initialization
// ============================================================================

async function initializePopup() {
  try {
    console.log('🚀 Starting popup initialization...');
    
    // Refresh DOM elements to ensure they're available
    refreshDOMElements();
    
    // Setup event listeners first
    EventHandlers.setupEventListeners();
    console.log('✅ Event listeners setup complete');
    
    // Load and apply theme
    await ThemeManager.loadAndApplyTheme();
    console.log('✅ Theme loaded and applied');
    
    // Try to restore previous popup state
    const popupState = await StorageManager.loadPopupState();
    console.log('📦 Loaded popup state from storage:', popupState);
    
    if (popupState && popupState.currentPage === 'settings') {
      // We have settings page stored, restore it
      console.log('⚙️ Restoring settings page...');
      await NavigationManager.showSettingsPage();
      
      // Only restore pending changes if popup was unexpectedly closed (force-closed tab)
      const hasPendingChanges = await state.restorePendingChangesFromStorage();
      
      if (hasPendingChanges) {
        console.log('💾 Detected unexpected popup closure with pending changes, restoring them...');
        await SettingsManager.applyPendingChangesToUI();
      } else {
        console.log('📝 No pending changes to restore - popup was closed normally');
      }
    } else {
      // For main page or no stored state, check ChatGPT status
      console.log('🔍 Checking ChatGPT status to determine what to show...');
      await checkChatGPTStatus();
    }
    
    console.log('✅ Popup initialization complete');
    
  } catch (error) {
    console.error('💥 Error during popup initialization:', error);
    console.log('🔄 Falling back to ChatGPT status check due to error...');
    await checkChatGPTStatus();
  }
}

// No more auto-saving on tab switch - only save when user explicitly saves

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePopup);
