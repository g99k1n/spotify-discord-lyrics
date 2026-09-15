import React from "react";
import { Music, Clock, Plus, Minus, RotateCcw } from "lucide-react";
import { CurrentPlayback } from "../types";

interface PlayerCardProps {
  track: CurrentPlayback | null;
  progressMs: number;
  offsetMs: number;
  onSetOffset: (offset: number) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  track,
  progressMs,
  offsetMs,
  onSetOffset,
}) => {
  if (!track) {
    return (
      <div className="glass-panel player-card" style={{ alignItems: "center", justifyContent: "center", minHeight: 320, textAlign: "center" }}>
        <Music size={48} color="#64748b" style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 18, color: "#94a3b8" }}>No Track Playing</h3>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Play a song on Spotify or turn on Demo Mode above.
        </p>
      </div>
    );
  }

  const durationMs = track.durationMs || 1;
  const progressPercent = Math.min(100, Math.max(0, (progressMs / durationMs) * 100));

  return (
    <div className="glass-panel player-card">
      <div className="album-art-wrap">
        <img
          src={track.albumArt || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80"}
          alt={track.name}
          className="album-art-img"
        />
        {track.isPlaying && (
          <div className="playing-badge">
            <div className="pulse-dot" />
            <span>PLAYING</span>
          </div>
        )}
      </div>

      <div className="track-info">
        <div className="track-title" title={track.name}>
          {track.name}
        </div>
        <div className="track-artist">{track.artist}</div>
        {track.album && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {track.album}
          </div>
        )}
      </div>

      {/* Progress Track */}
      <div className="progress-container">
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="time-row">
          <span>{formatTime(progressMs)}</span>
          <span>{formatTime(track.durationMs)}</span>
        </div>
      </div>

      {/* Quick Offset Adjuster */}
      <div className="offset-bar">
        <Clock size={16} color="#94a3b8" />
        <span style={{ flex: 1 }}>Sync Delay: <b>{offsetMs > 0 ? `+${offsetMs}` : offsetMs} ms</b></span>
        <button
          className="offset-btn"
          onClick={() => onSetOffset(offsetMs - 200)}
          title="Speed up lyrics by 200ms"
        >
          <Minus size={12} /> 200ms
        </button>
        <button
          className="offset-btn"
          onClick={() => onSetOffset(offsetMs + 200)}
          title="Delay lyrics by 200ms"
        >
          <Plus size={12} /> 200ms
        </button>
        {offsetMs !== 0 && (
          <button
            className="offset-btn"
            onClick={() => onSetOffset(0)}
            title="Reset delay to 0ms"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
