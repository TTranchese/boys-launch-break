import { NextResponse } from "next/server";
import { listParticipants } from "@/lib/db";
import { computeDinner } from "@/lib/dinner";
import type { Strategy } from "@/lib/geo";
import { isValidId } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await ctx.params;
  if (!isValidId(groupId)) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  const strategy: Strategy = new URL(req.url).searchParams.get("strategy") === "fair" ? "fair" : "total";

  try {
    const result = await computeDinner(listParticipants(groupId), strategy);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Couldn't rank places to eat right now. Please try again in a minute." },
      { status: 500 },
    );
  }
}
