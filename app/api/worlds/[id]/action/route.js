import { NextResponse } from "next/server";
const sup = require("@/lib/supervisor");
const { notify } = require("@/lib/notify");
const dbm = require("@/lib/db");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req, { params }) {
  const { action } = await req.json();
  const w = dbm.getWorld(params.id);
  if (!w) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  try {
    let result;
    if (action === "start") { result = await sup.startWorld(params.id); notify(params.id, "start", `${w.display_name} started`); }
    else if (action === "stop") { result = await sup.stopWorld(params.id, { graceful: true }); notify(params.id, "stop", `${w.display_name} stopped`); }
    else if (action === "restart") { result = await sup.restartWorld(params.id); notify(params.id, "restart", `${w.display_name} restarted`); }
    else if (action === "force-stop") { result = await sup.stopWorld(params.id, { graceful: false }); }
    else return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
