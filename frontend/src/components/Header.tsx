import React from "react";
import { Play, Square, Settings, Radio, Disc, Sparkles } from "lucide-react";
import { SyncState } from "../types";

interface HeaderProps {
  state: SyncState;
  connected: boolean;
  onToggleSync: () => void;
  onToggleDemo: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  connected,
  onToggleSync,
  onToggleDemo,
  onOpenSettings,
}) => {
  return (
    <header className="glass-panel app-header">
      <div className="logo-section">
        <div className="logo-badge">
          <Radio size={20} color="#1db954" />
          <span className="logo-title">Spotify × Discord</span>
          <span className="badge-tag">Lyrics Sync</span>
        </div>

        {/* Server & Demo Badges */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: connected ? "#4ade80" : "#f87171",
              background: "rgba(0,0,0,0.3)",
              padding: "4px 10px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: connected ? "#4ade80" : "#f87171",
              }}
            />
            {connected ? "Live Connected" : "Connecting..."}
          </span>

          {state.demoMode && (
            <span
              style={{
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "#f59e0b",
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                padding: "4px 10px",
                borderRadius: "999px",
              }}
            >
              <Sparkles size={12} />
              Demo Mode
            </span>
          )}
        </div>
      </div>

      <div className="header-actions">
        {/* Toggle Demo Button */}
        <button
          className="btn btn-secondary"
          onClick={onToggleDemo}
          title="Toggle between real Spotify OAuth and simulated demo mode"
        >
          <Disc size={16} />
          {state.demoMode ? "Switch to Live" : "Demo Mode"}
        </button>

        {/* Start / Stop Sync Button */}
        <button
          className={`btn ${state.isSyncing ? "btn-danger" : "btn-primary"}`}
          onClick={onToggleSync}
          id="toggle-sync-btn"
        >
          {state.isSyncing ? (
            <>
              <Square size={16} fill="#fff" />
              Stop Sync
            </>
          ) : (
            <>
              <Play size={16} fill="#000" />
              Start Sync
            </>
          )}
        </button>

        {/* Settings button */}
        <button
          className="btn btn-secondary"
          onClick={onOpenSettings}
          title="Configure Tokens & Preferences"
          id="open-settings-btn"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </header>
  );
};
