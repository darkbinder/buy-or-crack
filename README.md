# Steam Buy or Crack Decision Matrix

A premium decision assistant that evaluates whether to **BUY** or **CRACK** a Steam game directly on its Steam Store page. It uses the Google Gemini API to dynamically score games based on their price, update frequency, online dependencies, and mod requirements.

This repository contains a **Userscript** implementation of the tool: a zero-friction setup that works instantly in standard browsers via script managers (Violentmonkey, Tampermonkey) and updates automatically from GitHub.

---

## Features

- **Unified Multi-Factor Decision Matrix:** Evaluates every game across three core pillars alongside price tier, active discounts, Steam reviews, and live multiplayer health:
  - **Crack Status:** Checks CS.RIN.RU, FitGirl Repacks (including scanning repack details for hypervisor cracks), and Steam DRM notices. Hypervisor-only cracks are treated as unviable/high hassle.
  - **Core Online Dependency:** Distinguishes mandatory online/live-service/matchmaking gameplay from optional co-op tags on primarily single-player games.
  - **Crack Maintenance Hassle:** Evaluates update velocity, Early Access patch churn, Steam Workshop mod dependence, and Cloud save friction.
- **Smart Price Tier Weighting:**
  - **Dirt Cheap / Impulse Tier ($\le 20\%$ of threshold or $\ge 75\%$ off under threshold):** Leans **Buy** for 1-click Steam convenience when reviews are positive, unless hassle is strictly zero.
  - **Below Threshold:** Balances Crack Hassle and Core Online Dependency against affordability.
  - **Above Threshold:** Only recommends **Buy** when justified by core online gameplay (with healthy active servers), extreme Workshop/update dependence, or strong discounted/uncracked value.
- **Token-Saving Bypasses:** Minimizes AI token usage by skipping calls for:
  - **Free-to-Play Games:** Automatically bypassed (since there's no purchasing/cracking decision).
  - **Unreleased Games & Pre-Orders:** Bypassed automatically with an **Unreleased** banner until game files and launch DRM details are out.
  - **Early Access Games:** Bypassed by default (since they are unfinished). Includes a settings toggle to enable evaluations.
- **DRM & Crack-Aware AI Matrix:**
  - Scrapes 3rd-party DRM notices (e.g., Denuvo Anti-tamper), discounts, and overall review summaries directly from the Steam store page.
  - Queries Altansar69's CS.RIN.RU Enhanced DOM tags, the CS.RIN.RU forum, and FitGirl Repacks WordPress API (`fitgirl-repacks.site`) to detect crack availability and flag hypervisor-only cracks.
  - Combines deterministic anti-hallucination and policy guards with Gemini structured JSON output so verdicts stay accurate.
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

Once configured, loading any Steam page initiates an analysis. The widget displays one of four verdict banners:
- **🟢 BUY IT (Score 4–5):** Worth buying right now (cheap/discounted convenience, high crack hassle, uncracked at a fair price, or active online-core gameplay).
- **🏴‍☠️ CRACK IT (Score 1–2):** Clean non-hypervisor crack exists, core loop is offline-viable, and the price outweighs maintenance friction.
- **⏳ WAIT FOR SALE (Score 3):** Uncracked or hypervisor-only (or high-hassle), but currently expensive or mixed-reviewed—wait for a deeper discount.
- **⚠️ SKIP / DEAD ONLINE (Score 1):** Core gameplay relies heavily on online servers/matchmaking, and live Steam player counts are critically low ($< 100$).

Below the banner, you'll see:
- **Buy Worthiness Gauge (1–5) & 3-Pillar Sub-Pills:** Shows `Crack Status` (Cracked / Hypervisor Only / Uncracked / Online-Only), `Online Core` (Low / Med / High), and `Crack Hassle` (Low / Med / High).
- **Reasoning:** A concise 1–2 sentence explanation covering crack/DRM state, online core vs. server health, hassle, and price tier.
- **Three-Tier Online Components & Protection Badges:**
  - 🔴 **Restrictions & Hurdles (Rose/Red):** Denuvo Anti-tamper, 3rd-party launchers, uncracked/hypervisor-only status, and online multiplayer/matchmaking.
  - 🟢 **Freedom & Benefits (Green):** Standalone offline campaigns, DRM-free/Standard Steam, FitGirl Repack availability, active Steam discounts.
  - 🟣 **Ecosystem Features (Purple):** Steam Workshop mod support, Steam Cloud saves, controller support.

### Token-Saving Bypasses

To minimize API token usage, the engine performs the following checks before invoking the Gemini AI:
1. **Free-to-Play Bypass:** If a game's price is $0$ or its purchase label contains "Free", the evaluation exits early and renders a custom **Free-to-Play** banner. There is no buy/crack decision to make, so no tokens are consumed.
2. **Unreleased Game Bypass:** If a game is unreleased ("Coming Soon", future release date, or Pre-Purchase only), the evaluation exits early and displays an **Unreleased** banner showing the planned release date. No tokens are consumed until the game launches.
3. **Early Access Bypass:** Since Early Access games are unfinished, the script skips evaluation by default and renders an **Early Access Bypass** banner. If you still want to evaluate an Early Access game, you can click **"Enable Early Access Evaluations"** directly on the card, or turn it on in the settings panel.
