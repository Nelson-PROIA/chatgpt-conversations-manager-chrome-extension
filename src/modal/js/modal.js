import { ComponentLoader } from '../../js/utils/index.js';
import { DEFAULT_SETTINGS, getSettingWithDefault } from '../../js/constants/index.js';
import { ThemeManager } from './managers/ThemeManager.js';
import { ActionsManager } from './managers/ActionsManager.js';
import { ConversationsManager } from './managers/ConversationsManager.js';
import { ToastManager } from './managers/ToastManager.js';

const COMPONENT_PATHS = {
  HEADER: chrome.runtime.getURL('src/modal/components/header/Header.html'),
  FOOTER: chrome.runtime.getURL('src/modal/components/footer/Footer.html'),
  ACTIONS: chrome.runtime.getURL('src/modal/components/actions/ActionsBar.html'),
  CONVERSATIONS: chrome.runtime.getURL('src/modal/components/conversations/ConversationsList.html'),
  CONFIRMATION_MODAL: chrome.runtime.getURL('src/modal/components/common/ConfirmationModal.html'),
  TOAST: chrome.runtime.getURL('src/modal/components/common/Toast.html')
};

const COMPONENT_TARGETS = {
  HEADER: 'header-component',
  FOOTER: 'footer-component',
  ACTIONS: 'actions-component',
  CONVERSATIONS: 'conversations-component',
  CONFIRMATION_MODAL: 'confirm-modal-component',
  TOAST: 'toast-component'
};

let managers = new Map();
let settings = null;

/**
 * Initializes the modal with all managers and components
 */
async function initialize() {
  const modalComponents = [
    { path: COMPONENT_PATHS.HEADER, target: COMPONENT_TARGETS.HEADER },
    { path: COMPONENT_PATHS.FOOTER, target: COMPONENT_TARGETS.FOOTER },
    { path: COMPONENT_PATHS.ACTIONS, target: COMPONENT_TARGETS.ACTIONS },
    { path: COMPONENT_PATHS.CONVERSATIONS, target: COMPONENT_TARGETS.CONVERSATIONS },
    { path: COMPONENT_PATHS.CONFIRMATION_MODAL, target: COMPONENT_TARGETS.CONFIRMATION_MODAL },
    { path: COMPONENT_PATHS.TOAST, target: COMPONENT_TARGETS.TOAST }
  ];
  
  await ComponentLoader.loadComponents(modalComponents);
  setupModalEventListeners();

  settings = await loadSettings();
  
  initializeManagers();
  await startConversations();
}

/**
 * Loads settings from chrome storage
 * @returns {Object} Settings values object
 */
async function loadSettings() {
  const result = await chrome.storage.sync.get(['settings']);
  return result.settings?.values || {};
}

/**
 * Initializes all managers and registers them
 */
function initializeManagers() {
  const toastManager = new ToastManager();
  registerManager('toast', toastManager);
  
  const conversationsManager = new ConversationsManager(getSetting('batchSize'));
  registerManager('conversations', conversationsManager);
  
  const actionsManager = new ActionsManager(getSetting('preventDelete'), getSetting('preventArchive'), toastManager, conversationsManager);
  registerManager('actions', actionsManager);
  
  // Establish bidirectional communication
  conversationsManager.setActionsManager(actionsManager);
  
  registerManager('theme', new ThemeManager(getSetting('theme')));
}

/**
 * Registers a manager in the registry
 * @param {string} name - Unique name for the manager
 * @param {Object} manager - Manager instance
 */
function registerManager(name, manager) {
  managers.set(name, manager);
}

/**
 * Gets a manager from the registry
 * @param {string} name - Manager name
 * @returns {Object|null} Manager instance or null if not found
 */
function getManager(name) {
  return managers.get(name) || null;
}

/**
 * Gets settings value by key with fallback to default
 * @param {string} key - Settings key (e.g., 'batchSize', 'preventDelete')
 * @returns {*} Settings value or default value
 */
function getSetting(key) {
  return getSettingWithDefault(settings, key);
}

/**
 * Sets up modal event listeners (close button, escape key, modal wrapper click)
 */
function setupModalEventListeners() {
  // Close button
  const closeButton = document.getElementById('close-modal-btn');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      closeModal();
    });
  }

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Modal wrapper click (backdrop)
  const modalWrapper = document.querySelector('.modal-wrapper');
  if (modalWrapper) {
    modalWrapper.addEventListener('click', (e) => {
      // Only close if clicking on the wrapper itself, not on child elements
      if (e.target === modalWrapper) {
        closeModal();
      }
    });
  }
}

/**
 * Starts conversations fetching
 */
async function startConversations() {
  const conversationsManager = getManager('conversations');
  await conversationsManager.start();
}

/**
 * Closes the modal by sending message to parent
 */
function closeModal() {
  window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}