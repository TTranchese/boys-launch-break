import { NextResponse } from "next/server";
import { deleteParticipant, listParticipants, upsertParticipant } from "@/lib/db";
import { inTuscany } from "@/lib/geo";
import { isValidId, MAX_PARTICIPANTS } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ groupId: string; participantId: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { groupId, participantId } = await ctx.params;
  if (!isValidId(groupId) || !isValidId(participantId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { name?: unknown; lat?: unknown; lng?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!name) return NextResponse.json({ error: "Name is required", code: "name_required" }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inTuscany({ lat, lng })) {
    return NextResponse.json({ error: "Position must be inside Tuscany", code: "outside_tuscany" }, { status: 400 });
  }

  const current = listParticipants(groupId);
  if (!current.some((p) => p.id === participantId) && current.length >= MAX_PARTICIPANTS) {
    return NextResponse.json({ error: "This group is full", code: "group_full" }, { status: 409 });
  }

  const participant = upsertParticipant({ id: participantId, groupId, name, lat, lng });
  return NextResponse.json({ participant });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { groupId, participantId } = await ctx.params;
  if (!isValidId(groupId) || !isValidId(participantId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  deleteParticipant(groupId, participantId);
  return NextResponse.json({ ok: true });
}
