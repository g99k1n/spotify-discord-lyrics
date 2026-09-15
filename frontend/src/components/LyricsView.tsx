import React, { useEffect, useRef } from "react";
import { Mic2, ListMusic } from "lucide-react";
import { LyricLine } from "../types";

interface LyricsViewProps {
  lyrics: LyricLine[];
  activeIndex: number;
  isSyncing: boolean;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  lyrics,
  activeIndex,
  isSyncing,
}) => {
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll active line into center
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="glass-panel lyrics-panel" style={{ alignItems: "center", justifyContent: "center" }}>
        <Mic2 size={48} color="#64748b" style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 20, color: "#94a3b8" }}>Waiting for Lyrics</h3>
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 6, textAlign: "center", maxWidth: 400 }}>
          {isSyncing
            ? "Searching synced LRC database for currently playing song..."
            : "Click 'Start Sync' to start synchronizing lyrics with Discord."}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel lyrics-panel">
      <div className="lyrics-header">
        <div className="lyrics-title-group">
          <Mic2 size={20} color="#1db954" />
          <h2>Synchronized Karaoke Lyrics</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#94a3b8" }}>
          <ListMusic size={16} />
          <span>{lyrics.length} lines</span>
        </div>
      </div>

      <div className="lyrics-scroll-box" ref={scrollContainerRef}>
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;
          const isPassed = index < activeIndex;

          return (
            <div
              key={`${line.timeMs}-${index}`}
              ref={isActive ? activeLineRef : null}
              className={`lyric-line ${isActive ? "active" : ""} ${
                isPassed ? "passed" : ""
              }`}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
