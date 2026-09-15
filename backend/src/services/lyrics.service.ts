import { LyricLine, ParsedLyrics, LrclibResponse } from "../types/lyrics.js";
import { fetchWithProxy } from "../utils/proxy.js";

/**
 * Parse an LRC-formatted string into sorted LyricLine array
 */
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];

  const lines: LyricLine[] = [];
  const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  const rawLines = lrcText.split(/\r?\n/);

  for (const rawLine of rawLines) {
    lineRegex.lastIndex = 0;
    const match = lineRegex.exec(rawLine.trim());
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let millis = parseInt(match[3], 10);

      // Normalize 2-digit centiseconds to milliseconds
      if (match[3].length === 2) {
        millis *= 10;
      }

      const timeMs = minutes * 60 * 1000 + seconds * 1000 + millis;
      const text = match[4].trim();

      if (text.length > 0) {
        lines.push({ timeMs, text });
      }
    }
  }

  // Ensure lines are sorted chronologically
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

export function cleanTitle(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/\s*-\s*(Remastered|Bonus Track|Live|Radio Edit|Acoustic|Single Version|Deluxe|Original Mix).*$/i, "")
    .replace(/\s*[\(\[](feat\.|with|ft\.).*?[\)\]]/i, "")
    .replace(/\s*[\(\[](Remastered|Live|Official|Audio|Music Video).*?[\)\]]/i, "")
    .trim();
}

export class LyricsService {
  private cache = new Map<string, LyricLine[]>();
  private readonly baseUrl = "https://lrclib.net/api";

  private makeCacheKey(artist: string, track: string): string {
    return `${artist.trim().toLowerCase()} - ${track.trim().toLowerCase()}`;
  }

  public setCache(key: string, lines: LyricLine[]): void {
    this.cache.set(key, lines);
  }

  /**
   * Fast parallel fetch for synced lyrics
   */
  public async getLyrics(
    artist: string,
    track: string,
    _durationSeconds?: number
  ): Promise<ParsedLyrics | null> {
    const rawKey = this.makeCacheKey(artist, track);
    if (this.cache.has(rawKey)) {
      return { isSynced: true, lines: this.cache.get(rawKey)!, source: "cache" };
    }

    const cleanedTrack = cleanTitle(track);
    const cleanedKey = this.makeCacheKey(artist, cleanedTrack);
    if (this.cache.has(cleanedKey)) {
      return { isSynced: true, lines: this.cache.get(cleanedKey)!, source: "cache" };
    }

    // Try fetching concurrently: exact /get without strict duration + search
    try {
      const getQuery = async (tName: string): Promise<ParsedLyrics | null> => {
        try {
          const url = `${this.baseUrl}/get?artist_name=${encodeURIComponent(
            artist
          )}&track_name=${encodeURIComponent(tName)}`;

          const res = await fetchWithProxy(url, {
            headers: { "User-Agent": "SpotifyDiscordLyrics/1.0.0" },
            signal: AbortSignal.timeout(4000),
          });

          if (!res.ok) return null;
          const data = (await res.json()) as LrclibResponse;
          if (data.syncedLyrics) {
            const parsed = parseLrc(data.syncedLyrics);
            if (parsed.length > 0) {
              return { isSynced: true, lines: parsed, rawLrc: data.syncedLyrics, source: "lrclib" };
            }
          }
          return null;
        } catch {
          return null;
        }
      };

      const searchQuery = async (q: string): Promise<ParsedLyrics | null> => {
        try {
          const url = `${this.baseUrl}/search?q=${encodeURIComponent(q)}`;
          const res = await fetchWithProxy(url, {
            headers: { "User-Agent": "SpotifyDiscordLyrics/1.0.0" },
            signal: AbortSignal.timeout(4000),
          });

          if (!res.ok) return null;
          const list = (await res.json()) as LrclibResponse[];
          if (!Array.isArray(list)) return null;

          const match = list.find((item) => Boolean(item.syncedLyrics));
          if (match?.syncedLyrics) {
            const parsed = parseLrc(match.syncedLyrics);
            if (parsed.length > 0) {
              return { isSynced: true, lines: parsed, rawLrc: match.syncedLyrics, source: "lrclib" };
            }
          }
          return null;
        } catch {
          return null;
        }
      };

      // Run parallel requests: /get with clean title, /get with raw title, /search
      const candidates = [
        getQuery(cleanedTrack),
        searchQuery(`${artist} ${cleanedTrack}`),
      ];

      if (cleanedTrack !== track) {
        candidates.push(getQuery(track));
      }

      // Return whichever finishes first with valid lyrics
      const results = await Promise.allSettled(candidates);
      for (const res of results) {
        if (res.status === "fulfilled" && res.value && res.value.lines.length > 0) {
          this.cache.set(rawKey, res.value.lines);
          this.cache.set(cleanedKey, res.value.lines);
          return res.value;
        }
      }

      return null;
    } catch (err) {
      console.error("[LyricsService] Error fetching lyrics:", err);
      return null;
    }
  }
}
