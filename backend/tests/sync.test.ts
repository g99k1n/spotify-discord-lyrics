import { describe, it, expect } from "vitest";
import { findActiveLineIndex } from "../src/services/sync.service.js";
import { LyricLine } from "../src/types/lyrics.js";

describe("SyncService Line Matching", () => {
  const mockLines: LyricLine[] = [
    { timeMs: 10000, text: "Line 1 (10s)" },
    { timeMs: 20000, text: "Line 2 (20s)" },
    { timeMs: 35000, text: "Line 3 (35s)" },
  ];

  it("should return -1 when playback is before first line", () => {
    expect(findActiveLineIndex(mockLines, 5000)).toBe(-1);
    expect(findActiveLineIndex(mockLines, 0)).toBe(-1);
  });

  it("should return exact index when playback matches line start", () => {
    expect(findActiveLineIndex(mockLines, 10000)).toBe(0);
    expect(findActiveLineIndex(mockLines, 20000)).toBe(1);
    expect(findActiveLineIndex(mockLines, 35000)).toBe(2);
  });

  it("should return correct index between line intervals", () => {
    expect(findActiveLineIndex(mockLines, 15000)).toBe(0);
    expect(findActiveLineIndex(mockLines, 25000)).toBe(1);
  });

  it("should return last line index if playback is beyond all lines", () => {
    expect(findActiveLineIndex(mockLines, 60000)).toBe(2);
  });

  it("should handle empty lines array safely", () => {
    expect(findActiveLineIndex([], 10000)).toBe(-1);
  });
});
