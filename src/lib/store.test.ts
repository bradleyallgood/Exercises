import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileActivityStore } from "./store";

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
    expect(await store.list()).toEqual([]);
  });

  it("creates activities with generated id and createdAt", async () => {
    const store = createFileActivityStore(path.join(dir, "nested", "data.json"));
    const created = await store.create({
      type: "bike",
      durationMinutes: 60,
      performedAt: "2026-10-30T10:00:00.000Z",
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeTruthy();
    expect(await store.list()).toHaveLength(1);
  });

  it("lists newest activity first", async () => {
    const store = createFileActivityStore(path.join(dir, "data.json"));
    await store.create({ type: "run", durationMinutes: 10, performedAt: "2026-10-01T10:00:00.000Z" });
    await store.create({ type: "walk", durationMinutes: 10, performedAt: "2026-10-20T10:00:00.000Z" });

    const list = await store.list();
    expect(list.map((a) => a.type)).toEqual(["walk", "run"]);
  });
});
