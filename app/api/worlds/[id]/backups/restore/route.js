import { NextResponse } from "next/server";
const { restoreBackup } = require("@/lib/backups");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req, { params }) {
  const { backupId } = await req.json();
  try {
    const r = await restoreBackup(params.id, backupId);
    return NextResponse.json({ ok: true, result: r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
