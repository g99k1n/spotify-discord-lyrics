import { LyricLine } from "../types/lyrics.js";
import { CurrentPlayback } from "../types/spotify.js";
import { LyricsService } from "./lyrics.service.js";
import { SpotifyService } from "./spotify.service.js";
import { DiscordService } from "./discord.service.js";

export interface SyncState {
  isSyncing: boolean;
  track: CurrentPlayback | null;
  lyrics: LyricLine[];
  activeIndex: number;
  activeLyricText: string;
  progressMs: number;
  offsetMs: number;
  statusPrefix: string;
  statusEmoji: string;
  discordThrottled: boolean;
}

/**
 * Binary search or linear match to find active line index at timestamp currentMs
 */
export function findActiveLineIndex(
  lines: LyricLine[],
  currentMs: number
): number {
  if (!lines || lines.length === 0) return -1;
  if (currentMs < lines[0].timeMs) return -1;

  let low = 0;
  let high = lines.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].timeMs <= currentMs) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

export class SyncService {
  private spotifyService: SpotifyService;
  private lyricsService: LyricsService;
  private discordService: DiscordService;

  private isSyncing = false;
  private currentTrack: CurrentPlayback | null = null;
  private currentLyrics: LyricLine[] = [];
  private activeIndex = -1;
  private activeLyricText = "";
  private lastProgressMs = 0;
  private lastFetchTime = 0;
  private offsetMs = 0;
  private statusPrefix = "🎵 ";
  private statusEmoji = "🎶";
  private discordThrottled = false;

  private tickTimer?: NodeJS.Timeout;
  private pollTimer?: NodeJS.Timeout;
  private pollInFlight = false;
  private tickInFlight = false;
  private listeners: ((state: SyncState) => void)[] = [];

  constructor(
    spotifyService: SpotifyService,
    lyricsService: LyricsService,
    discordService: DiscordService
  ) {
    this.spotifyService = spotifyService;
    this.lyricsService = lyricsService;
    this.discordService = discordService;
  }

  public setOffset(offsetMs: number): void {
    this.offsetMs = offsetMs;
  }

  public setStatusFormat(prefix: string, emoji: string): void {
    this.statusPrefix = prefix;
    this.statusEmoji = emoji;
  }

  public onTick(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getState(): SyncState {
    const currentMs = this.calculateCurrentMs();
    return {
      isSyncing: this.isSyncing,
      track: this.currentTrack,
      lyrics: this.currentLyrics,
      activeIndex: this.activeIndex,
      activeLyricText: this.activeLyricText,
      progressMs: currentMs,
      offsetMs: this.offsetMs,
      statusPrefix: this.statusPrefix,
      statusEmoji: this.statusEmoji,
      discordThrottled: this.discordThrottled,
    };
  }

  public calculateCurrentMs(): number {
    if (!this.currentTrack || !this.currentTrack.isPlaying) {
      return this.lastProgressMs;
    }
    const elapsed = Date.now() - this.lastFetchTime;
    return Math.max(
      0,
      Math.min(
        this.lastProgressMs + elapsed + this.offsetMs,
        this.currentTrack.durationMs
      )
    );
  }

  public start(): void {
    if (this.isSyncing) return;
    this.isSyncing = true;

    // Start background loops
    this.pollSpotify();
    this.pollTimer = setInterval(() => this.pollSpotify(), 600);
    this.tickTimer = setInterval(() => this.tick(), 250);

    this.notifyState();
  }

  public async stop(): Promise<void> {
    if (!this.isSyncing) return;
    this.isSyncing = false;

    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.pollTimer = undefined;
    this.tickTimer = undefined;

    // Reset status on Discord
    await this.discordService.clearStatus();
    this.activeLyricText = "";
    this.activeIndex = -1;
    this.lastSyncedTrackId = null;
    this.lastSyncedStatusText = "";

    this.notifyState();
  }

  /**
   * Periodic Spotify track check (1.8s)
   */
  private async pollSpotify(): Promise<void> {
    if (!this.isSyncing || this.pollInFlight) return;
    this.pollInFlight = true;

    try {
      const playback = await this.spotifyService.getCurrentlyPlaying();
      if (!playback) {
        if (this.currentTrack) {
          this.currentTrack = null;
          this.currentLyrics = [];
          this.activeIndex = -1;
          this.activeLyricText = "";
          await this.discordService.clearStatus();
          this.lastSyncedTrackId = null;
          this.lastSyncedStatusText = "";
        }
        return;
      }

      const isNewTrack = !this.currentTrack || this.currentTrack.id !== playback.id;

      this.currentTrack = playback;
      this.lastProgressMs = playback.progressMs;
      this.lastFetchTime = playback.fetchTime;

      if (isNewTrack) {
        this.currentLyrics = [];
        this.activeIndex = -1;
        this.activeLyricText = "";
        this.lastSyncedTrackId = null;
        this.lastSyncedStatusText = "";
        await this.loadLyricsForTrack(playback);
      }

      if (!playback.isPlaying && this.lastSyncedStatusText) {
        await this.discordService.clearStatus();
        this.lastSyncedTrackId = null;
        this.lastSyncedStatusText = "";
      }
    } catch (err) {
      console.error("[SyncService] poll error:", err);
    } finally {
      this.pollInFlight = false;
    }
  }

  private async loadLyricsForTrack(track: CurrentPlayback): Promise<void> {
    if (track.isDemo) {
      // Provide built-in demo synced lyrics for instant testing
      this.currentLyrics = [
        { timeMs: 0, text: "🎶 [Instrumental Intro] 🎶" },
        { timeMs: 18500, text: "We're no strangers to love" },
        { timeMs: 22800, text: "You know the rules and so do I" },
        { timeMs: 27100, text: "A full commitment's what I'm thinking of" },
        { timeMs: 31400, text: "You wouldn't get this from any other guy" },
        { timeMs: 35700, text: "I just wanna tell you how I'm feeling" },
        { timeMs: 40000, text: "Gotta make you understand" },
        { timeMs: 43200, text: "Never gonna give you up" },
        { timeMs: 45400, text: "Never gonna let you down" },
        { timeMs: 47600, text: "Never gonna run around and desert you" },
        { timeMs: 51800, text: "Never gonna make you cry" },
        { timeMs: 53900, text: "Never gonna say goodbye" },
        { timeMs: 56100, text: "Never gonna tell a lie and hurt you" },
      ];
      return;
    }

    const lyricsData = await this.lyricsService.getLyrics(
      track.artist,
      track.name,
      track.durationMs / 1000
    );

    if (lyricsData && lyricsData.lines.length > 0) {
      this.currentLyrics = lyricsData.lines;
    } else {
      this.currentLyrics = [
        { timeMs: 0, text: `Listening to: ${track.name} by ${track.artist}` },
      ];
    }
  }

  private lastSyncedTrackId: string | null = null;
  private lastSyncedStatusText = "";

  /**
   * Fast tick loop (every 250ms) for lyric line transitions
   */
  private async tick(): Promise<void> {
    if (this.tickInFlight) return;
    this.tickInFlight = true;

    if (!this.isSyncing || !this.currentTrack || !this.currentTrack.isPlaying) {
      this.notifyState();
      this.tickInFlight = false;
      return;
    }

    try {
      const currentMs = this.calculateCurrentMs();
      const newIndex = findActiveLineIndex(this.currentLyrics, currentMs);

      if (newIndex >= 0) {
        this.activeIndex = newIndex;
        const line = this.currentLyrics[newIndex];
        this.activeLyricText = line.text;
        const statusText = `${this.statusPrefix}${line.text}`;

        // Sync track and complete text, so changing tracks or formatting is not skipped.
        if (
          this.lastSyncedTrackId !== this.currentTrack.id ||
          this.lastSyncedStatusText !== statusText
        ) {
          const result = await this.discordService.updateStatus({
            text: statusText,
            emojiName: this.statusEmoji,
          });

          this.discordThrottled = Boolean(result.throttled);
          if (result.success && !result.throttled) {
            this.lastSyncedTrackId = this.currentTrack.id;
            this.lastSyncedStatusText = statusText;
          }
        }
      }

      this.notifyState();
    } finally {
      this.tickInFlight = false;
    }
  }

  private notifyState(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
