import type { z } from "zod";
import {
  activityListResponseSchema,
  activityResponseSchema,
  apiErrorSchema,
  type ActivityInput,
  type ActivityPatch,
  type ApiErrorBody,
} from "./schemas";

/**
 * LEARNING NOTE: this is a typed client for the REST API, sharing its schemas.
 * The app's own UI does not need it, because Server Actions and Server Components
 * already get end-to-end types without any HTTP. It is for code that talks to the
 * API over HTTP, and it doubles as the contract test for the routes.
 *
 * Responses are parsed, not cast: `as Activity` would only tell the compiler what
 * you hope is true. Parsing fails loudly if the server ever sends something else.
 *
 * In a browser on the same origin the session cookie is sent automatically. From
 * anywhere else, pass a fetchFn that adds it.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error);
    this.name = "ApiError";
  }
}

export function createActivitiesClient(baseUrl = "", fetchFn: typeof fetch = fetch) {
  async function send(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetchFn(`${baseUrl}/api/activities${path}`, init);
    if (response.ok) return response;

    const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiError(
      response.status,
      body.success ? body.data : { error: `Request failed (${response.status})` },
    );
  }

  async function sendJson<T extends z.ZodType>(
    schema: T,
    path: string,
    init?: RequestInit,
  ): Promise<z.infer<T>> {
    const response = await send(path, init);
    return schema.parse(await response.json());
  }

  function jsonBody(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  return {
    async list() {
      const { data } = await sendJson(activityListResponseSchema, "");
      return data;
    },

    async create(input: ActivityInput) {
      const { data } = await sendJson(activityResponseSchema, "", jsonBody("POST", input));
      return data;
    },

    async update(id: string, patch: ActivityPatch) {
      const { data } = await sendJson(
        activityResponseSchema,
        `/${encodeURIComponent(id)}`,
        jsonBody("PATCH", patch),
      );
      return data;
    },

    async delete(id: string) {
      await send(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
