import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activityStore } from "@/lib/store";
import { createActivity } from "./actions";

const { dataFile } = vi.hoisted(() => ({
  dataFile: `activity-action-test-${process.pid}.json`,
}));

// Runs against a real file store in the temp dir, never the app's own data.
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  return { ...actual, activityStore: actual.createFileActivityStore(path.join(tmpdir(), dataFile)) };
});

// revalidatePath throws outside a Next.js request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

afterEach(async () => {
  vi.clearAllMocks();
  await rm(path.join(tmpdir(), dataFile), { force: true });
});

describe("createActivity", () => {
  it("stores a valid activity and revalidates the dashboard", async () => {
    const result = await createActivity({
      type: "run",
      durationMinutes: 30,
      performedAt: "2026-10-30T10:00:00.000Z",
    });

    expect(result).toEqual({ error: null });
    expect(await activityStore.list()).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("rejects invalid input without storing or revalidating", async () => {
    const result = await createActivity({ type: "teleport", durationMinutes: -5 });

    expect(result).toEqual({ error: "Validation failed" });
    expect(await activityStore.list()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
