# Gentle Doula

Gentle Doula is a calming pregnancy companion. It helps you track daily notes, check your mood with voice, read week-by-week guidance, invite a partner, plan shopping and nursery prep, and chat with an assistant.

## Features
- Daily notes with mood slider and lightweight sentiment analysis
- Optional voice check-in using your microphone to estimate energy and speaking rate
- Risk awareness banner for prepartum and postpartum mood support, plus quick partner alert
- Week-by-week guidance and daily reading tailored to your due date
- Smart preparation checklist with recommended start weeks
- Partner invitation, local backup export and import
- AI chat: local guide works offline; optional OpenAI mode with your own API key

## Getting started
1. Open index.html and click Open the app.
2. Set your due date in Settings.
3. Add your first daily note and optionally run a voice check-in.
4. Explore the Daily read, Checklist, and Chat tabs.
5. Invite your partner by sharing the household code and exporting a backup for them to import.

## AI setup
- Local mode: default, no setup required.
- OpenAI mode: open AI settings in the Chat tab, choose OpenAI, and paste your API key. The key is stored in your browser only. Using API keys directly in a browser is not ideal for production; prefer a secure backend in real deployments.

## Privacy and data
All data is stored locally via browser localStorage unless you choose to export it or connect an API key. Voice analysis stays on-device and does not record or upload audio. The app is not medical advice. If you feel unsafe or very low, contact your clinician or local emergency services.

## Accessibility
- WCAG 2.1 AA conscious color choices and high-contrast CTAs
- Keyboard navigable UI with large touch targets
- Respects prefers-reduced-motion

## Tech stack
- HTML5, Tailwind CSS (Play CDN), jQuery 3.7, modular JavaScript
- No backend; data persists in localStorage

## Development
Open index.html locally or serve the folder with any static server. The app has no build step.

## Files
- index.html: editorial landing page
- app.html: the main application
- help.html: support resources
- styles/main.css: custom CSS and animations
- scripts/helpers.js: storage, utilities, content, sentiment, audio analyzer, risk engine, AI wrapper
- scripts/ui.js: UI logic and event binding
- scripts/main.js: bootstrap
- data/pregnancy-content.json: week-by-week guidance
- assets/*: logo and decorative motifs

## Notes
- Partner invites work best by sharing an export file to import on the partner device since this app runs fully offline.
- For production syncing or multi-user chat, add a secure backend or privacy-preserving realtime layer.
