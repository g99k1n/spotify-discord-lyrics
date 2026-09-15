import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscordService } from "../src/services/discord.service.js";

describe("DiscordService & Throttler", () => {
  let service: DiscordService;

  beforeEach(() => {
    service = new DiscordService({
      token: "mock-token",
      minIntervalMs: 2500,
      maxStatusLength: 128,
    });
  });

  it("should truncate text longer than 128 characters safely with an ellipsis", () => {
    const longText = "A".repeat(150);
    const formatted = service.formatStatusText(longText);
    expect(formatted.length).toBeLessThanOrEqual(128);
    expect(formatted.endsWith("…")).toBe(true);
  });

  it("should not truncate text within 128 characters", () => {
    const shortText = "Never gonna give you up";
    expect(service.formatStatusText(shortText)).toBe(shortText);
  });

  it("should throttle requests that occur sooner than minIntervalMs", async () => {
    // Mock the internal network call
    const mockSender = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    service.setNetworkSender(mockSender);

    // Call 1
    const res1 = await service.updateStatus({ text: "Line 1" });
    expect(res1.success).toBe(true);
    expect(res1.throttled).toBe(false);
    expect(mockSender).toHaveBeenCalledTimes(1);

    // Call 2 immediately (0ms later)
    const res2 = await service.updateStatus({ text: "Line 2" });
    expect(res2.throttled).toBe(true);
    // Should NOT have made a second HTTP request to Discord
    expect(mockSender).toHaveBeenCalledTimes(1);
  });

  it("should allow request after minIntervalMs has elapsed", async () => {
    const mockSender = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    service.setNetworkSender(mockSender);

    await service.updateStatus({ text: "Line 1" });
    expect(mockSender).toHaveBeenCalledTimes(1);

    // Fast-forward lastUpdateTime by 2600ms
    service.forceSetLastUpdateTime(Date.now() - 2600);

    const res2 = await service.updateStatus({ text: "Line 2" });
    expect(res2.success).toBe(true);
    expect(res2.throttled).toBe(false);
    expect(mockSender).toHaveBeenCalledTimes(2);
  });

  it("should clear status by sending null payload", async () => {
    const mockSender = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    service.setNetworkSender(mockSender);

    const res = await service.clearStatus();
    expect(res.cleared).toBe(true);
    expect(mockSender).toHaveBeenCalledWith(null);
  });

  it("should serialize simultaneous status updates", async () => {
    let completeFirst: (() => void) | undefined;
    const mockSender = vi.fn().mockImplementation(
      () => new Promise<{ ok: boolean; status: number }>((resolve) => {
        if (!completeFirst) {
          completeFirst = () => resolve({ ok: true, status: 200 });
        } else {
          resolve({ ok: true, status: 200 });
        }
      })
    );
    service.setNetworkSender(mockSender);

    const first = service.updateStatus({ text: "Line 1" });
    const second = service.updateStatus({ text: "Line 2" });
    await Promise.resolve();
    expect(mockSender).toHaveBeenCalledTimes(1);

    completeFirst?.();
    await first;
    const secondResult = await second;
    expect(secondResult.throttled).toBe(true);
    expect(mockSender).toHaveBeenCalledTimes(1);
  });

  it("should respect a 429 returned by an injected sender", async () => {
    service.setNetworkSender(async () => ({ ok: false, status: 429 }));

    const result = await service.updateStatus({ text: "Line 1" });

    expect(result.success).toBe(false);
    expect(result.throttled).toBe(true);
  });
});
