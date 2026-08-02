# Steam Buy or Crack Decision Matrix

A premium decision assistant that evaluates whether to **BUY** or **CRACK** a Steam game directly on its Steam Store page. It uses the Google Gemini API to dynamically score games based on their price, update frequency, online dependencies, and mod requirements.

This repository contains **both** implementations of the tool so you can choose what works best for you:
1. **Userscript (Recommended):** Zero-friction installation, works instantly in standard browsers via script managers (Violentmonkey, Tampermonkey), and updates automatically from GitHub.
2. **Firefox Extension (Manifest V3):** Traditional browser extension with background scripts and a dedicated Options tab.

---

## Features

- **Price Routing Matrix:** Routes evaluation based on price vs. user-defined threshold:
  - **Cheap Games (< Threshold):** Evaluated using the **Hassle of Cracking** prompt (checks update frequency, workshop requirements, and save states).
  - **Expensive Games (>= Threshold):** Evaluated using the **Online Dependency** prompt (checks online validations, matchmaking, and launcher requirements).
- **Inline Custom Widget:** Injects a premium, glassmorphic UI card directly above the Steam buy button block.
- **Isolated Styling:** Uses Shadow DOM to prevent Steam's CSS from breaking the widget's premium look.
- **Dynamic Configuration:** Supports region country codes (CC) and price thresholds.

---

## 🚀 Option 1: Userscript Installation (Recommended)

This is the easiest and most sustainable way to run the script permanently.

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

## 📦 Option 2: Firefox Extension Installation (Local Sideloading)

To load and run the local extension package in Firefox:

### 1. Open Firefox Debugging
1. Launch Firefox.
2. Type `about:debugging` in the URL search bar and press **Enter**.

### 2. Load the Extension
1. Click on **"This Firefox"** in the left navigation panel.
2. Locate the **Temporary Extensions** section.
3. Click the **"Load Temporary Add-on..."** button.
4. Select the `manifest.json` file inside `f:\python\buy game scorer\firefox extenstion` and click **Open**.

*Note: Sideloaded extensions are temporary and will be removed whenever you close Firefox. You must reload it when restarting.*

### 3. Configuration & Setup
1. In `about:debugging` on the loaded extension card, click **"Preferences"** (or Options).
2. Alternatively, click the **"Open Extension Settings"** link on the injected Steam page widget.
3. Enter your Gemini API key, Steam CC, and Threshold price.
4. Click **"Save Settings"**.

---

## How it Works (Matrix Decision Scores)

Once configured, loading any Steam page initiates an analysis. The widget displays:
- **🟢 BUY IT:** If the AI score is $\ge 3$.
- **🏴‍☠️ CRACK IT:** If the AI score is $< 3$.
- **Live Player Count:** Queries active online player numbers so you know if multiplayer is dead.
- **Visual Gauge Score:** Integrates a score scale from $1$ (Low) to $5$ (High).
- **Reasoning:** A concise explanation of the AI's logic (e.g., highlighting updates, Steam Workshop usage, etc.).
- **Online Components Checklist:** A tags breakdown of active system components.
