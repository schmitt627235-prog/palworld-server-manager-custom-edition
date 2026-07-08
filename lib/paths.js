// lib/paths.js
// Centralizes where the app stores its data. In Electron the userData dir is
// injected via PALWORLD_MANAGER_DATA_DIR; in plain dev it falls back to ./.data.
const os = require("os");
const path = require("path");
const fs = require("fs");

function dataDir() {
  const injected = process.env.PALWORLD_MANAGER_DATA_DIR;
  const base = injected || path.join(process.cwd(), ".data");
  ensure(base);
  return base;
}

function ensure(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const P = {
  data: () => dataDir(),
  db: () => path.join(dataDir(), "registry.sqlite"),
  steamcmd: () => ensure(path.join(dataDir(), "steamcmd")),
  logs: () => ensure(path.join(dataDir(), "logs")),
  backups: () => ensure(path.join(dataDir(), "backups")),
  staging: () => ensure(path.join(dataDir(), "staging")),
  worldLogDir: (worldId) => ensure(path.join(dataDir(), "logs", worldId)),
  worldBackupDir: (worldId) => ensure(path.join(dataDir(), "backups", worldId)),
};

module.exports = { P, ensure, platform: os.platform() };
