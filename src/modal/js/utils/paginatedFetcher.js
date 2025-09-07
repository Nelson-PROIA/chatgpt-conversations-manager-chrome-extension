/**
 * Generic utility for fetching paginated data from any API endpoint
 * Supports filtering, sorting, and incremental fetching with deduplication
 */
export class PaginatedDataFetcher {
  /**
   * @param {string} baseUrl - Base API endpoint URL
   * @param {Object} authentication - Headers for authentication (e.g., { 'Authorization': 'Bearer token' })
   * @param {Function} getIdFunction - Function to extract unique ID from items (e.g., item => item.id)
   */
  constructor(baseUrl, authentication = {}, getIdFunction = item => item.id) {
    this.baseUrl = baseUrl;
    this.authentication = authentication;
    this.getIdFunction = getIdFunction;
    this.seenItems = new Set();
    this.hasMore = true;
  }

  /**
   * Main function to fetch paginated data with optional filtering and sorting
   * @param {number} targetCount - Number of items to retrieve (default = 100)
   * @param {number|null} apiLimit - Limit per API request (defaults to targetCount if null)
   * @param {Set} filters - Set of filter functions to apply
   * @param {Array} sortFunctions - Array of comparison functions for sorting
   * @returns {Promise<Array>} Array of fetched and processed items
   */
  async fetchPaginatedData(targetCount = 100, apiLimit = null, filters = new Set(), sortFunctions = []) {
    const fetchLimit = apiLimit || targetCount;
    
    if (sortFunctions.length > 0) {
      return await this.fetchAllAndSort(targetCount, filters, sortFunctions, fetchLimit);
    }
    
    return await this.fetchIncremental(targetCount, filters, fetchLimit);
  }

  /**
   * Fetch all data and sort it (used when sorting is required)
   * @param {number} targetCount - Number of items to retrieve
   * @param {Set} filters - Set of filter functions to apply
   * @param {Array} sortFunctions - Array of comparison functions for sorting
   * @param {number} fetchLimit - Limit per API request
   * @returns {Promise<Array>} Array of fetched and processed items
   */
  async fetchAllAndSort(targetCount, filters, sortFunctions, fetchLimit) {    
    const allItems = [];
    let offset = 0;
    
    while (true) {
      const response = await this.makeRequest(offset, fetchLimit);
      const items = (response.items || []).map(item => this.transformItem(item));
      
      if (items.length === 0) {
        this.hasMore = false;
        break;
      }
      
      allItems.push(...items);
      offset += fetchLimit;
      
      if (items.length < fetchLimit) {
        this.hasMore = false;
        break;
      }
    }
    
    const sortedItems = this.sortItemsGeneric(allItems, sortFunctions);
    return this.parseAndFilterItemsGeneric(sortedItems, targetCount, filters);
  }

  /**
   * Fetch data incrementally (used when no sorting is required)
   * @param {number} targetCount - Number of items to retrieve
   * @param {Set} filters - Set of filter functions to apply
   * @param {number} fetchLimit - Limit per API request
   * @returns {Promise<Array>} Array of fetched and processed items
   */
  async fetchIncremental(targetCount, filters, fetchLimit) {
    const newItems = [];
    let offset = 0;
    
    while (newItems.length < targetCount) {
      const response = await this.makeRequest(offset, fetchLimit);
      const items = (response.items || []).map(item => this.transformItem(item));
      
      if (items.length === 0) {
        this.hasMore = false;
        break;
      }
      
      const filteredItems = this.parseAndFilterItemsGeneric(items, targetCount - newItems.length, filters);
      newItems.push(...filteredItems);
      
      offset += fetchLimit;
      
      if (items.length < fetchLimit) {
        this.hasMore = false;
        break;
      }
    }
    
    return newItems;
  }

  /**
   * Make a request to the API
   * @param {number} offset - Offset for pagination
   * @param {number} limit - Limit for pagination
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(offset, limit) {
    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}?offset=${offset}&limit=${limit}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken,
      ...this.authentication
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch data: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  }

  /**
   * Generic function to parse and filter items (applies filters + already seen filter)
   * @param {Array} items - Array of items to filter
   * @param {number} maxCount - Maximum number of items to return
   * @param {Set} filters - Set of filter functions to apply
   * @returns {Array} Filtered array of items
   */
  parseAndFilterItemsGeneric(items, maxCount, filters) {
    const newItems = [];
    
    for (const item of items) {
      if (newItems.length >= maxCount) break;
      
      const itemId = this.getIdFunction(item);
      if (this.seenItems.has(itemId)) continue;
      
      if (this.passesFiltersGeneric(item, filters)) {
        newItems.push(item);
        this.seenItems.add(itemId);
      }
    }
    
    return newItems;
  }

  /**
   * Generic function to check if item passes filters
   * @param {Object} item - Item to check
   * @param {Set} filters - Set of filter functions to apply
   * @returns {boolean} True if item passes all filters
   */
  passesFiltersGeneric(item, filters) {
    if (!filters || filters.size === 0) {
      return true;
    }
    
    for (const filter of filters) {
      if (typeof filter === 'function' && !filter(item)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generic function to sort items with multiple criteria
   * @param {Array} items - Array of items to sort
   * @param {Array} sortFunctions - Array of comparison functions
   * @returns {Array} Sorted array of items
   */
  sortItemsGeneric(items, sortFunctions) {
    if (!sortFunctions || sortFunctions.length === 0) {
      return items;
    }
    
    return items.sort((a, b) => {
      for (const compareFunction of sortFunctions) {
        if (typeof compareFunction === 'function') {
          const comparison = compareFunction(a, b);
          if (comparison !== 0) {
            return comparison;
          }
        }
      }
      return 0;
    });
  }

  /**
   * Transform raw API item to standardized format
   * Override this method in subclasses for specific transformations
   * @param {Object} item - Raw item from API
   * @returns {Object} Transformed item
   */
  transformItem(item) {
    return item;
  }

  /**
   * Get access token for API requests
   * Override this method in subclasses for specific authentication
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    throw new Error('getAccessToken must be implemented in subclass');
  }

  /**
   * Clear the seen items set (useful for resetting state)
   */
  clearSeenItems() {
    this.seenItems.clear();
    this.hasMore = true;
  }

  /**
   * Check if there are more items available to fetch
   * @returns {boolean} True if there are more items to fetch
   */
  hasMoreItems() {
    return this.hasMore;
  }

  /**
   * Add items to the seen set (useful for initial state)
   * @param {Array} items - Array of items to mark as seen
   */
  markItemsAsSeen(items) {
    for (const item of items) {
      this.seenItems.add(this.getIdFunction(item));
    }
  }
}