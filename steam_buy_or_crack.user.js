// ==UserScript==
// @name         Steam Buy or Crack Decision Matrix
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Evaluates whether to BUY or CRACK a Steam game directly from its Store page using Gemini AI.
// @author       Ricco
// @match        *://store.steampowered.com/app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      generativelanguage.googleapis.com
// @connect      api.steampowered.com
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/darkbinder/buy-or-crack/main/steam_buy_or_crack.user.js
// @downloadURL  https://raw.githubusercontent.com/darkbinder/buy-or-crack/main/steam_buy_or_crack.user.js
// ==/UserScript==

(function() {
  'use strict';

  // Prevent duplicate execution
  if (document.getElementById('steam-buy-or-crack-root')) return;

  // Default configuration settings
  const DEFAULTS = {
    GEMINI_API_KEY: '',
    STEAM_CC: 'PH',
    MATRIX_PRICE_THRESHOLD: 1000,
    EVALUATE_EARLY_ACCESS: false
  };

  // Helper functions to get/set settings using GM storage
  function getSetting(key) {
    return GM_getValue(key, DEFAULTS[key]);
  }

  function setSetting(key, val) {
    GM_setValue(key, val);
  }

  function getSettings() {
    return {
      GEMINI_API_KEY: getSetting('GEMINI_API_KEY'),
      STEAM_CC: getSetting('STEAM_CC'),
      MATRIX_PRICE_THRESHOLD: parseFloat(getSetting('MATRIX_PRICE_THRESHOLD')) || 1000,
      EVALUATE_EARLY_ACCESS: getSetting('EVALUATE_EARLY_ACCESS')
    };
  }

  /**
   * Promise wrapper around GM_xmlhttpRequest to act like fetch
   */
  function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url: url,
        headers: options.headers,
        data: options.body,
        onload: (response) => {
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            json: () => Promise.resolve(JSON.parse(response.responseText)),
            text: () => Promise.resolve(response.responseText)
          });
        },
        onerror: (error) => {
          reject(error);
        }
      });
    });
  }

  // Initialize widget container
  const rootContainer = document.createElement('div');
  rootContainer.id = 'steam-buy-or-crack-root';
  rootContainer.style.marginBottom = '20px';
  rootContainer.style.position = 'relative';
  rootContainer.style.width = '100%';
  
  // Attach Shadow DOM for style isolation
  const shadow = rootContainer.attachShadow({ mode: 'open' });

  // Add styles to Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Core container */
    .widget-card {
      background: linear-gradient(135deg, rgba(20, 27, 44, 0.95) 0%, rgba(13, 18, 30, 0.98) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 22px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 0 20px rgba(139, 92, 246, 0.03);
      position: relative;
      overflow: hidden;
      color: #e2e8f0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .widget-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef);
      opacity: 0.8;
    }

    .widget-card.buy::before {
      background: linear-gradient(90deg, #10b981, #34d399, #059669);
    }

    .widget-card.crack::before {
      background: linear-gradient(90deg, #f43f5e, #fb7185, #e11d48);
    }

    /* Views */
    .view-main {
      display: block;
    }

    .view-settings {
      display: none;
      flex-direction: column;
      gap: 16px;
    }

    /* Header styling */
    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .matrix-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 3px 8px;
      border-radius: 50px;
      background: rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .matrix-title {
      font-size: 14px;
      font-weight: 600;
      color: #94a3b8;
    }

    .settings-link {
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: color 0.2s, transform 0.2s;
    }

    .settings-link:hover {
      color: #e2e8f0;
      transform: rotate(45deg);
    }

    .settings-link svg {
      width: 18px;
      height: 18px;
    }

    /* Recommendation Alert Banner */
    .recommendation-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.2px;
      transition: all 0.3s;
    }

    .buy-banner {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #34d399;
      text-shadow: 0 0 10px rgba(52, 211, 153, 0.2);
      box-shadow: inset 0 0 12px rgba(16, 185, 129, 0.05);
    }

    .crack-banner {
      background: rgba(244, 63, 94, 0.08);
      border: 1px solid rgba(244, 63, 94, 0.2);
      color: #fb7185;
      text-shadow: 0 0 10px rgba(251, 113, 133, 0.2);
      box-shadow: inset 0 0 12px rgba(244, 63, 94, 0.05);
    }

    .recommendation-banner svg {
      width: 22px;
      height: 22px;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    @media (max-width: 600px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Score gauge block */
    .score-block {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.03);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .score-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;
    }

    .score-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .score-val {
      font-size: 22px;
      font-weight: 800;
    }

    .score-val span {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
    }

    .score-track {
      position: relative;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      margin-bottom: 8px;
    }

    .score-fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: 10px;
      transition: width 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .buy .score-fill {
      background: linear-gradient(90deg, #10b981, #34d399);
      box-shadow: 0 0 10px rgba(52, 211, 153, 0.3);
    }

    .crack .score-fill {
      background: linear-gradient(90deg, #f43f5e, #fb7185);
      box-shadow: 0 0 10px rgba(251, 113, 133, 0.3);
    }

    .score-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #475569;
      font-weight: 600;
      padding: 0 2px;
    }

    .score-labels span.active {
      color: #94a3b8;
      font-weight: 700;
    }

    .price-badge {
      font-size: 11px;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      color: #64748b;
    }

    .player-count-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 50px;
      color: #60a5fa;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      text-shadow: 0 0 8px rgba(96, 165, 250, 0.15);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .player-count-badge svg {
      width: 12px;
      height: 12px;
    }

    /* Reasoning block */
    .reasoning-block {
      background: rgba(255, 255, 255, 0.02);
      border-left: 3px solid #8b5cf6;
      border-radius: 0 8px 8px 0;
      padding: 12px 14px;
      font-size: 13.5px;
      line-height: 1.5;
      color: #cbd5e1;
      height: 100%;
      display: flex;
      align-items: center;
    }

    .buy .reasoning-block {
      border-left-color: #10b981;
    }

    .crack .reasoning-block {
      border-left-color: #f43f5e;
    }

    /* Components list block */
    .components-block {
      margin-top: 10px;
    }

    .components-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      margin-bottom: 10px;
    }

    .components-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .component-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: #94a3b8;
    }

    .component-badge svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .component-badge.active-feature {
      background: rgba(139, 92, 246, 0.05);
      border-color: rgba(139, 92, 246, 0.15);
      color: #c084fc;
    }

    /* Warning/Error styling */
    .warning-card {
      background: rgba(245, 158, 11, 0.05);
      border: 1px solid rgba(245, 158, 11, 0.15);
      border-radius: 12px;
      padding: 20px;
      color: #f59e0b;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .warning-card a {
      color: #fbbf24;
      font-weight: 600;
      text-decoration: underline;
      cursor: pointer;
    }

    /* Loading state skeleton styling */
    .loading-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .skeleton {
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 6px;
    }

    .skeleton-title {
      height: 20px;
      width: 180px;
    }

    .skeleton-banner {
      height: 48px;
      width: 100%;
      border-radius: 8px;
    }

    .skeleton-text {
      height: 60px;
      width: 100%;
      border-radius: 8px;
    }

    .skeleton-badge {
      height: 28px;
      width: 110px;
      display: inline-block;
      border-radius: 6px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* --- Settings Panel Styling --- */
    .settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 12px;
    }

    .settings-title {
      font-size: 15px;
      font-weight: 700;
      color: #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }

    .form-group input {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 8px 12px;
      color: #f1f5f9;
      font-size: 13px;
      transition: all 0.2s;
      outline: none;
      width: 100%;
    }

    .form-group input:focus {
      border-color: #8b5cf6;
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
      background: rgba(0, 0, 0, 0.5);
    }

    .form-group input.input-error {
      border-color: #f43f5e;
      box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.25);
    }

    .input-with-icon {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-with-icon input {
      padding-right: 40px;
    }

    .icon-btn {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      transition: color 0.2s;
    }

    .icon-btn:hover {
      color: #cbd5e1;
    }

    .icon-btn svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 14px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-primary {
      background: #8b5cf6;
      color: white;
    }

    .btn-primary:hover {
      background: #7c3aed;
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: #cbd5e1;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #f1f5f9;
    }

    /* Checkbox styling */
    .checkbox-group {
      flex-direction: row !important;
      align-items: center !important;
      gap: 10px !important;
      cursor: pointer;
      user-select: none;
      margin-top: 4px;
    }

    .checkbox-group input[type="checkbox"] {
      width: 18px !important;
      height: 18px !important;
      accent-color: #8b5cf6;
      cursor: pointer;
    }

    .checkbox-group label {
      cursor: pointer;
      color: #cbd5e1 !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      text-transform: none !important;
      letter-spacing: normal !important;
    }

    /* Bypass states styling */
    .widget-card.bypass::before {
      background: linear-gradient(90deg, #3b82f6, #60a5fa, #2563eb);
    }

    .widget-card.early-access-bypass::before {
      background: linear-gradient(90deg, #f59e0b, #fbbf24, #d97706);
    }

    .recommendation-banner.bypass-banner {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      text-shadow: 0 0 10px rgba(96, 165, 250, 0.2);
      box-shadow: inset 0 0 12px rgba(59, 130, 246, 0.05);
    }

    .recommendation-banner.early-access-banner {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      text-shadow: 0 0 10px rgba(251, 191, 36, 0.2);
      box-shadow: inset 0 0 12px rgba(245, 158, 11, 0.05);
    }
  `;
  shadow.appendChild(style);

  // HTML content shell
  const widgetInner = document.createElement('div');
  widgetInner.className = 'widget-card';

  // Dynamic Content View container
  const evalView = document.createElement('div');
  evalView.className = 'view-main';
  widgetInner.appendChild(evalView);

  // Settings Panel Overlay container (hidden by default)
  const settingsView = document.createElement('div');
  settingsView.className = 'view-settings';
  settingsView.innerHTML = `
    <div class="settings-header">
      <span class="settings-title">Configure Matrix</span>
    </div>
    <div class="settings-form">
      <div class="form-group">
        <label for="input-key">Gemini API Key</label>
        <div class="input-with-icon">
          <input type="password" id="input-key" placeholder="AIzaSy...">
          <button id="toggle-key-visibility" class="icon-btn" type="button">
            <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="input-cc">Steam CC (Country)</label>
          <input type="text" id="input-cc" placeholder="PH" maxlength="2">
        </div>
        <div class="form-group">
          <label for="input-threshold">Price Threshold</label>
          <input type="number" id="input-threshold" placeholder="1000">
        </div>
      </div>
      <div class="form-group checkbox-group">
        <input type="checkbox" id="input-early-access">
        <label for="input-early-access">Evaluate Early Access Games</label>
      </div>
      <div class="form-actions">
        <button id="btn-cancel-settings" class="btn btn-secondary">Cancel</button>
        <button id="btn-save-settings" class="btn btn-primary">Save Settings</button>
      </div>
    </div>
  `;
  widgetInner.appendChild(settingsView);
  shadow.appendChild(widgetInner);

  // Bind Settings Panel events
  const togglePassBtn = settingsView.querySelector('#toggle-key-visibility');
  const keyInput = settingsView.querySelector('#input-key');
  const ccInput = settingsView.querySelector('#input-cc');
  const thresholdInput = settingsView.querySelector('#input-threshold');
  const earlyAccessCheckbox = settingsView.querySelector('#input-early-access');
  const saveSettingsBtn = settingsView.querySelector('#btn-save-settings');
  const cancelSettingsBtn = settingsView.querySelector('#btn-cancel-settings');
  const eyeIcon = settingsView.querySelector('#eye-icon');

  togglePassBtn.addEventListener('click', () => {
    const type = keyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    keyInput.setAttribute('type', type);
    
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

  cancelSettingsBtn.addEventListener('click', () => {
    settingsView.style.display = 'none';
    evalView.style.display = 'block';
  });

  saveSettingsBtn.addEventListener('click', () => {
    keyInput.classList.remove('input-error');
    ccInput.classList.remove('input-error');
    thresholdInput.classList.remove('input-error');

    const apiKey = keyInput.value.trim();
    const cc = ccInput.value.trim().toUpperCase();
    const thresholdVal = thresholdInput.value.trim();

    let hasError = false;

    if (!apiKey) {
      keyInput.classList.add('input-error');
      hasError = true;
    }
    if (!cc || cc.length !== 2) {
      ccInput.classList.add('input-error');
      hasError = true;
    }
    const threshold = parseFloat(thresholdVal);
    if (isNaN(threshold) || threshold < 0) {
      thresholdInput.classList.add('input-error');
      hasError = true;
    }

    if (hasError) return;

    setSetting('GEMINI_API_KEY', apiKey);
    setSetting('STEAM_CC', cc);
    setSetting('MATRIX_PRICE_THRESHOLD', threshold);
    setSetting('EVALUATE_EARLY_ACCESS', earlyAccessCheckbox.checked);

    // Switch view back and trigger evaluation
    settingsView.style.display = 'none';
    evalView.style.display = 'block';
    
    runEvaluation();
  });

  function openSettingsInline() {
    const config = getSettings();
    keyInput.value = config.GEMINI_API_KEY;
    ccInput.value = config.STEAM_CC;
    thresholdInput.value = config.MATRIX_PRICE_THRESHOLD;
    earlyAccessCheckbox.checked = config.EVALUATE_EARLY_ACCESS;
    
    evalView.style.display = 'none';
    settingsView.style.display = 'flex';
  }

  // Inject widget in Steam Page
  try {
    const gameData = scrapeGameDetails();
    if (!gameData.appId) {
      console.log('Steam Matrix: Valid AppID not detected. Aborting widget injection.');
      return;
    }

    const insertTarget = document.querySelector('#game_area_purchase') || 
                         document.querySelector('.game_area_purchase_margin') ||
                         document.querySelector('.rightcol');
    
    if (insertTarget) {
      insertTarget.parentNode.insertBefore(rootContainer, insertTarget);
      runEvaluation();
    } else {
      console.error('Steam Matrix: Could not find insert target in Steam Store DOM.');
    }
  } catch (err) {
    console.error('Steam Matrix Initialization Error:', err);
  }

  // --- MAIN EVALUATION ENGINE ---

  async function runEvaluation() {
    showLoading();
    try {
      const config = getSettings();
      const gameData = scrapeGameDetails();

      // 1. Check if Free-to-Play
      if (gameData.isFree) {
        showBypass('FREE_TO_PLAY', gameData.name);
        return;
      }

      // 2. Check if Early Access bypassed
      if (gameData.isEarlyAccess && !config.EVALUATE_EARLY_ACCESS) {
        showBypass('EARLY_ACCESS', gameData.name);
        return;
      }

      if (!config.GEMINI_API_KEY) {
        showError('NO_API_KEY', 'Gemini API Key is not configured.');
        return;
      }

      const playerCount = await getPlayerCount(gameData.appId);
      gameData.playerCount = playerCount;

      const evaluation = await evaluateGameWithAI(gameData, config);
      evaluation.playerCount = playerCount;

      renderDecision(evaluation, gameData.name);
    } catch (err) {
      console.error('Error evaluating game:', err);
      showError('API_ERROR', err.message || 'An unexpected error occurred during API evaluation.');
    }
  }

  // --- RENDERING FUNCTIONS ---

  function showLoading() {
    widgetInner.className = 'widget-card';
    evalView.innerHTML = `
      <div class="loading-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="skeleton skeleton-title"></div>
          <div style="width:18px; height:18px; border-radius:50%;" class="skeleton"></div>
        </div>
        <div class="skeleton skeleton-banner"></div>
        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:20px;">
          <div class="skeleton skeleton-text" style="height:80px;"></div>
          <div class="skeleton skeleton-text" style="height:80px;"></div>
        </div>
        <div style="display:flex; gap:8px;">
          <div class="skeleton skeleton-badge"></div>
          <div class="skeleton skeleton-badge" style="width:140px;"></div>
          <div class="skeleton skeleton-badge" style="width:90px;"></div>
        </div>
      </div>
    `;
  }

  function showError(code, message) {
    widgetInner.className = 'widget-card crack'; // red top border indicating config issue / failure
    if (code === 'NO_API_KEY') {
      evalView.innerHTML = `
        <div class="warning-card">
          <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:15px;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <span>Gemini API Key Required</span>
          </div>
          <p style="font-size:13.5px; line-height:1.4;">The Steam Purchase Decision Matrix needs a Gemini API Key to run evaluations. Please configure your key in settings.</p>
          <div>
            <a class="settings-trigger">Open Matrix Settings</a>
          </div>
        </div>
      `;
    } else {
      evalView.innerHTML = `
        <div class="warning-card" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.15); background: rgba(239, 68, 68, 0.03);">
          <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:15px;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
            <span>Matrix Evaluation Failed</span>
          </div>
          <p style="font-size:13.5px; line-height:1.4; color: #fca5a5;">${message}</p>
          <div>
            <a class="settings-trigger" style="color: #f87171;">Check Settings</a>
          </div>
        </div>
      `;
    }

    const trigger = evalView.querySelector('.settings-trigger');
    if (trigger) {
      trigger.addEventListener('click', openSettingsInline);
    }
  }

  function showBypass(type, gameName) {
    if (type === 'FREE_TO_PLAY') {
      widgetInner.className = 'widget-card bypass';
      evalView.innerHTML = `
        <div class="recommendation-banner bypass-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>🎁 FREE-TO-PLAY: ${gameName}</span>
        </div>
        <p style="font-size: 13.5px; line-height: 1.5; color: #cbd5e1; margin-bottom: 12px;">
          This game is Free-to-Play. There is no purchasing decision or crack viability evaluation required. You can add it directly to your Steam library!
        </p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <a class="settings-trigger" style="color: #60a5fa; cursor: pointer; font-size: 12px; text-decoration: underline;">Configure settings</a>
        </div>
      `;
    } else if (type === 'EARLY_ACCESS') {
      widgetInner.className = 'widget-card early-access-bypass';
      evalView.innerHTML = `
        <div class="recommendation-banner early-access-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          <span>🚧 EARLY ACCESS BYPASS: ${gameName}</span>
        </div>
        <p style="font-size: 13.5px; line-height: 1.5; color: #cbd5e1; margin-bottom: 12px;">
          Unfinished / Early Access game bypassed by default to minimize Gemini AI token consumption.
        </p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <a class="quick-enable-trigger" style="color: #fbbf24; cursor: pointer; font-weight: 600; text-decoration: underline; font-size: 13px;">Enable Early Access Evaluations</a>
          <a class="settings-trigger" style="color: #64748b; cursor: pointer; font-size: 12px; text-decoration: underline;">Configure settings</a>
        </div>
      `;

      const quickEnable = evalView.querySelector('.quick-enable-trigger');
      if (quickEnable) {
        quickEnable.addEventListener('click', () => {
          setSetting('EVALUATE_EARLY_ACCESS', true);
          runEvaluation();
        });
      }
    }

    const trigger = evalView.querySelector('.settings-trigger');
    if (trigger) {
      trigger.addEventListener('click', openSettingsInline);
    }
  }

  function renderDecision(result, gameName) {
    const isBuy = result.decisionScore >= 3;
    widgetInner.className = `widget-card ${isBuy ? 'buy' : 'crack'}`;

    let recHtml = '';
    if (isBuy) {
      recHtml = `
        <div class="recommendation-banner buy-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>🟢 BUY IT: ${gameName}</span>
        </div>
      `;
    } else {
      recHtml = `
        <div class="recommendation-banner crack-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <circle cx="12" cy="11" r="3"></circle>
            <line x1="12" y1="14" x2="12" y2="14.01"></line>
          </svg>
          <span>🏴‍☠️ CRACK IT: ${gameName}</span>
        </div>
      `;
    }

    const fillPercent = (result.decisionScore / 5) * 100;

    let componentsHtml = '';
    if (result.onlineComponents && result.onlineComponents.length > 0) {
      componentsHtml = result.onlineComponents.map(comp => {
        const text = comp.toLowerCase();
        let iconSvg = '';
        let addClass = '';

        if (text.includes('online') || text.includes('server') || text.includes('multiplayer') || text.includes('matchmaking')) {
          iconSvg = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`;
          addClass = 'active-feature';
        } else if (text.includes('single') || text.includes('offline') || text.includes('no third-party')) {
          iconSvg = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else if (text.includes('save') || text.includes('workshop') || text.includes('mod')) {
          iconSvg = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        } else {
          iconSvg = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`;
        }

        return `
          <div class="component-badge ${addClass}">
            ${iconSvg}
            <span>${comp}</span>
          </div>
        `;
      }).join('');
    }

    const evaluationLabel = result.evaluationType === 'HASSLE' ? 'Hassle of Cracking' : 'Online Dependency';

    evalView.innerHTML = `
      <div class="widget-header">
        <div class="title-area">
          <span class="matrix-badge">${result.evaluationType} MATRIX</span>
          <span class="matrix-title">Steam Decision Core</span>
          ${result.playerCount !== undefined && result.playerCount !== null ? `
            <span class="player-count-badge" title="Current active players on Steam">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
              <span>${result.playerCount.toLocaleString()} Live</span>
            </span>
          ` : ''}
        </div>
        <div class="settings-link" title="Open Matrix Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </div>

      ${recHtml}

      <div class="info-grid">
        <div class="score-block">
          <div class="score-header">
            <span class="score-label">${evaluationLabel}</span>
            <span class="score-val">${result.decisionScore} <span>/ 5</span></span>
          </div>
          <div class="score-track">
            <div class="score-fill" style="width: ${fillPercent}%;"></div>
          </div>
          <div class="score-labels">
            <span class="${result.decisionScore === 1 ? 'active' : ''}">1 (Low)</span>
            <span class="${result.decisionScore === 2 ? 'active' : ''}">2</span>
            <span class="${result.decisionScore === 3 ? 'active' : ''}">3 (Buy)</span>
            <span class="${result.decisionScore === 4 ? 'active' : ''}">4</span>
            <span class="${result.decisionScore === 5 ? 'active' : ''}">5 (High)</span>
          </div>
        </div>
        <div>
          <div class="reasoning-block">
            <span>"${result.reasoning}"</span>
          </div>
        </div>
      </div>

      <div class="components-block">
        <div class="components-title">Online Components & Features</div>
        <div class="components-list">
          ${componentsHtml}
        </div>
      </div>
    `;

    const settingsBtn = evalView.querySelector('.settings-link');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', openSettingsInline);
    }
  }

  // --- SCRAPING ENGINE ---

  function scrapeGameDetails() {
    const name = document.querySelector('.apphub_AppName')?.textContent.trim() || 
                 document.querySelector('#appHubAppName')?.textContent.trim() || 
                 document.title.replace(' on Steam', '');

    const match = window.location.pathname.match(/\/app\/(\d+)/);
    const appId = match ? match[1] : '';

    const priceMeta = document.querySelector('meta[itemprop="price"]')?.getAttribute('content');
    
    const priceStringElement = document.querySelector('.game_purchase_price') || 
                               document.querySelector('.discount_final_price') || 
                               document.querySelector('.price');
    const priceString = priceStringElement ? priceStringElement.textContent.trim() : '';

    let priceNumeric = 0;
    if (priceMeta !== undefined && priceMeta !== null && priceMeta !== '') {
      priceNumeric = parseFloat(priceMeta);
    } else if (priceString) {
      priceNumeric = parsePriceString(priceString);
    }

    const description = document.querySelector('.game_description_snippet')?.textContent.trim() || 
                        document.querySelector('#game_area_description')?.textContent.trim().substring(0, 300) || '';

    const genreElements = document.querySelectorAll('.details_block a[href*="/genre/"]');
    const genres = Array.from(genreElements).map(a => a.textContent.trim());
    const uniqueGenres = [...new Set(genres)].filter(g => g.length > 0);

    const categoryElements = document.querySelectorAll('.game_area_details_specs a.name, .game_area_details_specs a');
    const categories = Array.from(categoryElements).map(a => a.textContent.trim());
    const uniqueCategories = [...new Set(categories)].filter(c => c.length > 0);

    const headerImage = document.querySelector('.game_header_image_full')?.src || 
                        document.querySelector('meta[property="og:image"]')?.content || '';

    const isEarlyAccess = !!document.querySelector('.early_access_header');
    
    const pStrLower = priceString.toLowerCase();
    const isFree = priceNumeric === 0 || 
                   pStrLower.includes('free') || 
                   pStrLower.includes('demo') || 
                   pStrLower.includes('play for free') || 
                   pStrLower.includes('play a playtest');

    return {
      name,
      appId,
      priceNumeric: isNaN(priceNumeric) ? 0 : priceNumeric,
      priceString: priceString || (priceNumeric === 0 ? 'Free' : priceNumeric.toString()),
      description,
      genres: uniqueGenres,
      categories: uniqueCategories,
      headerImage,
      isEarlyAccess,
      isFree
    };
  }

  function parsePriceString(priceStr) {
    if (!priceStr) return 0;
    const lower = priceStr.toLowerCase();
    if (lower.includes('free') || lower.includes('demo') || lower.includes('play for free')) return 0;
    
    let cleaned = priceStr.replace(/[^\d.,]/g, '');
    if (!cleaned) return 0;

    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length === 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  // --- API COMMUNICATIONS ---

  async function getPlayerCount(appId) {
    if (!appId) return null;
    try {
      const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`;
      const response = await gmFetch(url);
      if (response.ok) {
        const json = await response.json();
        return json.response?.player_count ?? null;
      }
    } catch (err) {
      console.error('Error fetching player count:', err);
    }
    return null;
  }

  async function evaluateGameWithAI(gameData, config) {
    const price = gameData.priceNumeric;
    const threshold = config.MATRIX_PRICE_THRESHOLD;
    const underThreshold = price < threshold;

    const genresStr = (gameData.genres || []).join(', ') || 'N/A';
    const categoriesStr = (gameData.categories || []).join(', ') || 'N/A';

    let prompt = '';

    if (underThreshold) {
      prompt = `You are evaluating a game for the Steam Purchase Decision Matrix.
The game is cheap/under the threshold of ${threshold} ${config.STEAM_CC}. You need to score the "Hassle of Cracking/Pirating" this game on a scale of 1 to 5:

Game details:
- Name: ${gameData.name}
- Price: ${gameData.priceString} (Threshold: ${threshold})
- Description: ${gameData.description}
- Genres: ${genresStr}
- Categories: ${categoriesStr}
- Active Steam Players (Online now): ${gameData.playerCount !== null ? gameData.playerCount : 'Unknown'} (Note: If this is very low, e.g. < 100, online multiplayer is effectively dead, which might impact the value of buying it for matchmaking).

Score the "Hassle of Cracking" (1 to 5) where:
- 5 (High hassle to crack): The game has frequent updates that break compatibility, relies heavily on Steam Workshop for essential mods, or relies on Steam Cloud saves. It is a headache to maintain a cracked copy. (Recommends BUY).
- 1 (Low hassle to crack): The game is a static single-player game, receives no updates, does not use Steam Workshop for mods, and is simple to install once and play. Running a cracked copy is completely hassle-free. (Recommends CRACK).

Provide:
1. \`decision_score\` (int, 1-5) where score >= 3 maps to BUY, and score < 3 maps to CRACK.
2. \`reasoning\` (str, exactly one or two sentences explaining why you chose this score, highlighting the specific features like lack of Steam Workshop, update frequency, or simple static play).
3. \`online_components\` (list of strings, 3 to 5 short items breaking down the game's system and online components, e.g. "No Steam Workshop mods", "Offline single-player", "No third-party launcher", "Steam Cloud saves enabled", "Frequent patches/updates").`;
    } else {
      prompt = `You are evaluating a game for the Steam Purchase Decision Matrix.
The game is expensive/over the threshold of ${threshold} ${config.STEAM_CC}. You need to score the "Online Dependency / Buy Requirement" on a scale of 1 to 5:

Game details:
- Name: ${gameData.name}
- Price: ${gameData.priceString} (Threshold: ${threshold})
- Description: ${gameData.description}
- Genres: ${genresStr}
- Categories: ${categoriesStr}
- Active Steam Players (Online now): ${gameData.playerCount !== null ? gameData.playerCount : 'Unknown'} (Note: If this is very low, e.g. < 100, online multiplayer is effectively dead, which might impact the value of buying it for matchmaking).

Score the "Online Dependency" (1 to 5) where:
- 5 (High online requirement): The game has server-side validations, live services, or is multiplayer matchmaking only. Cracking is impossible or makes the game completely unplayable. You MUST buy it to play it. (Recommends BUY).
- 1 (Low online requirement): The game is fully playable offline, features a single-player focus, and does not require constant server connection or matchmaking. A cracked copy works flawlessly, so you can crack it to save money. (Recommends CRACK).

Provide:
1. \`decision_score\` (int, 1-5) where score >= 3 maps to BUY, and score < 3 maps to CRACK.
2. \`reasoning\` (str, exactly one or two sentences explaining why you chose this score, highlighting the specific features like single-player focus, offline viability, server-side validations, or multiplayer requirements).
3. \`online_components\` (list of strings, 3 to 5 short items breaking down the game's system and online components, e.g. "Server-side character validations", "Always-online required", "Peer-to-peer matchmaking", "Requires EA App launcher").`;
    }

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            decision_score: { type: "INTEGER" },
            reasoning: { type: "STRING" },
            online_components: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          },
          required: ["decision_score", "reasoning", "online_components"]
        },
        temperature: 0.2
      }
    };

    const models = [
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ];

    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`Matrix: Attempting query with model ${modelName}...`);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.GEMINI_API_KEY}`;

        const response = await gmFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.error?.message || `HTTP error! status: ${response.status}`;
          throw new Error(message);
        }

        const result = await response.json();
        
        if (!result.candidates || result.candidates.length === 0) {
          throw new Error('No candidates returned from Gemini API.');
        }

        const textResponse = result.candidates[0].content.parts[0].text;
        const parsedResponse = JSON.parse(textResponse);

        return {
          evaluationType: underThreshold ? 'HASSLE' : 'ONLINE_DEPENDENCY',
          decisionScore: parsedResponse.decision_score,
          reasoning: parsedResponse.reasoning,
          onlineComponents: parsedResponse.online_components,
          threshold: threshold,
          priceNumeric: price,
          underThreshold: underThreshold,
          modelUsed: modelName
        };
      } catch (err) {
        console.warn(`Matrix: Model ${modelName} failed. Error:`, err.message || err);
        lastError = err;
      }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
  }
})();
