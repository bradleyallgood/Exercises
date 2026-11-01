import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activityStore } from "@/lib/store";
import { DELETE, PATCH } from "./route";

const { dataFile } = vi.hoisted(() => ({
  dataFile: `activity-route-test-${process.pid}.json`,
}));

// Runs against a real file store in the temp dir, never the app's own data.
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  return { ...actual, activityStore: actual.createFileActivityStore(path.join(tmpdir(), dataFile)) };
});

afterEach(async () => {
  await rm(path.join(tmpdir(), dataFile), { force: true });
});

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: string) {
  return new Request("http://localhost/api/activities/x", { method: "PATCH", body });
}

function seed() {
  return activityStore.create({
    type: "run",
    durationMinutes: 30,
    performedAt: "2026-10-30T10:00:00.000Z",
  });
}

describe("PATCH /api/activities/[id]", () => {
  it("updates the activity and returns it", async () => {
    const created = await seed();

    const response = await PATCH(
      patchRequest(JSON.stringify({ durationMinutes: 45 })),
      context(created.id),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { ...created, durationMinutes: 45 } });
  });

  it("returns 404 for an unknown id", async () => {
    const response = await PATCH(
      patchRequest(JSON.stringify({ durationMinutes: 45 })),
      context(randomUUID()),
    );
    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed id", async () => {
    const response = await PATCH(
      patchRequest(JSON.stringify({ durationMinutes: 45 })),
      context("not-a-uuid"),
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid JSON", async () => {
    const created = await seed();
    const response = await PATCH(patchRequest("{nope"), context(created.id));
    expect(response.status).toBe(400);
  });

  it("returns 422 for invalid fields and leaves the activity unchanged", async () => {
    const created = await seed();

    const response = await PATCH(
      patchRequest(JSON.stringify({ durationMinutes: -5 })),
      context(created.id),
    );

    expect(response.status).toBe(422);
    expect(await activityStore.list()).toEqual([created]);
  });

  it("returns 422 for an empty patch", async () => {
    const created = await seed();
    const response = await PATCH(patchRequest("{}"), context(created.id));
    expect(response.status).toBe(422);
  });
});

describe("DELETE /api/activities/[id]", () => {
  it("deletes the activity and returns 204 with no body", async () => {
    const created = await seed();

    const response = await DELETE(new Request("http://localhost"), context(created.id));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(await activityStore.list()).toEqual([]);
  });

  it("returns 404 for an unknown id", async () => {
    const response = await DELETE(new Request("http://localhost"), context(randomUUID()));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a malformed id", async () => {
    const response = await DELETE(new Request("http://localhost"), context("not-a-uuid"));
    expect(response.status).toBe(404);
  });
});
