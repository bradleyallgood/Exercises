import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileActivityStore } from "./store";

const alice = "alice";
const bob = "bob";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "activity-store-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("file activity store", () => {
  it("starts empty when the file does not exist", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    expect(await store.list(alice)).toEqual([]);
  });

  it("creates activities with generated id and createdAt", async () => {
    const store = createFileActivityStore(path.join(dir, "nested", "data.json"));
    const created = await store.create(alice, {
      type: "bike",
      durationMinutes: 60,
      performedAt: "2026-10-30T10:00:00.000Z",
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeTruthy();
    expect(await store.list(alice)).toHaveLength(1);
  });

  it("does not expose the owner on returned activities", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    const created = await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });

    expect(created).not.toHaveProperty("userId");
    expect((await store.list(alice))[0]).not.toHaveProperty("userId");
  });

  it("lists newest activity first", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });
    await store.create(alice, { type: "walk", durationMinutes: 10, performedAt: "2026-10-20T10:00:00.000Z" });

    const list = await store.list(alice);
    expect(list.map((a) => a.type)).toEqual(["walk", "run"]);
  });

  it("updates only the given fields", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    const created = await store.create(alice, {
      type: "run",
      durationMinutes: 10,
      distanceKm: 2,
      performedAt: "2026-10-01T10:00:00.000Z",
    });

    const updated = await store.update(alice, created.id, { durationMinutes: 20 });

    expect(updated).toEqual({ ...created, durationMinutes: 20 });
    expect(await store.list(alice)).toEqual([updated]);
  });

  it("returns null when updating an unknown id", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    expect(await store.update(alice, randomUUID(), { durationMinutes: 20 })).toBeNull();
  });

  it("deletes only the given activity", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    const keep = await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });
    const remove = await store.create(alice, { type: "walk", durationMinutes: 10, performedAt: "2026-10-20T10:00:00.000Z" });

    expect(await store.delete(alice, remove.id)).toBe(true);
    expect(await store.list(alice)).toEqual([keep]);
  });

  it("returns false when deleting an unknown id", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    expect(await store.delete(alice, randomUUID())).toBe(false);
  });

  it("creates an external activity once, then updates it", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    const ref = { source: "pulse", externalId: "act_1" };
    const input = { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" } as const;

    const first = await store.upsertExternal(alice, ref, { ...input, distanceKm: 2 });
    const second = await store.upsertExternal(alice, ref, { ...input, durationMinutes: 20 });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.activity.id).toBe(first.activity.id);
    expect(second.activity.createdAt).toBe(first.activity.createdAt);
    expect(second.activity.distanceKm).toBeUndefined();
    expect(await store.list(alice)).toHaveLength(1);
  });

  it("keeps the same external id separate per user", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    const ref = { source: "pulse", externalId: "act_1" };
    const input = { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" } as const;

    await store.upsertExternal(alice, ref, input);
    await store.upsertExternal(bob, ref, { ...input, durationMinutes: 99 });

    expect((await store.list(alice)).map((a) => a.durationMinutes)).toEqual([10]);
    expect((await store.list(bob)).map((a) => a.durationMinutes)).toEqual([99]);
  });

  it("keeps each user's activities separate", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    const created = await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });

    expect(await store.list(bob)).toEqual([]);
    expect(await store.update(bob, created.id, { durationMinutes: 99 })).toBeNull();
    expect(await store.delete(bob, created.id)).toBe(false);
    expect(await store.list(alice)).toEqual([created]);
  });
});
