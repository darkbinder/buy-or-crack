# Steam Buy or Crack Decision Matrix

A premium decision assistant that evaluates whether to **BUY** or **CRACK** a Steam game directly on its Steam Store page. It uses the Google Gemini API to dynamically score games based on their price, update frequency, online dependencies, and mod requirements.

This repository contains a **Userscript** implementation of the tool: a zero-friction setup that works instantly in standard browsers via script managers (Violentmonkey, Tampermonkey) and updates automatically from GitHub.

---

## Features

- **Price Routing Matrix:** Routes evaluation based on price vs. user-defined threshold:
  - **Cheap Games (< Threshold):** Evaluated using the **Hassle of Cracking** prompt (checks update frequency, workshop requirements, and save states).
  - **Expensive Games (>= Threshold):** Evaluated using the **Online Dependency** prompt (checks online validations, matchmaking, and launcher requirements).
- **Token-Saving Bypasses:** Minimizes AI token usage by skipping calls for:
  - **Free-to-Play Games:** Automatically bypassed (since there's no purchasing/cracking decision).
  - **Early Access Games:** Bypassed by default (since they are unfinished). Includes a settings toggle to enable evaluations.
- **Inline Custom Widget:** Injects a premium, glassmorphic UI card directly above the Steam buy button block.
- **Isolated Styling:** Uses Shadow DOM to prevent Steam's CSS from breaking the widget's premium look.
- **Dynamic Configuration:** Supports region country codes (CC), price thresholds, and custom evaluation switches directly inline.

---

## 🚀 Installation & Setup

Follow these steps to get the script running in your browser:

### 1. Install a Script Manager
Install [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/) for your browser.

### 2. Install the Script
* **From GitHub (Standard):** Click the raw link to the userscript file (e.g., `https://raw.githubusercontent.com/darkbinder/buy-or-crack/main/steam_buy_or_crack.user.js`). Violentmonkey will automatically detect it and prompt you to click **Confirm Installation**.
* **For Local Development (Live Reloading):**
  1. Open your script manager settings.
  2. Check **"Allow access to file URLs"** (in Violentmonkey/Chrome extension settings).
  3. Create a new script and link it to your local file path: `file:///f:/python/buy%20game%20scorer/firefox%20extenstion/steam_buy_or_crack.user.js` using tracking or `@require`.

### 3. Configuration & Setup
1. Visit any Steam game store page (e.g., [Elden Ring](https://store.steampowered.com/app/1245620/Elden_Ring/)).
2. You will see a warning card: **Gemini API Key Required**.
3. Click the **"Open Matrix Settings"** link on the card (or the gear icon in the top right).
4. Enter your credentials:
   - **Gemini API Key:** Get a free API key from [Google AI Studio](https://aistudio.google.com/).
   - **Steam CC:** Set to your regional currency country code (e.g. `PH` for Philippines).
   - **Price Threshold:** Set your budget limit.
5. Click **"Save Settings"**. The widget will automatically save your key securely (`GM.setValue`) and instantly run the evaluation without reloading!

---

## How it Works (Matrix Decision Scores)

Once configured, loading any Steam page initiates an analysis. The widget displays:
- **🟢 BUY IT:** If the AI score is $\ge 3$.
- **🏴‍☠️ CRACK IT:** If the AI score is $< 3$.
- **Live Player Count:** Queries active online player numbers so you know if multiplayer is dead.
- **Visual Gauge Score:** Integrates a score scale from $1$ (Low) to $5$ (High).
- **Reasoning:** A concise explanation of the AI's logic (e.g., highlighting updates, Steam Workshop usage, etc.).
- **Online Components Checklist:** A tags breakdown of active system components.

### Token-Saving Bypasses

To minimize API token usage, the engine performs the following checks before invoking the Gemini AI:
1. **Free-to-Play Bypass:** If a game's price is $0$ or its purchase label contains "Free", the evaluation exits early and renders a custom **Free-to-Play** banner. There is no buy/crack decision to make, so no tokens are consumed.
2. **Early Access Bypass:** Since Early Access games are unfinished, the script skips evaluation by default and renders an **Early Access Bypass** banner. If you still want to evaluate an Early Access game, you can click **"Enable Early Access Evaluations"** directly on the card, or turn it on in the settings panel.
