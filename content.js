(function() {
  // Prevent duplicate execution
  if (document.getElementById('steam-buy-or-crack-root')) return;

  const storage = (typeof browser !== 'undefined' && browser.storage) ? browser.storage.local : chrome.storage.local;

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
  `;
  shadow.appendChild(style);

  // HTML content shell
  const widgetInner = document.createElement('div');
  widgetInner.className = 'widget-card';
  shadow.appendChild(widgetInner);

  // Render initial loading state
  showLoading();

  // Scrape page and trigger API evaluation
  try {
    const gameData = scrapeGameDetails();
    if (!gameData.appId) {
      // Not a valid game page or failed to scrape AppID
      console.log('Steam Matrix: Valid AppID not detected. Aborting widget injection.');
      return;
    }

    // Insert widget container above the Steam buy area
    const insertTarget = document.querySelector('#game_area_purchase') || 
                         document.querySelector('.game_area_purchase_margin') ||
                         document.querySelector('.rightcol');
    
    if (insertTarget) {
      insertTarget.parentNode.insertBefore(rootContainer, insertTarget);
    } else {
      console.error('Steam Matrix: Could not find insert target in Steam Store DOM.');
      return;
    }

    // Request decision matrix evaluation from background script
    chrome.runtime.sendMessage({ action: 'evaluateGame', gameData }, (response) => {
      // Handle chrome extensions callback error checking
      const err = chrome.runtime.lastError;
      if (err) {
        showError('COMMUNICATION_ERROR', err.message);
        return;
      }

      if (!response) {
        showError('EMPTY_RESPONSE', 'No response received from background script.');
        return;
      }

      if (response.error) {
        showError(response.error, response.message);
      } else if (response.success && response.data) {
        renderDecision(response.data, gameData.name);
      }
    });
  } catch (err) {
    console.error('Steam Matrix Scraper Error:', err);
  }

  // --- RENDERING FUNCTIONS ---

  function showLoading() {
    widgetInner.innerHTML = `
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
    if (code === 'NO_API_KEY') {
      widgetInner.innerHTML = `
        <div class="warning-card">
          <div style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:15px;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <span>Gemini API Key Required</span>
          </div>
          <p style="font-size:13.5px; line-height:1.4;">The Steam Purchase Decision Matrix needs a Gemini API Key to run evaluations. Please configure your key in settings.</p>
          <div>
            <a class="settings-trigger">Open Extension Settings</a>
          </div>
        </div>
      `;
    } else {
      widgetInner.innerHTML = `
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

    // Attach click handler for options trigger
    const trigger = widgetInner.querySelector('.settings-trigger');
    if (trigger) {
      trigger.addEventListener('click', openSettings);
    }
  }

  function renderDecision(result, gameName) {
    const isBuy = result.decisionScore >= 3;
    widgetInner.className = `widget-card ${isBuy ? 'buy' : 'crack'}`;

    // Format recommendation header
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

    // Score Fill percentage (score 1-5 maps to 20%-100% width)
    const fillPercent = (result.decisionScore / 5) * 100;

    // Component badges
    let componentsHtml = '';
    if (result.onlineComponents && result.onlineComponents.length > 0) {
      componentsHtml = result.onlineComponents.map(comp => {
        // Decide icon / class based on content text to add premium visual detail
        const text = comp.toLowerCase();
        let iconSvg = '';
        let addClass = '';

        if (text.includes('online') || text.includes('server') || text.includes('multiplayer') || text.includes('matchmaking')) {
          // Cloud/Server icon
          iconSvg = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`;
          addClass = 'active-feature';
        } else if (text.includes('single') || text.includes('offline') || text.includes('no third-party')) {
          // Play/Offline icon
          iconSvg = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else if (text.includes('save') || text.includes('workshop') || text.includes('mod')) {
          // Mod/Save wrench icon
          iconSvg = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        } else {
          // Bullet check icon
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

    widgetInner.innerHTML = `
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

    // Attach click handler for options link
    const settingsBtn = widgetInner.querySelector('.settings-link');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', openSettings);
    }
  }

  function openSettings() {
    if (typeof browser !== 'undefined') {
      browser.runtime.sendMessage({ action: 'openOptions' });
      // Fallback: direct window open if message routing fails in some contexts
      window.open(browser.runtime.getURL('options.html'));
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  }

  // --- SCRAPING FUNCTIONS ---

  function scrapeGameDetails() {
    const name = document.querySelector('.apphub_AppName')?.textContent.trim() || 
                 document.querySelector('#appHubAppName')?.textContent.trim() || 
                 document.title.replace(' on Steam', '');

    // Extract AppID from path /app/<appid>/<slug>/
    const match = window.location.pathname.match(/\/app\/(\d+)/);
    const appId = match ? match[1] : '';

    // Get raw price from itemprop metadata
    const priceMeta = document.querySelector('meta[itemprop="price"]')?.getAttribute('content');
    
    // Get display price strings
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

    // Game short description
    const description = document.querySelector('.game_description_snippet')?.textContent.trim() || 
                        document.querySelector('#game_area_description')?.textContent.trim().substring(0, 300) || '';

    // Genres (filter out duplicates, keep descriptive text)
    const genreElements = document.querySelectorAll('.details_block a[href*="/genre/"]');
    const genres = Array.from(genreElements).map(a => a.textContent.trim());
    const uniqueGenres = [...new Set(genres)].filter(g => g.length > 0);

    // Categories (Single-player, Multi-player, Steam Achievements, etc.)
    const categoryElements = document.querySelectorAll('.game_area_details_specs a.name, .game_area_details_specs a');
    const categories = Array.from(categoryElements).map(a => a.textContent.trim());
    const uniqueCategories = [...new Set(categories)].filter(c => c.length > 0);

    // Header image
    const headerImage = document.querySelector('.game_header_image_full')?.src || 
                        document.querySelector('meta[property="og:image"]')?.content || '';

    return {
      name,
      appId,
      priceNumeric: isNaN(priceNumeric) ? 0 : priceNumeric,
      priceString: priceString || (priceNumeric === 0 ? 'Free' : priceNumeric.toString()),
      description,
      genres: uniqueGenres,
      categories: uniqueCategories,
      headerImage
    };
  }

  function parsePriceString(priceStr) {
    if (!priceStr) return 0;
    const lower = priceStr.toLowerCase();
    if (lower.includes('free') || lower.includes('demo') || lower.includes('play for free')) return 0;
    
    // Extract numbers, commas, periods
    let cleaned = priceStr.replace(/[^\d.,]/g, '');
    if (!cleaned) return 0;

    if (cleaned.includes(',') && cleaned.includes('.')) {
      // e.g. 1,299.99
      cleaned = cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',')) {
      // Check if comma is decimal (e.g., "19,99") or thousands (e.g., "1,999")
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
})();
