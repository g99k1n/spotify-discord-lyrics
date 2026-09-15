import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { createApp } from "../src/index.js";

describe("API Routes & Health (Real HTTP Server)", () => {
  let server: http.Server;
  let baseUrl: string;
  let syncService: any;

  beforeAll(async () => {
    const appData = createApp();
    syncService = appData.syncService;
    server = http.createServer(appData.app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await syncService.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should respond to health endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("should return status via /api/status", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("isSyncing");
    expect(data).toHaveProperty("demoMode");
  });

  it("should toggle sync status via /api/sync/toggle", async () => {
    expect(syncService.getState().isSyncing).toBe(false);

    const toggleRes = await fetch(`${baseUrl}/api/sync/toggle`, {
      method: "POST",
    });
    expect(toggleRes.status).toBe(200);
    const toggleData = await toggleRes.json();
    expect(toggleData.isSyncing).toBe(true);
    expect(syncService.getState().isSyncing).toBe(true);

    // Toggle off
    await fetch(`${baseUrl}/api/sync/toggle`, { method: "POST" });
    expect(syncService.getState().isSyncing).toBe(false);
  }, 10000);

  it("should update offset via /api/sync/offset", async () => {
    const res = await fetch(`${baseUrl}/api/sync/offset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offsetMs: 250 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.offsetMs).toBe(250);
  });
});
