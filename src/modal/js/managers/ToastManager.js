/**
 * Manages toast notifications
 * Provides a centralized way to display toast messages throughout the application
 */
export class ToastManager {
  /**
   * Creates a new ToastManager instance
   */
  constructor() {
    this.toastContainer = null;
    this.createToastContainer();
  }

  /**
   * Creates the toast container if it doesn't exist
   * @private
   */
  createToastContainer() {
    if (!this.toastContainer) {
      // Try to use existing toast component container first
      const existingContainer = document.getElementById('toast-component');
      if (existingContainer) {
        this.toastContainer = existingContainer;
        this.toastContainer.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
        `;
      } else {
        // Fallback: create new container
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        this.toastContainer.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 10px;
        `;
        document.body.appendChild(this.toastContainer);
      }
    }
  }

  /**
   * Shows a toast notification
   * @param {string} message - The toast message
   * @param {string} type - Toast type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add toast styles
    toast.style.cssText = `
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease-in-out;
      max-width: 300px;
      word-wrap: break-word;
    `;

    // Set background color based on type
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    
    this.toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove after duration
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
  }

  /**
   * Removes a toast with animation
   * @param {HTMLElement} toast - The toast element to remove
   * @private
   */
  removeToast(toast) {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Shows a success toast
   * @param {string} message - The success message
   * @param {number} duration - Duration in milliseconds
   */
  success(message, duration = 3000) {
    this.show(message, 'success', duration);
  }

  /**
   * Shows an error toast
   * @param {string} message - The error message
   * @param {number} duration - Duration in milliseconds
   */
  error(message, duration = 5000) {
    this.show(message, 'error', duration);
  }

  /**
   * Shows a warning toast
   * @param {string} message - The warning message
   * @param {number} duration - Duration in milliseconds
   */
  warning(message, duration = 4000) {
    this.show(message, 'warning', duration);
  }

  /**
   * Shows an info toast
   * @param {string} message - The info message
   * @param {number} duration - Duration in milliseconds
   */
  info(message, duration = 3000) {
    this.show(message, 'info', duration);
  }
}
