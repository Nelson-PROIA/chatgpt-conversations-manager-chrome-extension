/**
 * Default settings constants shared across the extension
 * These values should match the ones defined in background.js
 */
export const DEFAULT_SETTINGS = {
  theme: 'light',
  batchSize: 50,
  isCustomBatchSize: false,
  preventDelete: true,
  preventArchive: true
};

/**
 * Gets a setting value with fallback to default
 * @param {Object} settings - Settings object
 * @param {string} key - Setting key
 * @returns {*} Setting value or default value
 */
export function getSettingWithDefault(settings, key) {
  if (!settings) {
    return DEFAULT_SETTINGS[key];
  }
  
  return settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
}
