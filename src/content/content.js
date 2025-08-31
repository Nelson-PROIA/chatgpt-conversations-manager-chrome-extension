/**
 * ChatGPT Conversations Manager - Content Script
 * Handles the conversations manager modal and API interactions
 */

// ============================================================================
// Constants
// ============================================================================

const API_ENDPOINTS = {
  SESSION: 'https://chatgpt.com/api/auth/session',
  CONVERSATIONS: 'https://chatgpt.com/backend-api/conversations',
  CONVERSATION: 'https://chatgpt.com/backend-api/conversation',
  SETTINGS: 'https://chatgpt.com/backend-api/settings/user'
};

const MODAL_ID = 'chatgpt-conversations-manager-modal';
const BUTTON_ID = 'chatgpt-conversations-manager-button';

// ============================================================================
// State Management
// ============================================================================

class ContentState {
  constructor() {
    this.isModalOpen = false;
    this.isRefreshing = false;
    this.isLoadingMore = false;
    this.hasMoreConversations = true;
    this.selectedConversations = new Set();
    this.conversations = [];
    this.currentOffset = 0;
    this.batchSize = 20;
  }

  reset() {
    this.selectedConversations.clear();
    this.conversations = [];
    this.currentOffset = 0;
    this.hasMoreConversations = true;
  }
}

const state = new ContentState();

// ============================================================================
// API Management
// ============================================================================

class APIManager {
  static async getAuthorizationHeaders() {
    try {
      const response = await fetch(API_ENDPOINTS.SESSION);
      const data = await response.json();
      
      if (!data.accessToken) {
        throw new Error('No access token found');
      }

      return {
        'Authorization': `Bearer ${data.accessToken}`,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      console.error('Error getting authorization headers:', error);
      throw error;
    }
  }

  static async fetchConversations(offset = 0, limit = 20) {
    const headers = await this.getAuthorizationHeaders();
    const url = `${API_ENDPOINTS.CONVERSATIONS}?offset=${offset}&limit=${limit}`;
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.status}`);
    }
    
    return await response.json();
  }

  static async deleteConversations(conversationIds) {
    const headers = await this.getAuthorizationHeaders();
    
    const promises = conversationIds.map(async (id) => {
      const response = await fetch(`${API_ENDPOINTS.CONVERSATION}/${id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete conversation ${id}: ${response.status}`);
      }
      
      return id;
    });
    
    return await Promise.all(promises);
  }

  static async archiveConversations(conversationIds) {
    const headers = await this.getAuthorizationHeaders();
    
    const promises = conversationIds.map(async (id) => {
      const response = await fetch(`${API_ENDPOINTS.CONVERSATION}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_archived: true })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to archive conversation ${id}: ${response.status}`);
      }
      
      return id;
    });
    
    return await Promise.all(promises);
  }

  static async unarchiveConversations(conversationIds) {
    const headers = await this.getAuthorizationHeaders();
    
    const promises = conversationIds.map(async (id) => {
      const response = await fetch(`${API_ENDPOINTS.CONVERSATION}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_archived: false })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to unarchive conversation ${id}: ${response.status}`);
      }
      
      return id;
    });
    
    return await Promise.all(promises);
  }

  static async checkLoginStatus() {
    try {
      await this.getAuthorizationHeaders();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// Modal Management
// ============================================================================

class ModalManager {
  static createModal() {
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'chatgpt-conversations-manager-modal';
    modal.innerHTML = this.getModalHTML();
    
    document.body.appendChild(modal);
    this.setupModalEventListeners(modal);
    
    return modal;
  }

  static getModalHTML() {
    return `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Manage Conversations</h2>
            <button class="close-btn" id="close-modal-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="search-container">
              <input type="text" id="search-input" placeholder="Search conversations..." class="search-input">
            </div>
            
            <div class="actions-bar">
              <div class="selection-controls">
                <button id="select-all-btn" class="btn secondary">Select All</button>
                <button id="select-none-btn" class="btn secondary">Select None</button>
                <span id="selection-count" class="selection-count">0 selected</span>
              </div>
              
              <div class="bulk-actions">
                <button id="delete-selected-btn" class="btn danger" disabled>Delete</button>
                <button id="archive-selected-btn" class="btn warning" disabled>Archive</button>
                <button id="unarchive-selected-btn" class="btn warning" disabled>Unarchive</button>
              </div>
            </div>
            
            <div class="conversations-list" id="conversations-list">
              <div class="loading">Loading conversations...</div>
            </div>
            
            <div class="load-more-container" id="load-more-container" style="display: none;">
              <button id="load-more-btn" class="btn secondary">Load More</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static setupModalEventListeners(modal) {
    // Close button
    modal.querySelector('#close-modal-btn').addEventListener('click', () => {
      this.closeModal();
    });

    // Overlay click to close
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal();
      }
    });

    // Search input
    const searchInput = modal.querySelector('#search-input');
    searchInput.addEventListener('input', (e) => {
      ConversationManager.filterConversations(e.target.value);
    });

    // Selection controls
    modal.querySelector('#select-all-btn').addEventListener('click', () => {
      ConversationManager.selectAll();
    });

    modal.querySelector('#select-none-btn').addEventListener('click', () => {
      ConversationManager.selectNone();
    });

    // Bulk actions
    modal.querySelector('#delete-selected-btn').addEventListener('click', () => {
      ConversationManager.deleteSelected();
    });

    modal.querySelector('#archive-selected-btn').addEventListener('click', () => {
      ConversationManager.archiveSelected();
    });

    modal.querySelector('#unarchive-selected-btn').addEventListener('click', () => {
      ConversationManager.unarchiveSelected();
    });

    // Load more
    modal.querySelector('#load-more-btn').addEventListener('click', () => {
      ConversationManager.loadMore();
    });
  }

  static openModal() {
    if (state.isModalOpen) return;
    
    state.isModalOpen = true;
    const modal = this.createModal();
    
    // Load initial conversations
    ConversationManager.loadConversations();
  }

  static closeModal() {
    if (!state.isModalOpen) return;
    
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.remove();
    }
    
    state.isModalOpen = false;
    state.reset();
  }
}

// ============================================================================
// Conversation Management
// ============================================================================

class ConversationManager {
  static async loadConversations() {
    if (state.isRefreshing) return;
    
    state.isRefreshing = true;
    this.updateLoadingState(true);
    
    try {
      const data = await APIManager.fetchConversations(0, state.batchSize);
      state.conversations = data.items || [];
      state.currentOffset = state.batchSize;
      state.hasMoreConversations = (data.items || []).length === state.batchSize;
      
      this.renderConversations();
      this.updateLoadMoreVisibility();
    } catch (error) {
      console.error('Error loading conversations:', error);
      this.showError('Failed to load conversations. Please try again.');
    } finally {
      state.isRefreshing = false;
      this.updateLoadingState(false);
    }
  }

  static async loadMore() {
    if (state.isLoadingMore || !state.hasMoreConversations) return;
    
    state.isLoadingMore = true;
    this.updateLoadMoreButton(true);
    
    try {
      const data = await APIManager.fetchConversations(state.currentOffset, state.batchSize);
      const newConversations = data.items || [];
      
      state.conversations.push(...newConversations);
      state.currentOffset += state.batchSize;
      state.hasMoreConversations = newConversations.length === state.batchSize;
      
      this.renderConversations();
      this.updateLoadMoreVisibility();
    } catch (error) {
      console.error('Error loading more conversations:', error);
      this.showError('Failed to load more conversations. Please try again.');
    } finally {
      state.isLoadingMore = false;
      this.updateLoadMoreButton(false);
    }
  }

  static renderConversations() {
    const container = document.getElementById('conversations-list');
    if (!container) return;
    
    if (state.conversations.length === 0) {
      container.innerHTML = '<div class="empty-state">No conversations found</div>';
      return;
    }
    
    const conversationsHTML = state.conversations.map(conv => this.renderConversation(conv)).join('');
    container.innerHTML = conversationsHTML;
    
    // Re-attach event listeners
    this.attachConversationEventListeners();
  }

  static renderConversation(conversation) {
    const isSelected = state.selectedConversations.has(conversation.id);
    const isArchived = conversation.is_archived;
    const date = new Date(conversation.update_time || conversation.create_time);
    
    return `
      <div class="conversation-item ${isSelected ? 'selected' : ''} ${isArchived ? 'archived' : ''}" 
           data-id="${conversation.id}">
        <div class="conversation-content">
          <div class="conversation-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${conversation.id}">
          </div>
          <div class="conversation-info">
            <div class="conversation-title">${conversation.title || 'Untitled'}</div>
            <div class="conversation-meta">
              <span class="conversation-id">${conversation.id}</span>
              <span class="conversation-date">${date.toLocaleDateString()}</span>
              ${isArchived ? '<span class="archived-badge">Archived</span>' : ''}
            </div>
          </div>
          <div class="conversation-actions">
            <button class="action-menu-btn" data-id="${conversation.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="19" cy="12" r="1"/>
                <circle cx="5" cy="12" r="1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static attachConversationEventListeners() {
    // Checkbox listeners
    document.querySelectorAll('.conversation-item input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          state.selectedConversations.add(id);
        } else {
          state.selectedConversations.delete(id);
        }
        this.updateSelectionUI();
      });
    });

    // Action menu listeners
    document.querySelectorAll('.action-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.showActionMenu(btn, id);
      });
    });

    // Row click listeners
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox' || e.target.closest('.action-menu-btn')) return;
        
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });
    });
  }

  static filterConversations(searchTerm) {
    const items = document.querySelectorAll('.conversation-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
      const title = item.querySelector('.conversation-title').textContent.toLowerCase();
      const id = item.querySelector('.conversation-id').textContent.toLowerCase();
      
      const matches = title.includes(term) || id.includes(term);
      item.style.display = matches ? 'block' : 'none';
    });
  }

  static selectAll() {
    const checkboxes = document.querySelectorAll('.conversation-item input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      state.selectedConversations.add(checkbox.dataset.id);
    });
    this.updateSelectionUI();
  }

  static selectNone() {
    const checkboxes = document.querySelectorAll('.conversation-item input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      state.selectedConversations.delete(checkbox.dataset.id);
    });
    this.updateSelectionUI();
  }

  static updateSelectionUI() {
    const count = state.selectedConversations.size;
    const countElement = document.getElementById('selection-count');
    const deleteBtn = document.getElementById('delete-selected-btn');
    const archiveBtn = document.getElementById('archive-selected-btn');
    const unarchiveBtn = document.getElementById('unarchive-selected-btn');
    
    if (countElement) countElement.textContent = `${count} selected`;
    if (deleteBtn) deleteBtn.disabled = count === 0;
    if (archiveBtn) archiveBtn.disabled = count === 0;
    if (unarchiveBtn) unarchiveBtn.disabled = count === 0;
  }

  static async deleteSelected() {
    if (state.selectedConversations.size === 0) return;
    
    const confirmed = confirm(`Are you sure you want to delete ${state.selectedConversations.size} conversation(s)?`);
    if (!confirmed) return;
    
    try {
      await APIManager.deleteConversations(Array.from(state.selectedConversations));
      this.removeDeletedConversations();
      this.showSuccess(`${state.selectedConversations.size} conversation(s) deleted successfully`);
    } catch (error) {
      console.error('Error deleting conversations:', error);
      this.showError('Failed to delete some conversations. Please try again.');
    }
  }

  static async archiveSelected() {
    if (state.selectedConversations.size === 0) return;
    
    const confirmed = confirm(`Are you sure you want to archive ${state.selectedConversations.size} conversation(s)?`);
    if (!confirmed) return;
    
    try {
      await APIManager.archiveConversations(Array.from(state.selectedConversations));
      this.updateArchivedConversations(Array.from(state.selectedConversations), true);
      this.showSuccess(`${state.selectedConversations.size} conversation(s) archived successfully`);
    } catch (error) {
      console.error('Error archiving conversations:', error);
      this.showError('Failed to archive some conversations. Please try again.');
    }
  }

  static async unarchiveSelected() {
    if (state.selectedConversations.size === 0) return;
    
    const confirmed = confirm(`Are you sure you want to unarchive ${state.selectedConversations.size} conversation(s)?`);
    if (!confirmed) return;
    
    try {
      await APIManager.unarchiveConversations(Array.from(state.selectedConversations));
      this.updateArchivedConversations(Array.from(state.selectedConversations), false);
      this.showSuccess(`${state.selectedConversations.size} conversation(s) unarchived successfully`);
    } catch (error) {
      console.error('Error unarchiving conversations:', error);
      this.showError('Failed to unarchive some conversations. Please try again.');
    }
  }

  static removeDeletedConversations() {
    state.selectedConversations.forEach(id => {
      const item = document.querySelector(`[data-id="${id}"]`);
      if (item) item.remove();
      
      const index = state.conversations.findIndex(conv => conv.id === id);
      if (index > -1) {
        state.conversations.splice(index, 1);
      }
    });
    
    state.selectedConversations.clear();
    this.updateSelectionUI();
  }

  static updateArchivedConversations(ids, isArchived) {
    ids.forEach(id => {
      const item = document.querySelector(`[data-id="${id}"]`);
      if (item) {
        item.classList.toggle('archived', isArchived);
        const badge = item.querySelector('.archived-badge');
        if (isArchived && !badge) {
          const meta = item.querySelector('.conversation-meta');
          meta.insertAdjacentHTML('beforeend', '<span class="archived-badge">Archived</span>');
        } else if (!isArchived && badge) {
          badge.remove();
        }
      }
      
      const conversation = state.conversations.find(conv => conv.id === id);
      if (conversation) {
        conversation.is_archived = isArchived;
      }
    });
    
    state.selectedConversations.clear();
    this.updateSelectionUI();
  }

  static showActionMenu(button, conversationId) {
    // Simple context menu - could be enhanced
    const actions = [
      { label: 'Delete', action: () => this.deleteSingle(conversationId) },
      { label: 'Archive', action: () => this.archiveSingle(conversationId) }
    ];
    
    const menu = document.createElement('div');
    menu.className = 'action-menu';
    menu.innerHTML = actions.map(action => 
      `<div class="action-menu-item" data-action="${action.label.toLowerCase()}">${action.label}</div>`
    ).join('');
    
    // Position menu
    const rect = button.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '1000';
    
    document.body.appendChild(menu);
    
    // Handle menu clicks
    menu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'delete') {
        this.deleteSingle(conversationId);
      } else if (action === 'archive') {
        this.archiveSingle(conversationId);
      }
      menu.remove();
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  }

  static async deleteSingle(conversationId) {
    const confirmed = confirm('Are you sure you want to delete this conversation?');
    if (!confirmed) return;
    
    try {
      await APIManager.deleteConversations([conversationId]);
      const item = document.querySelector(`[data-id="${conversationId}"]`);
      if (item) item.remove();
      this.showSuccess('Conversation deleted successfully');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      this.showError('Failed to delete conversation. Please try again.');
    }
  }

  static async archiveSingle(conversationId) {
    const confirmed = confirm('Are you sure you want to archive this conversation?');
    if (!confirmed) return;
    
    try {
      await APIManager.archiveConversations([conversationId]);
      this.updateArchivedConversations([conversationId], true);
      this.showSuccess('Conversation archived successfully');
    } catch (error) {
      console.error('Error archiving conversation:', error);
      this.showError('Failed to archive conversation. Please try again.');
    }
  }

  static updateLoadingState(isLoading) {
    const container = document.getElementById('conversations-list');
    if (!container) return;
    
    if (isLoading) {
      container.innerHTML = '<div class="loading">Loading conversations...</div>';
    }
  }

  static updateLoadMoreButton(isLoading) {
    const btn = document.getElementById('load-more-btn');
    if (btn) {
      btn.textContent = isLoading ? 'Loading...' : 'Load More';
      btn.disabled = isLoading;
    }
  }

  static updateLoadMoreVisibility() {
    const container = document.getElementById('load-more-container');
    if (container) {
      container.style.display = state.hasMoreConversations ? 'block' : 'none';
    }
  }

  static showSuccess(message) {
    // Simple success notification - could be enhanced
    console.log('Success:', message);
  }

  static showError(message) {
    // Simple error notification - could be enhanced
    console.error('Error:', message);
  }
}

// ============================================================================
// Button Management
// ============================================================================

class ButtonManager {
  static createButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'chatgpt-conversations-manager-button';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <path d="M8 9h8M8 13h6"/>
      </svg>
      Manage Conversations
    `;
    
    button.addEventListener('click', () => {
      ModalManager.openModal();
    });
    
    return button;
  }

  static injectButton() {
    // Look for the sidebar navigation
    const sidebar = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (!sidebar) {
      // Fallback: look for common ChatGPT sidebar selectors
      const selectors = [
        'aside',
        '.sidebar',
        '[data-testid="sidebar"]',
        '.flex.flex-col.fixed.left-0.top-0.bottom-0'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          this.injectIntoElement(element);
          return;
        }
      }
      
      // If no sidebar found, try again later
      setTimeout(() => this.injectButton(), 1000);
      return;
    }
    
    this.injectIntoElement(sidebar);
  }

  static injectIntoElement(container) {
    // Check if button already exists
    if (document.getElementById(BUTTON_ID)) return;
    
    const button = this.createButton();
    
    // Try to insert at the top of the navigation
    const firstChild = container.firstChild;
    if (firstChild) {
      container.insertBefore(button, firstChild);
    } else {
      container.appendChild(button);
    }
  }
}

// ============================================================================
// Message Handling
// ============================================================================

class MessageHandler {
  static handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'checkStatus':
        this.handleCheckStatus(sendResponse);
        break;
      case 'openManager':
        this.handleOpenManager();
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  static async handleCheckStatus(sendResponse) {
    try {
      const isLoggedIn = await APIManager.checkLoginStatus();
      sendResponse({ isLoggedIn });
    } catch (error) {
      sendResponse({ isLoggedIn: false });
    }
  }

  static handleOpenManager() {
    ModalManager.openModal();
  }
}

// ============================================================================
// Initialization
// ============================================================================

class ContentScript {
  static async initialize() {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  static setup() {
    // Inject the button
    ButtonManager.injectButton();
    
    // Setup message listener
    chrome.runtime.onMessage.addListener(MessageHandler.handleMessage);
    
    // Watch for navigation changes (SPA)
    this.setupNavigationObserver();
  }

  static setupNavigationObserver() {
    // Watch for URL changes in single-page apps
    let currentUrl = location.href;
    
    const observer = new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        // Re-inject button on navigation
        setTimeout(() => ButtonManager.injectButton(), 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize the content script
ContentScript.initialize();
