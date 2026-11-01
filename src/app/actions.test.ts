import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activityStore } from "@/lib/activity-store";
import { getUser } from "@/lib/session";
import { createActivity } from "./actions";

const { dataFile } = vi.hoisted(() => ({
  dataFile: `activity-action-test-${process.pid}.json`,
}));

// Runs against a real file store in the temp dir, never a database.
vi.mock("@/lib/activity-store", async () => {
  const { createFileActivityStore } = await import("@/lib/store");
  return { activityStore: createFileActivityStore(path.join(tmpdir(), dataFile)) };
});

vi.mock("@/lib/session", () => ({ getUser: vi.fn() }));

// revalidatePath throws outside a Next.js request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const valid = { type: "run", durationMinutes: 30, performedAt: "2026-10-30T10:00:00.000Z" };

function signInAs(id: string | null) {
  vi.mocked(getUser).mockResolvedValue(
    (id ? { id } : null) as Awaited<ReturnType<typeof getUser>>,
  );
}

beforeEach(() => signInAs("alice"));

afterEach(async () => {
  vi.clearAllMocks();
  await rm(path.join(tmpdir(), dataFile), { force: true });
});

describe("createActivity", () => {
  it("stores a valid activity for the signed-in user and revalidates the dashboard", async () => {
    const result = await createActivity(valid);

    expect(result).toEqual({ error: null });
    expect(await activityStore.list("alice")).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("ignores a userId in the input", async () => {
    await createActivity({ ...valid, userId: "bob" });

    expect(await activityStore.list("alice")).toHaveLength(1);
    expect(await activityStore.list("bob")).toEqual([]);
  });

  it("rejects a signed-out caller without storing or revalidating", async () => {
    signInAs(null);

    const result = await createActivity(valid);

    expect(result).toEqual({ error: "Not signed in" });
    expect(await activityStore.list("alice")).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid input without storing or revalidating", async () => {
    const result = await createActivity({ type: "teleport", durationMinutes: -5 });

    expect(result).toEqual({ error: "Validation failed" });
    expect(await activityStore.list("alice")).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
