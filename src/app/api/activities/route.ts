import { NextResponse } from "next/server";
import { z } from "zod";
import { activityStore } from "@/lib/activity-store";
import { activityInputSchema } from "@/lib/schemas";
import { getUser } from "@/lib/session";

// LEARNING NOTE: files named route.ts under app/ become API endpoints. Export
// functions named after HTTP methods. They receive a standard Web Request and
// return a standard Web Response (NextResponse is a thin helper on top).

export const dynamic = "force-dynamic"; // never cache this GET

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const data = await activityStore.list(user.id);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = activityInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const created = await activityStore.create(user.id, parsed.data);
  return NextResponse.json({ data: created }, { status: 201 });
}
