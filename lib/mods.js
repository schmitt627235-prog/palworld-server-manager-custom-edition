// lib/mods.js
// Palworld native server-side mod management, per the official docs:
// https://docs.palworldgame.com/settings-and-operation/mod/
//
// How the official system works:
//   - Workshop mods live in <installDir>/Mods/Workshop/<anyFolder>/Info.json
//   - Mods are enabled in <installDir>/Mods/PalModSettings.ini:
//         [PalModSettings]
//         bGlobalEnableMod=true
//         ActiveModList=<PackageName>   (one line per mod; PackageName from Info.json)
//   - On restart the server deploys each active mod per its InstallRules and writes
//     Mods/ManagedMods/<PackageName>/InstallManifest.json
//   - A mod only runs on a dedicated server if Info.json InstallRule includes "IsServer": true
//   - Server-side mods are Windows-only.
//   - Launch arg -NoMods disables all mods.
//
// This module reads/writes PalModSettings.ini, scans the Workshop folder, parses
// each Info.json, and imports mod archives into the Workshop directory.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const AdmZip = require("adm-zip");
const dbm = require("./db");

function modsRoot(installDir) { return path.join(installDir, "Mods"); }
function workshopDir(installDir) { return path.join(modsRoot(installDir), "Workshop"); }
function modSettingsPath(installDir) { return path.join(modsRoot(installDir), "PalModSettings.ini"); }

// ---- PalModSettings.ini read/write ----
function readModSettings(installDir) {
  const p = modSettingsPath(installDir);
  if (!fs.existsSync(p)) return { exists: false, globalEnable: false, activeMods: [], workshopRootDir: null };
  const raw = fs.readFileSync(p, "utf8");
  const globalEnable = /bGlobalEnableMod\s*=\s*true/i.test(raw);
  const activeMods = [];
  const rootMatch = raw.match(/WorkshopRootDir\s*=\s*(.+)/i);
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*ActiveModList\s*=\s*(.+?)\s*$/i);
    if (m && !line.trim().startsWith("#") && !line.trim().startsWith(";")) activeMods.push(m[1].trim());
  }
  return {
    exists: true,
    globalEnable,
    activeMods,
    workshopRootDir: rootMatch && !rootMatch[0].trim().startsWith("#") ? rootMatch[1].trim() : null,
  };
}

function writeModSettings(installDir, { globalEnable, activeMods, workshopRootDir }) {
  fs.mkdirSync(modsRoot(installDir), { recursive: true });
  let out = "[PalModSettings]\n";
  out += `bGlobalEnableMod=${globalEnable ? "true" : "false"}\n`;
  for (const pkg of activeMods) out += `ActiveModList=${pkg}\n`;
  if (workshopRootDir) out += `WorkshopRootDir=${workshopRootDir}\n`;
  fs.writeFileSync(modSettingsPath(installDir), out, "utf8");
  return modSettingsPath(installDir);
}

// ---- Info.json parsing ----
// Info.json shape (per official + community docs) includes at least:
//   { "PackageName": "...", "Version": "...", "InstallRules": { "IsServer": true, ... } }
function parseInfoJson(infoPath) {
  try {
    const j = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    const rule = j.InstallRule || j.InstallRules || {};
    return {
      packageName: j.PackageName || j.packageName || null,
      displayName: j.DisplayName || j.Name || j.PackageName || null,
      version: j.Version || j.version || null,
      isServer: rule.IsServer === true || rule.isServer === true,
      workshopId: j.WorkshopId || j.workshopId || null,
      raw: j,
    };
  } catch (e) {
    return { packageName: null, error: e.message };
  }
}

// Scan the Workshop directory for installed mods (folders containing Info.json).
function scanWorkshop(installDir) {
  const wd = workshopDir(installDir);
  if (!fs.existsSync(wd)) return [];
  const found = [];
  for (const entry of fs.readdirSync(wd, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const infoPath = path.join(wd, entry.name, "Info.json");
    if (fs.existsSync(infoPath)) {
      const info = parseInfoJson(infoPath);
      found.push({ folder: entry.name, infoPath, ...info });
    }
  }
  return found;
}

// Combined view: what's on disk (Workshop) reconciled with the active list.
function status(worldId) {
  const world = dbm.getWorld(worldId);
  if (!world) throw new Error("World not found");
  const settings = readModSettings(world.install_dir);
  const onDisk = scanWorkshop(world.install_dir);
  const activeSet = new Set(settings.activeMods);
  const windowsOnlyWarning = os.platform() !== "win32";

  const mods = onDisk.map((m) => ({
    folder: m.folder,
    packageName: m.packageName,
    displayName: m.displayName || m.packageName || m.folder,
    version: m.version,
    isServer: m.isServer,
    workshopId: m.workshopId,
    enabled: m.packageName ? activeSet.has(m.packageName) : false,
    infoError: m.error || null,
  }));

  // active packages with no matching folder on disk (dangling)
  const diskPkgs = new Set(onDisk.map((m) => m.packageName).filter(Boolean));
  const dangling = settings.activeMods.filter((p) => !diskPkgs.has(p));

  return {
    globalEnable: settings.globalEnable,
    modsSettingsExists: settings.exists,
    workshopDir: workshopDir(world.install_dir),
    windowsOnlyWarning,
    mods,
    dangling,
  };
}

// Toggle a mod's active state by editing ActiveModList.
function setModEnabled(worldId, packageName, enabled) {
  const world = dbm.getWorld(worldId);
  const s = readModSettings(world.install_dir);
  let active = new Set(s.activeMods);
  if (enabled) active.add(packageName); else active.delete(packageName);
  writeModSettings(world.install_dir, {
    globalEnable: s.globalEnable || enabled, // enabling a mod implies global enable
    activeMods: [...active],
    workshopRootDir: s.workshopRootDir,
  });
  dbm.logEvent(worldId, "mod", `${enabled ? "Enabled" : "Disabled"} mod ${packageName} (restart to apply)`);
  return status(worldId);
}

// Set the global mod on/off switch.
function setGlobalEnable(worldId, on) {
  const world = dbm.getWorld(worldId);
  const s = readModSettings(world.install_dir);
  writeModSettings(world.install_dir, { globalEnable: on, activeMods: s.activeMods, workshopRootDir: s.workshopRootDir });
  dbm.updateWorld(worldId, { mods_enabled: on ? 1 : 0 });
  dbm.logEvent(worldId, "mod", `Global mods ${on ? "enabled" : "disabled"} (restart to apply)`);
  return status(worldId);
}

// Import a mod archive (zip) into Workshop/<folder>. The zip must contain an
// Info.json somewhere; we place its containing folder under Workshop.
function importModZip(worldId, zipPath) {
  const world = dbm.getWorld(worldId);
  if (!world) throw new Error("World not found");
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const infoEntry = entries.find((e) => /(^|\/)Info\.json$/i.test(e.entryName.replace(/\\/g, "/")));
  if (!infoEntry) throw new Error("Archive has no Info.json — not a Workshop-style Palworld mod");

  // parse Info.json straight from the archive to get PackageName
  let info;
  try { info = JSON.parse(zip.readAsText(infoEntry)); } catch { throw new Error("Info.json is not valid JSON"); }
  const pkg = info.PackageName || info.packageName;
  if (!pkg) throw new Error("Info.json has no PackageName");
  const rule = info.InstallRule || info.InstallRules || {};
  const isServer = rule.IsServer === true || rule.isServer === true;

  // folder inside the zip that holds Info.json
  const infoPathNorm = infoEntry.entryName.replace(/\\/g, "/");
  const innerDir = infoPathNorm.includes("/") ? infoPathNorm.slice(0, infoPathNorm.lastIndexOf("/")) : "";

  const wd = workshopDir(world.install_dir);
  const destFolder = pkg.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const dest = path.join(wd, destFolder);
  fs.mkdirSync(dest, { recursive: true });

  // extract only the mod's own subtree, rebased to dest root
  for (const e of entries) {
    if (e.isDirectory) continue;
    const norm = e.entryName.replace(/\\/g, "/");
    if (innerDir && !norm.startsWith(innerDir + "/")) continue;
    const rel = innerDir ? norm.slice(innerDir.length + 1) : norm;
    const outPath = path.join(dest, rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, e.getData());
  }

  // record in registry
  const id = crypto.randomUUID();
  dbm.insertMod({
    id, world_id: worldId, package_name: pkg,
    display_name: info.DisplayName || info.Name || pkg,
    workshop_id: info.WorkshopId || null,
    version: info.Version || null,
    source: "manual", folder: destFolder,
    is_server: isServer ? 1 : 0, enabled: 0, created_at: Date.now(),
  });

  dbm.logEvent(worldId, "mod", `Imported mod ${pkg}${isServer ? "" : " (⚠ not marked IsServer)"}`);
  return { packageName: pkg, folder: destFolder, isServer, version: info.Version || null };
}

// Register a Workshop mod by numeric ID (user must have subscribed/downloaded it
// via Steam; we point the server at the standard workshop content path or copy it).
function copyFromWorkshopContent(worldId, workshopId, steamWorkshopPath) {
  const world = dbm.getWorld(worldId);
  if (!world) throw new Error("World not found");
  // default steam workshop content path for Palworld (app 1623730)
  const src = steamWorkshopPath || path.join(
    "C:", "Program Files (x86)", "Steam", "steamapps", "workshop", "content", "1623730", String(workshopId)
  );
  if (!fs.existsSync(src)) throw new Error(`Workshop content not found at ${src}. Subscribe/download it in Steam first, or provide the path.`);
  const infoPath = path.join(src, "Info.json");
  if (!fs.existsSync(infoPath)) throw new Error("That workshop folder has no Info.json");
  const info = parseInfoJson(infoPath);
  const dest = path.join(workshopDir(world.install_dir), String(workshopId));
  copyDir(src, dest);
  const id = crypto.randomUUID();
  dbm.insertMod({
    id, world_id: worldId, package_name: info.packageName,
    display_name: info.displayName, workshop_id: String(workshopId),
    version: info.version, source: "workshop", folder: String(workshopId),
    is_server: info.isServer ? 1 : 0, enabled: 0, created_at: Date.now(),
  });
  dbm.logEvent(worldId, "mod", `Added workshop mod ${workshopId} (${info.packageName})`);
  return { packageName: info.packageName, workshopId, isServer: info.isServer };
}

// Remove a mod: disable it, delete its Workshop folder.
function removeMod(worldId, packageNameOrFolder) {
  const world = dbm.getWorld(worldId);
  const s = readModSettings(world.install_dir);
  const disk = scanWorkshop(world.install_dir);
  const target = disk.find((m) => m.packageName === packageNameOrFolder || m.folder === packageNameOrFolder);

  // remove from active list
  if (target?.packageName) {
    const active = s.activeMods.filter((p) => p !== target.packageName);
    writeModSettings(world.install_dir, { globalEnable: s.globalEnable, activeMods: active, workshopRootDir: s.workshopRootDir });
  }
  // delete folder
  if (target?.folder) {
    const dir = path.join(workshopDir(world.install_dir), target.folder);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  dbm.logEvent(worldId, "mod", `Removed mod ${packageNameOrFolder} (restart to apply)`);
  return status(worldId);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, item.name), d = path.join(dst, item.name);
    if (item.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

module.exports = {
  modsRoot, workshopDir, modSettingsPath,
  readModSettings, writeModSettings, parseInfoJson, scanWorkshop,
  status, setModEnabled, setGlobalEnable,
  importModZip, copyFromWorkshopContent, removeMod,
};
