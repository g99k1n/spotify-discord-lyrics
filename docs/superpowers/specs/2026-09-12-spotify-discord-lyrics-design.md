# Spotify Discord Lyrics Sync — System Architecture & Design Specification

**Date:** 2026-09-12  
**Status:** Approved by User  
**Target:** Monorepo with separated `backend` and `frontend`

---

## 1. Executive Summary
A local fullstack web application that synchronizes the currently playing Spotify song, fetches karaoke-style synchronized lyrics (LRC timestamps) via open APIs (Lrclib.net), and displays the active lyric line in real-time as the user's Discord Custom Status.

The system features a dashboard UI (Vite + React) that provides live visual karaoke lyrics scrolling, audio progress tracking, and controls for offset adjustment, status emojis, and start/stop toggling.

---

## 2. Architecture & Monorepo Structure

```
spotify-discord-lyrics/
├── backend/
│   ├── src/
│   │   ├── config.ts              # Configuration (ports, default intervals, paths)
│   │   ├── services/
│   │   │   ├── spotify.service.ts # Spotify Web API client (currently-playing polling, tokens)
│   │   │   ├── lyrics.service.ts  # LRC parser & Lrclib API client with caching
│   │   │   ├── discord.service.ts # Discord REST client (custom status updates with rate limiting)
│   │   │   └── sync.service.ts    # High-precision sync ticker & line matching engine
│   │   ├── routes/
│   │   │   ├── auth.routes.ts     # Spotify auth and status check endpoints
│   │   │   ├── config.routes.ts   # Config read/save (Discord token, preferences)
│   │   │   └── sync.routes.ts     # Sync engine control (start/stop/offset)
│   │   ├── ws/
│   │   │   └── socket.ts          # WebSocket server for real-time client telemetry
│   │   └── index.ts               # Server entry point (Express/Fastify + WS)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx         # Connection status badges & power toggle
│   │   │   ├── PlayerCard.tsx     # Current track cover, artist, title, progress bar
│   │   │   ├── LyricsView.tsx     # Synchronized karaoke scroller with active line highlight
│   │   │   ├── DiscordPreview.tsx # Live preview of Discord profile avatar and status bubble
│   │   │   └── SettingsModal.tsx  # Configuration drawer (Discord token, Spotify credentials, offset ms)
│   │   ├── hooks/
│   │   │   └── useSyncSocket.ts   # WebSocket connection and reactive state hook
│   │   ├── App.tsx                # Main container layout
│   │   ├── index.css              # Glassmorphism dark-theme styling
│   │   └── main.tsx               # React entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── package.json                   # Root package script runner
└── README.md                      # Setup and usage instructions
```

---

## 3. Detailed Component Responsibilities

### 3.1 Backend Components

1. **`SpotifyService`**:
   - Queries `https://api.spotify.com/v1/me/player/currently-playing` every 1.5–2 seconds.
   - Extracts: `item.id`, `item.name`, `item.artists`, `progress_ms`, `is_playing`, `item.album.images`.
   - Supports local token refresh when access token expires.

2. **`LyricsService`**:
   - Fetches synchronized lyrics from `https://lrclib.net/api/get` using `track_name`, `artist_name`, and `duration`.
   - Parses standard LRC format `[mm:ss.xx] Lyric text` into an in-memory array of `{ timeMs: number, text: string }`.
   - Caches parsed lyrics per track ID to avoid duplicate network calls.

3. **`SyncService` (Precision Engine)**:
   - Interpolates current playback timestamp:
     `current_ms = last_progress_ms + (now - fetch_timestamp) + user_offset_ms`
   - Finds the matching active line: `lines[i].timeMs <= current_ms < lines[i+1].timeMs`.
   - Triggers Discord update when the active line changes.
   - Emits real-time state via WebSocket to all connected frontend clients.

4. **`DiscordService` & Anti-Rate-Limit Throttler**:
   - Updates status via `PATCH https://discord.com/api/v9/users/@me/settings`.
   - Payload:
     ```json
     {
       "custom_status": {
         "text": "🎵 [Lyric line]",
         "emoji_name": "🎶"
       }
     }
     ```
   - **Throttling Rules**:
     - Hard minimum delay of 2.5–3.0 seconds between consecutive Discord API calls.
     - Merges adjacent rapid lines or truncates text to 128 characters max.
     - On HTTP 429 response, pauses for `retry_after` + 500ms safety buffer.
     - Clears status (`custom_status: null`) on manual stop, song pause, or process termination (`SIGINT`/`SIGTERM`).

### 3.2 Frontend Components

1. **`PlayerCard`**:
   - Displays album art, track title, artists, duration, and smoothly animated progress bar.
2. **`LyricsView`**:
   - Vertical karaoke-style list of lyrics with auto-scroll keeping the active line centered.
   - Smooth CSS transitions and font-size scaling for the active line.
3. **`DiscordPreview`**:
   - Renders an interactive mock of a Discord user profile card showing the avatar, online status badge, and custom status bubble with the live synced lyric.
4. **`SettingsModal`**:
   - Form inputs for Discord Token, Spotify Client ID / Secret / Refresh Token, status prefix/emoji, and timing offset adjustment (-2000ms to +2000ms).

---

## 4. Communication & Protocols

- **REST API**:
  - `GET /api/status`: Current sync status, track info, connection health.
  - `POST /api/sync/toggle`: Start/Stop status syncing.
  - `POST /api/sync/offset`: Adjust timing offset in milliseconds.
  - `GET /api/config` & `POST /api/config`: Manage local settings.
  - `GET /api/auth/spotify/url` & `GET /api/auth/spotify/callback`: Spotify OAuth flow.
- **WebSocket (`/ws`)**:
  - Pushes real-time JSON packets: `{ track, progressMs, activeLyricIndex, lyrics, isSyncing, error }`.

---

## 5. Safety & Verification Plan

- **Token Safety**: Tokens stored in local `.env` and local config JSON; never committed to git.
- **Throttling Verification**: Unit test and integration assertions to ensure Discord API is never invoked faster than once every 2.5 seconds.
- **LRC Parser Verification**: Unit test verifying correct parsing of LRC timestamps (including edge cases: blank lines, instrumental breaks).
- **Graceful Shutdown**: Test verifying `SIGINT` correctly calls `clearStatus()` in Discord before exit.
