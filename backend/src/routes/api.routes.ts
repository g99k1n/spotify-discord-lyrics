import { Router } from "express";
import { SyncService } from "../services/sync.service.js";
import { SpotifyService } from "../services/spotify.service.js";
import { DiscordService } from "../services/discord.service.js";
import { AppConfig } from "../config.js";
import { randomBytes } from "crypto";

export function createApiRouter(
  syncService: SyncService,
  spotifyService: SpotifyService,
  discordService: DiscordService,
  appConfig: AppConfig
): Router {
  const router = Router();
  let spotifyOAuthState: string | null = null;

  // Health check
  router.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Current status
  router.get("/status", (_req, res) => {
    const state = syncService.getState();
    res.json({
      ...state,
      demoMode: spotifyService.isDemo(),
      hasDiscordToken: Boolean(appConfig.discordToken),
      hasSpotifyAuth: Boolean(appConfig.spotifyRefreshToken),
    });
  });

  // Toggle sync
  router.post("/sync/toggle", async (_req, res) => {
    const state = syncService.getState();
    if (state.isSyncing) {
      await syncService.stop();
    } else {
      syncService.start();
    }
    res.json(syncService.getState());
  });

  // Set timing offset in ms
  router.post("/sync/offset", (req, res) => {
    const { offsetMs } = req.body;
    if (typeof offsetMs === "number" && Number.isFinite(offsetMs)) {
      appConfig.offsetMs = offsetMs;
      syncService.setOffset(offsetMs);
      res.json({ success: true, offsetMs });
    } else {
      res.status(400).json({ error: "Invalid offsetMs" });
    }
  });

  // Update configuration
  router.post("/config", (req, res) => {
    const {
      discordToken,
      statusPrefix,
      statusEmoji,
      offsetMs,
      demoMode,
      spotifyClientId,
      spotifyClientSecret,
      spotifyRefreshToken,
    } = req.body;

    if (discordToken !== undefined && typeof discordToken === "string") {
      appConfig.discordToken = discordToken;
      discordService.setToken(discordToken);
    }
    if (
      (statusPrefix === undefined || typeof statusPrefix === "string") &&
      (statusEmoji === undefined || typeof statusEmoji === "string")
    ) {
      appConfig.statusPrefix = statusPrefix ?? appConfig.statusPrefix;
      appConfig.statusEmoji = statusEmoji ?? appConfig.statusEmoji;
      syncService.setStatusFormat(appConfig.statusPrefix, appConfig.statusEmoji);
    }
    if (typeof offsetMs === "number" && Number.isFinite(offsetMs)) {
      appConfig.offsetMs = offsetMs;
      syncService.setOffset(offsetMs);
    }
    if (typeof demoMode === "boolean") {
      appConfig.demoMode = demoMode;
      spotifyService.setDemoMode(demoMode);
    }
    if (
      [spotifyClientId, spotifyClientSecret, spotifyRefreshToken].every(
        (value) => value === undefined || typeof value === "string"
      ) &&
      (spotifyClientId || spotifyClientSecret || spotifyRefreshToken)
    ) {
      appConfig.spotifyClientId = spotifyClientId || appConfig.spotifyClientId;
      appConfig.spotifyClientSecret =
        spotifyClientSecret || appConfig.spotifyClientSecret;
      appConfig.spotifyRefreshToken =
        spotifyRefreshToken || appConfig.spotifyRefreshToken;

      spotifyService.setCredentials(
        appConfig.spotifyClientId,
        appConfig.spotifyClientSecret,
        appConfig.spotifyRefreshToken
      );
    }

    res.json({
      success: true,
      config: {
        hasDiscordToken: Boolean(appConfig.discordToken),
        statusPrefix: appConfig.statusPrefix,
        statusEmoji: appConfig.statusEmoji,
        offsetMs: appConfig.offsetMs,
        demoMode: spotifyService.isDemo(),
      },
    });
  });

  // Toggle demo mode directly
  router.post("/demo/toggle", (_req, res) => {
    const newMode = !spotifyService.isDemo();
    spotifyService.setDemoMode(newMode);
    appConfig.demoMode = newMode;
    res.json({ success: true, demoMode: newMode });
  });

  // Spotify OAuth URL
  router.get("/auth/spotify/url", (_req, res) => {
    spotifyOAuthState = randomBytes(32).toString("base64url");
    const url = spotifyService.getAuthUrl(appConfig.spotifyRedirectUri, spotifyOAuthState);
    res.json({ url, redirectUri: appConfig.spotifyRedirectUri });
  });

  // Spotify OAuth Callback
  router.get("/auth/spotify/callback", async (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string | undefined;

    if (!code || !state || state !== spotifyOAuthState) {
      spotifyOAuthState = null;
      return res.redirect(`${appConfig.frontendUrl}/?error=no_code`);
    }
    spotifyOAuthState = null;

    const tokens = await spotifyService.handleAuthCallback(code, appConfig.spotifyRedirectUri);
    if (tokens) {
      appConfig.spotifyRefreshToken = tokens.refreshToken;
      spotifyService.setDemoMode(false);
      appConfig.demoMode = false;

      // Persist refresh token to .env files
      try {
        const fs = await import("fs");
        const path = await import("path");
        const updateEnvFile = (filePath: string) => {
          if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, "utf-8");
            if (content.includes("SPOTIFY_REFRESH_TOKEN=")) {
              content = content.replace(/SPOTIFY_REFRESH_TOKEN=.*$/m, `SPOTIFY_REFRESH_TOKEN=${tokens.refreshToken}`);
            } else {
              content += `\nSPOTIFY_REFRESH_TOKEN=${tokens.refreshToken}\n`;
            }
            fs.writeFileSync(filePath, content);
          }
        };
        updateEnvFile(path.resolve(process.cwd(), ".env"));
        updateEnvFile(path.resolve(process.cwd(), "backend/.env"));
        console.log("[Backend] Spotify refresh token successfully persisted to .env");
      } catch (err) {
        console.warn("[Backend] Failed to persist refresh token to .env:", err);
      }

      return res.redirect(`${appConfig.frontendUrl}/?spotify=connected`);
    }

    res.redirect(`${appConfig.frontendUrl}/?error=auth_failed`);
  });

  return router;
}
