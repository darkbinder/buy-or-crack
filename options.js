// Check storage API availability (Firefox/Chrome cross-compatibility)
const storage = (typeof browser !== 'undefined' && browser.storage) ? browser.storage.local : chrome.storage.local;

// Default configuration settings
const DEFAULTS = {
  GEMINI_API_KEY: '',
  STEAM_CC: 'PH',
  MATRIX_PRICE_THRESHOLD: 1000
};

// DOM elements
const geminiKeyInput = document.getElementById('gemini-key');
const steamCcInput = document.getElementById('steam-cc');
const priceThresholdInput = document.getElementById('price-threshold');
const saveBtn = document.getElementById('btn-save');
const saveToast = document.getElementById('save-toast');
const togglePasswordBtn = document.getElementById('toggle-key-visibility');
const eyeIcon = document.getElementById('eye-icon');

// Toggle password visibility
togglePasswordBtn.addEventListener('click', () => {
  const type = geminiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
  geminiKeyInput.setAttribute('type', type);
  
  // Update eye icon SVG
  if (type === 'password') {
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    `;
  } else {
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    `;
  }
});

// Load settings from storage
function loadSettings() {
  storage.get(DEFAULTS, (settings) => {
    geminiKeyInput.value = settings.GEMINI_API_KEY || '';
    steamCcInput.value = (settings.STEAM_CC || 'PH').toUpperCase();
    priceThresholdInput.value = settings.MATRIX_PRICE_THRESHOLD !== undefined ? settings.MATRIX_PRICE_THRESHOLD : 1000;
  });
}

// Save settings to storage
function saveSettings() {
  // Clear previous validation errors
  geminiKeyInput.classList.remove('input-error');
  steamCcInput.classList.remove('input-error');
  priceThresholdInput.classList.remove('input-error');

  const apiKey = geminiKeyInput.value.trim();
  const steamCc = steamCcInput.value.trim().toUpperCase();
  const thresholdVal = priceThresholdInput.value.trim();

  let hasError = false;

  // Simple validation
  if (!apiKey) {
    geminiKeyInput.classList.add('input-error');
    hasError = true;
  }

  if (!steamCc || steamCc.length !== 2) {
    steamCcInput.classList.add('input-error');
    hasError = true;
  }

  const threshold = parseFloat(thresholdVal);
  if (isNaN(threshold) || threshold < 0) {
    priceThresholdInput.classList.add('input-error');
    hasError = true;
  }

  if (hasError) {
    return; // Don't save if there's a validation error
  }

  // Save to browser/chrome storage
  storage.set({
    GEMINI_API_KEY: apiKey,
    STEAM_CC: steamCc,
    MATRIX_PRICE_THRESHOLD: threshold
  }, () => {
    // Show success feedback
    showToast();
  });
}

// Show custom toast notification
function showToast() {
  saveToast.classList.add('show');
  setTimeout(() => {
    saveToast.classList.remove('show');
  }, 3000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadSettings);
saveBtn.addEventListener('click', saveSettings);
