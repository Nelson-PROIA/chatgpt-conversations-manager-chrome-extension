// ============================================================================
// ChatGPT Utility Functions
// ============================================================================

import { CHATGPT_URLS } from '../constants/index.js';

export async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export async function isOnChatGPT(tab) {
  if (!tab || !tab.url) return false;
  return CHATGPT_URLS.some(pattern => tab.url.includes(pattern));
}

export async function checkChatGPTStatus() {
  const tab = await getCurrentTab();
  
  if (!await isOnChatGPT(tab)) {
    return { isLoggedIn: false, tab: null };
  }

  try {
    const response = await fetch('https://chatgpt.com/api/auth/session', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const sessionData = await response.json();
      
      if (sessionData.user && sessionData.accessToken) {
        return {
          isLoggedIn: true,
          tab,
          userInfo: {
            email: sessionData.user.email,
            planType: sessionData.account?.planType || 'free'
          }
        };
      }
    }
  } catch (error) {}
  
  return { isLoggedIn: false, tab };
}

export async function getChatGPTTheme(tab) {
  try {
    const themeResponse = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => localStorage.getItem('theme')
    });
    
    return themeResponse?.[0]?.result;
  } catch (error) {
    return null;
  }
}
