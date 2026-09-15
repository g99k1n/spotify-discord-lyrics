# Spotify Discord Lyrics Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fullstack web application that synchronizes the currently playing Spotify song, fetches synchronized karaoke lyrics from Lrclib, and displays the current lyric line in real-time as the user's Discord Custom Status with anti-rate-limit protection.

**Architecture:** Monorepo with separated `backend` (Node.js + Express/WS + TypeScript) and `frontend` (Vite + React + TypeScript + Glassmorphism Dark UI). A backend sync engine interpolates Spotify playback progress, matches active LRC timestamps, safely throttles updates to Discord's `/users/@me/settings` endpoint (>= 2.5s interval), and streams real-time updates to the React dashboard via WebSocket.

**Tech Stack:** 
- Backend: Node.js, TypeScript, Express, `ws`, `dotenv`, `vitest`
- Frontend: Vite, React 18, TypeScript, Lucide React (icons), Vanilla CSS (Custom Design Tokens)
- Monorepo: `concurrently`

**Spec:** [docs/superpowers/specs/2026-09-12-spotify-discord-lyrics-design.md](file:///c:/Users/admin/Desktop/project%201/docs/superpowers/specs/2026-09-12-spotify-discord-lyrics-design.md)

## Global Constraints

- Discord rate-limit safe floor: minimum 2500ms between Discord Custom Status requests.
- Max status text length: 128 characters (Discord API limit).
- Tokens stored locally in `.env` or local configuration storage; never hardcoded or committed to git.
- Provide a Simulated/Demo Mode so the system can be fully verified and tested out-of-the-box without requiring live Spotify/Discord credentials on first run.

---

### Task 1: Monorepo Scaffolding & Root Configuration

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/config.ts`

**Interfaces:**
- Produces: `AppConfig` type and default configuration values.

- [ ] **Step 1: Create root package.json and .gitignore**

```json
{
  "name": "spotify-discord-lyrics-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm --prefix backend run dev",
    "dev:frontend": "npm --prefix frontend run dev",
    "build": "npm --prefix backend run build && npm --prefix frontend run build",
    "test:backend": "npm --prefix backend test"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create backend package.json and tsconfig.json**

Backend dependencies: `express`, `ws`, `dotenv`, `cors`, and dev dependencies `typescript`, `tsx`, `vitest`, `@types/express`, `@types/ws`, `@types/cors`.

- [ ] **Step 3: Implement backend/src/config.ts**

Define ports (default 3001 for backend, 5173 for frontend), Discord rate limit constant (`MIN_DISCORD_INTERVAL_MS = 2500`), max length (`128`), and config loader.

- [ ] **Step 4: Verify backend setup with a smoke test**

Run: `npm --prefix backend test`
Expected: PASS (0 or smoke test passing).

---

### Task 2: Lyrics Service (LRC Parser & Lrclib API Client with Cache)

**Files:**
- Create: `backend/src/types/lyrics.ts`
- Create: `backend/src/services/lyrics.service.ts`
- Create: `backend/tests/lyrics.test.ts`

**Interfaces:**
- Produces: 
  - `interface LyricLine { timeMs: number; text: string; }`
  - `interface ParsedLyrics { isSynced: boolean; lines: LyricLine[]; rawLrc?: string; }`
  - `parseLrc(lrcText: string): LyricLine[]`
  - `LyricsService.getLyrics(artist: string, track: string, durationMs?: number): Promise<ParsedLyrics | null>`

- [ ] **Step 1: Write failing unit test for LRC parser in backend/tests/lyrics.test.ts**

Tests standard timestamps `[00:14.20] Hello world`, multiple tags, out-of-order timestamps, and blank lines.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test tests/lyrics.test.ts`
Expected: FAIL ("cannot find module")

- [ ] **Step 3: Implement parseLrc and LyricsService with in-memory LRU/Map cache**

Fetch from `https://lrclib.net/api/get?artist_name=...&track_name=...&duration=...`. Fallback to `/api/search` if exact match not found.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test tests/lyrics.test.ts`
Expected: PASS

---

### Task 3: Discord Service with Throttling & Rate-Limit Protection

**Files:**
- Create: `backend/src/types/discord.ts`
- Create: `backend/src/services/discord.service.ts`
- Create: `backend/tests/discord.test.ts`

**Interfaces:**
- Consumes: `MIN_DISCORD_INTERVAL_MS = 2500`
- Produces:
  - `interface CustomStatusPayload { text: string; emojiName?: string; }`
  - `DiscordService.updateStatus(status: CustomStatusPayload): Promise<{ success: boolean; throttled?: boolean }>`
  - `DiscordService.clearStatus(): Promise<void>`

- [ ] **Step 1: Write failing unit test for Discord throttler**

Verifies:
- Consecutive calls within 2500ms are safely throttled (debounced/deferred).
- Status text longer than 128 characters is safely sliced with ellipsis `…`.
- Handling of HTTP 429 response backoff.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test tests/discord.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement DiscordService**

Uses `fetch` to send `PATCH https://discord.com/api/v9/users/@me/settings` with `Authorization: <user_token>`. Enforces timestamp gap tracking and queueing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test tests/discord.test.ts`
Expected: PASS

---

### Task 4: Spotify Service & Token Management

**Files:**
- Create: `backend/src/types/spotify.ts`
- Create: `backend/src/services/spotify.service.ts`
- Create: `backend/tests/spotify.test.ts`

**Interfaces:**
- Produces:
  - `interface CurrentPlayback { id: string; name: string; artist: string; albumArt: string; durationMs: number; progressMs: number; isPlaying: boolean; fetchTime: number; }`
  - `SpotifyService.getCurrentlyPlaying(): Promise<CurrentPlayback | null>`
  - `SpotifyService.setCredentials(clientId: string, clientSecret: string, refreshToken: string): void`
  - `SpotifyService.getAuthUrl(redirectUri: string): string`
  - `SpotifyService.handleAuthCallback(code: string, redirectUri: string): Promise<void>`

- [ ] **Step 1: Write test for playback data parsing & normalization**

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test tests/spotify.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement SpotifyService**

Supports both real Spotify OAuth (`/v1/me/player/currently-playing`) and simulated playback (for demo/offline mode).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test tests/spotify.test.ts`
Expected: PASS

---

### Task 5: Sync Service (Precision Karaoke Interpolator & State Hub)

**Files:**
- Create: `backend/src/services/sync.service.ts`
- Create: `backend/tests/sync.test.ts`

**Interfaces:**
- Consumes: `SpotifyService`, `LyricsService`, `DiscordService`
- Produces:
  - `SyncState { isSyncing: boolean; track: CurrentPlayback | null; lyrics: LyricLine[]; activeIndex: number; offsetMs: number; currentStatus: string; }`
  - `SyncService.start(): void`
  - `SyncService.stop(): void`
  - `SyncService.setOffset(offsetMs: number): void`
  - `SyncService.getState(): SyncState`
  - `SyncService.onTick(listener: (state: SyncState) => void): void`

- [ ] **Step 1: Write test for active line binary search and interpolation**

Validates that given timestamp sequence and offset, the exact active line index is returned.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test tests/sync.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement SyncService ticker loop**

Runs an internal 250ms high-resolution timer loop: interpolates progress, determines active lyric line, and calls `DiscordService.updateStatus` only on line transition.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test tests/sync.test.ts`
Expected: PASS

---

### Task 6: Backend HTTP API & WebSocket Server

**Files:**
- Create: `backend/src/routes/api.routes.ts`
- Create: `backend/src/ws/socket.ts`
- Create: `backend/src/index.ts`
- Create: `backend/tests/api.test.ts`

**Interfaces:**
- Produces:
  - REST endpoints (`/api/status`, `/api/sync/toggle`, `/api/sync/offset`, `/api/config`, `/api/demo/toggle`)
  - WebSocket at `ws://localhost:3001/ws` broadcasting `SYNC_STATE` events.

- [ ] **Step 1: Write integration test for REST endpoints**

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test tests/api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Express app, routes, and WebSocket server**

Mount routes, configure CORS for frontend, wire `SyncService` tick events to broadcast to all connected WebSocket clients, and register graceful shutdown handlers (`SIGINT`/`SIGTERM` to clear Discord status).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test tests/api.test.ts`
Expected: PASS

---

### Task 7: Frontend Scaffolding & Glassmorphism Design System

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/index.css`
- Create: `frontend/src/types.ts`

**Interfaces:**
- Produces: Modern dark aesthetic CSS tokens (Glass surfaces, glowing gradients, Spotify Green `#1DB954`, Discord Blurple `#5865F2`, typography).

- [ ] **Step 1: Initialize Vite React TypeScript project in frontend/**

- [ ] **Step 2: Create custom design tokens and utilities in frontend/src/index.css**

Implement curated HSL color palette, glassmorphism backdrop blur cards, custom scrollbars, and keyframe animations for lyric glow and pulse.

- [ ] **Step 3: Verify frontend build compiles without errors**

Run: `npm --prefix frontend run build`
Expected: PASS

---

### Task 8: Frontend Components & Live Dashboard

**Files:**
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/PlayerCard.tsx`
- Create: `frontend/src/components/LyricsView.tsx`
- Create: `frontend/src/components/DiscordPreview.tsx`
- Create: `frontend/src/components/SettingsModal.tsx`
- Create: `frontend/src/hooks/useSyncSocket.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: Complete interactive web application.
  - Live Karaoke scrolling with smooth centering.
  - Interactive Discord profile badge preview showing live status updates.
  - Controls for Start/Stop, Offset slider (-2000ms to +2000ms), and Demo Mode toggle.
  - Modal for configuring Discord Token, Spotify App credentials, and custom emoji.

- [ ] **Step 1: Implement useSyncSocket hook**

Handles WebSocket connection to `ws://localhost:3001/ws`, auto-reconnect, and state synchronization.

- [ ] **Step 2: Implement PlayerCard and DiscordPreview components**

- [ ] **Step 3: Implement LyricsView with auto-scroll and highlight animation**

- [ ] **Step 4: Implement SettingsModal and Header controls**

- [ ] **Step 5: Assemble App.tsx layout and test compilation**

Run: `npm --prefix frontend run build`
Expected: PASS

---

### Task 9: Full Integration, End-to-End Verification & Documentation

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `backend/.env.example`

- [ ] **Step 1: Create comprehensive README.md with clear setup instructions**

How to obtain Discord Token safely, how to set up Spotify App (or use simulated Demo Mode with 1-click), how to run `npm run dev`.

- [ ] **Step 2: Start backend and frontend simultaneously and verify in browser**

Verify with browser subagent or curl test that the backend responds on `http://localhost:3001/api/status` and frontend loads at `http://localhost:5173`.
