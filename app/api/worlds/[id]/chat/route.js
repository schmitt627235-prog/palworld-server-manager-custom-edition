import { NextResponse } from "next/server";
const sup = require("@/lib/supervisor");
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(_req, { params }) {
  return NextResponse.json({ ok: true, chat: sup.getChat(params.id) });
}
