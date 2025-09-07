// ============================================================================
// Modal Components Index
// ============================================================================

export const COMPONENT_PATHS = {
  HEADER: chrome.runtime.getURL('src/modal/components/header/Header.html'),
  FOOTER: chrome.runtime.getURL('src/modal/components/footer/Footer.html'),
  ACTIONS: chrome.runtime.getURL('src/modal/components/actions/ActionsBar.html'),
  CONVERSATIONS: chrome.runtime.getURL('src/modal/components/conversations/ConversationsList.html'),
  CONFIRMATION_MODAL: chrome.runtime.getURL('src/modal/components/common/ConfirmationModal.html'),
  TOAST: chrome.runtime.getURL('src/modal/components/common/Toast.html')
};

export const COMPONENT_TARGETS = {
  HEADER: 'header-component',
  FOOTER: 'footer-component',
  ACTIONS: 'actions-component',
  CONVERSATIONS: 'conversations-component',
  CONFIRMATION_MODAL: 'confirm-modal-component',
  TOAST: 'toast-component'
};
