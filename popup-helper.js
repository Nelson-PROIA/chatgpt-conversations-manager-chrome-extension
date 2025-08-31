// Helper popup JavaScript functions
function openManager() {
  // Send message to background script to open modal
  chrome.runtime.sendMessage({ action: 'openModalFromPopup' });
  window.close();
}

function refreshPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
  window.close();
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Add click event listeners to buttons
  const openManagerBtn = document.getElementById('openManagerBtn');
  const refreshPageBtn = document.getElementById('refreshPageBtn');
  
  if (openManagerBtn) {
    openManagerBtn.addEventListener('click', openManager);
  }
  
  if (refreshPageBtn) {
    refreshPageBtn.addEventListener('click', refreshPage);
  }
});
