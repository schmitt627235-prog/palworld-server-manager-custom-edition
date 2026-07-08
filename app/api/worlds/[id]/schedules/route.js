import { NextResponse } from "next/server";
const crypto = require("crypto");
const dbm = require("@/lib/db");
const { ensureScheduler } = require("@/lib/scheduler");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req, { params }) {
  return NextResponse.json({ ok: true, schedules: dbm.listSchedules(params.id) });
}

export async function POST(req, { params }) {
  const b = await req.json();
  const s = {
    id: crypto.randomUUID(),
    world_id: params.id,
    job_type: b.job_type,           // restart | backup | update
    mode: b.mode,                   // interval | daily
    interval_hours: b.interval_hours ?? null,
    time_of_day: b.time_of_day ?? null,
    enabled: b.enabled === false ? 0 : 1,
    created_at: Date.now(),
  };
  dbm.insertSchedule(s);
  ensureScheduler();
  return NextResponse.json({ ok: true, schedule: s });
}

export async function DELETE(req, { params }) {
  const id = new URL(req.url).searchParams.get("sid");
  if (id) dbm.deleteSchedule(id);
  return NextResponse.json({ ok: true });
}
