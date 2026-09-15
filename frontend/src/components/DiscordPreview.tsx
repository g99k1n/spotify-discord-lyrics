import React from "react";
import { MessageSquare, ShieldAlert, Sparkles } from "lucide-react";

interface DiscordPreviewProps {
  statusText: string;
  emojiName: string;
  prefix: string;
  isSyncing: boolean;
  throttled: boolean;
  hasToken: boolean;
  onOpenSettings: () => void;
}

export const DiscordPreview: React.FC<DiscordPreviewProps> = ({
  statusText,
  emojiName,
  prefix,
  isSyncing,
  throttled,
  hasToken,
  onOpenSettings,
}) => {
  const displayStatus = isSyncing && statusText
    ? `${prefix}${statusText}`
    : isSyncing
    ? `${prefix}Listening to Spotify...`
    : "No active status";

  return (
    <div className="discord-card">
      <div className="discord-header">
        <MessageSquare size={14} color="#5865f2" />
        <span>Live Discord Profile Preview</span>
      </div>

      <div className="discord-profile">
        <div className="avatar-wrapper">
          <img
            src="https://cdn.discordapp.com/embed/avatars/0.png"
            alt="Discord Avatar"
            className="avatar-img"
          />
          <div className="status-indicator" />
        </div>

        <div className="discord-user-meta">
          <div className="discord-username">Your Discord Account</div>
          <div className="discord-status-bubble" id="discord-status-bubble">
            {emojiName ? <span style={{ fontSize: "16px" }}>{emojiName}</span> : null}
            <span
              style={{
                fontStyle: isSyncing && statusText ? "normal" : "italic",
                color: isSyncing && statusText ? "#f2f3f5" : "#94a3b8",
              }}
            >
              {displayStatus}
            </span>
          </div>
        </div>
      </div>

      {throttled && (
        <div className="throttled-notice">
          <ShieldAlert size={14} />
          <span>Anti-Rate-Limit Protection: throttled to safe 2.5s delay</span>
        </div>
      )}

      {!hasToken && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px 12px",
            background: "rgba(88, 101, 242, 0.12)",
            borderRadius: "8px",
            border: "1px solid rgba(88, 101, 242, 0.25)",
            fontSize: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#c7d2fe", display: "flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={14} /> Demo preview active. Connect token for real Discord sync.
          </span>
          <button
            style={{
              background: "#5865f2",
              border: "none",
              color: "#fff",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={onOpenSettings}
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
};
