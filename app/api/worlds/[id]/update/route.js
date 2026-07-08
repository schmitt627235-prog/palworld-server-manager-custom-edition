import { NextResponse } from "next/server";
const { updateWorld } = require("@/lib/scheduler");
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(_req, { params }) {
  const r = await updateWorld(params.id);
  return NextResponse.json({ ok: r.ok !== false, result: r });
}
