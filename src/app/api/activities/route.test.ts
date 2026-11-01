import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activityStore } from "@/lib/activity-store";
import { getUser } from "@/lib/session";
import { GET, POST } from "./route";

const { dataFile } = vi.hoisted(() => ({
  dataFile: `activity-collection-test-${process.pid}.json`,
}));

// Runs against a real file store in the temp dir, never a database.
vi.mock("@/lib/activity-store", async () => {
  const { createFileActivityStore } = await import("@/lib/store");
  return { activityStore: createFileActivityStore(path.join(tmpdir(), dataFile)) };
});

vi.mock("@/lib/session", () => ({ getUser: vi.fn() }));

const valid = { type: "run", durationMinutes: 30, performedAt: "2026-10-30T10:00:00.000Z" };

function signInAs(id: string | null) {
  vi.mocked(getUser).mockResolvedValue(
    (id ? { id } : null) as Awaited<ReturnType<typeof getUser>>,
  );
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/activities", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => signInAs("alice"));

afterEach(async () => {
  await rm(path.join(tmpdir(), dataFile), { force: true });
});

describe("GET /api/activities", () => {
  it("returns only the signed-in user's activities", async () => {
    const mine = await activityStore.create("alice", { type: "run", durationMinutes: 10, performedAt: valid.performedAt });
    await activityStore.create("bob", { type: "walk", durationMinutes: 20, performedAt: valid.performedAt });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [mine] });
  });

  it("returns 401 when signed out", async () => {
    signInAs(null);
    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/activities", () => {
  it("creates the activity for the signed-in user", async () => {
    const response = await POST(postRequest(valid));

    expect(response.status).toBe(201);
    expect(await activityStore.list("alice")).toHaveLength(1);
  });

  it("ignores a userId in the body", async () => {
    await POST(postRequest({ ...valid, userId: "bob" }));

    expect(await activityStore.list("alice")).toHaveLength(1);
    expect(await activityStore.list("bob")).toEqual([]);
  });

  it("returns 401 when signed out and stores nothing", async () => {
    signInAs(null);

    const response = await POST(postRequest(valid));

    expect(response.status).toBe(401);
    expect(await activityStore.list("alice")).toEqual([]);
  });

  it("returns 422 for invalid fields", async () => {
    const response = await POST(postRequest({ type: "teleport" }));
    expect(response.status).toBe(422);
  });
});
