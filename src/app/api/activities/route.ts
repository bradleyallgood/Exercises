import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { activitiesTag } from "@/lib/activities";
import { activityStore } from "@/lib/activity-store";
import {
  activityInputSchema,
  type ActivityListResponse,
  type ActivityResponse,
  type ApiErrorBody,
} from "@/lib/schemas";
import { getUser } from "@/lib/session";

// LEARNING NOTE: files named route.ts under app/ become API endpoints. Export
// functions named after HTTP methods. They receive a standard Web Request and
// return a standard Web Response (NextResponse is a thin helper on top).
//
// The type argument on NextResponse.json is what ties a response to its schema:
// without it the body is checked against nothing, and it can drift unnoticed.
//
// updateTag is not available here, so writes use revalidateTag. { expire: 0 }
// means no stale data at all: the default "max" profile would show the dashboard
// one stale read after a write, fine for a blog but not for a user's own data.

function unauthorized() {
  return NextResponse.json<ApiErrorBody>({ error: "Not signed in" }, { status: 401 });
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const data = await activityStore.list(user.id);
  return NextResponse.json<ActivityListResponse>({ data });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiErrorBody>(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = activityInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiErrorBody>(
      { error: "Validation failed", details: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const created = await activityStore.create(user.id, parsed.data);
  revalidateTag(activitiesTag(user.id), { expire: 0 });
  return NextResponse.json<ActivityResponse>({ data: created }, { status: 201 });
}
