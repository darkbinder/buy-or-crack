# Steam Buy or Crack Decision Matrix - Firefox Extension

A premium local Firefox Extension (Manifest V3) that evaluates whether to **BUY** or **CRACK** a Steam game directly from its Steam Store page. It uses the Google Gemini API to dynamically score games based on their price, updates, online requirements, and mod dependencies.

## Features

- **Price Routing Matrix:** Routes evaluation based on price vs. user-defined threshold:
  - **Cheap Games (< Threshold):** Evaluated using the **Hassle of Cracking** prompt (checks update frequency, workshop requirements, and save states).
  - **Expensive Games (>= Threshold):** Evaluated using the **Online Dependency** prompt (checks online validations, matchmaking, and launcher requirements).
- **Inline Custom Widget:** Injects a premium, glassmorphic UI card directly above the Steam buy button block.
- **Isolated Styling:** Uses Shadow DOM to prevent Steam's CSS from breaking the extension's premium look.
- **Options/Settings Page:** Modern configuration dashboard to easily update settings.

---

## Step-by-Step Firefox Installation (Local Sideloading)

To load and test this extension locally in Firefox:

### 1. Open Firefox Debugging
1. Launch Firefox.
2. Type `about:debugging` in the URL search bar and press **Enter**.

### 2. Load the Extension
1. Click on **"This Firefox"** in the left navigation panel.
2. Locate the **Temporary Extensions** section.
3. Click the **"Load Temporary Add-on..."** button.
4. In the file explorer, navigate to the folder containing your extension files:
   `f:\python\buy game scorer\firefox extenstion`
5. Select the `manifest.json` file and click **Open**.

*The extension is now sideloaded! It will remain active until you restart Firefox.*

---

## Configuration & Setup

Before you can run evaluations, you must add your Google Gemini API Key:

1. In `about:debugging` on the loaded extension card, click the **"Preferences"** (or Options) button.
   *Alternatively, you can click the **"Open Extension Settings"** link directly on the injected Steam widget.*
2. **Gemini API Key:** Enter your Gemini API Key. If you do not have one, get a free key from the [Google AI Studio](https://aistudio.google.com/).
3. **Steam Country Code (CC):** Set to your region (defaults to `PH` for Philippines).
4. **Price Threshold:** Set the price threshold in your regional currency (defaults to `1000`).
5. Click **"Save Settings"** (a green success notification will slide in).

---

## How to Test

1. Visit any Steam game store page (e.g., `https://store.steampowered.com/app/1245620/Elden_Ring/`).
2. You will see a skeleton loading card appear right above the buy options block.
3. Once the Gemini API completes the evaluation, the widget will slide in with the dynamic recommendation:
   - **🟢 BUY IT:** If the AI score is $\ge 3$.
   - **🏴‍☠️ CRACK IT:** If the AI score is $< 3$.
4. You will also see a visual gauge score, a detailed reasoning snippet, and a checklist of identified online components.
