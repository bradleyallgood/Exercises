import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { user } from "../db/auth-schema";
import { wearableConnections } from "../db/schema";
import { createPostgresActivityStore, createPostgresWearableConnections } from "./postgres-store";

const url = process.env.TEST_DATABASE_URL;

const alice = "alice";
const bob = "bob";

describe.skipIf(!url)("postgres activity store", () => {
  const db = drizzle(url!);
  const store = createPostgresActivityStore(db);

  beforeEach(async () => {
    await db.execute(sql`truncate table "user", activities cascade`);
    await db.insert(user).values([
      { id: alice, name: "Alice", email: "alice@example.com" },
      { id: bob, name: "Bob", email: "bob@example.com" },
    ]);
  });

  it("creates activities with generated id and createdAt", async () => {
    const created = await store.create(alice, {
      type: "bike",
      durationMinutes: 60,
      performedAt: "2026-10-30T10:00:00.000Z",
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeTruthy();
    expect(created.performedAt).toBe("2026-10-30T10:00:00.000Z");
    expect(await store.list(alice)).toHaveLength(1);
  });

  it("omits distanceKm when none was given", async () => {
    const created = await store.create(alice, {
      type: "run",
      durationMinutes: 10,
      performedAt: "2026-10-01T10:00:00.000Z",
    });

    expect(created.distanceKm).toBeUndefined();
  });

  it("does not expose the owner on returned activities", async () => {
    const created = await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });

    expect(created).not.toHaveProperty("userId");
  });

  it("lists newest activity first", async () => {
    await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });
    await store.create(alice, { type: "walk", durationMinutes: 10, performedAt: "2026-10-20T10:00:00.000Z" });

    const list = await store.list(alice);
    expect(list.map((a) => a.type)).toEqual(["walk", "run"]);
  });

  it("updates only the given fields", async () => {
    const created = await store.create(alice, {
      type: "run",
      durationMinutes: 10,
      distanceKm: 2,
      performedAt: "2026-10-01T10:00:00.000Z",
    });

    const updated = await store.update(alice, created.id, {
      durationMinutes: 20,
      performedAt: "2026-10-02T10:00:00.000Z",
    });

    expect(updated).toEqual({
      ...created,
      durationMinutes: 20,
      performedAt: "2026-10-02T10:00:00.000Z",
    });
  });

  it("returns null when updating an unknown id", async () => {
    expect(await store.update(alice, randomUUID(), { durationMinutes: 20 })).toBeNull();
  });

  it("deletes only the given activity", async () => {
    const keep = await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });
    const remove = await store.create(alice, { type: "walk", durationMinutes: 10, performedAt: "2026-10-20T10:00:00.000Z" });

    expect(await store.delete(alice, remove.id)).toBe(true);
    expect((await store.list(alice)).map((a) => a.id)).toEqual([keep.id]);
  });

  it("returns false when deleting an unknown id", async () => {
    expect(await store.delete(alice, randomUUID())).toBe(false);
  });

  it("creates an external activity once, then updates it", async () => {
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
    const ref = { source: "pulse", externalId: "act_1" };
    const input = { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" } as const;

    await store.upsertExternal(alice, ref, input);
    await store.upsertExternal(bob, ref, { ...input, durationMinutes: 99 });

    expect((await store.list(alice)).map((a) => a.durationMinutes)).toEqual([10]);
    expect((await store.list(bob)).map((a) => a.durationMinutes)).toEqual([99]);
  });

  it("never treats activities logged by hand as duplicates", async () => {
    const input = { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" } as const;

    await store.create(alice, input);
    await store.create(alice, input);

    expect(await store.list(alice)).toHaveLength(2);
  });

  it("finds the user linked to a wearable athlete", async () => {
    const connections = createPostgresWearableConnections(db);
    await db.insert(wearableConnections).values({ provider: "pulse", athleteId: "ath_1", userId: alice });

    expect(await connections.findUserId("pulse", "ath_1")).toBe(alice);
    expect(await connections.findUserId("pulse", "ath_2")).toBeNull();
    expect(await connections.findUserId("other", "ath_1")).toBeNull();
  });

  it("keeps each user's activities separate", async () => {
    const created = await store.create(alice, { type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });

    expect(await store.list(bob)).toEqual([]);
    expect(await store.update(bob, created.id, { durationMinutes: 99 })).toBeNull();
    expect(await store.delete(bob, created.id)).toBe(false);
    expect((await store.list(alice)).map((a) => a.durationMinutes)).toEqual([10]);
  });
});
