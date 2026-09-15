import { useState, useEffect, useCallback, useRef } from "react";
import { SyncState } from "../types";

export interface AppConfigInput {
  discordToken?: string;
  statusPrefix: string;
  statusEmoji: string;
  offsetMs: number;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  spotifyRefreshToken?: string;
}

export function useSyncSocket() {
  const [state, setState] = useState<SyncState>({
    isSyncing: false,
    track: null,
    lyrics: [],
    activeIndex: -1,
    activeLyricText: "",
    progressMs: 0,
    offsetMs: 0,
    statusPrefix: "",
    statusEmoji: "",
    discordThrottled: false,
    demoMode: true,
  });

  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Initial fetch via REST API
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({ ...prev, ...data }));
      }
    } catch {
      // Backend might still be starting up
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Setup WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host; // proxied through vite or direct
    const wsUrl = `${protocol}//${host}/ws`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let isDisposed = false;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "SYNC_STATE") {
            setState((prev) => ({ ...prev, ...message.data }));
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!isDisposed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    // Fallback polling every 3s in case WS is interrupted
    const pollInterval = setInterval(fetchStatus, 3000);

    return () => {
      isDisposed = true;
      clearInterval(pollInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [fetchStatus]);

  const toggleSync = async () => {
    try {
      const res = await fetch("/api/sync/toggle", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to toggle sync:", err);
    }
  };

  const setOffset = async (newOffsetMs: number) => {
    try {
      setState((prev) => ({ ...prev, offsetMs: newOffsetMs }));
      await fetch("/api/sync/offset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offsetMs: newOffsetMs }),
      });
    } catch (err) {
      console.error("Failed to set offset:", err);
    }
  };

  const saveConfig = async (newConfig: AppConfigInput): Promise<boolean> => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        fetchStatus();
        return true;
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    }
    return false;
  };

  const toggleDemo = async () => {
    try {
      const res = await fetch("/api/demo/toggle", { method: "POST" });
      if (res.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error("Failed to toggle demo:", err);
    }
  };

  return {
    state,
    connected,
    toggleSync,
    setOffset,
    saveConfig,
    toggleDemo,
    refreshStatus: fetchStatus,
  };
}
