import React, { useEffect, useState } from "react";
import type { AppConfigInput } from "../hooks/useSyncSocket";
import { X, Key, Shield, Sliders, CheckCircle2, Eye, EyeOff } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrefix: string;
  currentEmoji: string;
  currentOffset: number;
  hasDiscordToken: boolean;
  onSave: (config: AppConfigInput) => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentPrefix,
  currentEmoji,
  currentOffset,
  hasDiscordToken,
  onSave,
}) => {
  const [discordToken, setDiscordToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [prefix, setPrefix] = useState(currentPrefix);
  const [emoji, setEmoji] = useState(currentEmoji);
  const [offset, setOffset] = useState(currentOffset);
  const [spotifyClientId, setSpotifyClientId] = useState("");
  const [spotifyClientSecret, setSpotifyClientSecret] = useState("");
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrefix(currentPrefix);
      setEmoji(currentEmoji);
      setOffset(currentOffset);
      setSavedSuccess(false);
    }
  }, [isOpen, currentPrefix, currentEmoji, currentOffset]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: AppConfigInput = {
      statusPrefix: prefix,
      statusEmoji: emoji,
      offsetMs: Number(offset),
    };

    if (discordToken.trim()) {
      payload.discordToken = discordToken.trim();
    }
    if (spotifyClientId.trim()) {
      payload.spotifyClientId = spotifyClientId.trim();
    }
    if (spotifyClientSecret.trim()) {
      payload.spotifyClientSecret = spotifyClientSecret.trim();
    }
    if (spotifyRefreshToken.trim()) {
      payload.spotifyRefreshToken = spotifyRefreshToken.trim();
    }

    const saved = await onSave(payload);
    if (!saved) return;
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sliders size={20} color="#5865f2" />
            <h3>Application Settings</h3>
          </div>
          <button
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
            }}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Discord Token */}
          <div className="form-group">
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Key size={14} color="#5865f2" />
              Discord User Token
              {hasDiscordToken && (
                <span style={{ fontSize: 11, color: "#4ade80", marginLeft: "auto" }}>
                  ● Token configured
                </span>
              )}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showToken ? "text" : "password"}
                className="form-input"
                placeholder={hasDiscordToken ? "Leave blank to keep existing token" : "Paste your Discord user token"}
                value={discordToken}
                onChange={(e) => setDiscordToken(e.target.value)}
              />
              <button
                type="button"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="help-text" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Shield size={12} /> Stored only locally on your machine.
            </span>
          </div>

          {/* Formatting */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Status Prefix</label>
              <input
                type="text"
                className="form-input"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. 🎵 "
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status Emoji</label>
              <input
                type="text"
                className="form-input"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="e.g. 🎶"
              />
            </div>
          </div>

          {/* Timing Offset */}
          <div className="form-group">
            <label className="form-label">Default Timing Offset (ms)</label>
            <input
              type="number"
              className="form-input"
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
              placeholder="e.g. 0"
            />
            <span className="help-text">
              Positive values delay the lyrics; negative values speed them up.
            </span>
          </div>

          {/* Spotify API credentials */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#1db954" }}>
              Spotify API Credentials
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Spotify Client ID"
                value={spotifyClientId}
                onChange={(e) => setSpotifyClientId(e.target.value)}
              />
              <input
                type="password"
                className="form-input"
                placeholder="Spotify Client Secret"
                value={spotifyClientSecret}
                onChange={(e) => setSpotifyClientSecret(e.target.value)}
              />
              <input
                type="password"
                className="form-input"
                placeholder="Spotify Refresh Token"
                value={spotifyRefreshToken}
                onChange={(e) => setSpotifyRefreshToken(e.target.value)}
              />
              <span className="help-text">
                Если у вас есть Refresh Token, просто вставьте его сюда и нажмите «Save Settings».
              </span>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" id="save-settings-btn">
              {savedSuccess ? (
                <>
                  <CheckCircle2 size={16} /> Saved!
                </>
              ) : (
                "Save Settings"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
