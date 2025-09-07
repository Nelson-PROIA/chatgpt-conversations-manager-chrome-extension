// ============================================================================
// Theme Manager (Modal Version)
// ============================================================================

export class ThemeManager {
  constructor(theme = 'light') {
    this.theme = theme;
    this.loadTheme();
  }

  async loadTheme() {
    try {
      let theme = this.theme;
      
      // If theme is 'gpt', use gptTheme value
      if (theme === 'gpt') {
        const result = await chrome.storage.sync.get(['gptTheme']);
        theme = result.gptTheme || 'light';
      }
      
      // If theme is 'system', detect system preference
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      // Apply theme to body only (remove any existing theme classes first)
      document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
      document.body.classList.add(`theme-${theme}`);
      
    } catch (error) {
      // Fallback to light theme
      document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
      document.body.classList.add('theme-light');
    }
  }
}
