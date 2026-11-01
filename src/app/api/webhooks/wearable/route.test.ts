import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activityStore, wearableConnections } from "@/lib/activity-store";
import { signPayload } from "@/lib/wearable";
import { POST } from "./route";

const { dataFile } = vi.hoisted(() => ({
  dataFile: `activity-webhook-test-${process.pid}.json`,
}));

// Runs against a real file store in the temp dir, never a database.
vi.mock("@/lib/activity-store", async () => {
  const { createFileActivityStore } = await import("@/lib/store");
  return {
    activityStore: createFileActivityStore(path.join(tmpdir(), dataFile)),
    wearableConnections: { findUserId: vi.fn() },
  };
});

// getUser must never be needed here, and activities.ts imports it.
vi.mock("@/lib/session", () => ({ getUser: vi.fn() }));

// revalidateTag throws outside a Next.js request.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }));

const SECRET = "test-webhook-secret";

const data = {
  activity_id: "act_1",
  athlete_id: "ath_1",
  sport_type: "running",
  start_date: "2026-10-31T08:00:00-06:00",
  elapsed_seconds: 1800,
  distance_meters: 5000,
};
const event = { id: "evt_1", type: "activity.created", data };

function send(body: unknown, options: { signature?: string | null; secret?: string } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature =
    options.signature === undefined
      ? signPayload(raw, options.secret ?? SECRET, timestamp)
      : options.signature;

  return POST(
    new Request("http://localhost/api/webhooks/wearable", {
      method: "POST",
      body: raw,
      headers: signature ? { "x-pulse-signature": signature } : {},
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("WEARABLE_WEBHOOK_SECRET", SECRET);
  vi.mocked(wearableConnections.findUserId).mockResolvedValue("alice");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  await rm(path.join(tmpdir(), dataFile), { force: true });
});

describe("POST /api/webhooks/wearable", () => {
  it("stores a mapped activity for the linked user and expires their cache", async () => {
    const response = await send(event);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "created" });
    expect(await activityStore.list("alice")).toMatchObject([
      {
        type: "run",
        durationMinutes: 30,
        distanceKm: 5,
        performedAt: "2026-10-31T14:00:00.000Z",
      },
    ]);
    expect(wearableConnections.findUserId).toHaveBeenCalledWith("pulse", "ath_1");
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("activities:alice", { expire: 0 });
  });

  it("does not duplicate an activity when the provider retries", async () => {
    await send(event);
    const retry = await send(event);

    expect(await retry.json()).toEqual({ status: "updated" });
    expect(await activityStore.list("alice")).toHaveLength(1);
  });

  it("applies a later update to the same activity", async () => {
    await send(event);
    await send({
      id: "evt_2",
      type: "activity.updated",
      data: { ...data, elapsed_seconds: 3600, distance_meters: null },
    });

    const [activity, ...others] = await activityStore.list("alice");
    expect(others).toEqual([]);
    expect(activity?.durationMinutes).toBe(60);
    expect(activity?.distanceKm).toBeUndefined();
  });

  it.each([
    ["missing", null],
    ["malformed", "nonsense"],
  ])("returns 401 for a %s signature and stores nothing", async (_name, signature) => {
    const response = await send(event, { signature });

    expect(response.status).toBe(401);
    expect(await activityStore.list("alice")).toEqual([]);
    expect(wearableConnections.findUserId).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("returns 401 for a signature made with the wrong secret", async () => {
    const response = await send(event, { secret: "wrong" });
    expect(response.status).toBe(401);
  });

  it("refuses everything when no secret is configured", async () => {
    vi.stubEnv("WEARABLE_WEBHOOK_SECRET", "");

    const response = await send(event, { secret: "" });

    expect(response.status).toBe(503);
    expect(await activityStore.list("alice")).toEqual([]);
  });

  it("returns 400 for signed but invalid JSON", async () => {
    const response = await send("{nope");
    expect(response.status).toBe(400);
  });

  it("returns 422 with field errors for an invalid payload", async () => {
    const response = await send({ ...event, data: { ...data, elapsed_seconds: "soon" } });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      details: { fieldErrors: { elapsed_seconds: expect.any(Array) } },
    });
  });

  it("returns 422 when the mapped activity is one the app does not accept", async () => {
    const response = await send({ ...event, data: { ...data, elapsed_seconds: 30 * 3600 } });

    expect(response.status).toBe(422);
    expect(await activityStore.list("alice")).toEqual([]);
  });

  it("acknowledges an event type it does not handle, whatever its data", async () => {
    const response = await send({ id: "evt_3", type: "sleep.recorded", data: { hours: 8 } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ignored" });
    expect(await activityStore.list("alice")).toEqual([]);
  });

  it("acknowledges an athlete with no linked user", async () => {
    vi.mocked(wearableConnections.findUserId).mockResolvedValue(null);

    const response = await send(event);

    expect(await response.json()).toEqual({ status: "ignored" });
    expect(await activityStore.list("alice")).toEqual([]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("ignores any user id in the payload", async () => {
    await send({ ...event, userId: "bob", data: { ...data, user_id: "bob" } });

    expect(await activityStore.list("alice")).toHaveLength(1);
    expect(await activityStore.list("bob")).toEqual([]);
  });
});
