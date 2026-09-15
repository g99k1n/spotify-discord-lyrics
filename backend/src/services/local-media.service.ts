import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { CurrentPlayback } from "../types/spotify.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LocalMediaService {
  private childProcess: ChildProcess | null = null;
  private scriptPath: string;
  private currentPlayback: CurrentPlayback | null = null;
  private isDisposed = false;

  constructor() {
    this.scriptPath = path.resolve(__dirname, "../scripts/stream-media.ps1");
    this.startWorker();
  }

  private startWorker(): void {
    if (this.childProcess) {
      try {
        this.childProcess.kill();
      } catch {}
    }

    try {
      this.childProcess = spawn("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        this.scriptPath,
      ]);

      let buffer = "";

      this.childProcess.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf-8");
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || ""; // Keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("{")) continue;

          try {
            const data = JSON.parse(trimmed);
            if (data.isPlaying && data.title && data.artist) {
              this.currentPlayback = {
                id: `local-${data.artist}-${data.title}`.replace(/\s+/g, "-"),
                name: data.title,
                artist: data.artist,
                album: data.album || "Spotify Desktop",
                albumArt:
                  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80",
                durationMs: data.durationMs > 0 ? data.durationMs : 210000,
                progressMs: data.positionMs ?? 0,
                isPlaying: true,
                fetchTime: Date.now(),
                isDemo: false,
              };
            } else {
              this.currentPlayback = null;
            }
          } catch {
            // Ignore parse errors on partial lines
          }
        }
      });

      this.childProcess.on("error", (err) => {
        console.error("[LocalMediaService] Media worker error:", err.message);
      });

      this.childProcess.on("exit", () => {
        // Auto-restart if exited unexpectedly
        if (!this.isDisposed) {
          setTimeout(() => this.startWorker(), 1500);
        }
      });
    } catch (err) {
      console.error("[LocalMediaService] Failed to spawn media worker:", err);
    }
  }

  public async getCurrentlyPlaying(): Promise<CurrentPlayback | null> {
    return this.currentPlayback;
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.childProcess) {
      try {
        this.childProcess.kill();
      } catch {}
      this.childProcess = null;
    }
  }
}
