import { NextResponse } from "next/server";
const dbm = require("@/lib/db");
const rest = require("@/lib/restclient");
const sup = require("@/lib/supervisor");
const { boot } = require("@/lib/bootstrap");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  boot();
  const worlds = dbm.listWorlds();
  const enriched = await Promise.all(
    worlds.map(async (w) => {
      const running = sup.isRunning(w.world_id) || sup.pidAlive(w.process_id);
      let live = null, apiUp = false;
      if (running && w.rest_api_enabled) {
        try {
          const [metrics, players] = await Promise.all([
            rest.metrics(w).catch(() => null),
            rest.players(w).catch(() => null),
          ]);
          apiUp = !!(metrics || players);
          live = {
            uptime: metrics?.uptime ?? null,
            fps: metrics?.serverfps ?? metrics?.fps ?? null,
            days: metrics?.days ?? null,
            currentPlayers: players?.players?.length ?? metrics?.currentplayernum ?? 0,
            maxPlayers: metrics?.maxplayernum ?? null,
          };
        } catch {}
      }
      const updateAvailable = !!(w.build_id && w.latest_known_build_id && w.build_id !== w.latest_known_build_id);
      return { ...w, running, apiUp, live, updateAvailable };
    })
  );
  return NextResponse.json({ ok: true, worlds: enriched });
}
