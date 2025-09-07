// ============================================================================
// Content Script - ChatGPT Conversations Manager
// ============================================================================

// Prevent double injection
if (window.chatgptConversationsManagerLoaded) {
  console.log('ChatGPT Conversations Manager already loaded, skipping...');
} else {
  window.chatgptConversationsManagerLoaded = true;

  // Constants
  const MODAL_ID = 'chatgpt-conversations-manager-modal';
  const BUTTON_ID = 'chatgpt-conversations-manager-button';

// ============================================================================
// Button Management
// ============================================================================

class ButtonManager {
  static createButton() {
    const button = document.createElement('a');
    button.id = BUTTON_ID;
    button.href = '#';
    button.className = 'group __menu-item hoverable';
    // Get theme color from ChatGPT
    const getThemeColor = () => {
      try {
        // Try to get the accent color from ChatGPT's CSS variables
        const computedStyle = getComputedStyle(document.documentElement);
        const accentColor = computedStyle.getPropertyValue('--accent-primary') || 
                           computedStyle.getPropertyValue('--color-accent-primary') ||
                           '#007bff'; // fallback
        return accentColor.trim() || '#007bff';
      } catch (e) {
        return '#007bff'; // fallback
      }
    };

    const themeColor = getThemeColor();
    
    button.style.cssText = `
      background: ${themeColor} !important;
      color: white !important;
      margin: 4px 6px 0 6px !important;
      border-radius: 10px !important;
    `;
    
    button.innerHTML = `
      <div class="flex min-w-0 items-center gap-1.5">
        <div class="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon" aria-hidden="true">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
          </svg>
        </div>
        <div class="flex min-w-0 grow items-center gap-2.5 group-data-no-contents-gap:gap-0">
          <div class="truncate">Manage Conversations</div>
        </div>
      </div>
    `;
    
    // Add hover effect with darker theme color
    const darkenColor = (color) => {
      // Simple darkening function - reduce RGB values by 20%
      const hex = color.replace('#', '');
      const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 40);
      const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 40);
      const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 40);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    button.addEventListener('mouseenter', () => {
      button.style.background = `${darkenColor(themeColor)} !important`;
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = `${themeColor} !important`;
    });
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      ModalManager.openModal();
    });
    
    return button;
  }

  static async injectButton() {
    const maxRetries = 10;
    const retryDelay = 500;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Look for the sidebar container
        const sidebar = document.querySelector('aside[class*="sidebar"]') || 
                       document.querySelector('[data-testid="sidebar"]') ||
                       document.querySelector('nav[role="navigation"]');
        
        if (sidebar) {
          // Look for the Library button to insert after it
          const libraryButton = sidebar.querySelector('a[data-testid="sidebar-item-library"]');
          
          if (libraryButton && libraryButton.parentElement) {
            // Check if button already exists
            if (document.getElementById(BUTTON_ID)) {
              return true;
            }
            
            // Create and insert the button
            const button = this.createButton();
            libraryButton.parentElement.insertBefore(button, libraryButton.nextSibling);
            
            console.log('Manage Conversations button injected successfully');
            return true;
          }
        }
        
        if (attempt < maxRetries) {
          console.log(`Button injection attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(`Button injection attempt ${attempt} error:`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    console.error('Failed to inject Manage Conversations button after all attempts');
    return false;
  }
}

// ============================================================================
// Modal Management
// ============================================================================

class ModalManager {
  static isModalOpen = false;

  static async createModal() {
    // Remove any existing modal first
    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal) {
      existingModal.remove();
    }
    
    // Remove any existing backdrop
    const existingBackdrop = document.getElementById(MODAL_ID + '-backdrop');
    if (existingBackdrop) {
      existingBackdrop.remove();
    }
    
    // Create iframe directly
    const iframe = document.createElement('iframe');
    iframe.id = MODAL_ID;
    iframe.src = chrome.runtime.getURL('src/modal/modal.html') + '?t=' + Date.now(); // Cache busting
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.style.cssText = `
      color-scheme: none !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 9999 !important;
    `;
    
    console.log('Creating iframe with src:', iframe.src);
    
    // Add load event listener to iframe
    iframe.addEventListener('load', () => {
      console.log('Iframe loaded successfully');
    });
    
    iframe.addEventListener('error', (e) => {
      console.error('Iframe failed to load:', e);
    });
    
    // Add iframe directly to body
    document.body.appendChild(iframe);
    this.setupModalEventListeners(iframe);
    
    return iframe;
  }

  static setupModalEventListeners(iframe) {
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen) {
        this.closeModal();
      }
    });

    // Backdrop click handling is now managed by the iframe

    // Listen for close messages from iframe
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'CLOSE_MODAL') {
        this.closeModal();
      }
    });
  }

  static async openModal() {
    if (this.isModalOpen) return;
    
    this.isModalOpen = true;
    await this.createModal();
  }

  static closeModal() {
    const iframe = document.getElementById(MODAL_ID);
    if (iframe) {
      iframe.remove();
      this.isModalOpen = false;
    }
  }
}

// ============================================================================
// Navigation Observer
// ============================================================================

class NavigationObserver {
  static setup() {
    let currentUrl = window.location.href;
    
    const observer = new MutationObserver((mutations) => {
      // Check for URL changes
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        console.log('URL changed to:', currentUrl);
        
        // Re-inject button after navigation
        setTimeout(() => {
          ButtonManager.injectButton();
        }, 1000);
      }
      
      // Check for sidebar changes
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if sidebar elements were added
              if (node.matches && (
                node.matches('aside[class*="sidebar"]') ||
                node.matches('a[data-testid="sidebar-item-library"]') ||
                node.querySelector('aside[class*="sidebar"]') ||
                node.querySelector('a[data-testid="sidebar-item-library"]')
              )) {
                console.log('Sidebar elements detected, re-injecting button...');
                setTimeout(() => {
                  ButtonManager.injectButton();
                }, 500);
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('Navigation observer setup complete');
  }
}

// ============================================================================
// Initialization
// ============================================================================

async function initialize() {
  console.log('ChatGPT Conversations Manager content script initialized');
  
  // Inject the button
  await ButtonManager.injectButton();
  
  // Setup navigation observer
  NavigationObserver.setup();
}

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}
