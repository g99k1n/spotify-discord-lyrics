import { describe, it, expect } from "vitest";
import { parseLrc, LyricsService } from "../src/services/lyrics.service.js";

describe("LRC Parser & LyricsService", () => {
  it("should parse standard LRC format correctly", () => {
    const lrc = `
[ti:Never Gonna Give You Up]
[ar:Rick Astley]
[00:18.50] We're no strangers to love
[00:22.80] You know the rules and so do I
[00:27.10] A full commitment's what I'm thinking of
    `.trim();

    const lines = parseLrc(lrc);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({
      timeMs: 18500,
      text: "We're no strangers to love",
    });
    expect(lines[1]).toEqual({
      timeMs: 22800,
      text: "You know the rules and so do I",
    });
    expect(lines[2]).toEqual({
      timeMs: 27100,
      text: "A full commitment's what I'm thinking of",
    });
  });

  it("should filter out empty lines or metadata lines", () => {
    const lrc = `
[length:03:32]
[00:05.10] 
[00:08.25] Real lyric line
[00:12.00]    
    `.trim();

    const lines = parseLrc(lrc);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Real lyric line");
    expect(lines[0].timeMs).toBe(8250);
  });

  it("should sort lines chronologically if they appear out of order", () => {
    const lrc = `
[00:30.00] Line 2
[00:10.00] Line 1
    `.trim();

    const lines = parseLrc(lrc);
    expect(lines[0].text).toBe("Line 1");
    expect(lines[1].text).toBe("Line 2");
  });

  it("should retrieve lyrics from cache if already requested", async () => {
    const service = new LyricsService();
    const mockTrack = "Mock Track";
    const mockArtist = "Mock Artist";
    const cacheKey = `${mockArtist} - ${mockTrack}`.toLowerCase();

    // Seed cache
    service.setCache(cacheKey, [
      { timeMs: 1000, text: "Cached line" },
    ]);

    const result = await service.getLyrics(mockArtist, mockTrack);
    expect(result).not.toBeNull();
    expect(result?.lines[0].text).toBe("Cached line");
  });
});
