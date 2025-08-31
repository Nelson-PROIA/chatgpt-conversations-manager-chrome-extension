// ============================================================================
// Settings Manager
// ============================================================================

import { BATCH_SIZE_CONFIG, DEFAULT_SETTINGS } from '../constants/index.js';
import { getElements } from '../utils/ui.js';
import { ToastManager } from './ToastManager.js';
import { ThemeManager } from './ThemeManager.js';
import { StorageManager } from './StorageManager.js';
import { NavigationManager } from './NavigationManager.js';

export class SettingsManager {
  static state = null;
  static originalSettings = null; // Track original settings when form loads

  static setState(stateInstance) {
    this.state = stateInstance;
  }

  static async loadSettingsForm() {
    try {
      // Load current settings from storage
      const currentSettings = await StorageManager.getSettings();
      
      // Store original settings for comparison
      this.originalSettings = { ...currentSettings };
      console.log('Original settings loaded:', this.originalSettings);
      
      const elements = getElements();
      
      // Set batch size and highlight selected button
      if (elements.batchInput) {
        // Only set value if it's a custom batch size, otherwise leave empty
        if (currentSettings.isCustomBatchSize && currentSettings.batchSize) {
          elements.batchInput.value = currentSettings.batchSize;
        } else {
          elements.batchInput.value = '';
        }
      }
      
      // Highlight selected batch size button or custom input
      const batchButtons = document.querySelectorAll('[data-batch]');
      const currentBatchSize = currentSettings.batchSize || 50; // Default to 50
      let foundMatchingButton = false;
      
      // Check if we should use custom batch size
      if (currentSettings.isCustomBatchSize) {
        // Custom batch size is selected
        batchButtons.forEach(btn => btn.classList.remove('active'));
        if (elements.batchInput) {
          const customWrapper = elements.batchInput.closest('.custom-batch-wrapper');
          if (customWrapper) {
            customWrapper.classList.add('active');
          }
        }
      } else {
        // Predefined batch size is selected
        batchButtons.forEach(btn => {
          const btnValue = parseInt(btn.dataset.batch);
          if (btnValue === currentBatchSize) {
            btn.classList.add('active');
            foundMatchingButton = true;
          } else {
            btn.classList.remove('active');
          }
        });
        
        // Ensure custom input is not active
        if (elements.batchInput) {
          const customWrapper = elements.batchInput.closest('.custom-batch-wrapper');
          if (customWrapper) {
            customWrapper.classList.remove('active');
          }
        }
      }

      // Highlight selected theme button
      const themeButtons = document.querySelectorAll('[data-theme]');
      const currentTheme = currentSettings.theme || DEFAULT_SETTINGS.theme;
      themeButtons.forEach(btn => {
        if (btn.dataset.theme === currentTheme) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Set prevent toggles
      if (elements.preventDelete) {
        elements.preventDelete.checked = currentSettings.preventDelete !== false; // Default to true
      }
      
      if (elements.preventArchive) {
        elements.preventArchive.checked = currentSettings.preventArchive !== false; // Default to true
      }

      // Check if there are existing pending changes and update form accordingly
      const existingPendingChanges = await StorageManager.getPendingChanges();
      if (Object.keys(existingPendingChanges).length > 0) {
        console.log('Found existing pending changes:', existingPendingChanges);
        
        // Apply pending changes to the form UI (but don't save to storage yet)
        if (existingPendingChanges.theme) {
          // Update theme button active state
          const themeButtons = document.querySelectorAll('[data-theme]');
          themeButtons.forEach(btn => btn.classList.remove('active'));
          const activeThemeBtn = document.querySelector(`[data-theme="${existingPendingChanges.theme}"]`);
          if (activeThemeBtn) activeThemeBtn.classList.add('active');
        }
        
        if (existingPendingChanges.batchSize !== undefined || existingPendingChanges.isCustomBatchSize !== undefined) {
          // Update batch size button active state
          const batchButtons = document.querySelectorAll('[data-batch]');
          batchButtons.forEach(btn => btn.classList.remove('active'));
          
          // Check if custom batch size is selected
          if (existingPendingChanges.isCustomBatchSize) {
            // Custom batch size is selected
            if (elements.batchInput) {
              const customWrapper = elements.batchInput.closest('.custom-batch-wrapper');
              if (customWrapper) {
                customWrapper.classList.add('active');
              }
            }
          } else {
            // Check if it matches a predefined button
            const activeBatchBtn = document.querySelector(`[data-batch="${existingPendingChanges.batchSize}"]`);
            if (activeBatchBtn) {
              activeBatchBtn.classList.add('active');
            }
          }
        }
        
        if (existingPendingChanges.preventDelete !== undefined) {
          if (elements.preventDelete) {
            elements.preventDelete.checked = existingPendingChanges.preventDelete;
          }
        }
        
        if (existingPendingChanges.preventArchive !== undefined) {
          if (elements.preventArchive) {
            elements.preventArchive.checked = existingPendingChanges.preventArchive;
          }
        }
      }

      // Update save button state
      this.updateSaveButtonState();
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  static async saveSettings() {
    try {
      // Save settings using StorageManager (applies pending changes to values)
      await StorageManager.saveSettings();
      
      // Apply the new theme if it was changed
      const newSettings = await StorageManager.getSettings();
      if (newSettings.theme) {
        await ThemeManager.applyTheme(newSettings.theme);
      }
      
      // Clear pending changes in state
      await this.state.clearPendingChanges();
      
      // Update save button state
      this.updateSaveButtonState();
      
      // Go back to main page first
      await NavigationManager.goBackWithoutConfirmation();
      
      // Then show success feedback
      this.showSaveSuccess();
      
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showSaveError();
    }
  }

  static async revertToOriginalSettings() {
    try {
      await this.loadSettingsForm();
      await this.state.clearPendingChanges();
      // Update save button state
      this.updateSaveButtonState();
    } catch (error) {
      console.error('Error reverting settings:', error);
    }
  }

  static updateSaveButtonState() {
    const elements = getElements();
    
    if (elements.saveSettingsBtn) {
      const hasChanges = this.state.hasPendingChanges();
      console.log('Updating save button state:', { hasChanges, pendingChanges: this.state.getPendingChanges() });
      
      // Save button is disabled by default, only enabled when there are pending changes
      elements.saveSettingsBtn.disabled = !hasChanges;
      
      // Also update the button text/class to show it's disabled
      if (hasChanges) {
        elements.saveSettingsBtn.classList.remove('disabled');
        elements.saveSettingsBtn.textContent = 'Save';
      } else {
        elements.saveSettingsBtn.classList.add('disabled');
        elements.saveSettingsBtn.textContent = 'No Changes';
      }
    }
  }

  static showSaveSuccess() {
    ToastManager.settingsSaved();
  }

  static showSaveError() {
    ToastManager.settingsError();
  }

  // Helper method to validate batch size
  static isValidBatchSize(value) {
    return !isNaN(value) && 
           value >= 1 && 
           value <= 250;
  }

  // Helper method to select custom batch size
  static async selectCustomBatchSize(value) {
    try {
      // Remove active state from all batch buttons
      const batchButtons = document.querySelectorAll('[data-batch]');
      batchButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active state to custom batch wrapper
      const elements = getElements();
      if (elements.batchInput) {
        const customWrapper = elements.batchInput.closest('.custom-batch-wrapper');
        if (customWrapper) {
          customWrapper.classList.add('active');
        }
      }
      
      // Update pending changes for both batchSize and isCustomBatchSize
      let updatedChanges = await StorageManager.updatePendingChanges('batchSize', value);
      updatedChanges = await StorageManager.updatePendingChanges('isCustomBatchSize', true);
      
      // Sync state with updated pending changes
      this.state.pendingChanges = updatedChanges;
      
      // Update save button state
      this.updateSaveButtonState();
      
      console.log('Custom batch size selected:', value);
    } catch (error) {
      console.error('Error selecting custom batch size:', error);
    }
  }

  // Helper method to deselect custom batch size
  static async deselectCustomBatchSize() {
    try {
      // Remove active state from custom batch wrapper
      const elements = getElements();
      if (elements.batchInput) {
        const customWrapper = elements.batchInput.closest('.custom-batch-wrapper');
        if (customWrapper) {
          customWrapper.classList.remove('active');
        }
      }
      
      // Clear pending changes for custom batch size
      let updatedChanges = await StorageManager.updatePendingChanges('batchSize', undefined);
      updatedChanges = await StorageManager.updatePendingChanges('isCustomBatchSize', false);
      
      // Sync state with updated pending changes
      this.state.pendingChanges = updatedChanges;
      
      // Update save button state
      this.updateSaveButtonState();
      
      console.log('Custom batch size deselected');
    } catch (error) {
      console.error('Error deselecting custom batch size:', error);
    }
  }

  // Event handlers for settings changes
  static setupSettingsEventListeners() {
    const elements = getElements();
    
    // Theme buttons
    const themeButtons = document.querySelectorAll('[data-theme]');
    themeButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const theme = e.target.closest('[data-theme]').dataset.theme;
        
        // Don't apply theme immediately in settings - just track as pending change
        // Theme will be applied when settings are saved
        
        // Update pending changes - this will automatically add/remove based on comparison with stored values
        console.log('Theme button clicked:', { theme });
        const updatedChanges = await StorageManager.updatePendingChanges('theme', theme);
        
        // Sync state with updated pending changes
        this.state.pendingChanges = updatedChanges;
        
        // Update active state
        themeButtons.forEach(btn => btn.classList.remove('active'));
        e.target.closest('[data-theme]').classList.add('active');
        
        // Update save button state
        this.updateSaveButtonState();
      });
    });

    // Batch size buttons
    const batchButtons = document.querySelectorAll('[data-batch]');
    batchButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const batchSize = parseInt(e.target.dataset.batch);
        
        // Clear custom batch size setting and input
        if (elements.batchInput) {
          elements.batchInput.value = '';
          const customWrapper = elements.batchInput.closest('.custom-batch-wrapper');
          if (customWrapper) {
            customWrapper.classList.remove('active');
          }
        }
        
        // Update pending changes for both batchSize and isCustomBatchSize
        let updatedChanges = await StorageManager.updatePendingChanges('batchSize', batchSize);
        updatedChanges = await StorageManager.updatePendingChanges('isCustomBatchSize', false);
        
        // Sync state with updated pending changes
        this.state.pendingChanges = updatedChanges;
        
        // Update active state
        batchButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update save button state
        this.updateSaveButtonState();
      });
    });
    
    // Custom batch size input
    if (elements.batchInput) {
      let lastValidValue = null;
      let isCurrentlySelected = false;
      
      // Store the last valid value when input is focused (if it was previously selected)
      elements.batchInput.addEventListener('focus', (e) => {
        const customWrapper = e.target.closest('.custom-batch-wrapper');
        if (customWrapper && customWrapper.classList.contains('active')) {
          isCurrentlySelected = true;
          lastValidValue = parseInt(e.target.value) || null;
        }
      });
      
      // Handle input changes with validation
      elements.batchInput.addEventListener('input', async (e) => {
        const inputValue = e.target.value;
        const value = parseInt(inputValue);
        
        // Check if input length exceeds max (3 characters)
        if (inputValue.length > 3) {
          e.target.value = inputValue.slice(0, 3);
          return;
        }
        
        // Validate the value
        const isValid = this.isValidBatchSize(value);
        
        if (isValid) {
          // Value is valid - proceed with selection
          await this.selectCustomBatchSize(value);
        } else {
          // Value is invalid - don't select, but keep the input value for user to fix
          console.log('Invalid batch size entered:', value);
        }
      });
      
      // Handle when user finishes typing (blur event)
      elements.batchInput.addEventListener('blur', async (e) => {
        const value = parseInt(e.target.value);
        const isValid = this.isValidBatchSize(value);
        
        if (isValid) {
          // Value is valid - ensure it's selected
          await this.selectCustomBatchSize(value);
        } else if (isCurrentlySelected && lastValidValue !== null) {
          // Invalid value and was previously selected - revert to last valid value
          e.target.value = lastValidValue;
          await this.selectCustomBatchSize(lastValidValue);
        } else {
          // Invalid value and not previously selected - clear input and don't select
          e.target.value = '';
          await this.deselectCustomBatchSize();
        }
        
        // Reset tracking variables
        isCurrentlySelected = false;
        lastValidValue = null;
      });
    }

    // Prevent delete toggle
    if (elements.preventDelete) {
      elements.preventDelete.addEventListener('change', async (e) => {
        // Update pending changes - this will automatically add/remove based on comparison with stored values
        const updatedChanges = await StorageManager.updatePendingChanges('preventDelete', e.target.checked);
        
        // Sync state with updated pending changes
        this.state.pendingChanges = updatedChanges;
        
        // Update save button state
        this.updateSaveButtonState();
      });
    }

    // Prevent archive toggle
    if (elements.preventArchive) {
      elements.preventArchive.addEventListener('change', async (e) => {
        // Update pending changes - this will automatically add/remove based on comparison with stored values
        const updatedChanges = await StorageManager.updatePendingChanges('preventArchive', e.target.checked);
        
        // Sync state with updated pending changes
        this.state.pendingChanges = updatedChanges;
        
        // Update save button state
        this.updateSaveButtonState();
      });
    }

    // Save button
    if (elements.saveSettingsBtn) {
      elements.saveSettingsBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveSettings();
      });
    }
  }
}


