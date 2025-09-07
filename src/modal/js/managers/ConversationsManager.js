// ============================================================================
// Conversations Manager
// ============================================================================

import { ActionsManager } from './ActionsManager.js';
import { PaginatedDataFetcher } from '../utils/paginatedFetcher.js';

class Conversation {
  constructor(data) {
    this.id = data.id;
    this.title = data.title || 'Untitled Conversation';
    this.date = new Date(data.create_time);
    this.updateTime = new Date(data.update_time);
    this.status = data.is_archived ? 'archived' : 'active';
    this.isNew = this.isNewConversation(data.create_time);
    this.isRecentlyModified = this.isRecentlyModified(data.update_time);
  }

  isNewConversation(createTime) {
    const now = new Date();
    const created = new Date(createTime);
    const differenceHours = (now - created) / (1000 * 60 * 60);
    return differenceHours < 24;
  }

  isRecentlyModified(updateTime) {
    const now = new Date();
    const updated = new Date(updateTime);
    const differenceHours = (now - updated) / (1000 * 60 * 60);
    return differenceHours < 24;
  }
}

class ConversationsFetcher extends PaginatedDataFetcher {
  constructor() {
    super(
      'https://chatgpt.com/backend-api/conversations',
      {}, // Will be set dynamically with access token
      item => item.id
    );
  }

  async getAccessToken() {
    try {
      const response = await fetch('https://chatgpt.com/api/auth/session');
      const data = await response.json();
      return data.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  transformItem(item) {
    return new Conversation(item);
  }
}

class FetchSettings {
  constructor(batchSize, sortBy = 'created', activeFilters = []) {
    this.batchSize = batchSize;
    this.sortBy = sortBy;
    this.activeFilters = activeFilters;
  }

  getFilters() {
    const filters = new Set();
    
    if (this.activeFilters.includes('new')) {
      filters.add((conversation) => conversation.isNew);
    }
    
    if (this.activeFilters.includes('updated')) {
      filters.add((conversation) => conversation.isRecentlyModified);
    }
    
    if (this.activeFilters.includes('other')) {
      filters.add((conversation) => !conversation.isNew && !conversation.isRecentlyModified);
    }
    
    return filters;
  }

  getSortFunctions() {
    const sortFunctions = [];
    
    switch (this.sortBy) {
      case 'created':
        sortFunctions.push((a, b) => new Date(b.date) - new Date(a.date));
        sortFunctions.push((a, b) => a.title.localeCompare(b.title));
        break;
      case 'modified':
        sortFunctions.push((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
        sortFunctions.push((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name':
        sortFunctions.push((a, b) => a.title.localeCompare(b.title));
        sortFunctions.push((a, b) => new Date(b.date) - new Date(a.date));
        break;
    }
    
    return sortFunctions;
  }
}

export class ConversationsManager {
  constructor(batchSize = 20) {
    this.batchSize = batchSize;
    this.conversations = new Map();
    this.selectedConversations = new Set();
    this.fetchSettings = null;
    this.conversationsFetcher = null;
    this.currentFetchId = null;
    this.isLoading = false;
    this.debounceTimeout = null;
    this.lastRefreshTime = 0;
    this.debounceDelay = 500; // 500ms debounce
    
    // Callbacks for notifying other managers
    this.onSelectionChanged = null;
    this.onSearchChanged = null;
    
    // Search state
    this.currentSearchTerm = '';
    this.currentSearchId = null;
    
    // Load more tracking
    this.totalConversationsLoaded = 0;
    this.conversationsDisplayed = 0;
    
    this.setupLoadMoreListener();
  }

  /**
   * Starts the conversations manager
   */
  async start() {
    try {
      console.log('🚀 ConversationsManager.start() called');
      this.fetchSettings = new FetchSettings(this.batchSize);
      this.conversationsFetcher = new ConversationsFetcher();
      
      this.clearState();
      this.conversationsDisplayed = this.batchSize; // Initialize to batch size
      
      console.log('📊 Starting loadMore...');
      await this.loadMore();
      console.log('✅ loadMore completed');
    } catch (error) {
      console.error('❌ Error starting conversations:', error);
    }
  }

  clearState() {
    this.conversations.clear();
    this.selectedConversations.clear();
    this.conversationsDisplayed = 0;
    
    if (this.conversationsFetcher) {
      this.conversationsFetcher.clearSeenItems();
    }
  }

  hasMore() {
    // Check if fetcher has more items (normal case)
    const fetcherHasMore = this.conversationsFetcher && this.conversationsFetcher.hasMoreItems();
    
    // If fetcher says no more items, check if we have more conversations to display
    if (!fetcherHasMore && this.conversationsFetcher) {
      const totalLoaded = this.conversations.size;
      const displayed = this.searchConversations(this.currentSearchTerm).length;
      
      console.log('🔍 hasMore artificial check:', {
        totalLoaded,
        displayed,
        batchSize: this.fetchSettings?.batchSize || 20,
        hasMore: displayed < totalLoaded
      });
      
      return displayed < totalLoaded;
    }
    
    console.log('🔍 hasMore fetcher check:', {
      fetcherExists: !!this.conversationsFetcher,
      hasMoreItems: this.conversationsFetcher ? this.conversationsFetcher.hasMoreItems() : false,
      result: fetcherHasMore
    });
    
    return fetcherHasMore;
  }

  async loadMore() {
    if (!this.conversationsFetcher || !this.hasMore()) {
      console.log('⏹️ No more conversations to load or fetcher not ready');
      return;
    }

    // Check if already fetching
    if (this.isLoading) {
      console.log('⏳ Already loading, skipping...');
      return;
    }
    
    // Check if we need to fetch more or just display more
    const fetcherHasMore = this.conversationsFetcher.hasMoreItems();
    const totalLoaded = this.conversations.size;
    const displayed = this.searchConversations(this.currentSearchTerm).length;
    
    if (!fetcherHasMore && displayed < totalLoaded) {
      // Just display more conversations from what we already have
      console.log('🔄 Displaying more conversations from cache...');
      this.conversationsDisplayed = Math.min(displayed + this.fetchSettings.batchSize, totalLoaded);
      this.renderConversations();
      return;
    }
    
    console.log('🔄 Starting loadMore...');
    this.isLoading = true;
    this.showLoadingState();
    const fetchId = crypto.randomUUID();
    this.currentFetchId = fetchId;
    console.log('🆔 Fetch ID:', fetchId);

    try {
      // Ensure authentication is set up
      const accessToken = await this.conversationsFetcher.getAccessToken();
      this.conversationsFetcher.authentication = {
        'Authorization': `Bearer ${accessToken}`
      };
      
      const filters = this.fetchSettings.getFilters();
      const sortFunctions = this.fetchSettings.getSortFunctions();
      console.log('🔍 Filters:', filters);
      console.log('📊 Sort functions:', sortFunctions.length);
      
      console.log('🌐 Calling fetchPaginatedData...');
      const newConversations = await this.conversationsFetcher.fetchPaginatedData(
        this.fetchSettings.batchSize, 
        null, 
        filters, 
        sortFunctions
      );
      console.log('📦 Received conversations:', newConversations.length);

      // Only apply results if this is still the latest fetch
      if (fetchId === this.currentFetchId) {
        console.log('✅ Applying results for fetch:', fetchId);
        // Add new conversations to the map
        for (const conversation of newConversations) {
          this.conversations.set(conversation.id, conversation);
        }
        
        // Update displayed count
        this.conversationsDisplayed = Math.min(
          this.conversationsDisplayed + newConversations.length,
          this.conversations.size
        );
        
        // Sort all conversations
        this.sortConversations();
        
        this.renderConversations();
        console.log('🎨 Rendered conversations, total:', this.conversations.size);
      } else {
        console.log('❌ Fetch outdated, discarding results');
      }
      
    } catch (error) {
      if (fetchId === this.currentFetchId) {
        console.error('❌ Error loading more conversations:', error);
        this.hideLoadingState();
      }
    } finally {
      if (fetchId === this.currentFetchId) {
      this.isLoading = false;
        this.currentFetchId = null;
        console.log('🏁 LoadMore completed');
      }
    }
  }

  async refresh() {
    const now = Date.now();
    const timeSinceLastRefresh = now - this.lastRefreshTime;
    
    // Debounce check
    if (timeSinceLastRefresh < this.debounceDelay) {
      // Clear existing timeout and set new one
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      
      this.debounceTimeout = setTimeout(() => {
        this.performRefresh();
      }, this.debounceDelay - timeSinceLastRefresh);
      
      return;
    }
    
    // Clear any pending debounce
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    
    await this.performRefresh();
  }

  async performRefresh() {
    this.lastRefreshTime = Date.now();
    
    // Check if already fetching
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    const fetchId = crypto.randomUUID();
    this.currentFetchId = fetchId;

    try {
      // Clear state and reset fetcher
      this.clearState();
      
      const filters = this.fetchSettings.getFilters();
      const sortFunctions = this.fetchSettings.getSortFunctions();
      
      const conversations = await this.conversationsFetcher.fetchPaginatedData(
        this.fetchSettings.batchSize, 
        null, 
        filters, 
        sortFunctions
      );

      // Only apply results if this is still the latest fetch
      if (fetchId === this.currentFetchId) {
        // Add conversations to the map
        for (const conversation of conversations) {
          this.conversations.set(conversation.id, conversation);
        }
        
        // Sort all conversations
        this.sortConversations();
        
        this.renderConversations();
      }
      
    } catch (error) {
      if (fetchId === this.currentFetchId) {
        this.renderConversations();
      }
    } finally {
      if (fetchId === this.currentFetchId) {
      this.isLoading = false;
        this.currentFetchId = null;
      this.hideLoadingState();
      }
    }
  }

  sortConversations() {
    const sortFunctions = this.fetchSettings.getSortFunctions();
    const conversationsArray = Array.from(this.conversations.values());
    
    conversationsArray.sort((a, b) => {
      for (const sortFunction of sortFunctions) {
        const comparison = sortFunction(a, b);
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
    
    this.conversations.clear();
    
    for (const conversation of conversationsArray) {
      this.conversations.set(conversation.id, conversation);
    }
  }

  // Settings management
  updateSortBy(sortBy) {
    this.fetchSettings.sortBy = sortBy;
    
    if (this.conversations.size > 0) {
      // Re-sort existing conversations
      this.sortConversations();
      this.renderConversations();
    }
  }

  updateFilters(activeFilters) {
    this.fetchSettings.activeFilters = activeFilters;
    this.refresh(); // This will debounce and refresh everything
  }

  resetToDefaultSettings() {
    this.fetchSettings.sortBy = 'created';
    this.fetchSettings.activeFilters = [];
    this.refresh();
  }

  // Selection management
  toggleConversationSelection(conversationId) {
    if (this.selectedConversations.has(conversationId)) {
      this.selectedConversations.delete(conversationId);
    } else {
      this.selectedConversations.add(conversationId);
    }
    this.renderConversations();
    this.notifySelectionChanged();
  }

  selectAllConversations() {
    this.selectedConversations.clear();
    const conversationsToDisplay = this.searchConversations(this.currentSearchTerm);
    for (const conversation of conversationsToDisplay) {
      this.selectedConversations.add(conversation.id);
    }
    this.renderConversations();
    this.notifySelectionChanged();
  }

  deselectAllConversations() {
    this.selectedConversations.clear();
    this.renderConversations();
    this.notifySelectionChanged();
  }

  getSelectedConversationsCount() {
    return this.selectedConversations.size;
  }

  getTotalConversationsCount() {
    return this.searchConversations(this.currentSearchTerm).length;
  }

  hasActiveSearch() {
    return this.currentSearchTerm && this.currentSearchTerm.trim().length > 0;
  }

  areAllConversationsSelected() {
    const conversationsToDisplay = this.searchConversations(this.currentSearchTerm);
    return conversationsToDisplay.length > 0 && 
           conversationsToDisplay.every(conversation => this.selectedConversations.has(conversation.id));
  }

  // Search functionality
  searchConversations(searchString) {
    let allConversations;
    
    if (!searchString || searchString.trim() === '') {
      allConversations = Array.from(this.conversations.values());
    } else {
      const searchTerm = searchString.toLowerCase().trim();
      const filteredConversations = [];

      for (const conversation of this.conversations.values()) {
        const title = conversation.title.toLowerCase();
        const id = conversation.id.toLowerCase();
        
        // Search in both title and ID (case insensitive)
        if (title.includes(searchTerm) || id.includes(searchTerm)) {
          filteredConversations.push(conversation);
        }
      }
      
      allConversations = filteredConversations;
    }
    
    // Limit the number of conversations displayed
    const limit = this.conversationsDisplayed || this.fetchSettings?.batchSize || 20;
    return allConversations.slice(0, limit);
  }

  getConversations() {
    return Array.from(this.conversations.values());
  }

  setSearchTerm(searchTerm) {
    this.currentSearchTerm = searchTerm;
    this.renderConversations();
    this.notifySearchChanged();
  }

  getCurrentSearchTerm() {
    return this.currentSearchTerm;
  }

  // Callback management
  setOnSelectionChanged(callback) {
    this.onSelectionChanged = callback;
  }

  setOnSearchChanged(callback) {
    this.onSearchChanged = callback;
  }

  notifySelectionChanged() {
    if (this.actionsManager) {
      const selectedCount = this.getSelectedConversationsCount();
      this.actionsManager.updateSelectToggle(selectedCount);
      this.actionsManager.updateActionButtons();
    }
  }

  notifySearchStateChanged() {
    if (this.actionsManager) {
      const hasSearch = this.hasActiveSearch();
      this.actionsManager.updateSearchIndicator(hasSearch);
    }
  }

  notifySearchChanged() {
    const actionsManager = getManager('actions');
    if (actionsManager) {
      actionsManager.updateSelectToggleButton();
    }
  }

  // UI State management
  showLoadingState() {
    console.log('🔄 Showing loading state...');
    const conversationsList = document.getElementById('conversations-list');
    if (conversationsList) {
      conversationsList.innerHTML = `
        <div class="conversations-loading">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading conversations...</div>
        </div>
      `;
      console.log('✅ Loading state displayed');
    } else {
      console.error('❌ conversations-list element not found');
    }
    
    // Disable action bar during loading
    if (this.actionsManager) {
      this.actionsManager.disableActionBar();
    }
  }

  hideLoadingState() {
    console.log('🔄 Hiding loading state...');
    // Loading state will be replaced by renderConversations()
  }

  disableActionsDuringLoading() {
    const selectBtn = document.getElementById('select-toggle-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const archiveBtn = document.getElementById('archive-btn');
    const searchInput = document.getElementById('search-input');
    
    if (selectBtn) selectBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    if (archiveBtn) archiveBtn.disabled = true;
    if (searchInput) searchInput.disabled = true;
  }

  enableActionsAfterLoading() {
    // Enable action bar after loading
    if (this.actionsManager) {
      this.actionsManager.enableActionBar();
    }
  }

  // Rendering
  renderConversations() {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) return;

    // Always hide loading state when rendering conversations
    this.hideLoadingState();
    this.enableActionsAfterLoading();

    // Get conversations to display (with search filter applied)
    const conversationsToDisplay = this.searchConversations(this.currentSearchTerm);

    if (conversationsToDisplay.length === 0) {
      const message = this.currentSearchTerm ? 'No conversations match your search' : 'No conversations found';
      conversationsList.innerHTML = `
        <div class="empty-state">
          <p>${message}</p>
          <a href="https://chatgpt.com/" target="_self" class="start-new-link">Start a new conversation</a>
        </div>
      `;
      return;
    }
    
    const conversationsHTML = conversationsToDisplay
      .map(conversation => this.getConversationHTML(conversation))
      .join('');
    const loadMoreHTML = this.getLoadMoreHTML();
    
    conversationsList.innerHTML = conversationsHTML + loadMoreHTML;
    
    this.attachConversationListeners();
    this.attachLoadMoreListener();
    this.updateSelectAllButton();
  }

  getConversationHTML(conversation) {
    const isSelected = this.selectedConversations.has(conversation.id);
    const tags = this.getConversationTags(conversation);
    const searchTerm = this.currentSearchTerm || '';
    
    // Highlight search terms in title and ID
    const highlightedTitle = this.highlightSearchTerm(conversation.title, searchTerm);
    const highlightedId = this.highlightSearchTerm(conversation.id, searchTerm);
    
    return `
      <div class="conversation-item ${isSelected ? 'selected' : ''}" data-id="${conversation.id}">
        <input type="checkbox" class="conversation-checkbox" ${isSelected ? 'checked' : ''} data-id="${conversation.id}">
        
        <div class="conversation-content">
          <div class="conversation-main">
            <div class="conversation-title-row">
              <h3 class="conversation-title">${highlightedTitle}</h3>
              ${tags}
            </div>
            <div class="conversation-id-container">
              <span class="conversation-id" title="Conversation ID: ${conversation.id}">
                <button class="copy-id-btn" data-id="${conversation.id}" title="Copy ID">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" fill="none"/>
                  </svg>
                </button>
                <button class="copy-link-btn" data-id="${conversation.id}" title="Copy Link">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" fill="none"/>
                  </svg>
                </button>
                ${highlightedId}
              </span>
            </div>
          </div>
          
          <div class="conversation-dates">
            <div class="conversation-date created">Created: ${this.formatDate(conversation.date)}</div>
            <div class="conversation-date updated">Modified: ${this.formatDate(conversation.updateTime)}</div>
          </div>
        </div>
        
        <button class="conversation-menu-btn" data-id="${conversation.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="1" fill="currentColor"/>
            <circle cx="12" cy="5" r="1" fill="currentColor"/>
            <circle cx="12" cy="19" r="1" fill="currentColor"/>
          </svg>
        </button>
      </div>
    `;
  }

  getConversationTags(conversation) {
    const tags = [];
    if (conversation.isNew) {
      tags.push('<span class="conversation-tag new" title="This conversation was created in the last 24 hours">New</span>');
    }
    if (conversation.isRecentlyModified) {
      tags.push('<span class="conversation-tag updated" title="This conversation was modified in the last 24 hours">Updated</span>');
    }
    return tags.length > 0 ? `<div class="conversation-tags">${tags.join('')}</div>` : '';
  }

  getLoadMoreHTML() {
    const hasMore = this.hasMore();
    console.log('🔍 getLoadMoreHTML:', { hasMore });
    
    if (!hasMore) {
      return '';
    }
    
    return `
      <div class="load-more-item">
        <button class="action-btn" id="load-more-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          </svg>
          Load More
        </button>
      </div>
    `;
  }

  formatDate(date) {
    const now = new Date();
    const targetDate = new Date(date);
    const differenceMs = now - targetDate;
    const differenceMinutes = Math.floor(differenceMs / (1000 * 60));
    const differenceHours = Math.floor(differenceMs / (1000 * 60 * 60));
    const differenceDays = Math.floor(differenceMs / (1000 * 60 * 60 * 24));
    const differenceWeeks = Math.floor(differenceDays / 7);
    const differenceMonths = Math.floor(differenceDays / 30);
    const differenceYears = Math.floor(differenceDays / 365);

    if (differenceMinutes < 1) {
      return 'Just now';
    } else if (differenceMinutes < 60) {
      return `${differenceMinutes}m ago`;
    } else if (differenceHours < 24) {
      return `${differenceHours}h ago`;
    } else if (differenceDays === 1) {
      return 'Yesterday';
    } else if (differenceDays < 7) {
      return `${differenceDays}d ago`;
    } else if (differenceWeeks < 4) {
      return `${differenceWeeks}w ago`;
    } else if (differenceMonths < 12 && differenceMonths > 0) {
      return `${differenceMonths}mo ago`;
    } else if (differenceYears > 0) {
      return `${differenceYears}y ago`;
    } else {
      // Fallback for very recent dates
      return `${differenceDays}d ago`;
    }
  }

  showContextMenu(button) {
    const conversationId = button.dataset.id;
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    // Close any open dropdowns
    this.closeAllSelectors();

    // Remove existing context menu
    const existingMenu = document.querySelector('.conversation-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Remove active class from all 3-dots buttons
    document.querySelectorAll('.conversation-menu-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Add active class to the button
    button.classList.add('active');

    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.className = 'conversation-context-menu show';
    contextMenu.innerHTML = `
      <div class="conversation-context-menu-item" data-action="go-to">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Go to
      </div>
      <div class="conversation-context-menu-item" data-action="copy-id">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        Copy ID
      </div>
      <div class="conversation-context-menu-item" data-action="copy-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        Copy Link
      </div>
      <div class="conversation-context-menu-item archive" data-action="archive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="21,8 21,21 3,21 3,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="1" y="3" width="22" height="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="10" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Archive
      </div>
      <div class="conversation-context-menu-item danger" data-action="delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M19,6v14a2,2 0 01-2,2H7a2,2 0 01-2-2V6m3,0V4a2,2 0 012-2h4a2,2 0 012,2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Delete
      </div>
    `;

    // Position the menu
    const buttonRect = button.getBoundingClientRect();
    contextMenu.style.position = 'absolute';
    contextMenu.style.top = `${buttonRect.bottom + 2}px`;
    contextMenu.style.left = `${buttonRect.right - contextMenu.offsetWidth}px`;

    // Add to DOM
    document.body.appendChild(contextMenu);

    // Add event listeners
    contextMenu.addEventListener('click', (e) => {
      const action = e.target.closest('.conversation-context-menu-item')?.dataset.action;
      if (action) {
        this.handleContextMenuAction(action, conversationId, e);
        contextMenu.remove();
        button.classList.remove('active');
      }
    });

    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!contextMenu.contains(e.target) && !button.contains(e.target)) {
        contextMenu.remove();
        button.classList.remove('active');
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  async handleContextMenuAction(action, conversationId, event = null) {
    switch (action) {
      case 'go-to':
        // Open conversation in new tab
        window.open(`https://chatgpt.com/c/${conversationId}`, '_blank');
        break;
      case 'copy-id':
        await this.copyToClipboard(conversationId, event);
        break;
      case 'copy-link':
        await this.copyLinkToClipboard(conversationId, event);
        break;
      case 'archive':
        await this.archiveConversations([conversationId]);
        break;
      case 'delete':
        await this.deleteConversations([conversationId]);
        break;
    }
  }

  attachConversationListeners() {
    // Checkbox listeners
    document.querySelectorAll('.conversation-item input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.toggleConversationSelection(e.target.dataset.id);
      });
    });

    // Card click listeners (to select/deselect)
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on checkbox, menu button, or copy buttons
        if (e.target.type === 'checkbox' || 
            e.target.closest('.conversation-menu-btn') ||
            e.target.closest('.copy-id-btn') ||
            e.target.closest('.copy-link-btn')) {
          return;
        }
        const conversationId = item.dataset.id;
        this.toggleConversationSelection(conversationId);
      });
    });

    // Context menu listeners
    document.querySelectorAll('.conversation-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Check if this button already has an active context menu
        const existingMenu = document.querySelector('.conversation-context-menu');
        const isActive = btn.classList.contains('active');
        
        if (isActive && existingMenu) {
          // Close existing menu
          existingMenu.remove();
          btn.classList.remove('active');
        } else {
          // Close any other open menu first
          if (existingMenu) {
            existingMenu.remove();
            document.querySelectorAll('.conversation-menu-btn').forEach(b => b.classList.remove('active'));
          }
          // Show new menu
          this.showContextMenu(btn);
        }
      });
    });

    // Copy ID button listeners
    document.querySelectorAll('.copy-id-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(btn.dataset.id, e);
      });
    });

    // Copy link button listeners
    document.querySelectorAll('.copy-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyLinkToClipboard(btn.dataset.id, e);
      });
    });
  }

  attachLoadMoreListener() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.loadMore();
      });
    }
  }

  updateSelectAllButton() {
    const selectBtn = document.getElementById('select-toggle-btn');
    const selectText = document.getElementById('select-toggle-text');
    
    if (selectBtn && selectText) {
      if (this.areAllConversationsSelected()) {
        selectText.textContent = 'Unselect All';
      } else {
        selectText.textContent = 'Select All';
      }
    }
  }

  // Actions
  async deleteSelectedConversations() {
    if (this.selectedConversations.size === 0) return;
    
    const confirmed = await ActionsManager.confirmAction('delete', this.selectedConversations.size);
    if (!confirmed) return;
    
    try {
      await ActionsManager.deleteConversations(Array.from(this.selectedConversations));
    this.selectedConversations.clear();
      await this.refresh(); // Refresh the list
    } catch (error) {
      console.error('Error deleting conversations:', error);
    }
  }

  async archiveSelectedConversations() {
    if (this.selectedConversations.size === 0) return;
    
    const confirmed = await ActionsManager.confirmAction('archive', this.selectedConversations.size);
    if (!confirmed) return;
    
    try {
      await ActionsManager.archiveConversations(Array.from(this.selectedConversations));
      this.selectedConversations.clear();
      await this.refresh(); // Refresh the list
    } catch (error) {
      console.error('Error archiving conversations:', error);
    }
  }

  /**
   * Sets up the Load More button event listener
   * @private
   */
  setupLoadMoreListener() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', async () => {
        await this.loadMore();
      });
    }
  }

  /**
   * Performs search on conversations with concurrent search handling
   * @param {string} searchTerm - The search term to filter by
   */
  search(searchTerm) {
    // Generate unique ID for this search
    const searchId = crypto.randomUUID();
    this.currentSearchId = searchId;
    this.currentSearchTerm = searchTerm;
    
    console.log('🔍 Performing search:', searchTerm, 'ID:', searchId);
    
    // Perform local search and render
    this.renderConversations();
    
    // Notify search state changed (indicator should update)
    this.notifySearchStateChanged();
    
    // Notify ActionsManager that search is completed (only if this is still the latest search)
    setTimeout(() => {
      if (searchId === this.currentSearchId) {
        if (this.actionsManager) {
          this.actionsManager.onSearchCompleted(searchTerm.length > 0);
        }
      } else {
        console.log('🔍 Search outdated, not notifying ActionsManager:', searchId);
      }
    }, 0);
  }

  /**
   * Sets the sort field and refreshes the conversation list
   * @param {string} sortBy - The sort field (created, modified, name)
   */
  setSortBy(sortBy) {
    this.sortBy = sortBy;
    this.refresh();
  }

  /**
   * Sets the sort direction and refreshes the conversation list
   * @param {string} direction - The sort direction (asc, desc)
   */
  setSortDirection(direction) {
    this.sortDirection = direction;
    this.refresh();
  }

  /**
   * Sets the active filters and refreshes the conversation list
   * @param {Array<string>} filters - Array of active filter names
   */
  setActiveFilters(filters) {
    this.activeFilters = new Set(filters);
    this.refresh();
  }

  /**
   * Gets the current search term
   * @returns {string} The current search term
   */
  getSearchTerm() {
    return this.searchTerm;
  }

  /**
   * Gets the number of selected conversations
   * @returns {number} Number of selected conversations
   */
  getSelectedCount() {
    return this.selectedConversations.size;
  }

  /**
   * Gets whether there's an active search
   * @returns {boolean} True if there's an active search
   */
  hasActiveSearch() {
    return this.searchTerm && this.searchTerm.trim().length > 0;
  }

  /**
   * Sets the ActionsManager reference for communication
   * @param {ActionsManager} actionsManager - The ActionsManager instance
   */
  setActionsManager(actionsManager) {
    this.actionsManager = actionsManager;
  }

  /**
   * Notifies ActionsManager of selection changes
   * @private
   */
  notifySelectionChanged() {
    if (this.actionsManager) {
      const selectedCount = this.selectedConversations.size;
      const hasSearch = this.hasActiveSearch();
      this.actionsManager.updateSelectToggle(selectedCount, hasSearch);
      this.actionsManager.updateActionButtons();
    }
  }

  /**
   * Closes all selector dropdowns
   * @private
   */
  closeAllSelectors() {
    if (this.actionsManager) {
      this.actionsManager.closeAllSelectors();
    }
  }

  /**
   * Highlights search terms in text
   * @param {string} text - The text to highlight
   * @param {string} searchTerm - The search term to highlight
   * @returns {string} HTML with highlighted search terms
   * @private
   */
  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !searchTerm.trim()) {
      return text;
    }
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /**
   * Creates particle animation at click location
   * @param {Event} event - The click event
   * @private
   */
  createParticleAnimation(event) {
    // Use mouse cursor position directly (we're already in iframe context)
    // Offset slightly up and left for better visibility
    const centerX = event.clientX - 5;
    const centerY = event.clientY - 5;
    
    console.log('🎆 Creating particles at:', centerX, centerY);

    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'copy-particles';
    particlesContainer.style.position = 'fixed';
    particlesContainer.style.pointerEvents = 'none';
    particlesContainer.style.zIndex = '1000';
    particlesContainer.style.left = '0';
    particlesContainer.style.top = '0';
    particlesContainer.style.width = '100%';
    particlesContainer.style.height = '100%';
    document.body.appendChild(particlesContainer);

    // Create 8 particles in a circle
    for (let i = 0; i < 8; i++) {
      const particle = document.createElement('div');
      particle.className = 'copy-particle';
      
      const angle = (i * 45) * (Math.PI / 180); // 45 degrees apart
      const distance = 20 + Math.random() * 10; // Random distance between 20-30px
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      particle.style.position = 'absolute';
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      particle.style.width = '3px';
      particle.style.height = '3px';
      particle.style.background = 'var(--accent-primary)';
      particle.style.borderRadius = '50%';
      particle.style.transform = 'translate(-50%, -50%)';
      particle.style.setProperty('--particle-x', `${x}px`);
      particle.style.setProperty('--particle-y', `${y}px`);
      particle.style.animation = 'particle-explosion 0.6s ease-out forwards';
      
      particlesContainer.appendChild(particle);
    }

    // Remove particles after animation
    setTimeout(() => {
      if (particlesContainer.parentNode) {
        particlesContainer.parentNode.removeChild(particlesContainer);
      }
    }, 600);
  }

  /**
   * Shows copy confirmation toast
   * @param {string} message - The confirmation message
   * @param {string} conversationId - The conversation ID to display
   * @private
   */
  showCopyConfirmation(message, conversationId = '') {
    // Remove existing toast
    const existingToast = document.querySelector('.copy-confirmation-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'copy-confirmation-toast toast-success';
    
    // Display message with conversation ID if provided
    if (conversationId) {
      toast.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div>${message}</div>
          <div style="font-size: 9px; opacity: 0.8; font-family: monospace;">${conversationId}</div>
        </div>
      `;
    } else {
      toast.textContent = message;
    }
    
    document.body.appendChild(toast);

    // Show toast with slide-in animation
    toast.style.display = 'block';
    toast.style.animation = 'toastSlideIn 0.3s ease-out';

    // Auto-hide after 2 seconds
    setTimeout(() => {
      this.hideCopyToast(toast);
    }, 2000);
  }

  /**
   * Hides copy confirmation toast
   * @param {HTMLElement} toast - The toast element to hide
   * @private
   */
  hideCopyToast(toast) {
    if (toast) {
      // Start slide-out animation
      toast.style.animation = 'toastSlideOut 0.3s ease-in';
      
      // Hide after animation completes
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }

  /**
   * Copies conversation ID to clipboard
   * @param {string} conversationId - The conversation ID to copy
   * @param {Event} event - The click event for particle animation
   */
  async copyToClipboard(conversationId, event = null) {
    try {
      await navigator.clipboard.writeText(conversationId);
      
      // Create particle animation if event provided
      if (event) {
        this.createParticleAnimation(event);
      }
      
      // Show confirmation toast
      this.showCopyConfirmation('ID copied to clipboard', conversationId);
      
    } catch (error) {
      console.error('Failed to copy ID:', error);
      if (this.actionsManager && this.actionsManager.toastManager) {
        this.actionsManager.toastManager.error('Failed to copy ID');
      }
    }
  }

  /**
   * Copies conversation link to clipboard
   * @param {string} conversationId - The conversation ID to create link for
   * @param {Event} event - The click event for particle animation
   */
  async copyLinkToClipboard(conversationId, event = null) {
    try {
      const link = `https://chatgpt.com/c/${conversationId}`;
      await navigator.clipboard.writeText(link);
      
      // Create particle animation if event provided
      if (event) {
        this.createParticleAnimation(event);
      }
      
      // Show confirmation toast
      this.showCopyConfirmation('Link copied to clipboard', conversationId);
      
    } catch (error) {
      console.error('Failed to copy link:', error);
      if (this.actionsManager && this.actionsManager.toastManager) {
        this.actionsManager.toastManager.error('Failed to copy link');
      }
    }
  }
}
