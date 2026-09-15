import dotenv from "dotenv";
import path from "path";

dotenv.config();

export interface AppConfig {
  port: number;
  frontendUrl: string;
  minDiscordIntervalMs: number;
  maxStatusLength: number;
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRefreshToken: string;
  spotifyRedirectUri: string;
  discordToken: string;
  statusPrefix: string;
  statusEmoji: string;
  offsetMs: number;
  demoMode: boolean;
}

export const config: AppConfig = {
  port: Number(process.env.PORT) || 3001,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  minDiscordIntervalMs: 2500, // Safe throttle to avoid Discord 429 & ToS flags
  maxStatusLength: 128,       // Discord Custom Status maximum character limit
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || "",
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
  spotifyRefreshToken: process.env.SPOTIFY_REFRESH_TOKEN || "",
  spotifyRedirectUri:
    process.env.SPOTIFY_REDIRECT_URI ||
    `http://127.0.0.1:${Number(process.env.PORT) || 3001}/api/auth/spotify/callback`,
  discordToken: process.env.DISCORD_TOKEN || "",
  statusPrefix: process.env.STATUS_PREFIX ?? "",
  statusEmoji: process.env.STATUS_EMOJI ?? "",
  offsetMs: Number(process.env.OFFSET_MS) || 0,
  demoMode: process.env.DEMO_MODE !== undefined ? process.env.DEMO_MODE === "true" : true,
};
