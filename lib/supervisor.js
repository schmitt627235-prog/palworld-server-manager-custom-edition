// lib/supervisor.js  (spec §4 lifecycle, §5 log capture, §9 crash guardian)
// Holds live child processes in memory (singleton across the Next server runtime).
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const kill = require("tree-kill");
const { P } = require("./paths");
const dbm = require("./db");
const rest = require("./restclient");
const ini = require("./ini");

const RING = 500; // lines kept in memory per world

// Global singleton so hot-reload / multiple route handlers share state.
const g = globalThis;
if (!g.__PAL_SUP) {
  g.__PAL_SUP = {
    procs: new Map(),          // world_id -> child process
    logs: new Map(),           // world_id -> string[] ring buffer
    listeners: new Map(),      // world_id -> Set(fn) for live log streaming
    chat: new Map(),           // world_id -> chat entry[] ring buffer
    chatListeners: new Map(),  // world_id -> Set(fn) for live chat streaming
    guardTimer: null,
  };
}
const S = g.__PAL_SUP;

function serverBinary(installDir) {
  if (os.platform() === "win32") return path.join(installDir, "PalServer.exe");
  return path.join(installDir, "PalServer.sh");
}

function buildArgs(world) {
  const args = [
    `-port=${world.game_port}`,
    `-queryport=${world.query_port}`,
    `-publicport=${world.game_port}`,
    `-RESTAPIPort=${world.rest_api_port}`,
    "-useperfthreads",
    "-NoAsyncLoadingThread",
    "-UseMultithreadForDS",
  ];
  if (world.rest_api_enabled) args.push("-RESTAPIEnabled=true");
  // If mods are explicitly disabled for this world, hard-disable via launch flag.
  if (!world.mods_enabled) args.push("-NoMods");
  // Community server: lists the server in Palworld's in-game public browser.
  // Current flag is -publiclobby; EpicApp=PalServer is the legacy equivalent kept
  // for older server builds. Both are harmless together.
  if (world.community_server) {
    args.push("-publiclobby");
    args.push("EpicApp=PalServer");
  }
  if (world.extra_args) args.push(...world.extra_args.split(/\s+/).filter(Boolean));
  return args;
}

function pushLog(worldId, line) {
  let buf = S.logs.get(worldId);
  if (!buf) { buf = []; S.logs.set(worldId, buf); }
  const stamped = `[${new Date().toISOString()}] ${line}`;
  buf.push(stamped);
  if (buf.length > RING) buf.shift();
  // append to rotating file
  try {
    fs.appendFileSync(path.join(P.worldLogDir(worldId), "console.log"), stamped + "\n");
  } catch {}
  // live listeners (SSE)
  const set = S.listeners.get(worldId);
  if (set) for (const fn of set) { try { fn(stamped); } catch {} }
  // chat detection — Palworld console emits: [<time>] [CHAT] <PlayerName> message
  const chat = parseChatLine(line);
  if (chat) recordChat(worldId, chat);
}

// Parse a Palworld console chat line into { name, message }.
// Formats seen in the wild (with optional ANSI color codes and timestamps):
//   [2026-07-07 13:55:48] [CHAT] <Frenzi> hello
//   [CHAT] <Frenzi> hello
//   [CHAT][Global] <Frenzi>: hello
//   [CHAT][Global][Frenzi(steam_123456)] hello world
//   [CHAT][Local][Frenzi] hello
function parseChatLine(line) {
  if (!line) return null;
  // strip ANSI color codes
  const clean = line.replace(/\x1b\[[0-9;]*m/g, "");
  const idx = clean.indexOf("[CHAT]");
  if (idx === -1) return null;
  let rest = clean.slice(idx + 6).trim();

  // optional channel tag like [Global] / [Local] / [Guild]
  let channel = null;
  const KNOWN_CHANNELS = ["Global", "Local", "Guild", "Whisper", "Party"];
  const chan = rest.match(/^\[([^\]]+)\]\s*/);
  if (chan && KNOWN_CHANNELS.includes(chan[1])) {
    channel = chan[1];
    rest = rest.slice(chan[0].length);
  }

  // Format A: <Name> message   or   <Name>: message
  let m = rest.match(/^<([^>]+)>\s*:?\s*(.*)$/);
  if (m) return { name: cleanName(m[1]), message: m[2].trim(), channel };

  // Format B: [Name] message  or  [Name(steam_123)] message  or  [Name]: message
  m = rest.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/);
  if (m) return { name: cleanName(m[1]), message: m[2].trim(), channel };

  // Format C: Name: message   (last resort, only if there's a colon)
  m = rest.match(/^([^:]{1,32}):\s+(.+)$/);
  if (m) return { name: cleanName(m[1]), message: m[2].trim(), channel };

  return null;
}

// Strip a trailing "(steam_12345)" or "(platform_id)" from a player name.
function cleanName(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function recordChat(worldId, chat) {
  let buf = S.chat.get(worldId);
  if (!buf) { buf = []; S.chat.set(worldId, buf); }
  const entry = { ...chat, at: Date.now() };
  buf.push(entry);
  if (buf.length > 300) buf.shift();
  try { dbm.logSession(worldId, null, chat.name, "chat"); } catch {}
  // notify chat listeners
  const set = S.chatListeners.get(worldId);
  if (set) for (const fn of set) { try { fn(entry); } catch {} }
}

function getChat(worldId) { return S.chat.get(worldId) || []; }
function subscribeChat(worldId, fn) {
  let set = S.chatListeners.get(worldId);
  if (!set) { set = new Set(); S.chatListeners.set(worldId, set); }
  set.add(fn);
  return () => set.delete(fn);
}

function getLogs(worldId) {
  return S.logs.get(worldId) || [];
}
function subscribe(worldId, fn) {
  let set = S.listeners.get(worldId);
  if (!set) { set = new Set(); S.listeners.set(worldId, set); }
  set.add(fn);
  return () => set.delete(fn);
}

function isRunning(worldId) {
  const child = S.procs.get(worldId);
  return !!child && !child.killed && child.exitCode === null;
}

function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function startWorld(worldId) {
  const world = dbm.getWorld(worldId);
  if (!world) throw new Error("World not found");
  if (isRunning(worldId)) return { started: false, reason: "already running" };

  const bin = serverBinary(world.install_dir);
  if (!fs.existsSync(bin)) throw new Error(`Server binary missing: ${bin}`);

  dbm.updateWorld(worldId, { status: "starting" });
  dbm.logEvent(worldId, "start", `Launching ${world.display_name}`);

  const args = buildArgs(world);
  pushLog(worldId, `Starting: ${path.basename(bin)} ${args.join(" ")}`);

  // On Linux the .sh needs to be executable
  try { if (os.platform() !== "win32") fs.chmodSync(bin, 0o755); } catch {}

  // Spawn options. On Windows, PalServer.exe launches the real shipping binary in
  // its own console window; windowsHide + detached + a hidden shell keep it hidden.
  const spawnOpts = {
    cwd: world.install_dir,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  };
  if (os.platform() === "win32") {
    // detached:true gives the child its own process group so we can still tree-kill
    // it, while windowsHide + CREATE_NO_WINDOW suppress the console window.
    spawnOpts.detached = true;
    spawnOpts.windowsHide = true;
  }

  const child = spawn(bin, args, spawnOpts);
  S.procs.set(worldId, child);
  dbm.updateWorld(worldId, {
    status: "running",
    process_id: child.pid,
    last_started_at: Date.now(),
  });

  child.stdout.on("data", (d) => splitLines(d).forEach((l) => pushLog(worldId, l)));
  child.stderr.on("data", (d) => splitLines(d).forEach((l) => pushLog(worldId, l)));
  child.on("close", (code) => {
    S.procs.delete(worldId);
    const w = dbm.getWorld(worldId);
    pushLog(worldId, `Process exited with code ${code}`);
    // If we weren't intentionally stopping/updating, mark crashed.
    if (w && w.status !== "stopping" && w.status !== "updating") {
      dbm.updateWorld(worldId, { status: "crashed", process_id: null });
      dbm.logEvent(worldId, "crash", `Exited unexpectedly (code ${code})`);
    } else {
      dbm.updateWorld(worldId, { status: "stopped", process_id: null });
    }
  });

  ensureGuardian();
  return { started: true, pid: child.pid };
}

async function stopWorld(worldId, { graceful = true, waittime = 15 } = {}) {
  const world = dbm.getWorld(worldId);
  if (!world) throw new Error("World not found");
  dbm.updateWorld(worldId, { status: "stopping" });
  dbm.logEvent(worldId, "stop", `Stopping ${world.display_name}`);

  if (graceful && world.rest_api_enabled) {
    try {
      // NOTE: do NOT call rest.save() here. On shutdown Palworld re-serializes its
      // loaded config back to PalWorldSettings.ini; calling save() first makes it
      // persist the OLD in-memory settings and overwrite edits made while stopped.
      // shutdown() alone triggers a clean save of world data on exit.
      await rest.shutdown(world, waittime, "Server shutting down.");
    } catch { /* fall through to hard kill */ }
  }
  const child = S.procs.get(worldId);
  await new Promise((resolve) => {
    if (!child) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    child.once("close", finish);
    // hard timeout
    setTimeout(() => {
      if (child.pid) kill(child.pid, "SIGKILL", () => {});
      setTimeout(finish, 1500);
    }, graceful ? (waittime + 5) * 1000 : 500);
  });
  S.procs.delete(worldId);
  dbm.updateWorld(worldId, { status: "stopped", process_id: null });
  // Give the OS a moment to flush the config file Palworld rewrites on exit,
  // so a subsequent start reads the fully-written ini.
  await new Promise((r) => setTimeout(r, 800));
  return { stopped: true };
}

async function restartWorld(worldId) {
  // Capture the user's intended settings BEFORE stopping, because Palworld
  // rewrites PalWorldSettings.ini on exit and would otherwise clobber edits.
  const world = dbm.getWorld(worldId);
  let intendedIni = null;
  try {
    if (world) intendedIni = fs.readFileSync(ini.settingsIniPath(world.install_dir), "utf8");
  } catch {}

  await stopWorld(worldId, { graceful: true, waittime: 5 });
  await new Promise((r) => setTimeout(r, 1500));

  // Re-write the intended settings now that the old process has fully exited and
  // done its own exit-time config write. This makes edits actually persist.
  try {
    if (intendedIni && world) {
      fs.writeFileSync(ini.settingsIniPath(world.install_dir), intendedIni, "utf8");
      dbm.logEvent(worldId, "settings", "Re-applied saved settings after shutdown");
    }
  } catch {}

  return startWorld(worldId);
}

// ---- Crash guardian (spec §9) ----
function ensureGuardian() {
  if (S.guardTimer) return;
  S.guardTimer = setInterval(guardTick, 20000);
}
async function guardTick() {
  const worlds = dbm.listWorlds();
  for (const w of worlds) {
    if (!w.crash_guard) continue;
    if (w.status === "crashed") {
      // auto-relaunch after a crash
      dbm.updateWorld(w.world_id, { crash_count: (w.crash_count || 0) + 1 });
      dbm.logEvent(w.world_id, "guardian", "Crash detected — auto-restarting");
      try { await startWorld(w.world_id); } catch {}
      continue;
    }
    if (w.status === "running") {
      const alive = isRunning(w.world_id) || pidAlive(w.process_id);
      if (!alive) {
        dbm.updateWorld(w.world_id, { status: "crashed" });
        continue;
      }
      // process alive but API frozen for extended period → treat as hang
      if (w.rest_api_enabled) {
        const ok = await rest.healthy(w).catch(() => false);
        if (!ok) {
          const hangs = (S.__hang ||= new Map());
          const n = (hangs.get(w.world_id) || 0) + 1;
          hangs.set(w.world_id, n);
          if (n >= 6) { // ~2 min unresponsive
            hangs.set(w.world_id, 0);
            dbm.logEvent(w.world_id, "guardian", "API unresponsive — force restarting (hang)");
            try { await restartWorld(w.world_id); } catch {}
          }
        } else {
          (S.__hang ||= new Map()).set(w.world_id, 0);
        }
      }
    }
  }
}

function splitLines(buf) {
  return buf.toString("utf8").split(/\r?\n/).filter((l) => l.length);
}

module.exports = {
  serverBinary, buildArgs, startWorld, stopWorld, restartWorld,
  isRunning, pidAlive, getLogs, subscribe, pushLog, ensureGuardian,
  getChat, subscribeChat, parseChatLine,
};
