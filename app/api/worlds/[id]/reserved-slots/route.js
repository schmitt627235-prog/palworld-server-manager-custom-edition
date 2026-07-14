import { NextResponse } from "next/server";
const dbm = require("@/lib/db");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STEAM_ID = /^7656119\d{10}$/;
const ROLES = new Set(["owner", "admin", "moderator", "vip", "friend"]);

function worldOr404(id) {
  return dbm.getWorld(id) || null;
}

export async function GET(_req, { params }) {
  if (!worldOr404(params.id)) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...dbm.getReservedSlots(params.id) });
}

export async function POST(req, { params }) {
  if (!worldOr404(params.id)) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "save-settings") {
    const reservedSlots = Math.max(1, Math.min(31, Number(body.reserved_slots) || 1));
    const message = String(body.message || "Der verbleibende Serverplatz ist reserviert.").trim().slice(0, 240);
    return NextResponse.json({ ok: true, ...dbm.saveReservedSlots(params.id, {
      enabled: !!body.enabled,
      reserved_slots: reservedSlots,
      message,
    }) });
  }

  if (body.action === "save-player") {
    const steamId = String(body.steam_id || "").trim();
    if (!STEAM_ID.test(steamId)) {
      return NextResponse.json({ ok: false, error: "SteamID64 must contain 17 digits and start with 7656119." }, { status: 400 });
    }
    const role = ROLES.has(body.role) ? body.role : "vip";
    return NextResponse.json({ ok: true, ...dbm.upsertReservedPlayer(params.id, {
      steam_id: steamId,
      display_name: String(body.display_name || "").trim().slice(0, 80),
      role,
      note: String(body.note || "").trim().slice(0, 240),
      enabled: body.enabled !== false,
    }) });
  }

  return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
}

export async function DELETE(req, { params }) {
  if (!worldOr404(params.id)) return NextResponse.json({ ok: false, error: "World not found" }, { status: 404 });
  const steamId = new URL(req.url).searchParams.get("steam_id") || "";
  if (!STEAM_ID.test(steamId)) return NextResponse.json({ ok: false, error: "Invalid SteamID64" }, { status: 400 });
  return NextResponse.json({ ok: true, ...dbm.deleteReservedPlayer(params.id, steamId) });
}
