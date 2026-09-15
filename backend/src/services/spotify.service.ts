import { CurrentPlayback, SpotifyTokens } from "../types/spotify.js";
import { fetchWithProxy } from "../utils/proxy.js";
import { LocalMediaService } from "./local-media.service.js";

export interface SpotifyServiceOptions {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  demoMode?: boolean;
}

export class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string;
  private tokenExpiresAt = 0;
  private demoMode: boolean;
  private localMediaService = new LocalMediaService();

  // Demo playback simulation state
  private demoStartTime = Date.now();
  private readonly demoTrackDuration = 212000; // 3m 32s (Rick Astley - Never Gonna Give You Up)

  constructor(options: SpotifyServiceOptions) {
    this.clientId = options.clientId || "";
    this.clientSecret = options.clientSecret || "";
    this.refreshToken = options.refreshToken || "";
    this.accessToken = options.accessToken || "";
    this.demoMode = options.demoMode ?? false;
  }

  public setCredentials(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): void {
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();
    this.refreshToken = refreshToken.trim();
  }

  public setDemoMode(enabled: boolean): void {
    this.demoMode = enabled;
    if (enabled) {
      this.demoStartTime = Date.now();
    }
  }

  public isDemo(): boolean {
    return this.demoMode;
  }

  public dispose(): void {
    this.localMediaService.dispose();
  }

  public normalizePlayback(raw: any): CurrentPlayback | null {
    if (!raw || !raw.item) return null;

    const item = raw.item;
    const artists = Array.isArray(item.artists)
      ? item.artists.map((a: any) => a.name).join(", ")
      : "Unknown Artist";

    const albumArt =
      item.album?.images?.[0]?.url ||
      item.album?.images?.[1]?.url ||
      "";

    return {
      id: item.id || `track-${Date.now()}`,
      name: item.name || "Unknown Track",
      artist: artists,
      album: item.album?.name || "",
      albumArt,
      durationMs: item.duration_ms || 180000,
      progressMs: raw.progress_ms ?? 0,
      isPlaying: Boolean(raw.is_playing),
      fetchTime: Date.now(),
      isDemo: false,
    };
  }

  /**
   * Refreshes access token via Spotify Accounts API
   */
  public async refreshAccessToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      return null;
    }

    try {
      const basic = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString("base64");

      const response = await fetchWithProxy("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        console.error(
          "[SpotifyService] Token refresh failed:",
          response.status,
          response.statusText
        );
        return null;
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };

      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }

      return this.accessToken;
    } catch (err) {
      console.error("[SpotifyService] Token refresh error:", err);
      return null;
    }
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    return await this.refreshAccessToken();
  }

  public getAuthUrl(redirectUri: string, state?: string): string {
    const scopes = ["user-read-currently-playing", "user-read-playback-state"];
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      scope: scopes.join(" "),
      redirect_uri: redirectUri,
    });
    if (state) params.set("state", state);
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  public async handleAuthCallback(
    code: string,
    redirectUri: string
  ): Promise<SpotifyTokens | null> {
    try {
      const basic = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString("base64");

      const response = await fetchWithProxy("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        console.error("[SpotifyService] Auth callback error:", response.status, response.statusText);
        return null;
      }

      const data = (await response.json()) as any;
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.tokenExpiresAt,
      };
    } catch (err) {
      console.error("[SpotifyService] handleAuthCallback exception:", err);
      return null;
    }
  }

  /**
   * Fetches currently playing song:
   * 1. Ultra-fast local Windows Spotify detection (0ms latency, zero configuration)
   * 2. Spotify Web API if valid token exists
   * 3. Fallback to demo mode if active
   */
  public async getCurrentlyPlaying(): Promise<CurrentPlayback | null> {
    // Demo mode must be deterministic and must not be replaced by another
    // Windows media session (for example, a browser tab playing audio).
    if (this.demoMode) {
      return this.getSimulatedPlayback();
    }

    // 1. High-speed local Windows Spotify detection
    try {
      const local = await this.localMediaService.getCurrentlyPlaying();
      if (local && local.isPlaying) {
        return local;
      }
    } catch {}

    // 2. Spotify Web API if valid token exists
    const token = await this.getValidAccessToken();
    if (token) {
      try {
        const response = await fetchWithProxy(
          "https://api.spotify.com/v1/me/player/currently-playing",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 204 || response.status === 404) {
          return null;
        }

        if (response.ok) {
          const raw = await response.json();
          return this.normalizePlayback(raw);
        }
      } catch (err) {
        console.error("[SpotifyService] Error fetching currently-playing:", err);
      }
    }

    return null;
  }

  private getSimulatedPlayback(): CurrentPlayback {
    const elapsed = (Date.now() - this.demoStartTime) % this.demoTrackDuration;

    return {
      id: "demo-rick-astley-01",
      name: "Never Gonna Give You Up",
      artist: "Rick Astley",
      album: "Whenever You Need Somebody",
      albumArt:
        "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80",
      durationMs: this.demoTrackDuration,
      progressMs: elapsed,
      isPlaying: true,
      fetchTime: Date.now(),
      isDemo: true,
    };
  }
}
