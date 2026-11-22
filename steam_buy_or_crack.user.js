// ==UserScript==
// @name         Steam Buy or Crack Decision Matrix
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Evaluates whether to BUY or CRACK a Steam game directly from its Store page using Gemini AI.
// @author       Ricco
// @match        *://store.steampowered.com/app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      generativelanguage.googleapis.com
// @connect      api.steampowered.com
// @connect      cs.rin.ru
// @connect      fitgirl-repacks.site
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

    .widget-card.wait::before {
      background: linear-gradient(90deg, #f59e0b, #fbbf24, #d97706);
    }

    .widget-card.skip::before {
      background: linear-gradient(90deg, #64748b, #f97316, #ea580c);
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

    .wait-banner {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: #fbbf24;
      text-shadow: 0 0 10px rgba(251, 191, 36, 0.2);
      box-shadow: inset 0 0 12px rgba(245, 158, 11, 0.05);
    }

    .skip-banner {
      background: rgba(249, 115, 22, 0.08);
      border: 1px solid rgba(249, 115, 22, 0.25);
      color: #fb923c;
      text-shadow: 0 0 10px rgba(251, 146, 60, 0.2);
      box-shadow: inset 0 0 12px rgba(249, 115, 22, 0.05);
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

    .wait .score-fill {
      background: linear-gradient(90deg, #d97706, #fbbf24);
      box-shadow: 0 0 10px rgba(251, 191, 36, 0.3);
    }

    .skip .score-fill {
      background: linear-gradient(90deg, #64748b, #fb923c);
      box-shadow: 0 0 10px rgba(251, 146, 60, 0.25);
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

    .matrix-pillars {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .pillar-pill {
      font-size: 10.5px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .pillar-pill.pill-good {
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.25);
      color: #34d399;
    }

    .pillar-pill.pill-warn {
      background: rgba(245, 158, 11, 0.08);
      border-color: rgba(245, 158, 11, 0.25);
      color: #fbbf24;
    }

    .pillar-pill.pill-bad {
      background: rgba(244, 63, 94, 0.08);
      border-color: rgba(244, 63, 94, 0.25);
      color: #fb7185;
    }

    .pillar-pill.pill-info {
      background: rgba(139, 92, 246, 0.1);
      border-color: rgba(139, 92, 246, 0.25);
      color: #c084fc;
    }

    .price-badge {
      font-size: 11px;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      color: #64748b;
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

    .wait .reasoning-block {
      border-left-color: #f59e0b;
    }

    .skip .reasoning-block {
      border-left-color: #f97316;
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
      transition: all 0.2s ease;
    }

    .component-badge svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    /* Three-Tier Badge Styling */
    .component-badge.badge-restriction {
      background: rgba(244, 63, 94, 0.08);
      border-color: rgba(244, 63, 94, 0.25);
      color: #fb7185;
    }

    .component-badge.badge-benefit {
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.25);
      color: #34d399;
    }

    .component-badge.badge-feature {
      background: rgba(139, 92, 246, 0.08);
      border-color: rgba(139, 92, 246, 0.2);
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

    .widget-card.unreleased-bypass::before {
      background: linear-gradient(90deg, #8b5cf6, #a855f7, #6366f1);
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

    .recommendation-banner.unreleased-banner {
      background: rgba(139, 92, 246, 0.08);
      border: 1px solid rgba(139, 92, 246, 0.2);
      color: #a78bfa;
      text-shadow: 0 0 10px rgba(167, 139, 250, 0.2);
      box-shadow: inset 0 0 12px rgba(139, 92, 246, 0.05);
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
      <div class="form-group" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
        <label style="color: #64748b; font-size: 11px;">Scraped DRM (Debug)</label>
        <div id="debug-drm-output" style="font-size: 12px; color: #94a3b8; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; word-break: break-all; min-height: 20px;"></div>
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

      // 2. Check if Unreleased / Coming Soon
      if (gameData.isUnreleased) {
        showBypass('UNRELEASED', gameData.name, gameData.releaseDate);
        return;
      }

      // 3. Check if Early Access bypassed
      if (gameData.isEarlyAccess && !config.EVALUATE_EARLY_ACCESS) {
        showBypass('EARLY_ACCESS', gameData.name);
        return;
      }

      if (!config.GEMINI_API_KEY) {
        showError('NO_API_KEY', 'Gemini API Key is not configured.');
        return;
      }

      // Fetch player count, DOM RIN status, and FitGirl Repacks status in parallel
      const [playerCount, rinFromDom, fitGirlStatus] = await Promise.all([
        getPlayerCount(gameData.appId),
        Promise.resolve(getRinStatusFromDOM()),
        fetchFitGirlStatus(gameData.name)
      ]);
      gameData.playerCount = playerCount;
      gameData.fitGirlStatus = fitGirlStatus;

      let rinStatus = rinFromDom;
      if (!rinStatus) {
        rinStatus = await fetchRinStatusFromAPI(gameData.appId, gameData.name);
      }
      gameData.rinStatus = rinStatus || 'Unknown / Not detected';

      const crackParts = [];
      if (rinStatus) crackParts.push(`CS.RIN.RU: ${rinStatus}`);
      if (fitGirlStatus && fitGirlStatus.label) crackParts.push(`FitGirl: ${fitGirlStatus.label}`);
      gameData.crackStatus = crackParts.length > 0 ? crackParts.join(' | ') : 'Unknown / Not detected';
      gameData.isHypervisor = /hypervisor/i.test(rinStatus || '') || Boolean(fitGirlStatus && fitGirlStatus.isHypervisor);
      gameData.drmNotice = scrapeDrmNotice();
      
      const debugEl = shadow.querySelector('#debug-drm-output');
      if (debugEl) debugEl.textContent = gameData.drmNotice;

      const evaluation = await evaluateGameWithAI(gameData, config);
      evaluation.playerCount = playerCount;

      renderDecision(evaluation, gameData);
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

  function showBypass(type, gameName, extraInfo) {
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
    } else if (type === 'UNRELEASED') {
      widgetInner.className = 'widget-card unreleased-bypass';
      const plannedDateStr = extraInfo ? ` (Planned: ${extraInfo})` : '';
      evalView.innerHTML = `
        <div class="recommendation-banner unreleased-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>⏳ UNRELEASED: ${gameName}${plannedDateStr}</span>
        </div>
        <p style="font-size: 13.5px; line-height: 1.5; color: #cbd5e1; margin-bottom: 12px;">
          This game has not been released yet. Evaluations are bypassed to conserve Gemini AI tokens until the game officially launches.
        </p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size: 12px; color: #94a3b8;">Awaiting release binaries & DRM details</span>
          <a class="settings-trigger" style="color: #a78bfa; cursor: pointer; font-size: 12px; text-decoration: underline;">Configure settings</a>
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildComponentBadges(gameData, result) {
    const badges = [];
    const seen = new Set();

    function addBadge(text, type, iconSvg) {
      if (!text) return;
      const clean = text.trim();
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      badges.push({ text: clean, type, iconSvg });
    }

    const ICONS = {
      lock: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>`,
      server: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`,
      shield: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
      check: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
      gear: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
      default: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`
    };

    const gData = typeof gameData === 'object' ? gameData : {};
    const drmRaw = gData.drmNotice || '';
    const drmLower = drmRaw.toLowerCase();

    // 1. DETERMINISTIC DRM BADGES
    if (drmLower.includes('denuvo')) {
      addBadge('Denuvo Anti-tamper', 'restriction', ICONS.lock);
    } else if (drmLower.includes('vmprotect')) {
      addBadge('VMProtect DRM Active', 'restriction', ICONS.lock);
    } else if (drmLower && drmLower !== 'none detected') {
      const notices = drmRaw.split(';');
      notices.forEach(n => {
        const trimmed = n.trim();
        if (trimmed) addBadge(trimmed, 'restriction', ICONS.lock);
      });
    } else {
      addBadge('Standard Steam (No 3rd-Party DRM)', 'benefit', ICONS.check);
    }

    // 2. DETERMINISTIC CRACK STATUS & SALE BADGES (CS.RIN.RU / FitGirl / Hypervisor)
    const rinRaw = gData.rinStatus || '';
    const rinLower = rinRaw.toLowerCase();
    const isHypervisor = Boolean(gData.isHypervisor) || result.crackStatus === 'HYPERVISOR_ONLY';

    if (isHypervisor) {
      addBadge('Hypervisor Crack Only (Avoid)', 'restriction', ICONS.lock);
    } else if (gData.fitGirlStatus && gData.fitGirlStatus.found) {
      addBadge('FitGirl Repack Available', 'benefit', ICONS.shield);
    }

    if (rinLower.includes('uncracked')) {
      addBadge(`Status: ${rinRaw}`, 'restriction', ICONS.lock);
    } else if (!isHypervisor && (rinLower.includes('cracked') || rinLower.includes('steamstub'))) {
      addBadge(`Status: ${rinRaw}`, 'benefit', ICONS.shield);
    }

    if (gData.discountPct > 0) {
      addBadge(`On Sale: -${gData.discountPct}% Off`, 'benefit', ICONS.check);
    }

    // 3. CURATED AI TAGS
    const aiComponents = result.onlineComponents || [];
    aiComponents.forEach(comp => {
      const lower = comp.toLowerCase().trim();

      // Guard: Filter out contradictory DRM claims
      const hasDrm = drmLower && drmLower !== 'none detected';
      const hasStrongDrm = drmLower && /denuvo|vmprotect|arxan/i.test(drmLower);

      // If Steam page does NOT have strong DRM, never allow the AI to invent a Denuvo/VMProtect badge!
      if (!hasStrongDrm && /denuvo|vmprotect|arxan/i.test(lower)) {
        return; // drop hallucinated Denuvo badge!
      }

      if (hasDrm && (lower.includes('no drm') || lower.includes('no intrusive drm') || lower.includes('drm-free') || lower.includes('without any crack hassle'))) {
        return; // drop contradiction!
      }
      // Guard: Avoid duplicate Denuvo or Hypervisor badges if already added
      if (lower.includes('denuvo') && seen.has('denuvo anti-tamper')) {
        return;
      }
      if (isHypervisor && (lower.includes('hypervisor') || lower.includes('fitgirl') || lower.includes('hassle-free'))) {
        return;
      }

      // Classification:
      // A. Restrictions: Online multiplayer, matchmaking, server dependency, live services, anticheat, launchers
      const isOnline = lower.includes('online') || lower.includes('server') || lower.includes('multiplayer') || lower.includes('matchmaking') || lower.includes('live-service') || lower.includes('live service');
      const isDrmOrAntiCheat = lower.includes('denuvo') || lower.includes('hypervisor') || lower.includes('anticheat') || lower.includes('anti-cheat') || lower.includes('battleye') || lower.includes('easy anti') || (lower.includes('drm') && !lower.includes('no ') && !lower.includes('free'));
      const isAccountOrLauncher = lower.includes('launcher') || lower.includes('account required') || lower.includes('always-online');

      if (isOnline || isDrmOrAntiCheat || isAccountOrLauncher) {
        addBadge(comp, 'restriction', isOnline ? ICONS.server : ICONS.lock);
      }
      // B. Benefits: Offline single-player, standalone, local co-op, DRM-free, cracked
      else if (
        lower.includes('offline') || 
        lower.includes('single-player') || 
        lower.includes('single player') || 
        lower.includes('campaign') || 
        lower.includes('standalone') || 
        lower.includes('local co-op') || 
        lower.includes('split-screen') || 
        lower.includes('no third-party') || 
        lower.includes('no 3rd-party') ||
        lower.includes('cracked')
      ) {
        addBadge(comp, 'benefit', lower.includes('cracked') ? ICONS.shield : ICONS.check);
      }
      // C. Ecosystem / Neutral Features: Workshop mods, cloud saves, controllers
      else {
        addBadge(comp, 'feature', lower.includes('mod') || lower.includes('workshop') ? ICONS.gear : ICONS.default);
      }
    });

    return badges;
  }

  function renderDecision(result, gameData) {
    const gData = typeof gameData === 'object' ? gameData : {};
    const gameName = gData.name || (typeof gameData === 'string' ? gameData : 'Game');
    const verdict = ['BUY', 'CRACK', 'WAIT', 'SKIP'].includes((result.verdict || '').toUpperCase())
      ? result.verdict.toUpperCase()
      : (result.decisionScore >= 3 ? 'BUY' : 'CRACK');

    widgetInner.className = `widget-card ${verdict.toLowerCase()}`;

    let recHtml = '';
    if (verdict === 'BUY') {
      recHtml = `
        <div class="recommendation-banner buy-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>🟢 BUY IT: ${escapeHtml(gameName)}</span>
        </div>
      `;
    } else if (verdict === 'WAIT') {
      recHtml = `
        <div class="recommendation-banner wait-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>⏳ WAIT FOR SALE: ${escapeHtml(gameName)}</span>
        </div>
      `;
    } else if (verdict === 'SKIP') {
      recHtml = `
        <div class="recommendation-banner skip-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>⚠️ SKIP / DEAD ONLINE: ${escapeHtml(gameName)}</span>
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
          <span>🏴‍☠️ CRACK IT: ${escapeHtml(gameName)}</span>
        </div>
      `;
    }

    const fillPercent = (result.decisionScore / 5) * 100;

    // 3-Pillar Sub-Pills
    const crackStatus = (result.crackStatus || 'CRACKED').toUpperCase();
    let crackPillClass = 'pill-good';
    let crackPillText = '🔓 Cracked';
    if (crackStatus === 'HYPERVISOR_ONLY') {
      crackPillClass = 'pill-bad';
      crackPillText = '🔒 Hypervisor Only';
    } else if (crackStatus === 'UNCRACKED') {
      crackPillClass = 'pill-bad';
      crackPillText = '🔒 Uncracked';
    } else if (crackStatus === 'ONLINE_ONLY') {
      crackPillClass = 'pill-info';
      crackPillText = '🌐 Online-Only';
    }

    const onlineCore = (result.onlineCore || 'LOW').toUpperCase();
    const onlinePillClass = onlineCore === 'HIGH' ? 'pill-bad' : (onlineCore === 'MEDIUM' ? 'pill-warn' : 'pill-good');
    const onlineLabel = onlineCore === 'MEDIUM' ? 'Med' : (onlineCore === 'HIGH' ? 'High' : 'Low');

    const crackHassle = (result.crackHassle || 'LOW').toUpperCase();
    const hasslePillClass = crackHassle === 'HIGH' ? 'pill-bad' : (crackHassle === 'MEDIUM' ? 'pill-warn' : 'pill-good');
    const hassleLabel = crackHassle === 'MEDIUM' ? 'Med' : (crackHassle === 'HIGH' ? 'High' : 'Low');

    const badges = buildComponentBadges(gameData, result);
    const componentsHtml = badges.map(badge => `
      <div class="component-badge badge-${badge.type}">
        ${badge.iconSvg}
        <span>${escapeHtml(badge.text)}</span>
      </div>
    `).join('');

    evalView.innerHTML = `
      <div class="widget-header">
        <div class="title-area">
          <span class="matrix-badge">UNIFIED MATRIX</span>
          <span class="matrix-title">Steam Decision Core</span>
          ${gData.discountPct > 0 ? `<span class="price-badge" style="color:#34d399; background:rgba(16,185,129,0.1);">-${gData.discountPct}% OFF</span>` : ''}
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
            <span class="score-label">Buy Worthiness</span>
            <span class="score-val">${result.decisionScore} <span>/ 5</span></span>
          </div>
          <div class="score-track">
            <div class="score-fill" style="width: ${fillPercent}%;"></div>
          </div>
          <div class="score-labels">
            <span class="${result.decisionScore === 1 ? 'active' : ''}">1 (Crack/Skip)</span>
            <span class="${result.decisionScore === 2 ? 'active' : ''}">2</span>
            <span class="${result.decisionScore === 3 ? 'active' : ''}">3 (Wait)</span>
            <span class="${result.decisionScore === 4 ? 'active' : ''}">4</span>
            <span class="${result.decisionScore === 5 ? 'active' : ''}">5 (Must Buy)</span>
          </div>
          <div class="matrix-pillars">
            <span class="pillar-pill ${crackPillClass}">${crackPillText}</span>
            <span class="pillar-pill ${onlinePillClass}">Online Core: ${onlineLabel}</span>
            <span class="pillar-pill ${hasslePillClass}">Crack Hassle: ${hassleLabel}</span>
          </div>
        </div>
        <div>
          <div class="reasoning-block">
            <span>"${escapeHtml(result.reasoning)}"</span>
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
    const rawName = document.querySelector('.apphub_AppName')?.textContent.trim() || 
                    document.querySelector('#appHubAppName')?.textContent.trim() || 
                    document.title.replace(' on Steam', '');
    const name = rawName
      .replace(/\s*\[(?:CRACKED|UNCRACKED|SteamStub|Not on RIN|bypass|denuvo|hypervisor)[^\]]*\]/gi, '')
      .trim();

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

    // Scrape discount % and original price from main base-game purchase block (avoiding bundles/demos when possible)
    const purchaseBlocks = Array.from(document.querySelectorAll('#game_area_purchase .game_area_purchase_game:not(.bundle):not(.demo_above_purchase)'));
    const pricedBlock = purchaseBlocks.find(el => el.querySelector('.game_purchase_price, .discount_final_price')) ||
                        document.querySelector('.game_area_purchase_game');

    const discountPctEl = pricedBlock
      ? pricedBlock.querySelector('.discount_pct')
      : document.querySelector('.game_area_purchase_game .discount_pct, .discount_pct');
    const discountPctRaw = discountPctEl ? discountPctEl.textContent.trim() : '';
    const discountMatch = discountPctRaw.match(/\d+/);
    const discountPct = discountMatch ? parseInt(discountMatch[0], 10) : 0;

    const originalPriceEl = pricedBlock
      ? pricedBlock.querySelector('.discount_original_price')
      : document.querySelector('.game_area_purchase_game .discount_original_price, .discount_original_price');
    const originalPriceString = originalPriceEl ? originalPriceEl.textContent.trim() : '';

    // Scrape overall Steam review summary (last summary row when both Recent & All exist)
    const reviewSummaryEls = Array.from(document.querySelectorAll('#user_reviews_filter_score .game_review_summary, .user_reviews_summary_row .game_review_summary'));
    const reviewSummaryEl = reviewSummaryEls.length > 0 ? reviewSummaryEls[reviewSummaryEls.length - 1] : null;
    const reviewSummary = reviewSummaryEl ? reviewSummaryEl.textContent.trim() : 'No reviews';

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
    
    // Detect if unreleased / coming soon
    const comingSoonElem = document.querySelector('.game_area_comingsoon, .coming_soon');
    const releaseDateElem = document.querySelector('.release_date .date');
    const releaseDate = releaseDateElem ? releaseDateElem.textContent.trim() : '';

    let isFutureDate = false;
    if (releaseDate) {
      const parsedDate = Date.parse(releaseDate);
      if (!isNaN(parsedDate) && parsedDate > Date.now()) {
        isFutureDate = true;
      }
    }

    const isUnreleasedText = /coming soon|to be announced|tba|not yet released|planned release date/i.test(releaseDate);

    const purchaseButtons = Array.from(document.querySelectorAll('.game_area_purchase_game .btn_addtocart, .game_area_purchase_game .btn_green_steamui'));
    const hasPrePurchase = purchaseButtons.some(b => /pre-purchase|pre-order/i.test(b.textContent));
    const hasBuyOrPlay = purchaseButtons.some(b => /buy|play game|add to cart/i.test(b.textContent) && !/pre-purchase|pre-order/i.test(b.textContent));

    const isUnreleased = !!comingSoonElem || isUnreleasedText || isFutureDate || (hasPrePurchase && !hasBuyOrPlay);

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
      discountPct,
      originalPriceString,
      reviewSummary,
      description,
      genres: uniqueGenres,
      categories: uniqueCategories,
      headerImage,
      isEarlyAccess,
      isUnreleased,
      releaseDate,
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

  function scrapeDrmNotice() {
    const notices = [];
    
    // Helper: Steam reuses the .DRM_notice CSS class for 3rd-party EULAs as well.
    // Pure software licenses (EULAs) are not DRM, and shouldn't trigger DRM warnings or override "Standard Steam".
    const isPureEula = (text) => {
      const lower = text.toLowerCase();
      const hasEula = lower.includes('eula') || lower.includes('agreement to a 3rd-party') || lower.includes('agreement to an eula');
      const hasRealDrm = lower.includes('denuvo') || lower.includes('vmprotect') || lower.includes('arxan') || lower.includes('securom') || lower.includes('drm') || lower.includes('activation limit') || lower.includes('account');
      return hasEula && !hasRealDrm;
    };

    // 1. Check all elements matching DRM notice classes (case-insensitive attribute selector and explicit uppercase)
    const drmElements = document.querySelectorAll('.DRM_notice, .drm_notice, [class*="DRM_notice"], [class*="drm_notice"], .custom_binding_info');
    drmElements.forEach(el => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      if (text && !isPureEula(text) && !notices.includes(text)) {
        notices.push(text);
      }
    });

    // 2. Scan right column, specs, details, and purchase blocks (official info containers, excluding user reviews!)
    const scanContainers = document.querySelectorAll('.rightcol, .glance_ctn_responsive_right, #game_highlights, .details_block, .game_area_details_specs, #game_area_purchase');
    scanContainers.forEach(container => {
      const text = container.textContent;
      if (/denuvo|vmprotect|arxan|third-party drm|3rd-party drm/i.test(text)) {
        const matches = text.match(/(?:Incorporates\s+)?(?:3rd-party\s+DRM|DRM:[^.\n\r]+|Denuvo[^.\n\r]+|VMProtect[^.\n\r]+)/i);
        if (matches && !notices.some(n => n.includes(matches[0].trim()))) {
          notices.push(matches[0].trim().replace(/\s+/g, ' '));
        }
      }
    });

    // 3. Fallback scan on the official game info containers (strictly avoids user reviews where players discuss DRM)
    scanContainers.forEach(container => {
      const text = container.textContent;
      if (/denuvo/i.test(text) && !notices.some(n => /denuvo/i.test(n))) {
        const match = text.match(/Incorporates\s+3rd-party\s+DRM:\s*Denuvo[^\n\r.]*|Denuvo\s+Anti-tamper[^\n\r.]*/i);
        if (match) {
          notices.push(match[0].trim().replace(/\s+/g, ' '));
        } else {
          notices.push('Incorporates 3rd-party DRM: Denuvo Anti-tamper');
        }
      }
      if (/vmprotect/i.test(text) && !notices.some(n => /vmprotect/i.test(n))) {
        notices.push('VMProtect DRM');
      }
    });

    return notices.length > 0 ? notices.join('; ') : 'None detected';
  }

  function getRinStatusFromDOM() {
    const appNameElem = document.querySelector('#appHubAppName') || document.querySelector('.apphub_AppName');
    if (!appNameElem) return null;
    const text = appNameElem.textContent || '';
    const tagMatches = text.match(/\[(CRACKED|UNCRACKED|SteamStub|Not on RIN|bypass|denuvo|hypervisor)\]/gi);
    if (tagMatches && tagMatches.length > 0) {
      return tagMatches.join(' ');
    }
    return null;
  }

  async function fetchRinStatusFromAPI(appId, appName) {
    if (!appId) return null;
    try {
      const rinSearchUrl = `https://cs.rin.ru/forum/search.php?keywords=${appId}&fid%5B%5D=10&sr=topics&sf=firstpost`;
      const response = await gmFetch(rinSearchUrl);
      if (!response.ok) return null;

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const secCheck = doc.querySelector('p');
      if (secCheck && secCheck.textContent.includes('Security check')) {
        return null;
      }

      const topics = doc.querySelectorAll('.titles:not(:first-child), .topictitle');
      let matchingTopic = null;
      if (appName) {
        const cleanName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const topic of topics) {
          const cleanTopic = topic.textContent.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanTopic.includes(cleanName) || cleanName.includes(cleanTopic)) {
            matchingTopic = topic;
            break;
          }
        }
      }
      if (!matchingTopic && topics.length > 0) {
        matchingTopic = topics[0];
      }

      if (matchingTopic) {
        const tags = matchingTopic.textContent.match(/(?<!^)\[([^\]]+)\]/g);
        if (tags && tags.length > 0) {
          return tags.join(' ');
        }
        return '[Topic Found - No Status Tag]';
      }
      return '[Not on RIN]';
    } catch (err) {
      console.warn('Steam Matrix: CS.RIN.RU query failed or blocked:', err);
      return null;
    }
  }

  async function fetchFitGirlStatus(appName) {
    if (!appName) {
      return { found: false, isHypervisor: false, title: null, label: null };
    }
    try {
      const cleanSearchName = appName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[™®©]/g, '')
        .replace(/[:\-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const url = `https://fitgirl-repacks.site/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanSearchName)}&search_columns=post_title&per_page=10`;
      const response = await gmFetch(url);
      if (!response.ok) {
        return { found: false, isHypervisor: false, title: null, label: null };
      }

      const posts = await response.json();
      if (!Array.isArray(posts) || posts.length === 0) {
        return { found: false, isHypervisor: false, title: null, label: null };
      }

      const decodeHtml = (html) => {
        const doc = new DOMParser().parseFromString(html || '', 'text/html');
        return (doc.documentElement.textContent || '').trim();
      };

      const toSlug = (str) => str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[™®©'’]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const normalizeTitle = (str) => str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[™®©'’]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

      const appSlug = toSlug(appName);
      const normApp = normalizeTitle(appName);
      const compactApp = normApp.replace(/\s+/g, '');
      const editionSuffixRe = /^(edition|complete|deluxe|ultimate|goty|game of the year|remastered|director|repack|collection|definitive|bundle|all dlc|digital|anniversary|gold|premium|standard|enhanced|royal|anthology)/i;

      let matchedPost = null;
      let matchedTitle = '';

      // Pass 1: Exact FitGirl post slug match (e.g. "days-gone")
      for (const post of posts) {
        if (post?.slug && post.slug.toLowerCase() === appSlug) {
          matchedPost = post;
          matchedTitle = decodeHtml(post?.title?.rendered || '') || post.slug;
          break;
        }
      }

      // Pass 2: Normalized base title or edition-suffixed title/slug match
      if (!matchedPost) {
        for (const post of posts) {
          const decodedTitle = decodeHtml(post?.title?.rendered || '');
          if (!decodedTitle) continue;

          const baseTitle = decodedTitle.split(/\s+[\u2013\u2014]\s+|\s+\+\s+|,\s*v\d|\s+v\d|\s+build\s+\d/i)[0];
          const normBase = normalizeTitle(baseTitle);
          const compactBase = normBase.replace(/\s+/g, '');
          const postSlug = (post?.slug || '').toLowerCase();

          const isExactMatch = normBase === normApp || compactBase === compactApp;
          const isEditionMatch = normBase.startsWith(normApp + ' ') &&
            editionSuffixRe.test(normBase.slice(normApp.length).trim());
          const isSlugEditionMatch = appSlug && postSlug.startsWith(appSlug + '-') &&
            editionSuffixRe.test(postSlug.slice(appSlug.length + 1).replace(/-/g, ' '));

          if (isExactMatch || isEditionMatch || isSlugEditionMatch) {
            matchedPost = post;
            matchedTitle = decodedTitle;
            break;
          }
        }
      }

      if (!matchedPost) {
        return { found: false, isHypervisor: false, title: null, label: null };
      }

      const contentHtml = matchedPost?.content?.rendered || '';
      const isHypervisor = /hypervisor/i.test(matchedTitle) || /hypervisor/i.test(contentHtml);

      return {
        found: true,
        isHypervisor,
        title: matchedTitle,
        label: isHypervisor ? '[FitGirl: Hypervisor Crack]' : '[FitGirl Repack Available]'
      };
    } catch (err) {
      console.warn('Steam Matrix: FitGirl API query failed:', err);
      return { found: false, isHypervisor: false, title: null, label: null };
    }
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

  function extractJsonFromGeminiResult(result) {
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text)
      .join('\n')
      .trim();

    if (!text) {
      throw new Error('Empty response text from Gemini API.');
    }

    const isMatrixObj = (obj) => obj && typeof obj === 'object' && ('verdict' in obj || 'decision_score' in obj);

    // 1. Direct JSON parse (cleanest path for responseMimeType: "application/json")
    try {
      const direct = JSON.parse(text);
      if (isMatrixObj(direct)) return direct;
    } catch (_) {}

    // 2. Fenced code block anywhere in grounded prose
    const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
    let fenceMatch;
    while ((fenceMatch = fenceRe.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        if (isMatrixObj(parsed)) return parsed;
      } catch (_) {}
    }

    // 3. Balanced brace scan for a valid matrix JSON object in prose
    let depth = 0;
    let startIdx = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') {
        if (depth === 0) startIdx = i;
        depth++;
      } else if (ch === '}' && depth > 0) {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          const slice = text.slice(startIdx, i + 1);
          try {
            const parsed = JSON.parse(slice);
            if (isMatrixObj(parsed)) return parsed;
          } catch (_) {}
          startIdx = -1;
        }
      }
    }

    throw new Error('Could not parse valid Matrix JSON from Gemini response.');
  }

  async function evaluateGameWithAI(gameData, config) {
    const price = gameData.priceNumeric;
    const threshold = config.MATRIX_PRICE_THRESHOLD;
    const underThreshold = price < threshold;
    const dirtCheapThreshold = Math.round(threshold * 0.2);
    const isDirtCheap = (price > 0 && price <= dirtCheapThreshold) || (underThreshold && (gameData.discountPct || 0) >= 75);

    let priceTier = `ABOVE THRESHOLD (Expensive Tier >= ${threshold} ${config.STEAM_CC})`;
    if (isDirtCheap) {
      priceTier = `DIRT CHEAP / IMPULSE TIER (<= ${dirtCheapThreshold} ${config.STEAM_CC} or >= 75% off under threshold)`;
    } else if (underThreshold) {
      priceTier = `BELOW THRESHOLD (Affordable / Mid Tier < ${threshold} ${config.STEAM_CC})`;
    }

    const genresStr = (gameData.genres || []).join(', ') || 'N/A';
    const categoriesStr = (gameData.categories || []).join(', ') || 'N/A';
    const drmStr = gameData.drmNotice || 'None detected';
    const rinStatusStr = gameData.rinStatus || 'Unknown / Not detected';
    const fitGirlLabel = (gameData.fitGirlStatus && gameData.fitGirlStatus.label) ? gameData.fitGirlStatus.label : 'Not found on FitGirl';
    const discountText = gameData.discountPct > 0
      ? `-${gameData.discountPct}% off (Original: ${gameData.originalPriceString || 'N/A'})`
      : 'No active discount';

    const prompt = `You are evaluating a game for the Unified Steam Purchase Decision Matrix.
Analyze all three pillars (Crack Status, Core Online Dependency, Crack Maintenance Hassle) alongside the Price Tier, Discount, Reviews, and Active Players to recommend a verdict.

Game details:
- Name: ${gameData.name}
- AppID: ${gameData.appId}
- Release Date: ${gameData.releaseDate || 'Unknown'}
- Early Access: ${gameData.isEarlyAccess ? 'Yes' : 'No'}
- Current Price: ${gameData.priceString} | Discount: ${discountText} | User Threshold: ${threshold} ${config.STEAM_CC}
- Computed Price Tier: ${priceTier}
- Steam Review Summary: ${gameData.reviewSummary || 'No reviews'}
- Active Steam Players (Online now): ${gameData.playerCount !== null ? gameData.playerCount : 'Unknown'} (Use this strictly to check if online-centric games have healthy servers or dead < 100 player counts)
- Description: ${gameData.description}
- Genres: ${genresStr}
- Categories: ${categoriesStr}
- DRM / Protection Notice (Scraped from Steam): ${drmStr}
- Community Crack Status (CS.RIN.RU): ${rinStatusStr}
- FitGirl Repacks Status: ${fitGirlLabel}

EVALUATION PILLARS:
1. \`crack_status\`: "CRACKED" | "HYPERVISOR_ONLY" | "UNCRACKED" | "ONLINE_ONLY"
   - Check CS.RIN.RU status, FitGirl Repack status, DRM notice, and release date alongside your knowledge to determine whether a working non-hypervisor crack exists.
   - If FitGirl Repacks Status is "[FitGirl Repack Available]" or CS.RIN.RU Status includes "[CRACKED]" or "[SteamStub]", \`crack_status\` MUST be "CRACKED".
   - If DRM / Protection Notice is "None detected" (standard Steam protection only) and the game is NOT online-only, standard Steam DRM is easily bypassed by Steam emulators, so \`crack_status\` MUST be "CRACKED" even if FitGirl or CS.RIN.RU status is unknown.
   - CRITICAL HYPERVISOR RULE: If the only available crack or bypass is a Hypervisor crack/bypass, classify \`crack_status\` as "HYPERVISOR_ONLY" and \`crack_hassle\` as "HIGH". The user strictly refuses to use hypervisor cracks, so a hypervisor-only game MUST NEVER receive a "CRACK" verdict—treat it like an uncracked game ("BUY" if affordable/on sale with good reviews, or "WAIT" if expensive/full price or mixed reviews).
   - Strictly respect the scraped DRM Notice: if it says "None detected", do NOT invent Denuvo/VMProtect. If Denuvo/VMProtect is listed and no clean non-hypervisor crack is confirmed, classify as "UNCRACKED" (or "HYPERVISOR_ONLY" if hypervisor-cracked).
   - Use "ONLINE_ONLY" when server-side validation / live service makes offline cracking impossible regardless of DRM.

2. \`online_core\`: "LOW" | "MEDIUM" | "HIGH"
   - "HIGH": Core gameplay or majority of features are mandatory online, live-service, MMO, or multiplayer matchmaking where cracking makes no sense.
   - "MEDIUM": Substantial co-op / online features that meaningfully affect the experience, though solo play exists.
   - "LOW": Primarily offline / single-player game (even if Steam lists optional co-op, leaderboards, or Steam Cloud tags).

3. \`crack_hassle\`: "LOW" | "MEDIUM" | "HIGH"
   - Measures maintenance friction of a cracked copy: frequent patches/updates (Early Access or recent launch), heavy reliance on Steam Workshop mods, or important Cloud/cross-save sync. "UNCRACKED", "HYPERVISOR_ONLY", and "ONLINE_ONLY" automatically have "HIGH" crack_hassle.

VERDICT & PRICE WEIGHTING RULES (\`verdict\` & \`decision_score\` 1-5):
- "SKIP" (Score 1): Use when \`online_core\` is "HIGH" (no point cracking) AND Active Steam Players is critically low (< 100 players online) or Steam Reviews are overwhelmingly negative.
- "WAIT" (Score 3): Use when the game cannot be cleanly cracked ("UNCRACKED" or "HYPERVISOR_ONLY", or extreme "HIGH" crack_hassle) AND it is currently in the ABOVE THRESHOLD tier without a deep discount (>= 40% off) OR has Mixed/Negative reviews. Do NOT tell the user to pay full high price just because a crack isn't ready.
- "BUY" (Score 4-5):
  * DIRT CHEAP TIER: Strongly lean "BUY" (Score 4) for instant Steam convenience, Cloud saves, and zero torrent/repack friction if reviews are Positive—only choose "CRACK" if \`crack_hassle\` is strictly zero on a tiny static offline game or reviews are poor.
  * BELOW THRESHOLD TIER: Recommend "BUY" when \`online_core\` is "MEDIUM"/"HIGH" (with healthy player count), \`crack_hassle\` is "MEDIUM"/"HIGH", or \`crack_status\` is "UNCRACKED"/"HYPERVISOR_ONLY" with Positive reviews.
  * ABOVE THRESHOLD TIER: Recommend "BUY" only when the high price is justified—e.g. "HIGH" \`online_core\` with healthy player count (>= 100), heavy Workshop/update dependence, or "UNCRACKED"/"HYPERVISOR_ONLY" on a strong sale with Very/Overwhelmingly Positive reviews.
- "CRACK" (Score 1-2): Use when a clean non-hypervisor crack exists (\`crack_status\` is "CRACKED"), \`online_core\` is "LOW" (or "MEDIUM" above threshold where solo campaign is the main draw), and paying the asking price isn't justified over a low/moderate-hassle cracked copy.

CRITICAL OUTPUT RULES:
- \`reasoning\`: Exactly 1 or 2 concise sentences explaining the verdict, referencing the real crack/DRM state, online core vs player count (if relevant), hassle, and price tier.
- \`online_components\`: 3 to 5 short tags describing gameplay connectivity and dependencies (e.g. "Offline single-player campaign", "Optional P2P co-op", "Steam Workshop mod support", "Live-service matchmaking", "Frequent updates"). Never contradict the scraped DRM notice.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "verdict": "BUY" | "CRACK" | "WAIT" | "SKIP",
  "decision_score": 1-5,
  "crack_status": "CRACKED" | "HYPERVISOR_ONLY" | "UNCRACKED" | "ONLINE_ONLY",
  "online_core": "LOW" | "MEDIUM" | "HIGH",
  "crack_hassle": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": "1-2 sentences...",
  "online_components": ["3 to 5 short items"]
}`;

    const responseSchemaConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          verdict: { type: "STRING", enum: ["BUY", "CRACK", "WAIT", "SKIP"] },
          decision_score: { type: "INTEGER" },
          crack_status: { type: "STRING", enum: ["CRACKED", "HYPERVISOR_ONLY", "UNCRACKED", "ONLINE_ONLY"] },
          online_core: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
          crack_hassle: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
          reasoning: { type: "STRING" },
          online_components: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        },
        required: ["verdict", "decision_score", "crack_status", "online_core", "crack_hassle", "reasoning", "online_components"]
      },
      temperature: 0.2
    };

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: responseSchemaConfig
    };

    const models = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ];

    const discoverAvailableModel = async (apiKey, triedModels) => {
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const res = await gmFetch(listUrl);
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data.models)) return null;

        const candidates = data.models
          .filter(m =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            !/tts|image|banana|embedding|live|transcribe|robotics|omni|veo|imagen|computer-use|deep-research/i.test(m.name || '') &&
            !/gemini-[12]\./i.test(m.name || '') &&
            !/pro|gemini-4|carbon|argon/i.test(m.name || '') &&
            !/preview-09-2025|preview-10-2025|preview-12-2025|deprecated/i.test(m.name || '')
          )
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(name => name && !triedModels.includes(name));

        if (candidates.length === 0) return null;
        const preferredLite = candidates.find(name => /flash-lite/i.test(name));
        const preferredFlash = candidates.find(name => /flash/i.test(name));
        return preferredLite || preferredFlash || candidates[0];
      } catch (err) {
        console.warn('Matrix: ListModels discovery failed:', err);
        return null;
      }
    };

    const tryEvaluateWithModel = async (modelName) => {
      console.log(`Matrix: Attempting query with model ${modelName}...`);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.GEMINI_API_KEY}`;

      const response = await gmFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || `HTTP error! status: ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }

      const result = await response.json();
      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API.');
      }

      const parsedResponse = extractJsonFromGeminiResult(result);

      // Normalize core fields
      parsedResponse.verdict = ['BUY', 'CRACK', 'WAIT', 'SKIP'].includes((parsedResponse.verdict || '').toUpperCase())
        ? parsedResponse.verdict.toUpperCase()
        : (parsedResponse.decision_score >= 3 ? 'BUY' : 'CRACK');
      parsedResponse.crack_status = ['CRACKED', 'HYPERVISOR_ONLY', 'UNCRACKED', 'ONLINE_ONLY'].includes((parsedResponse.crack_status || '').toUpperCase())
        ? parsedResponse.crack_status.toUpperCase()
        : 'CRACKED';
      parsedResponse.online_core = ['LOW', 'MEDIUM', 'HIGH'].includes((parsedResponse.online_core || '').toUpperCase())
        ? parsedResponse.online_core.toUpperCase()
        : 'LOW';
      parsedResponse.crack_hassle = ['LOW', 'MEDIUM', 'HIGH'].includes((parsedResponse.crack_hassle || '').toUpperCase())
        ? parsedResponse.crack_hassle.toUpperCase()
        : 'LOW';
      parsedResponse.reasoning = String(parsedResponse.reasoning || '').trim();

      // 1. Hypervisor Guard: user refuses hypervisor cracks -> treat as unviable/high hassle
      const hypervisorDetected = Boolean(gameData.isHypervisor) || parsedResponse.crack_status === 'HYPERVISOR_ONLY';
      if (hypervisorDetected) {
        parsedResponse.crack_status = 'HYPERVISOR_ONLY';
        parsedResponse.crack_hassle = 'HIGH';
        if (parsedResponse.verdict === 'CRACK') {
          parsedResponse.verdict = underThreshold ? 'BUY' : 'WAIT';
          parsedResponse.decision_score = underThreshold ? 4 : 3;
          if (!/hypervisor/i.test(parsedResponse.reasoning)) {
            parsedResponse.reasoning += ' Only a hypervisor crack is available, which is treated as unviable.';
          }
        }
      }

      // 2. Strong DRM Anti-Hallucination & Policy Guard
      const hasStrongDrm = drmStr && /denuvo|vmprotect|arxan/i.test(drmStr);
      const rinUncracked = /uncracked/i.test(rinStatusStr);
      const rinCracked = /cracked/i.test(rinStatusStr) && !rinUncracked && !/hypervisor/i.test(rinStatusStr);
      const fitGirlCleanCracked = Boolean(gameData.fitGirlStatus && gameData.fitGirlStatus.found && !gameData.fitGirlStatus.isHypervisor);
      const locallyConfirmedCracked = !hypervisorDetected && !rinUncracked && (rinCracked || fitGirlCleanCracked);

      if (hasStrongDrm) {
        const rLower = parsedResponse.reasoning.toLowerCase();
        const noDrmRegex = /no\s+(?:[a-z-]+\s+)*drm|drm-free|drm\s*free|lacks\s+drm|without\s+(?:any\s+)?(?:[a-z-]+\s+)*drm|none\s+detected/i;
        const contradicts = noDrmRegex.test(rLower);
        const searchConfirmedCracked = !hypervisorDetected && !rinUncracked && parsedResponse.crack_status === 'CRACKED' && !contradicts;

        if (!locallyConfirmedCracked && !searchConfirmedCracked) {
          if (contradicts || parsedResponse.verdict === 'CRACK') {
            console.log("Matrix guard triggered: overriding unverified CRACK / hallucinatory DRM response.");
            parsedResponse.crack_status = hypervisorDetected ? 'HYPERVISOR_ONLY' : 'UNCRACKED';
            parsedResponse.crack_hassle = 'HIGH';
            parsedResponse.verdict = underThreshold ? 'BUY' : 'WAIT';
            parsedResponse.decision_score = underThreshold ? 4 : 3;
            if (contradicts) {
              parsedResponse.reasoning = `This game incorporates ${drmStr.split(';')[0]}, which prevents standard cracking. ${underThreshold ? 'Buying at this price is recommended.' : 'Waiting for a sale is recommended.'}`;
            }
          }
        } else if (contradicts) {
          console.log("Matrix guard triggered: fixing hallucinated reasoning for cracked game with strong DRM.");
          parsedResponse.reasoning = parsedResponse.reasoning.replace(new RegExp(noDrmRegex, 'gi'), 'Although it has strong DRM, it');
        }

        if (Array.isArray(parsedResponse.online_components)) {
          parsedResponse.online_components = parsedResponse.online_components.filter(c => !noDrmRegex.test(c));
          if (!parsedResponse.online_components.some(c => /denuvo|vmprotect|arxan|drm/i.test(c))) {
            parsedResponse.online_components.unshift(`Protected by ${drmStr.split(' ')[0] || 'Strong'} DRM`);
          }
        }
      } else {
        // 3. False DRM Guard: If Steam page does NOT have Denuvo/VMProtect/Arxan, prevent AI from hallucinating that it does
        const rLower = parsedResponse.reasoning.toLowerCase();
        const falseDrmRegex = /\b(?:denuvo(?:\s+anti-tamper)?|vmprotect|arxan)\b/i;

        if (falseDrmRegex.test(rLower)) {
          console.log("Matrix guard triggered: AI hallucinated Denuvo/DRM when none exists on Steam page. Correcting reasoning.");
          parsedResponse.reasoning = parsedResponse.reasoning
            .replace(/incorporates\s+3rd-party\s+drm:\s*denuvo[^\n\r.,]*/gi, 'has no 3rd-party DRM')
            .replace(/incorporates\s+denuvo(?:\s+anti-tamper)?(?:\s+drm)?/gi, 'has standard Steam protection')
            .replace(/features\s+denuvo(?:\s+anti-tamper)?(?:\s+drm)?/gi, 'features standard Steam protection')
            .replace(/protected\s+by\s+denuvo(?:\s+anti-tamper)?(?:\s+drm)?/gi, 'free of 3rd-party DRM')
            .replace(/uses\s+denuvo(?:\s+anti-tamper)?(?:\s+drm)?/gi, 'uses standard Steam protection')
            .replace(/denuvo\s+anti-tamper\s+drm/gi, 'standard Steam protection')
            .replace(/denuvo\s+anti-tamper/gi, 'standard Steam protection')
            .replace(/denuvo\s+drm/gi, 'standard Steam protection')
            .replace(/\bdenuvo\b/gi, 'standard Steam');

          const catLower = (gameData.categories || []).join(' ').toLowerCase();
          const descLower = (gameData.description || '').toLowerCase();
          const isSinglePlayer = catLower.includes('single-player') || catLower.includes('single player') || descLower.includes('single-player');

          if (isSinglePlayer && !hypervisorDetected && parsedResponse.online_core !== 'HIGH' && !isDirtCheap && parsedResponse.decision_score >= 3) {
            parsedResponse.verdict = 'CRACK';
            parsedResponse.crack_status = 'CRACKED';
            parsedResponse.decision_score = 1;
            parsedResponse.reasoning += " (Note: No Denuvo or 3rd-party DRM detected on Steam; single-player content is playable offline).";
          }
        }

        if (Array.isArray(parsedResponse.online_components)) {
          parsedResponse.online_components = parsedResponse.online_components.filter(c => !falseDrmRegex.test(c));
        }
      }

      // 3b. Confirmed Cracked / Standard Steam Non-Uncracked Guard
      const standardSteamNotUncracked = !hasStrongDrm && !hypervisorDetected && !rinUncracked &&
        parsedResponse.online_core !== 'HIGH' && parsedResponse.crack_status === 'UNCRACKED';

      if (locallyConfirmedCracked || standardSteamNotUncracked) {
        const wasMarkedUncracked = parsedResponse.crack_status === 'UNCRACKED';
        parsedResponse.crack_status = 'CRACKED';

        if (wasMarkedUncracked && parsedResponse.crack_hassle === 'HIGH' && !gameData.isEarlyAccess) {
          parsedResponse.crack_hassle = 'LOW';
        }

        const falseUncrackedRegex = /\b(?:uncracked|not\s+(?:yet\s+)?cracked|no\s+working\s+crack|cannot\s+be\s+cracked|remains\s+uncracked|lacks\s+a\s+crack)\b/i;
        const reasoningClaimedUncracked = falseUncrackedRegex.test(parsedResponse.reasoning);
        if (reasoningClaimedUncracked) {
          parsedResponse.reasoning = parsedResponse.reasoning
            .replace(/\b(?:remains|is|currently)\s+uncracked\b/gi, 'is cracked')
            .replace(/\buncracked\b/gi, 'cracked')
            .replace(/\bnot\s+(?:yet\s+)?cracked\b/gi, 'already cracked')
            .replace(/\bno\s+working\s+crack\b/gi, 'a working crack is available')
            .replace(/\bcannot\s+be\s+cracked\b/gi, 'can be cracked')
            .replace(/\blacks\s+a\s+crack\b/gi, 'has a working crack');
        }

        if (Array.isArray(parsedResponse.online_components)) {
          parsedResponse.online_components = parsedResponse.online_components.filter(c => !falseUncrackedRegex.test(c));
        }

        if (
          (wasMarkedUncracked || reasoningClaimedUncracked) &&
          (parsedResponse.verdict === 'WAIT' || (!underThreshold && parsedResponse.verdict === 'BUY' && parsedResponse.online_core === 'LOW' && parsedResponse.crack_hassle === 'LOW'))
        ) {
          console.log("Matrix guard triggered: overriding false UNCRACKED verdict to CRACK.");
          parsedResponse.verdict = 'CRACK';
          parsedResponse.decision_score = 1;
          if (fitGirlCleanCracked && !/fitgirl|crack/i.test(parsedResponse.reasoning)) {
            parsedResponse.reasoning += ' A FitGirl repack is confirmed available for offline play.';
          }
        }
      }

      // 4. Dead Online Guard
      if (parsedResponse.online_core === 'HIGH' && gameData.playerCount !== null && gameData.playerCount < 100 && parsedResponse.verdict === 'BUY') {
        console.log("Matrix guard triggered: High online core with dead player count -> overriding to SKIP.");
        parsedResponse.verdict = 'SKIP';
        parsedResponse.decision_score = 1;
        if (!/player|dead|empty|low/i.test(parsedResponse.reasoning)) {
          parsedResponse.reasoning += ` (Only ${gameData.playerCount} active Steam players online, making online play unviable.)`;
        }
      }

      // 5. Align numeric score with final verdict
      let finalScore = parseInt(parsedResponse.decision_score, 10);
      if (isNaN(finalScore)) finalScore = 3;
      if (parsedResponse.verdict === 'SKIP') finalScore = 1;
      else if (parsedResponse.verdict === 'CRACK') finalScore = Math.max(1, Math.min(2, finalScore));
      else if (parsedResponse.verdict === 'WAIT') finalScore = 3;
      else if (parsedResponse.verdict === 'BUY') finalScore = Math.max(4, Math.min(5, finalScore));

      return {
        evaluationType: 'UNIFIED',
        verdict: parsedResponse.verdict,
        decisionScore: finalScore,
        crackStatus: parsedResponse.crack_status,
        onlineCore: parsedResponse.online_core,
        crackHassle: parsedResponse.crack_hassle,
        reasoning: parsedResponse.reasoning,
        onlineComponents: parsedResponse.online_components,
        threshold: threshold,
        priceNumeric: price,
        underThreshold: underThreshold,
        modelUsed: modelName
      };
    };

    let lastError = null;

    for (const modelName of models) {
      try {
        return await tryEvaluateWithModel(modelName);
      } catch (err) {
        console.warn(`Matrix: Model ${modelName} failed. Error:`, err.message || err);
        lastError = err;
      }
    }

    // Dynamic fallback via ListModels if all static model names failed
    const discoveredModel = await discoverAvailableModel(config.GEMINI_API_KEY, models);
    if (discoveredModel) {
      try {
        console.log(`Matrix: Falling back to discovered model ${discoveredModel}...`);
        return await tryEvaluateWithModel(discoveredModel);
      } catch (err) {
        console.warn(`Matrix: Discovered model ${discoveredModel} failed. Error:`, err.message || err);
        lastError = err;
      }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
  }
})();
