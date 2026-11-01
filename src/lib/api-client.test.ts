import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { GET, POST } from "@/app/api/activities/route";
import { DELETE, PATCH } from "@/app/api/activities/[id]/route";
import { ApiError, createActivitiesClient } from "./api-client";
import type { ActivityInput } from "./schemas";
import { getUser } from "./session";

const { dataFile } = vi.hoisted(() => ({
  dataFile: `activity-client-test-${process.pid}.json`,
}));

// Runs against a real file store in the temp dir, never a database.
vi.mock("./activity-store", async () => {
  const { createFileActivityStore } = await import("./store");
  return { activityStore: createFileActivityStore(path.join(tmpdir(), dataFile)) };
});

vi.mock("./session", () => ({ getUser: vi.fn() }));

// revalidateTag throws outside a Next.js request.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }));

const input: ActivityInput = {
  type: "run",
  durationMinutes: 30,
  distanceKm: 5,
  performedAt: "2026-10-30T10:00:00.000Z",
};

function signInAs(id: string | null) {
  vi.mocked(getUser).mockResolvedValue(
    (id ? { id } : null) as Awaited<ReturnType<typeof getUser>>,
  );
}

/** Contract test: sends the client's real requests to the real route handlers. */
const routesFetch: typeof fetch = async (url, init) => {
  const request = new Request(new URL(String(url), "http://localhost"), init);
  const id = new URL(request.url).pathname.split("/api/activities/")[1];

  if (id === undefined) return request.method === "POST" ? POST(request) : GET();

  const context = { params: Promise.resolve({ id }) };
  return request.method === "PATCH" ? PATCH(request, context) : DELETE(request, context);
};

const client = createActivitiesClient("", routesFetch);

/** Runs the promise, returning what it rejects with. Fails if it resolves. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => expect.unreachable("expected a rejection"),
    (error: unknown) => error,
  );
}

beforeEach(() => signInAs("alice"));

afterEach(async () => {
  await rm(path.join(tmpdir(), dataFile), { force: true });
});

describe("activities client against the real routes", () => {
  it("creates, lists, updates, and deletes", async () => {
    const created = await client.create(input);
    expect(created).toMatchObject(input);

    expect(await client.list()).toEqual([created]);

    const updated = await client.update(created.id, { durationMinutes: 45 });
    expect(updated).toEqual({ ...created, durationMinutes: 45 });

    await client.delete(created.id);
    expect(await client.list()).toEqual([]);
  });

  it("omits distanceKm when none was given", async () => {
    const created = await client.create({
      type: "walk",
      durationMinutes: 20,
      performedAt: "2026-10-30T10:00:00.000Z",
    });

    expect(created).not.toHaveProperty("distanceKm");
    expect((await client.list())[0]).not.toHaveProperty("distanceKm");
  });

  it("never exposes the owner", async () => {
    const created = await client.create(input);

    expect(created).not.toHaveProperty("userId");
    expect((await client.list())[0]).not.toHaveProperty("userId");
  });

  it("throws ApiError with the status when signed out", async () => {
    signInAs(null);

    const error = await rejection(client.list());

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: "Not signed in" });
  });

  it("throws ApiError with field errors for invalid input", async () => {
    const error = await rejection(client.create({ ...input, durationMinutes: -5 }));

    expect(error).toMatchObject({
      status: 422,
      body: { details: { fieldErrors: { durationMinutes: expect.any(Array) } } },
    });
  });

  it("throws ApiError for an unknown id", async () => {
    await expect(client.update(randomUUID(), { durationMinutes: 45 })).rejects.toMatchObject({
      status: 404,
    });
    await expect(client.delete(randomUUID())).rejects.toMatchObject({ status: 404 });
  });
});

describe("activities client when the server breaks the contract", () => {
  it("rejects a success response with the wrong shape", async () => {
    const drifted = createActivitiesClient("", async () =>
      Response.json({ data: [{ id: "not-a-uuid", durationMinutes: "30" }] }),
    );

    expect(await rejection(drifted.list())).toBeInstanceOf(ZodError);
  });

  it("still reports the status when an error body is not JSON", async () => {
    const broken = createActivitiesClient("", async () => new Response("Bad Gateway", { status: 502 }));

    await expect(broken.list()).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502)",
    });
  });
});
