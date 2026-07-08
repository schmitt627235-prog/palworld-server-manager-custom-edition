// lib/scheduler.js  (spec §7 scheduler, §8 update all)
const dbm = require("./db");
const steam = require("./steamcmd");
const sup = require("./supervisor");
const { createBackup } = require("./backups");
const { notify } = require("./notify");

const g = globalThis;
if (!g.__PAL_SCHED) g.__PAL_SCHED = { timer: null, updating: new Set() };
const ST = g.__PAL_SCHED;

function ensureScheduler() {
  if (ST.timer) return;
  ST.timer = setInterval(tick, 60 * 1000); // check every minute
  tick();
}

function due(sched, now) {
  if (!sched.enabled) return false;
  const last = sched.last_run || 0;
  if (sched.mode === "interval" && sched.interval_hours) {
    return now - last >= sched.interval_hours * 3600 * 1000;
  }
  if (sched.mode === "daily" && sched.time_of_day) {
    const [h, m] = sched.time_of_day.split(":").map(Number);
    const d = new Date(now);
    const target = new Date(d); target.setHours(h, m, 0, 0);
    // fire within the minute window, and not already run today
    const ranToday = last && new Date(last).toDateString() === d.toDateString();
    return !ranToday && d >= target && d - target < 90 * 1000;
  }
  return false;
}

async function tick() {
  const now = Date.now();
  for (const s of dbm.listSchedules()) {
    if (!due(s, now)) continue;
    dbm.updateScheduleRun(s.id, now);
    try {
      if (s.job_type === "backup") await createBackup(s.world_id, "scheduled");
      else if (s.job_type === "restart") await scheduledRestart(s.world_id);
      else if (s.job_type === "update") await updateWorld(s.world_id);
      dbm.logEvent(s.world_id, "scheduler", `Ran ${s.job_type} job`);
    } catch (e) {
      dbm.logEvent(s.world_id, "scheduler", `Job ${s.job_type} failed: ${e.message}`);
    }
  }
}

async function scheduledRestart(worldId) {
  const w = dbm.getWorld(worldId);
  if (!w) return;
  await createBackup(worldId, "pre-restart-safety").catch(() => {});
  await notify("restart", `Scheduled restart of ${w.display_name}`);
  await sup.restartWorld(worldId);
}

// ---- Update All / per-world update (spec §8) ----
async function checkUpdates() {
  const latest = await steam.fetchLatestBuildId();
  if (!latest) return { latest: null, worlds: [] };
  const flagged = [];
  for (const w of dbm.listWorlds()) {
    dbm.updateWorld(w.world_id, { latest_known_build_id: latest });
    if (w.build_id && w.build_id !== latest) flagged.push(w.world_id);
  }
  return { latest, worlds: flagged };
}

async function updateWorld(worldId, onLog = () => {}) {
  if (ST.updating.has(worldId)) return { skipped: "already updating" };
  ST.updating.add(worldId);
  const w = dbm.getWorld(worldId);
  try {
    const wasRunning = sup.isRunning(worldId);
    if (wasRunning) {
      onLog("Saving and shutting down...");
      await sup.stopWorld(worldId, { graceful: true, waittime: 20 });
    }
    dbm.updateWorld(worldId, { status: "updating" });
    onLog("Creating safety backup...");
    await createBackup(worldId, "pre-update-safety").catch(() => {});
    onLog("Running SteamCMD update...");
    const code = await steam.installOrUpdate(w.install_dir, onLog);
    if (code !== 0) throw new Error(`SteamCMD failed (${code})`);
    const bid = steam.readInstalledBuildId(w.install_dir);
    if (bid) dbm.updateWorld(worldId, { build_id: bid });
    dbm.updateWorld(worldId, { status: "stopped" });
    if (wasRunning) { onLog("Relaunching..."); await sup.startWorld(worldId); }
    dbm.logEvent(worldId, "update", `Updated to build ${bid || "?"}`);
    await notify("update", `${w.display_name} updated to build ${bid || "?"}`);
    return { ok: true, build: bid };
  } catch (e) {
    dbm.updateWorld(worldId, { status: "stopped" });
    return { ok: false, error: e.message };
  } finally {
    ST.updating.delete(worldId);
  }
}

async function updateAll(onLog = () => {}) {
  const { worlds } = await checkUpdates();
  const results = [];
  for (const id of worlds) {
    onLog(`Updating world ${id}...`);
    results.push({ worldId: id, ...(await updateWorld(id, onLog)) });
  }
  return results;
}

module.exports = { ensureScheduler, tick, checkUpdates, updateWorld, updateAll };
