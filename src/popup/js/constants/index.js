// ============================================================================
// Constants and Configuration
// ============================================================================

export const BATCH_SIZE_CONFIG = {
  MIN: 1,
  MAX: 250
};

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
  CHATGPT: 'chatgpt'
};

export const PAGES = {
  GENERAL: 'general',
  CHATGPT: 'chatgpt',
  SETTINGS: 'settings'
};

export const CHATGPT_URLS = [
  'chatgpt.com',
  'chat.openai.com',
  'chatgpt.azure.com'
];

export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

// Default settings
export const DEFAULT_SETTINGS = {
  theme: THEMES.LIGHT,
  batchSize: BATCH_SIZE_CONFIG.DEFAULT,
  isCustomBatchSize: false,
  preventDelete: true,
  preventArchive: true
};

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  GPT_THEME: 'gptTheme'
};
