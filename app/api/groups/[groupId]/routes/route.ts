import { NextResponse } from "next/server";
import { listParticipants } from "@/lib/db";
import { computeRoutes } from "@/lib/dinner";
import { inTuscany } from "@/lib/geo";
import { isValidId } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Road routes from every participant of the group to one destination. */
export async function GET(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await ctx.params;
  if (!isValidId(groupId)) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  const sp = new URL(req.url).searchParams;
  const to = { lat: Number(sp.get("lat")), lng: Number(sp.get("lng")) };
  if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng) || !inTuscany(to)) {
    return NextResponse.json({ error: "Destination must be inside Tuscany" }, { status: 400 });
  }
  return NextResponse.json({ routes: await computeRoutes(listParticipants(groupId), to) });
}
