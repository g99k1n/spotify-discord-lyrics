export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface ParsedLyrics {
  isSynced: boolean;
  lines: LyricLine[];
  rawLrc?: string;
  source: "lrclib" | "cache" | "demo";
}

export interface LrclibResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}
