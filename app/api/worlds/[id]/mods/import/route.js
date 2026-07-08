import { NextResponse } from "next/server";
const mods = require("@/lib/mods");
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req, { params }) {
  const { zipPath, workshopId, steamWorkshopPath } = await req.json();
  try {
    if (workshopId) return NextResponse.json({ ok: true, result: mods.copyFromWorkshopContent(params.id, workshopId, steamWorkshopPath) });
    if (zipPath) return NextResponse.json({ ok: true, result: mods.importModZip(params.id, zipPath) });
    return NextResponse.json({ ok: false, error: "provide zipPath or workshopId" }, { status: 400 });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); }
}
