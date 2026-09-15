import { CustomStatusPayload, DiscordStatusResult } from "../types/discord.js";

export interface DiscordServiceOptions {
  token: string;
  minIntervalMs?: number;
  maxStatusLength?: number;
}

export class DiscordService {
  private token: string;
  private minIntervalMs: number;
  private maxStatusLength: number;
  private lastUpdateTime = 0;
  private rateLimitedUntil = 0;
  private lastStatusText = "";
  private requestQueue: Promise<void> = Promise.resolve();

  // Allows mock injection for tests
  private networkSender?: (
    payload: { custom_status: { text: string; emoji_name?: string } | null } | null
  ) => Promise<{ ok: boolean; status: number; headers?: Record<string, string> }>;

  constructor(options: DiscordServiceOptions) {
    this.token = options.token;
    this.minIntervalMs = options.minIntervalMs ?? 2500;
    this.maxStatusLength = options.maxStatusLength ?? 128;
  }

  public setToken(token: string): void {
    this.token = token.trim();
  }

  public setNetworkSender(
    sender: (
      payload: { custom_status: { text: string; emoji_name?: string } | null } | null
    ) => Promise<{ ok: boolean; status: number; headers?: Record<string, string> }>
  ): void {
    this.networkSender = sender;
  }

  public forceSetLastUpdateTime(timestamp: number): void {
    this.lastUpdateTime = timestamp;
  }

  public formatStatusText(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length <= this.maxStatusLength) {
      return trimmed;
    }
    // Truncate and append ellipsis
    return trimmed.slice(0, this.maxStatusLength - 1) + "…";
  }

  /**
   * Safely updates Discord Custom Status with anti-rate-limit throttling
   */
  public async updateStatus(
    status: CustomStatusPayload
  ): Promise<DiscordStatusResult> {
    return this.enqueue(() => this.performUpdateStatus(status));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.requestQueue.then(operation, operation);
    this.requestQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async performUpdateStatus(
    status: CustomStatusPayload
  ): Promise<DiscordStatusResult> {
    const formattedText = this.formatStatusText(status.text);

    // If identical to current active status, don't spam API
    if (formattedText === this.lastStatusText) {
      return { success: true, throttled: false };
    }

    const now = Date.now();

    // 1. Check if currently backing off from 429
    if (now < this.rateLimitedUntil) {
      return {
        success: false,
        throttled: true,
        error: `Rate limited. Backing off for ${Math.ceil(
          (this.rateLimitedUntil - now) / 1000
        )}s`,
      };
    }

    // 2. Check throttling floor (minimum 2500ms between calls)
    const elapsedSinceLastUpdate = now - this.lastUpdateTime;
    if (elapsedSinceLastUpdate < this.minIntervalMs) {
      return {
        success: false,
        throttled: true,
        error: `Throttled: next update allowed in ${
          this.minIntervalMs - elapsedSinceLastUpdate
        }ms`,
      };
    }

    // 3. Dispatch to Discord
    const customStatus: any = {
      text: formattedText,
    };
    if (status.emojiName) {
      customStatus.emoji_name = status.emojiName;
    } else {
      customStatus.emoji_name = null;
      customStatus.emoji_id = null;
    }

    const payload = {
      custom_status: customStatus,
    };

    try {
      if (this.networkSender) {
        const response = await this.networkSender(payload);
        if (response.status === 429) {
          const retryAfter = Number(response.headers?.["retry-after"]) || 5;
          this.rateLimitedUntil = Date.now() + retryAfter * 1000 + 500;
          return {
            success: false,
            throttled: true,
            error: `Discord 429 received. Backing off for ${retryAfter}s`,
          };
        }
        if (!response.ok) {
          return { success: false, error: `Discord returned HTTP ${response.status}` };
        }
      } else if (this.token) {
        const fetchOptions: any = {
          method: "PATCH",
          headers: {
            Authorization: this.token,
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          body: JSON.stringify(payload),
        };

        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl) {
          try {
            const { ProxyAgent } = await import("undici");
            fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
          } catch {}
        }

        const response = await fetch(
          "https://discord.com/api/v9/users/@me/settings",
          fetchOptions
        );

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("retry-after")) || 5;
          this.rateLimitedUntil = Date.now() + retryAfter * 1000 + 500;
          return {
            success: false,
            throttled: true,
            error: `Discord 429 received. Backing off for ${retryAfter}s`,
          };
        }

        if (!response.ok) {
          console.error(`[DiscordService] Error HTTP ${response.status}: ${response.statusText}`);
          return {
            success: false,
            error: `Discord returned HTTP ${response.status}`,
          };
        }

        console.log(`[DiscordService] Successfully set status in Discord: "${formattedText}"`);
      }

      this.lastUpdateTime = Date.now();
      this.lastStatusText = formattedText;
      return { success: true, throttled: false };
    } catch (err: any) {
      console.error("[DiscordService] Network error:", err?.message);
      return {
        success: false,
        error: err?.message || "Failed to update Discord status",
      };
    }
  }

  /**
   * Resets custom status back to clear / null
   */
  public async clearStatus(): Promise<DiscordStatusResult> {
    return this.enqueue(() => this.performClearStatus());
  }

  private async performClearStatus(): Promise<DiscordStatusResult> {
    try {
      if (this.networkSender) {
        const response = await this.networkSender(null);
        if (!response.ok) {
          return { success: false, error: `Discord returned HTTP ${response.status}` };
        }
      } else if (this.token) {
        const fetchOptions: any = {
          method: "PATCH",
          headers: {
            Authorization: this.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ custom_status: null }),
        };

        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl) {
          try {
            const { ProxyAgent } = await import("undici");
            fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
          } catch {}
        }

        const response = await fetch("https://discord.com/api/v9/users/@me/settings", fetchOptions);
        if (!response.ok) {
          return { success: false, error: `Discord returned HTTP ${response.status}` };
        }
      }

      this.lastStatusText = "";
      this.lastUpdateTime = Date.now();
      return { success: true, cleared: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to clear status",
      };
    }
  }
}
