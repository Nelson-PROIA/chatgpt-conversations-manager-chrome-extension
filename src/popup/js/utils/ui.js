// ============================================================================
// UI Utility Functions
// ============================================================================

export function showLoadingSkeleton() {
  const elements = getElements();
  
  if (elements.generalTab) elements.generalTab.style.display = 'none';
  if (elements.chatgptTab) elements.chatgptTab.style.display = 'none';
  if (elements.settingsPage) elements.settingsPage.style.display = 'none';
  
  if (elements.loadingSkeleton) {
    elements.loadingSkeleton.style.display = 'flex';
  }
}

export function hideLoadingSkeleton() {
  const elements = getElements();
  
  if (elements.loadingSkeleton) {
    elements.loadingSkeleton.style.display = 'none';
  }
}

export function getElements() {
  return {
    generalTab: document.getElementById('general-tab-component'),
    chatgptTab: document.getElementById('chatgpt-tab-component'),
    settingsPage: document.getElementById('settings-page-component'),
    loadingSkeleton: document.getElementById('chatgpt-skeleton-component'),
    backBtn: document.getElementById('back-btn'),
    settingsGear: document.getElementById('settings-btn'),
    themeButtons: document.querySelectorAll('[data-theme]'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    openChatgptBtn: document.getElementById('open-chatgpt-btn'),
    openManagerBtn: document.getElementById('open-manager-btn'),
    batchInput: document.getElementById('custom-batch-input'),
    preventDelete: document.getElementById('prevent-delete'),
    preventArchive: document.getElementById('prevent-archive'),
    userPlan: document.querySelector('.user-plan'),
    userEmail: document.querySelector('.user-email')
  };
}
