import { NextResponse } from "next/server";
const dbm = require("@/lib/db");
const sup = require("@/lib/supervisor");
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: current chat buffer + whether the capture mod is installed for this world.
export async function GET(_req, { params }) {
  const w = dbm.getWorld(params.id);
  const modInstalled = w ? sup.chatModInstalled(w.install_dir) : false;
  return NextResponse.json({
    ok: true,
    chat: sup.getChat(params.id),
    modInstalled,
    bundledAvailable: !!sup.bundledChatModDir(),
  });
}

// POST: install the bundled PSMChatRelay UE4SS mod into this world's server.
export async function POST(_req, { params }) {
  const w = dbm.getWorld(params.id);
  if (!w) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  try {
    const res = sup.installChatMod(w.install_dir);
    dbm.logEvent(params.id, "mods", "Installed chat relay mod (PSMChatRelay)");
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
