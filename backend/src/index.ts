import express from "express";
import http from "http";
import cors from "cors";
import { config } from "./config.js";
import { SpotifyService } from "./services/spotify.service.js";
import { LyricsService } from "./services/lyrics.service.js";
import { DiscordService } from "./services/discord.service.js";
import { SyncService } from "./services/sync.service.js";
import { createApiRouter } from "./routes/api.routes.js";
import { setupWebSocket } from "./ws/socket.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json());

  // Instantiate Core Services
  const spotifyService = new SpotifyService({
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
    refreshToken: config.spotifyRefreshToken,
    demoMode: config.demoMode,
  });

  const lyricsService = new LyricsService();

  const discordService = new DiscordService({
    token: config.discordToken,
    minIntervalMs: config.minDiscordIntervalMs,
    maxStatusLength: config.maxStatusLength,
  });

  const syncService = new SyncService(
    spotifyService,
    lyricsService,
    discordService
  );

  syncService.setOffset(config.offsetMs);
  syncService.setStatusFormat(config.statusPrefix, config.statusEmoji);

  // Mount API router
  const apiRouter = createApiRouter(
    syncService,
    spotifyService,
    discordService,
    config
  );
  app.use("/api", apiRouter);

  return { app, syncService, spotifyService, discordService };
}

// Start server if executed directly
if (process.env.NODE_ENV !== "test") {
  const { app, syncService, spotifyService } = createApp();
  const server = http.createServer(app);

  setupWebSocket(server, syncService);

  server.listen(config.port, "127.0.0.1", () => {
    console.log(`[Backend] Server listening on http://localhost:${config.port}`);
    console.log(`[Backend] WebSocket available at ws://localhost:${config.port}/ws`);
    console.log(`[Backend] Demo Mode is ${config.demoMode ? "ACTIVE (simulated playback)" : "OFF"}`);
    syncService.start();
    console.log(`[Backend] Auto-sync started.`);
  });

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log("\n[Backend] Shutting down, resetting Discord status...");
    await syncService.stop();
    spotifyService.dispose();
    server.close(() => {
      console.log("[Backend] Server closed cleanly.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
