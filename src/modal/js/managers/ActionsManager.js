/**
 * Manages the action bar functionality including search, sort, filter, and actions
 * Handles delete/archive buttons, sort/filter controls, select toggle, and search
 */
export class ActionsManager {
  /**
   * Creates a new ActionsManager instance
   * @param {boolean} preventDelete - Whether delete action is prevented
   * @param {boolean} preventArchive - Whether archive action is prevented
   * @param {ToastManager} toastManager - The toast manager instance
   * @param {ConversationsManager} conversationsManager - The conversations manager instance
   */
  constructor(preventDelete = false, preventArchive = false, toastManager = null, conversationsManager = null) {
    this.preventDelete = preventDelete;
    this.preventArchive = preventArchive;
    this.toastManager = toastManager;
    this.conversationsManager = conversationsManager;
    
    // Find DOM elements
    this.selectToggleButton = document.getElementById('select-toggle-btn');
    this.selectToggleText = document.getElementById('select-toggle-text');
    this.selectSearchIndicator = document.getElementById('select-search-indicator');
    this.selectCount = document.getElementById('select-count');
    this.deleteButton = document.getElementById('delete-btn');
    this.archiveButton = document.getElementById('archive-btn');
    this.searchInputElement = document.getElementById('search-input');
    this.clearButtonElement = document.getElementById('clear-search-btn');
    
    // Selector elements
    this.sortSelector = document.getElementById('sort-selector');
    this.filterSelector = document.getElementById('filter-selector');
    this.sortDirectionIconBtn = document.getElementById('sort-direction-icon-btn');
    this.filterModeIconBtn = document.getElementById('filter-mode-icon-btn');
    
    this.searchQuery = '';
    this.searchTimeout = null;
    this.currentSort = 'created';
    this.sortDirection = 'asc';
    this.filterMode = 'inclusive';
    this.activeFilters = new Set();
    
    this.setupEventListeners();
    this.setupSelectorListeners();
    this.setupSearchListeners();
    
    // Initialize button states
    this.updateSortDirectionButton();
    this.updateFilterModeButton();
    
    // Disable action bar by default (will be enabled after conversations load)
    this.disableActionBar();
  }

  /**
   * Sets up event listeners for action buttons
   * @private
   */
  setupEventListeners() {
    if (this.selectToggleButton) {
      this.selectToggleButton.addEventListener('click', () => {
        this.handleSelectToggle();
      });
    }
    
    if (this.deleteButton) {
      this.deleteButton.addEventListener('click', () => {
        this.handleDelete();
      });
    }
    
    if (this.archiveButton) {
      this.archiveButton.addEventListener('click', () => {
        this.handleArchive();
      });
    }
  }

  /**
   * Sets up event listeners for search functionality
   * @private
   */
  setupSearchListeners() {
    if (this.searchInputElement) {
      this.searchInputElement.addEventListener('input', (event) => {
        this.handleSearchInput(event.target.value);
      });
    }

    if (this.clearButtonElement) {
      this.clearButtonElement.addEventListener('click', () => {
        this.clearSearch();
      });
    }
  }

  /**
   * Sets up event listeners for selector functionality
   * @private
   */
  setupSelectorListeners() {
    // Sort selector
    if (this.sortSelector) {
      const trigger = this.sortSelector.querySelector('.selector-trigger');
      if (trigger) {
        trigger.addEventListener('click', () => {
          this.toggleSortSelector();
        });
      }

      // Sort options
      const sortOptions = this.sortSelector.querySelectorAll('.selector-option[data-sort]');
      sortOptions.forEach(option => {
        option.addEventListener('click', () => {
          const sortValue = option.dataset.sort;
          this.handleSortChange(sortValue);
        });
      });
    }

    // Sort direction icon button
    if (this.sortDirectionIconBtn) {
      this.sortDirectionIconBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering selector
        this.toggleSortDirection();
      });
    }

    // Filter selector
    if (this.filterSelector) {
      const trigger = this.filterSelector.querySelector('.selector-trigger');
      if (trigger) {
        trigger.addEventListener('click', () => {
          this.toggleFilterSelector();
        });
      }

      // Filter options
      const filterOptions = this.filterSelector.querySelectorAll('.selector-option[data-filter]');
      filterOptions.forEach(option => {
        option.addEventListener('click', () => {
          const filterValue = option.dataset.filter;
          this.handleFilterToggle(filterValue);
        });
      });

      // Reset filters option
      const resetOption = this.filterSelector.querySelector('.selector-option[data-action="reset-filters"]');
      if (resetOption) {
        resetOption.addEventListener('click', () => {
          this.handleResetFilters();
        });
      }
    }

    // Filter mode icon button
    if (this.filterModeIconBtn) {
      this.filterModeIconBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering selector
        this.toggleFilterMode();
      });
    }

    // Close selectors when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.sort-selector') && 
          !e.target.closest('.filter-selector') && 
          !e.target.closest('.conversation-menu-btn') &&
          !e.target.closest('.context-menu')) {
        this.closeAllSelectors();
      }
    });
  }


  /**
   * Handles select toggle button click
   * @private
   */
  handleSelectToggle() {
    if (this.conversationsManager.areAllConversationsSelected()) {
      // All selected, deselect all
      this.conversationsManager.deselectAllConversations();
    } else {
      // Not all selected, select all (limited to search results if search is active)
      this.conversationsManager.selectAllConversations();
    }
  }

  /**
   * Handles delete button click
   * @private
   */
  async handleDelete() {
    if (!this.conversationsManager) return;
    
    const selectedIds = Array.from(this.conversationsManager.selectedConversations);
    if (selectedIds.length === 0) return;
    
    // Check if delete prevention is enabled
    if (this.preventDelete) {
      this.toastManager.warning('Delete action is disabled in settings');
      return;
    }
    
    const confirmed = await this.showConfirmationModal(
      'Delete Conversations',
      `Are you sure you want to delete ${selectedIds.length} conversation(s)? This action cannot be undone.`,
      'Delete',
      'Cancel',
      'danger'
    );
    
    if (confirmed) {
      await this.deleteConversations(selectedIds);
    }
  }

  /**
   * Handles archive button click
   * @private
   */
  async handleArchive() {
    if (!this.conversationsManager) return;
    
    const selectedIds = Array.from(this.conversationsManager.selectedConversations);
    if (selectedIds.length === 0) return;
    
    // Check if archive prevention is enabled
    if (this.preventArchive) {
      this.toastManager.warning('Archive action is disabled in settings');
      return;
    }
    
    const confirmed = await this.showConfirmationModal(
      'Archive Conversations',
      `Are you sure you want to archive ${selectedIds.length} conversation(s)?`,
      'Archive',
      'Cancel',
      'warning'
    );
    
    if (confirmed) {
      await this.archiveConversations(selectedIds);
    }
  }

  /**
   * Handles reset settings button click
   * @private
   */
  handleResetSettings() {
    if (this.conversationsManager) {
      this.conversationsManager.resetToDefaultSettings();
    }
  }


  /**
   * Disables all action bar elements during loading
   */
  disableActionBar() {
    // Disable toggle selection button
    if (this.selectToggleButton) {
      this.selectToggleButton.disabled = true;
    }
    
    // Disable action buttons
    if (this.deleteButton) {
      this.deleteButton.disabled = true;
    }
    if (this.archiveButton) {
      this.archiveButton.disabled = true;
    }
    
    // Disable search input
    if (this.searchInputElement) {
      this.searchInputElement.disabled = true;
    }
    
    // Disable clear button
    if (this.clearButtonElement) {
      this.clearButtonElement.disabled = true;
    }
    
    // Disable selectors
    if (this.sortSelector) {
      this.sortSelector.style.pointerEvents = 'none';
      this.sortSelector.style.opacity = '0.5';
    }
    if (this.filterSelector) {
      this.filterSelector.style.pointerEvents = 'none';
      this.filterSelector.style.opacity = '0.5';
    }
    
    // Disable icon buttons
    if (this.sortDirectionIconBtn) {
      this.sortDirectionIconBtn.disabled = true;
    }
    if (this.filterModeIconBtn) {
      this.filterModeIconBtn.disabled = true;
    }
  }

  /**
   * Enables action bar elements after loading
   */
  enableActionBar() {
    // Enable toggle selection button
    if (this.selectToggleButton) {
      this.selectToggleButton.disabled = false;
    }
    
    // Enable search input
    if (this.searchInputElement) {
      this.searchInputElement.disabled = false;
    }
    
    // Enable clear button
    if (this.clearButtonElement) {
      this.clearButtonElement.disabled = false;
    }
    
    // Enable selectors
    if (this.sortSelector) {
      this.sortSelector.style.pointerEvents = 'auto';
      this.sortSelector.style.opacity = '1';
    }
    if (this.filterSelector) {
      this.filterSelector.style.pointerEvents = 'auto';
      this.filterSelector.style.opacity = '1';
    }
    
    // Enable icon buttons
    if (this.sortDirectionIconBtn) {
      this.sortDirectionIconBtn.disabled = false;
    }
    if (this.filterModeIconBtn) {
      this.filterModeIconBtn.disabled = false;
    }
    
    // Update action buttons based on current selection
    this.updateActionButtons();
  }

  /**
   * Updates the delete and archive buttons state
   * Called by ConversationsManager when selection changes
   */
  updateActionButtons() {
    if (!this.conversationsManager) return;
    
    const hasSelection = this.conversationsManager.getSelectedConversationsCount() > 0;
    
    if (this.deleteButton) {
      this.deleteButton.disabled = !hasSelection;
    }
    
    if (this.archiveButton) {
      this.archiveButton.disabled = !hasSelection;
    }
  }

  /**
   * Deletes conversations via API
   * @param {Array<string>} conversationIds - Array of conversation IDs to delete
   * @private
   */
  async deleteConversations(conversationIds) {
    try {
      for (const id of conversationIds) {
        const response = await fetch(`https://chatgpt.com/backend-api/conversation/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer ' + await this.getAccessToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_visible: false })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete conversation ${id}: ${response.status}`);
        }
      }
      
      this.toastManager.success(`Successfully deleted ${conversationIds.length} conversation(s)`);
      
      // Remove deleted conversations from the list
      if (this.conversationsManager) {
        this.conversationsManager.conversations.forEach(conversation => {
          if (conversationIds.includes(conversation.id)) {
            this.conversationsManager.conversations.delete(conversation.id);
            this.conversationsManager.selectedConversations.delete(conversation.id);
          }
        });
        
        this.conversationsManager.renderConversations();
        this.updateActionButtons();
      }
      
    } catch (error) {
      console.error('Error deleting conversations:', error);
      this.toastManager.error('Failed to delete conversations');
    }
  }

  /**
   * Archives conversations via API
   * @param {Array<string>} conversationIds - Array of conversation IDs to archive
   * @private
   */
  async archiveConversations(conversationIds) {
    try {
      for (const id of conversationIds) {
        const response = await fetch(`https://chatgpt.com/backend-api/conversation/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer ' + await this.getAccessToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_archived: true })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to archive conversation ${id}: ${response.status}`);
        }
      }
      
      this.toastManager.success(`Successfully archived ${conversationIds.length} conversation(s)`);
      
      // Update conversation status in the list
      if (this.conversationsManager) {
        this.conversationsManager.conversations.forEach(conversation => {
          if (conversationIds.includes(conversation.id)) {
            conversation.status = 'archived';
            this.conversationsManager.selectedConversations.delete(conversation.id);
          }
        });
        
        this.conversationsManager.renderConversations();
        this.updateActionButtons();
      }
      
    } catch (error) {
      console.error('Error archiving conversations:', error);
      this.toastManager.error('Failed to archive conversations');
    }
  }

  /**
   * Gets access token for API requests
   * @returns {Promise<string>} Access token
   * @private
   */
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

  /**
   * Shows a confirmation modal
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @param {string} confirmText - Confirm button text
   * @param {string} cancelText - Cancel button text
   * @param {string} type - Modal type (danger, warning, etc.)
   * @returns {Promise<boolean>} True if confirmed, false if cancelled
   * @private
   */
  async showConfirmationModal(title, message, confirmText, cancelText, type = 'warning') {
    return new Promise((resolve) => {
      // Create modal HTML
      const modalHTML = `
        <div class="confirmation-modal-overlay">
          <div class="confirmation-modal">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="confirmation-buttons">
              <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
              <button class="btn btn-${type}" id="confirm-ok">${confirmText}</button>
            </div>
          </div>
        </div>
      `;
      
      // Add modal to body
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      const modal = document.querySelector('.confirmation-modal-overlay');
      const cancelBtn = document.getElementById('confirm-cancel');
      const confirmBtn = document.getElementById('confirm-ok');
      
      // Handle button clicks
      cancelBtn.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });
      
      confirmBtn.addEventListener('click', () => {
        modal.remove();
          resolve(true);
      });
      
      // Handle overlay click
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  }

  /**
   * Handles search input changes with debouncing
   * @param {string} value - The search input value
   * @private
   */
  handleSearchInput(value) {
    this.searchQuery = value;
    this.updateClearButton();

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.performSearch();
    }, 300);
  }

  /**
   * Performs the search by communicating with ConversationsManager
   * @private
   */
  performSearch() {
    if (this.conversationsManager) {
      this.conversationsManager.search(this.searchQuery);
    }
  }

  /**
   * Clears the search input and resets search state
   * @private
   */
  clearSearch() {
    if (this.searchInputElement) {
      this.searchInputElement.value = '';
    }
    
    this.searchQuery = '';
    this.updateClearButton();
    
    if (this.conversationsManager) {
      this.conversationsManager.search('');
    }
  }

  /**
   * Updates the visibility of the clear button based on search state
   * @private
   */
  updateClearButton() {
    if (this.clearButtonElement) {
      this.clearButtonElement.style.display = this.searchQuery ? 'flex' : 'none';
    }
  }

  /**
   * Toggles the sort selector dropdown
   * @private
   */
  toggleSortSelector() {
    if (this.sortSelector) {
      this.sortSelector.classList.toggle('open');
      if (this.filterSelector) {
        this.filterSelector.classList.remove('open');
      }
    }
  }

  /**
   * Toggles the filter selector dropdown
   * @private
   */
  toggleFilterSelector() {
    if (this.filterSelector) {
      this.filterSelector.classList.toggle('open');
      if (this.sortSelector) {
        this.sortSelector.classList.remove('open');
      }
    }
  }

  /**
   * Closes all selector dropdowns
   * @private
   */
  closeAllSelectors() {
    if (this.sortSelector) {
      this.sortSelector.classList.remove('open');
    }
    if (this.filterSelector) {
      this.filterSelector.classList.remove('open');
    }
  }

  /**
   * Handles sort change
   * @param {string} sortValue - The sort value (created, modified, name)
   * @private
   */
  handleSortChange(sortValue) {
    this.currentSort = sortValue;
    this.updateSortSelector();
    this.closeAllSelectors();
    
    if (this.conversationsManager) {
      this.conversationsManager.setSortBy(sortValue);
    }
  }

  /**
   * Toggles sort direction
   * @private
   */
  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.updateSortDirectionButton();
    
    if (this.conversationsManager) {
      this.conversationsManager.setSortDirection(this.sortDirection);
    }
  }

  /**
   * Toggles filter mode between inclusive and exclusive
   * @private
   */
  toggleFilterMode() {
    this.filterMode = this.filterMode === 'inclusive' ? 'exclusive' : 'inclusive';
    this.updateFilterModeButton();
    
    if (this.conversationsManager) {
      this.conversationsManager.setFilterMode(this.filterMode);
    }
  }

  /**
   * Handles filter toggle (multi-select)
   * @param {string} filterValue - The filter value (new, updated, other)
   * @private
   */
  handleFilterToggle(filterValue) {
    if (this.activeFilters.has(filterValue)) {
      this.activeFilters.delete(filterValue);
    } else {
      this.activeFilters.add(filterValue);
    }
    
    this.updateFilterSelector();
    
    if (this.conversationsManager) {
      this.conversationsManager.setActiveFilters(Array.from(this.activeFilters));
    }
  }

  /**
   * Handles reset filters
   * @private
   */
  handleResetFilters() {
    this.activeFilters.clear();
    this.updateFilterSelector();
    this.closeAllSelectors();
    
    if (this.conversationsManager) {
      this.conversationsManager.setActiveFilters([]);
    }
  }

  /**
   * Updates the sort selector display
   * @private
   */
  updateSortSelector() {
    if (!this.sortSelector) return;
    
    const textElement = this.sortSelector.querySelector('.selector-text');
    if (textElement) {
      const sortLabels = {
        created: 'Created Date',
        modified: 'Modified Date',
        name: 'Name'
      };
      textElement.textContent = sortLabels[this.currentSort] || 'Created Date';
    }

    // Update selected option
    const options = this.sortSelector.querySelectorAll('.selector-option[data-sort]');
    options.forEach(option => {
      option.classList.toggle('selected', option.dataset.sort === this.currentSort);
    });
  }

  /**
   * Updates the sort direction button
   * @private
   */
  updateSortDirectionButton() {
    if (!this.sortDirectionIconBtn) return;
    
    this.sortDirectionIconBtn.classList.toggle('descending', this.sortDirection === 'desc');
  }

  /**
   * Updates the filter mode button display
   * @private
   */
  updateFilterModeButton() {
    if (!this.filterModeIconBtn) return;
    
    this.filterModeIconBtn.classList.toggle('exclusive', this.filterMode === 'exclusive');
  }

  /**
   * Updates the filter selector display
   * @private
   */
  updateFilterSelector() {
    if (!this.filterSelector) return;
    
    const textElement = this.filterSelector.querySelector('.selector-text');
    if (textElement) {
      if (this.activeFilters.size === 0) {
        textElement.textContent = 'All';
      } else if (this.activeFilters.size === 1) {
        const filter = Array.from(this.activeFilters)[0];
        const filterLabels = {
          new: 'New',
          updated: 'Updated',
          other: 'Other'
        };
        textElement.textContent = filterLabels[filter] || 'All';
      } else {
        textElement.textContent = `${this.activeFilters.size} filters`;
      }
    }

    // Update selected options
    const options = this.filterSelector.querySelectorAll('.selector-option[data-filter]');
    options.forEach(option => {
      option.classList.toggle('selected', this.activeFilters.has(option.dataset.filter));
    });
  }

  /**
   * Updates the select toggle button text and count
   * @param {number} selectedCount - Number of selected conversations
   */
  updateSelectToggle(selectedCount) {
    if (!this.selectToggleButton || !this.selectToggleText || !this.selectCount) return;
    
    const conversationsManager = this.conversationsManager;
    const totalCount = conversationsManager ? conversationsManager.getTotalConversationsCount() : 0;
    
    // Always show count
    this.selectCount.textContent = `(${selectedCount})`;
    this.selectCount.style.display = 'inline';
    
    // Logic: if at least 1 not selected -> "Select All", if all selected -> "Unselect All"
    if (selectedCount < totalCount) {
      this.selectToggleText.textContent = 'Select All';
    } else {
      this.selectToggleText.textContent = 'Unselect All';
    }
  }

  /**
   * Updates the search indicator visibility
   * @param {boolean} hasSearch - Whether there's an active search
   */
  updateSearchIndicator(hasSearch) {
    if (!this.selectSearchIndicator) return;
    
    if (hasSearch) {
      this.selectSearchIndicator.style.display = 'inline';
    } else {
      this.selectSearchIndicator.style.display = 'none';
    }
  }

  /**
   * Called by ConversationsManager when search is completed
   * @param {boolean} hasSearch - Whether there's an active search
   */
  onSearchCompleted(hasSearch) {
    const selectedCount = this.conversationsManager ? this.conversationsManager.getSelectedConversationsCount() : 0;
    this.updateSelectToggle(selectedCount);
    this.updateSearchIndicator(hasSearch);
  }

}