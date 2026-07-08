import { NextResponse } from "next/server";
const mods = require("@/lib/mods");
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req, { params }) {
  try { return NextResponse.json({ ok: true, ...mods.status(params.id) }); }
  catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); }
}

// DELETE ?pkg=<packageName|folder> — remove a mod
export async function DELETE(req, { params }) {
  const pkg = new URL(req.url).searchParams.get("pkg");
  if (!pkg) return NextResponse.json({ ok: false, error: "pkg required" }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...mods.removeMod(params.id, pkg) }); }
  catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); }
}
