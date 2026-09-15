export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface CurrentPlayback {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  isDemo?: boolean;
}

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
  demoMode?: boolean;
  hasDiscordToken?: boolean;
  hasSpotifyAuth?: boolean;
}
