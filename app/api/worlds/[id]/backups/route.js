import { NextResponse } from "next/server";
const dbm = require("@/lib/db");
const { createBackup } = require("@/lib/backups");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req, { params }) {
  return NextResponse.json({ ok: true, backups: dbm.listBackups(params.id) });
}

export async function POST(_req, { params }) {
  try {
    const r = await createBackup(params.id, "manual");
    return NextResponse.json({ ok: true, backup: r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
