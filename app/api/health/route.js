import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
const dbm = require("@/lib/db");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const worlds = dbm.listWorlds();
  const checks = [];
  checks.push({ id: "memory", status: os.freemem() / os.totalmem() > 0.1 ? "green" : "yellow", title: "System memory", detail: `${Math.round(os.freemem()/1048576)} MB free` });
  checks.push({ id: "data", status: process.env.PALWORLD_MANAGER_DATA_DIR ? "green" : "yellow", title: "Isolated data directory", detail: process.env.PALWORLD_MANAGER_DATA_DIR || "Default manager data directory" });
  for (const world of worlds) {
    const saved = `${world.install_dir}\\Pal\\Saved`;
    checks.push({ id: `saved-${world.world_id}`, status: fs.existsSync(saved) ? "green" : "red", title: `${world.display_name}: save path`, detail: saved });
    checks.push({ id: `rest-${world.world_id}`, status: world.rest_api_enabled ? "green" : "yellow", title: `${world.display_name}: REST API`, detail: world.rest_api_enabled ? `Configured on port ${world.rest_api_port}` : "Disabled" });
    checks.push({ id: `playit-${world.world_id}`, status: world.playit_enabled ? "green" : "yellow", title: `${world.display_name}: Playit.gg`, detail: world.playit_enabled ? `Configured (public port ${world.playit_public_port})` : "Not configured" });
  }
  const severity = checks.some(c=>c.status==="red") ? "red" : checks.some(c=>c.status==="yellow") ? "yellow" : "green";
  return NextResponse.json({ ok: true, preview: process.env.PALWORLD_PREVIEW_MODE === "1", severity, checkedAt: Date.now(), checks });
}
