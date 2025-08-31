// ============================================================================
// Theme Manager
// ============================================================================

import { THEMES } from '../constants/index.js';
import { getElements } from '../utils/ui.js';
import { ToastManager } from './ToastManager.js';
import { StorageManager } from './StorageManager.js';

export class ThemeManager {

  static async selectTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      console.error('Invalid theme:', theme);
      return;
    }

    try {
      // Save the selected theme to storage
      await StorageManager.saveTheme(theme);
      
      // Apply the theme
      await this.applyTheme(theme);
      
      // Update theme buttons
      this.updateThemeButtons(theme);
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }

  static async applyTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
  
    const applySystemTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    };
  
    if (theme === THEMES.SYSTEM) {
      applySystemTheme();
    } else if (theme === THEMES.CHATGPT) {
      const gptTheme = await StorageManager.getGptTheme();
      if (gptTheme === THEMES.DARK || gptTheme === THEMES.LIGHT) {
        document.body.classList.add(`theme-${gptTheme}`);
      } else {
        applySystemTheme();
      }
    } else if (theme === THEMES.DARK || theme === THEMES.LIGHT) {
      document.body.classList.add(`theme-${theme}`);
    } else {
      applySystemTheme();
    }
  }

  static updateThemeButtons(selectedTheme) {
    const elements = getElements();
    const themeButtons = elements.themeButtons;
    
    themeButtons.forEach(btn => {
      const theme = btn.dataset.theme;
      if (theme === selectedTheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      
      // Disable ChatGPT theme if not available
      if (theme === THEMES.CHATGPT) {
        this.updateChatGptButtonState(btn);
      }
    });
  }

  static async updateChatGptButtonState(btn) {
    try {
      const gptTheme = await StorageManager.getGptTheme();
      if (gptTheme) {
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.title = 'ChatGPT Theme';
      } else {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.title = 'ChatGPT Theme (not available)';
      }
    } catch (error) {
      console.error('Error updating ChatGPT button state:', error);
      btn.disabled = true;
      btn.classList.add('disabled');
    }
  }

  static async updateGptTheme(theme) {
    try {
      await StorageManager.saveGptTheme(theme);
      
      // Update ChatGPT theme button state if we're on settings page
      const gptThemeBtn = document.querySelector('[data-theme="chatgpt"]');
      if (gptThemeBtn) {
        this.updateChatGptButtonState(gptThemeBtn);
      }
      
      // If the current theme is ChatGPT, refresh it to apply the new gptTheme value
      await this.refreshTheme();
      
      console.log('GPT theme updated:', theme);
    } catch (error) {
      console.error('Error updating GPT theme:', error);
    }
  }

  static async loadTheme() {
    try {
      const currentSettings = await StorageManager.getSettings();
      const theme = currentSettings.theme || THEMES.LIGHT;

      if (theme) {
        await this.selectTheme(theme);
      } else {
        await this.selectTheme(THEMES.LIGHT);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      await this.selectTheme(THEMES.LIGHT);
    }
  }

  // Method to refresh theme when gptTheme changes
  static async refreshTheme() {
    try {
      const currentSettings = await StorageManager.getSettings();
      const theme = currentSettings.theme || THEMES.LIGHT;
      
      // If current theme is ChatGPT, refresh it to get the latest gptTheme value
      if (theme === THEMES.CHATGPT) {
        console.log('Refreshing ChatGPT theme with latest gptTheme value');
        await this.applyTheme(THEMES.CHATGPT);
      }
    } catch (error) {
      console.error('Error refreshing theme:', error);
    }
  }
}
