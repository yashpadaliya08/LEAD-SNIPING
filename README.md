# ⚡ Lead Sniping Engine

> Real-time freelance lead monitoring and consultative pitch generation for Upwork & Reddit.

## 🚀 Quick Start

1. **Configure Environment**
   Open `.env` and verify your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_token_from_botfather
   TELEGRAM_CHAT_ID=your_chat_id_from_userinfobot
   POLL_INTERVAL_MS=5000
   MIN_HOURLY_RATE=30
   MIN_FIXED_BUDGET=200
   ```

2. **Start the Engine**
   ```bash
   npm run dev
   ```
   Or double-click `start_sniper.bat` on Windows.

3. **How It Works**
   - Polls active job streams (Reddit `r/forhire`, `r/freelance_forhire`, `r/Jobbit`, and Upwork).
   - In-memory deduplication ensures zero duplicate alerts.
   - Evaluates jobs against sweet-spot criteria (MVPs, scraping, automations, AI wrappers).
   - Extracts client name and hidden Easter eggs.
   - Dispatches a consultative pitch directly to your Telegram with inline job links in **< 5 seconds**.
