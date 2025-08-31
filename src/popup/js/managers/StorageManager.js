// ============================================================================
// Storage Manager
// ============================================================================

import { DEFAULT_SETTINGS, STORAGE_KEYS, PAGES } from '../constants/index.js';

export class StorageManager {
  
  // Initialize extension storage with default values
  static async initializeStorage() {
    try {
      // First, check if we have the old flat storage structure
      const allStorage = await chrome.storage.sync.get();
      console.log('Current storage state:', allStorage);
      
      // Check if we need to migrate from old flat storage
      if (allStorage.theme || allStorage.batchSize || allStorage.preventDelete || allStorage.preventArchive) {
        console.log('Migrating from old flat storage structure...');
        
        // Extract old settings
        const oldSettings = {
          theme: allStorage.theme || DEFAULT_SETTINGS.theme,
          batchSize: allStorage.batchSize || DEFAULT_SETTINGS.batchSize,
          preventDelete: allStorage.preventDelete !== undefined ? allStorage.preventDelete : DEFAULT_SETTINGS.preventDelete,
          preventArchive: allStorage.preventArchive !== undefined ? allStorage.preventArchive : DEFAULT_SETTINGS.preventDelete
        };
        
        // Save to new structured storage
        await chrome.storage.sync.set({
          [STORAGE_KEYS.SETTINGS]: {
            values: oldSettings,
            changes: {}
          },
          [STORAGE_KEYS.GPT_THEME]: allStorage.gptTheme || null
        });
        
        // Clear old flat storage
        await chrome.storage.sync.remove(['theme', 'batchSize', 'preventDelete', 'preventArchive', 'isCustomBatchSize']);
        
        console.log('Migration completed:', oldSettings);
      } else {
        // Use new structured storage
        const { settings, gptTheme } = await chrome.storage.sync.get([
          STORAGE_KEYS.SETTINGS,
          STORAGE_KEYS.GPT_THEME
        ]);

        // Set default settings if none exist
        if (!settings) {
          await chrome.storage.sync.set({ 
            [STORAGE_KEYS.SETTINGS]: {
              values: DEFAULT_SETTINGS,
              changes: {}
            }
          });
        }

        // GPT theme starts as null (will be detected by background script)
        if (!gptTheme) {
          await chrome.storage.sync.set({ [STORAGE_KEYS.GPT_THEME]: null });
        }
      }

      console.log('Storage initialized successfully');
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  }

  // Get current settings values (without pending changes)
  static async getSettings() {
    try {
      const { settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      if (settings && settings.values) {
        return settings.values;
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  // Save theme to settings
  static async saveTheme(theme) {
    try {
      const { settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      const currentValues = settings?.values || DEFAULT_SETTINGS;
      
      // Update theme in values
      const newValues = { ...currentValues, theme };
      
      // Save updated values
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SETTINGS]: {
          values: newValues,
          changes: settings?.changes || {}
        }
      });
      
      console.log('Theme saved:', theme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }

  // Save settings (apply pending changes to values)
  static async saveSettings() {
    try {
      const { settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      const currentValues = settings?.values || DEFAULT_SETTINGS;
      const currentChanges = settings?.changes || {};
      
      // Apply pending changes to values
      const newValues = { ...currentValues, ...currentChanges };
      
      // Save updated values and clear changes
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SETTINGS]: {
          values: newValues,
          changes: {}
        }
      });
      
      console.log('Settings saved successfully, pending changes cleared');
      return newValues;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }



  // Get pending changes
  static async getPendingChanges() {
    try {
      const { settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);

      if (settings && settings.changes) {
        return settings.changes;
      }

      return {};
    } catch (error) {
      console.error('Error getting pending changes:', error);

      return {};
    }
  }



  // Clear pending changes
  static async clearPendingChanges() {
    try {
      const { settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      const currentValues = settings?.values || DEFAULT_SETTINGS;
      
      // Clear changes but keep values
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SETTINGS]: {
          values: currentValues,
          changes: {}
        }
      });
      
      console.log('Pending changes cleared');
    } catch (error) {
      console.error('Error clearing pending changes:', error);
      throw error;
    }
  }

  // Get GPT theme
  static async getGptTheme() {
    try {
      const { gptTheme } = await chrome.storage.sync.get(STORAGE_KEYS.GPT_THEME);
      return gptTheme;
    } catch (error) {
      console.error('Error getting GPT theme:', error);
      return null;
    }
  }

  // Save GPT theme
  static async saveGptTheme(gptTheme) {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.GPT_THEME]: gptTheme });
    } catch (error) {
      console.error('Error saving GPT theme:', error);
      throw error;
    }
  }

  // Check if a setting has changed from its stored value
  static async hasSettingChanged(settingKey, newValue) {
    try {
      const currentSettings = await this.getSettings();
      const currentValue = currentSettings[settingKey];
      return currentValue !== newValue;
    } catch (error) {
      console.error('Error checking if setting changed:', error);
      return false;
    }
  }

  // Update pending changes based on setting comparison
  static async updatePendingChanges(settingKey, newValue) {
    try {
      console.log('StorageManager.updatePendingChanges called:', { settingKey, newValue });
      
      // Get current settings and pending changes
      const { settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      const currentValues = settings?.values || DEFAULT_SETTINGS;
      const currentChanges = settings?.changes || {};
      
      console.log('Current values:', currentValues);
      console.log('Current changes:', currentChanges);
      
      // Check if the new value is different from the current stored value
      if (currentValues[settingKey] !== newValue) {
        // Value changed, add to pending changes
        currentChanges[settingKey] = newValue;
        console.log('Setting added to pending changes:', currentValues[settingKey], settingKey, newValue);
      } else {
        // Value is same as stored, remove from pending changes if it was there
        if (currentChanges[settingKey] !== undefined) {
          delete currentChanges[settingKey];
          console.log('Setting removed from pending changes:', settingKey);
        }
      }
      
      // Save updated settings structure
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SETTINGS]: {
          values: currentValues,
          changes: currentChanges
        }
      });
      
      console.log('Updated pending changes:', currentChanges);
      return currentChanges;
    } catch (error) {
      console.error('Error updating pending changes:', error);
      throw error;
    }
  }
}
