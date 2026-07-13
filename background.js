// Check storage API availability (Firefox/Chrome cross-compatibility)
const storage = (typeof browser !== 'undefined' && browser.storage) ? browser.storage.local : chrome.storage.local;

// Default configuration settings
const DEFAULTS = {
  GEMINI_API_KEY: '',
  STEAM_CC: 'PH',
  MATRIX_PRICE_THRESHOLD: 1000
};

// Listen for messages from the content script
if (typeof browser !== 'undefined') {
  browser.runtime.onMessage.addListener(handleMessage);
} else {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep message channel open for async response
  });
}

/**
 * Handle incoming messages from content scripts
 */
async function handleMessage(message, sender) {
  if (message.action === 'openOptions') {
    if (typeof browser !== 'undefined' && browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
    return { success: true };
  }

  if (message.action === 'evaluateGame') {
    try {
      const config = await getSettings();
      if (!config.GEMINI_API_KEY) {
        return { error: 'NO_API_KEY', message: 'Gemini API Key is not configured. Please open Extension Options.' };
      }

      // Fetch active player count before invoking AI
      const playerCount = await getPlayerCount(message.gameData.appid || message.gameData.appId);
      message.gameData.playerCount = playerCount;

      const evaluation = await evaluateGameWithAI(message.gameData, config);
      evaluation.playerCount = playerCount; // Pass back to display in UI

      return { success: true, data: evaluation };
    } catch (err) {
      console.error('Error evaluating game:', err);
      return { error: 'API_ERROR', message: err.message || 'An unexpected error occurred during API evaluation.' };
    }
  }
}

/**
 * Retrieves configuration settings, falling back to defaults if not set.
 */
function getSettings() {
  return new Promise((resolve) => {
    storage.get(DEFAULTS, (settings) => {
      resolve(settings);
    });
  });
}

/**
 * Routes and queries Gemini based on the game's price vs the user threshold.
 */
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;

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

  const response = await fetch(endpoint, {
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
    underThreshold: underThreshold
  };
}

/**
 * Fetches the active player count for a given Steam AppID.
 * Uses Steam's public Web API.
 */
async function getPlayerCount(appId) {
  if (!appId) return null;
  try {
    const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`;
    const response = await fetch(url);
    if (response.ok) {
      const json = await response.json();
      return json.response?.player_count ?? null;
    }
  } catch (err) {
    console.error('Error fetching player count:', err);
  }
  return null;
}
