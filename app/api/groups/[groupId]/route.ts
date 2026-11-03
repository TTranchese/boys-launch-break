import { NextResponse } from "next/server";
import { listParticipants } from "@/lib/db";
import { findMeetingPlace, type Strategy } from "@/lib/geo";
import { isValidId } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await ctx.params;
  if (!isValidId(groupId)) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });

  const strategy: Strategy = new URL(req.url).searchParams.get("strategy") === "fair" ? "fair" : "total";
  const participants = listParticipants(groupId);
  const meeting = findMeetingPlace(participants, strategy);

  return NextResponse.json({ groupId, participants, meeting });
}
