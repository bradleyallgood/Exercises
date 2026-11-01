import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { activitiesTag } from "@/lib/activities";
import { activityStore } from "@/lib/activity-store";
import { activityPatchSchema } from "@/lib/schemas";
import { getUser } from "@/lib/session";

// LEARNING NOTE: folders in [brackets] are dynamic segments. In current Next.js
// `params` is a Promise, so it must be awaited. Ids come from the URL, which is
// a trust boundary like the body: Postgres throws on a malformed uuid, so a bad
// id has to be caught here to come back as a 404 instead of a 500.
//
// Another user's activity is also a 404, not a 403: a 403 would confirm the id
// exists. The store makes this automatic by scoping every query to the user.

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

function notFound() {
  return NextResponse.json({ error: "Activity not found" }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = activityPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const updated = await activityStore.update(user.id, id, parsed.data);
  if (!updated) return notFound();
  revalidateTag(activitiesTag(user.id), { expire: 0 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return notFound();

  const deleted = await activityStore.delete(user.id, id);
  if (!deleted) return notFound();
  revalidateTag(activitiesTag(user.id), { expire: 0 });
  return new NextResponse(null, { status: 204 });
}
