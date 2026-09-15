# 🎵 Spotify × Discord Lyrics Sync

<p align="center">
  <img src="./assets/demo.jpg" alt="Spotify × Discord Lyrics Sync Demo" width="680" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.5);" />
</p>

Full-featured application that syncs your active **Spotify** playback and automatically displays synchronized karaoke lyrics in your **Discord Custom Status** in real-time, featuring built-in rate-limit protection.

---

## 🌟 Key Features

- **Real-Time Synchronization Engine (Backend):**
  - Continuously tracks Spotify playback and precisely interpolates track progress down to the millisecond.
  - Automatically fetches synced LRC subtitles (with millisecond timestamps) via the public `lrclib.net` database without requiring private Spotify cookies.
  - Aligns current playback timing with active lyrical lines and dispatches updates to Discord status.
- **Anti-Rate-Limit Discord Protection:**
  - Strict minimum update interval — **no more than once every 2.5 seconds** (throttled).
  - Automatically truncates lines exceeding 128 characters (Discord limit) with an ellipsis `…`.
  - Automatically resets status (`custom_status: null`) upon clicking "Stop Sync", pausing playback, or server termination (`SIGINT`/`SIGTERM`).
- **Modern Architecture & Stack:**
  - **Backend:** Node.js, Express, WebSocket (`ws`), TypeScript, Vitest.
  - **Frontend:** React 18, Vite, TypeScript, Lucide Icons, Vanilla Glassmorphism Dark Theme.
- **Interactive Dashboard:**
  - Sleek music player card with album art, track title, artist, and animated progress bar.
  - Karaoke lyrics view with smooth auto-scroll and centering for active lines.
  - Live Discord profile card preview (avatar with online badge and custom status bubble).
  - Fine-grained timing latency adjustment (`+200ms` / `-200ms` / reset) for perfect rhythm alignment.
  - **Demo Mode:** Works out of the box with zero setup required to test the interface and lyrics engine immediately.

---

## 📁 Project Structure

```
spotify-discord-lyrics/
├── assets/
│   └── demo.jpg               # Visual demonstration banner
├── backend/
│   ├── src/
│   │   ├── config.ts          # Port, token, and throttling configuration
│   │   ├── services/
│   │   │   ├── lyrics.service.ts  # LRC parser & lrclib.net API client with cache
│   │   │   ├── spotify.service.ts # Spotify Web API client + Demo mock generator
│   │   │   ├── discord.service.ts # Discord status updater with 2.5s rate-limiter
│   │   │   └── sync.service.ts    # Millisecond timestamp interpolator & sync loop
│   │   ├── routes/
│   │   │   └── api.routes.ts      # REST API (/api/status, /api/sync/toggle, etc.)
│   │   ├── ws/
│   │   │   └── socket.ts          # WebSocket server broadcasting live state
│   │   └── index.ts           # Server entry point
│   └── tests/                 # 21 unit and integration tests (Vitest)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx         # Navigation, connection badges, and sync toggle
│   │   │   ├── PlayerCard.tsx     # Track info, cover art, seek bar, latency offset
│   │   │   ├── LyricsView.tsx     # Karaoke scrolling lyrics viewport
│   │   │   ├── DiscordPreview.tsx # Live simulated Discord user profile card
│   │   │   └── SettingsModal.tsx  # Token and configuration dialog
│   │   ├── hooks/
│   │   │   └── useSyncSocket.ts   # WebSocket connection hook
│   │   ├── App.tsx
│   │   └── index.css          # Glassmorphism design system (Dark Neon Theme)
│
├── package.json               # Root monorepo runner scripts
└── README.md
```

---

## 🚀 Quick Start

### 1. Run Development Server (Backend + Frontend)

In the root directory of the project, execute:

```bash
npm run dev
```

This will concurrently launch:
- **Backend API & WebSocket:** `http://localhost:3001`
- **Frontend Dashboard:** `http://localhost:5173`

Open in your browser: **`http://localhost:5173`**

By default, **Demo Mode** is enabled: a simulated track (*Rick Astley — Never Gonna Give You Up*) starts playing with synchronized karaoke lyrics and live updates in the Discord preview card.

---

## ⚙️ Connecting Discord & Spotify

Click the **Settings** button in the top right corner of the dashboard:

1. **Discord User Token:**
   - Open Discord in your web browser (`discord.com/app`).
   - Press `Ctrl + Shift + I` (Developer Tools) -> **Network** tab.
   - Perform any action (send a message or switch channels).
   - Filter by `/messages` or `/users/@me` and find the `Authorization` header under **Request Headers**.
   - Copy the token value and paste it into the **Discord User Token** field in Settings.
   - *Tokens are stored strictly locally on your machine.*

2. **Spotify API Credentials (for Live Sync):**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
   - Create an application and copy your **Client ID** and **Client Secret**.
   - Add `http://127.0.0.1:3001/api/auth/spotify/callback` to **Redirect URIs** in your Spotify app settings.

---

## 🧪 Running Tests

The test suite covers the LRC parser, Discord rate-limiting throttler (2500ms safety delay), timecode line indexing, and API routes:

```bash
npm run test:backend
```

All 21 tests are executed with `vitest`.
