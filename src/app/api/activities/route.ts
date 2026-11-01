import { NextResponse } from "next/server";
import { z } from "zod";
import { activityInputSchema } from "@/lib/schemas";
import { activityStore } from "@/lib/store";

// LEARNING NOTE: files named route.ts under app/ become API endpoints. Export
// functions named after HTTP methods. They receive a standard Web Request and
// return a standard Web Response (NextResponse is a thin helper on top).

export const dynamic = "force-dynamic"; // never cache this GET

export async function GET() {
  const data = await activityStore.list();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
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

  const created = await activityStore.create(parsed.data);
  return NextResponse.json({ data: created }, { status: 201 });
}
