import { describe, it, expect, beforeEach } from "vitest";
import { SpotifyService } from "../src/services/spotify.service.js";

describe("SpotifyService", () => {
  let service: SpotifyService;

  beforeEach(() => {
    service = new SpotifyService({
      clientId: "mock-client-id",
      clientSecret: "mock-secret",
      refreshToken: "mock-refresh",
      demoMode: false,
    });
  });

  it("should normalize raw Spotify API currently-playing response", () => {
    const rawApiPayload = {
      is_playing: true,
      progress_ms: 45000,
      item: {
        id: "spotify-track-123",
        name: "Blinding Lights",
        duration_ms: 200000,
        artists: [{ name: "The Weeknd" }],
        album: {
          name: "After Hours",
          images: [{ url: "https://example.com/cover.jpg" }],
        },
      },
    };

    const normalized = service.normalizePlayback(rawApiPayload);
    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe("spotify-track-123");
    expect(normalized?.name).toBe("Blinding Lights");
    expect(normalized?.artist).toBe("The Weeknd");
    expect(normalized?.albumArt).toBe("https://example.com/cover.jpg");
    expect(normalized?.progressMs).toBe(45000);
    expect(normalized?.isPlaying).toBe(true);
  });

  it("should return null if nothing is currently playing", () => {
    const normalized = service.normalizePlayback(null);
    expect(normalized).toBeNull();
  });

  it("should include the supplied OAuth state in the authorization URL", () => {
    const url = new URL(
      service.getAuthUrl("http://127.0.0.1:3001/api/auth/spotify/callback", "csrf-state")
    );

    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:3001/api/auth/spotify/callback"
    );
  });

  it("should provide working simulated playback in demo mode", async () => {
    const demoService = new SpotifyService({
      clientId: "",
      clientSecret: "",
      refreshToken: "",
      demoMode: true,
    });

    const playback1 = await demoService.getCurrentlyPlaying();
    expect(playback1).not.toBeNull();
    expect(playback1?.isPlaying).toBe(true);
    expect(playback1?.name).toBeDefined();
    expect(playback1?.isDemo).toBe(true);
  });
});
