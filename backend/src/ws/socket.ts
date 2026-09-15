import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { SyncService, SyncState } from "../services/sync.service.js";

export function setupWebSocket(
  server: Server,
  syncService: SyncService
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const broadcast = (data: any) => {
    const payload = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  wss.on("connection", (ws) => {
    // Send immediate snapshot of current state
    const currentState = syncService.getState();
    ws.send(JSON.stringify({ type: "SYNC_STATE", data: currentState }));

    ws.on("message", async (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === "TOGGLE_SYNC") {
          const state = syncService.getState();
          if (state.isSyncing) {
            await syncService.stop();
          } else {
            syncService.start();
          }
        }
      } catch {
        // Ignore invalid messages
      }
    });
  });

  // Wire syncService tick to WebSocket clients
  syncService.onTick((state: SyncState) => {
    broadcast({ type: "SYNC_STATE", data: state });
  });

  return wss;
}
