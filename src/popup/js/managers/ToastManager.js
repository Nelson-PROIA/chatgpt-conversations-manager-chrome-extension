// ============================================================================
// Toast Manager
// ============================================================================

import { getElements } from '../utils/ui.js';
import { TOAST_TYPES } from '../constants/index.js';

export class ToastManager {
  static show(message, type = 'info', duration = 3000) {
    // Get toast element
    let toast = document.getElementById('toast-component');
    if (!toast) {
      console.error('Toast element not found');
      return null;
    }

    // Set message and type
    toast.textContent = message;
    toast.className = `toast toast-${type}`;

    // Show toast with slide-in animation
    toast.style.display = 'block';
    toast.style.animation = 'toastSlideIn 0.3s ease-out';

    // Auto-hide after duration
    setTimeout(() => {
      this.hide(toast);
    }, duration);

    return toast;
  }

  static showSuccess(message, duration = 3000) {
    return this.show(message, TOAST_TYPES.SUCCESS, duration);
  }

  static showError(message, duration = 4000) {
    return this.show(message, TOAST_TYPES.ERROR, duration);
  }

  static showInfo(message, duration = 3000) {
    return this.show(message, TOAST_TYPES.INFO, duration);
  }

  static showWarning(message, duration = 4000) {
    return this.show(message, TOAST_TYPES.WARNING, duration);
  }

  static hide(toast = null) {
    if (!toast) {
      toast = document.getElementById('toast-component');
    }

    if (toast) {
      // Start slide-out animation
      toast.style.animation = 'toastSlideOut 0.3s ease-in';
      
      // Hide after animation completes
      setTimeout(() => {
        toast.style.display = 'none';
        // Reset animation for next use
        toast.style.animation = '';
      }, 300);
    }
  }



  // Quick methods for common use cases
  static settingsSaved() {
    return this.showSuccess('Settings saved successfully!');
  }

  static settingsError() {
    return this.showError('Failed to save settings. Please try again.');
  }

  static themeApplied() {
    return this.showSuccess('Theme applied successfully!');
  }

  static navigationCancelled() {
    return this.showInfo('Navigation cancelled');
  }
}
