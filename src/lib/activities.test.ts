import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activitiesTag, getActivities } from "./activities";
import { activityStore } from "./activity-store";
import { getUser } from "./session";

const { dataFile } = vi.hoisted(() => ({
  dataFile: `activity-read-test-${process.pid}.json`,
}));

// Runs against a real file store in the temp dir, never a database.
vi.mock("./activity-store", async () => {
  const { createFileActivityStore } = await import("./store");
  return { activityStore: createFileActivityStore(path.join(tmpdir(), dataFile)) };
});

vi.mock("./session", () => ({ getUser: vi.fn() }));

// cacheTag and cacheLife throw outside a `use cache` scope.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

function signInAs(id: string | null) {
  vi.mocked(getUser).mockResolvedValue(
    (id ? { id } : null) as Awaited<ReturnType<typeof getUser>>,
  );
}

afterEach(async () => {
  vi.clearAllMocks();
  await rm(path.join(tmpdir(), dataFile), { force: true });
});

describe("getActivities", () => {
  it("returns only the signed-in user's activities, tagged per user", async () => {
    const performedAt = "2026-10-30T10:00:00.000Z";
    const mine = await activityStore.create("alice", { type: "run", durationMinutes: 10, performedAt });
    await activityStore.create("bob", { type: "walk", durationMinutes: 20, performedAt });
    signInAs("alice");

    expect(await getActivities()).toEqual([mine]);
    expect(cacheTag).toHaveBeenCalledWith("activities:alice");
  });

  it("redirects a signed-out caller without reading any data", async () => {
    signInAs(null);

    await expect(getActivities()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(cacheTag).not.toHaveBeenCalled();
  });
});

describe("activitiesTag", () => {
  it("is different for each user", () => {
    expect(activitiesTag("alice")).not.toBe(activitiesTag("bob"));
  });
});
