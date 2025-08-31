// ============================================================================
// State Manager
// ============================================================================

import { PAGES, DEFAULT_SETTINGS } from '../constants/index.js';
import { StorageManager } from './StorageManager.js';

export class StateManager {
  constructor() {
    this.currentPage = PAGES.GENERAL;
    this.gptTheme = null;
    this.cancelChatGPTCheck = false;
    this.pendingChanges = {};
    
    // Load initial state from storage
    this.loadInitialState();
  }

  async loadInitialState() {
    try {
      // Load pending changes
      this.pendingChanges = await StorageManager.getPendingChanges();
      console.log('Initial pending changes loaded:', this.pendingChanges);
      
      // Load GPT theme
      this.gptTheme = await StorageManager.getGptTheme();
      
      console.log('Initial state loaded:', {
        pendingChanges: this.pendingChanges,
        gptTheme: this.gptTheme
      });
      
      // Notify that state has been loaded
      this.notifyPendingChangesUpdate();
    } catch (error) {
      console.error('Error loading initial state:', error);
    }
  }



  hasPendingChanges() {
    const hasChanges = Object.keys(this.pendingChanges).length > 0;
    console.log('hasPendingChanges called:', { hasChanges, pendingChanges: this.pendingChanges });
    return hasChanges;
  }

  async addPendingChange(key, value) {
    console.log('Adding pending change:', { key, value });
    // Use StorageManager to properly update pending changes
    const updatedPendingChanges = await StorageManager.updatePendingChanges(key, value);
    this.pendingChanges = updatedPendingChanges;
    console.log('Updated pending changes:', this.pendingChanges);
    this.notifyPendingChangesUpdate();
  }

  async removePendingChange(key) {
    delete this.pendingChanges[key];
    await StorageManager.savePendingChanges(this.pendingChanges);
    this.notifyPendingChangesUpdate();
  }

  async clearPendingChanges() {
    this.pendingChanges = {};
    await StorageManager.clearPendingChanges();
    this.notifyPendingChangesUpdate();
  }

  getPendingChanges() {
    return { ...this.pendingChanges };
  }

  setCancelChatGPTCheck(value) {
    this.cancelChatGPTCheck = value;
  }

  getCancelChatGPTCheck() {
    return this.cancelChatGPTCheck;
  }

  async setGptTheme(theme) {
    this.gptTheme = theme;
    await StorageManager.saveGptTheme(theme);
  }

  getGptTheme() {
    return this.gptTheme;
  }

  // Observer pattern for pending changes updates
  notifyPendingChangesUpdate() {
    // This can be used to notify other components about state changes
    console.log('Pending changes updated:', this.pendingChanges);
  }

  // Get a snapshot of the current state
  getStateSnapshot() {
    return {
      currentPage: this.currentPage,
      gptTheme: this.gptTheme,
      cancelChatGPTCheck: this.cancelChatGPTCheck,
      hasPendingChanges: this.hasPendingChanges(),
      pendingChangesCount: Object.keys(this.pendingChanges).length
    };
  }
}
