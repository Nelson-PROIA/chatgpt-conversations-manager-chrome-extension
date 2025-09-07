// ============================================================================
// Navigation Manager
// ============================================================================

import { PAGES } from '../constants/index.js';
import { showLoadingSkeleton, hideLoadingSkeleton, getElements } from '../utils/ui.js';
import { checkChatGPTStatus, getChatGPTTheme } from '../utils/chatgpt.js';
import { ThemeManager } from './ThemeManager.js';
import { SettingsManager } from './SettingsManager.js';

export class NavigationManager {
  static state = null;
  static isInitializing = true;

  static setState(stateInstance) {
    this.state = stateInstance;
  }

  static setInitializationComplete() {
    this.isInitializing = false;
  }

  static async showGeneralTab() {
    const elements = getElements();
    
    elements.generalTab.style.display = 'flex';

    elements.chatgptTab.style.display = 'none';
    elements.settingsPage.style.display = 'none';
    elements.loadingSkeleton.style.display = 'none';
    elements.loadingComponent.style.display = 'none';
    elements.backBtn.style.display = 'none';
    elements.settingsGear.style.display = 'flex';
  }

  static async showChatGPTTab() {
    const elements = getElements();
    
    // Hide loading component and show skeleton for ChatGPT content loading
    elements.loadingComponent.style.display = 'none';
    elements.loadingSkeleton.style.display = 'flex';
    elements.chatgptTab.style.display = 'none';
    elements.generalTab.style.display = 'none';
    elements.settingsPage.style.display = 'none';
    elements.backBtn.style.display = 'none';
    elements.settingsGear.style.display = 'flex';
    
    
    // Then show the actual ChatGPT tab
    elements.loadingSkeleton.style.display = 'none';
    elements.chatgptTab.style.display = 'flex';
    
    // Refresh theme if it's set to ChatGPT to get the latest gptTheme value
    await ThemeManager.refreshTheme();
  }

  static async showSettingsPage() {
    console.log('showSettingsPage called, isInitializing:', this.isInitializing);
    // Prevent navigation during initialization
    if (this.isInitializing) {
      console.log('Navigation blocked during initialization');
      return;
    }
    
    const elements = getElements();
    
    elements.settingsPage.style.display = 'flex';

    elements.generalTab.style.display = 'none';
    elements.chatgptTab.style.display = 'none';
    elements.loadingComponent.style.display = 'none';
    elements.loadingSkeleton.style.display = 'none';
    elements.backBtn.style.display = 'flex';
    elements.settingsGear.style.display = 'none';
    
    this.state.cancelChatGPTCheck = true;
    

    
    await SettingsManager.loadSettingsForm();
    
    // Make sure save button state reflects current pending changes
    SettingsManager.updateSaveButtonState();
    
    // Update theme button states to ensure GPT button is properly disabled if needed
    await ThemeManager.updateAllThemeButtonStates();
  }

  static async goBack() {
    if (this.state.hasPendingChanges()) {
      const result = await this.showConfirmationModal(
        'Discard Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        'Discard',
        'Keep Editing'
      );
      
      if (result === 'confirm') {
        // User confirmed leaving, navigate away first to avoid seeing settings reset
        await this.goBackWithoutConfirmation();
        // Then discard changes and revert settings
        await SettingsManager.revertToOriginalSettings();
        this.state.clearPendingChanges();
        // Reset the settings form to original state
        await SettingsManager.loadSettingsForm();
      }
      // If result is 'cancel', stay on settings page
    } else {
      // No pending changes, go back to main view
      await this.goBackWithoutConfirmation();
    }
  }

  static async goBackWithoutConfirmation() {
    this.state.cancelChatGPTCheck = false;
    
    // Check ChatGPT status and show appropriate tab (same logic as main popup)
    const result = await checkChatGPTStatus();
    
    if (result.isLoggedIn) {
      // Update user info and show ChatGPT tab if logged in
      if (result.userInfo) {
        this.updateUserInfo(result.userInfo);
      }
      await this.showChatGPTTab();
    } else {
      // Show general tab if not logged in
      await this.showGeneralTab();
    }
  }

  static updateUserInfo(userInfo) {
    const elements = getElements();
    
    if (elements.userPlan) {
      elements.userPlan.textContent = userInfo.planType === 'plus' ? 'Plus' : 'Free';
    }
    
    if (elements.userEmail) {
      elements.userEmail.textContent = userInfo.email;
    }
  }

  static async showConfirmationModal(title, message, confirmText, cancelText) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = modal.querySelector('#confirm-modal-title');
    const messageEl = modal.querySelector('#confirm-modal-message');
    const confirmBtn = modal.querySelector('#confirm-action-btn');
    const cancelBtn = modal.querySelector('#confirm-cancel-btn');
    
    if (modal && titleEl && messageEl && confirmBtn && cancelBtn) {
      titleEl.textContent = title;
      messageEl.textContent = message;
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      
      modal.style.display = 'flex';
      
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
    
    return 'cancel';
  }
}


