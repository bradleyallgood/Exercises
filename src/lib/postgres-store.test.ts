import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { createPostgresActivityStore } from "./postgres-store";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("postgres activity store", () => {
  beforeEach(async () => {
    await drizzle(url!).execute(sql`truncate table activities`);
  });

  it("creates activities with generated id and createdAt", async () => {
    const store = createPostgresActivityStore(url!);
    const created = await store.create({
      type: "bike",
      durationMinutes: 60,
      performedAt: "2026-10-30T10:00:00.000Z",
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeTruthy();
    expect(created.performedAt).toBe("2026-10-30T10:00:00.000Z");
    expect(await store.list()).toHaveLength(1);
  });

  it("omits distanceKm when none was given", async () => {
    const store = createPostgresActivityStore(url!);
    const created = await store.create({
      type: "run",
      durationMinutes: 10,
      performedAt: "2026-10-01T10:00:00.000Z",
    });

    expect(created.distanceKm).toBeUndefined();
  });

  it("lists newest activity first", async () => {
    const store = createPostgresActivityStore(url!);
    await store.create({ type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });
    await store.create({ type: "walk", durationMinutes: 10, performedAt: "2026-10-20T10:00:00.000Z" });

    const list = await store.list();
    expect(list.map((a) => a.type)).toEqual(["walk", "run"]);
  });
});
