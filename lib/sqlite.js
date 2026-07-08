// lib/sqlite.js
// Unified synchronous SQLite adapter presenting the small subset of the
// better-sqlite3 API that db.js uses. It works across every runtime by choosing
// a backend at load time:
//
//   1. node:sqlite  — Node's built-in module (Node 22.5+ with --experimental-sqlite).
//   2. node-sqlite3-wasm — a pure-WASM fallback that needs NO native build, NO flags,
//                          and NO specific Node/Electron version. This is what makes
//                          the packaged desktop app start reliably regardless of the
//                          Electron-bundled Node version.
//
// db.js writes SQL with @named parameters and passes a single plain-key object
// (e.g. { world_id, display_name, ... }). Both backends are normalized to that.

let backend = null;   // 'node' | 'wasm'
let NodeDatabaseSync = null;
let WasmDatabase = null;

// PALWORLD_SQLITE_BACKEND=wasm forces the portable WASM backend (useful if a
// runtime's node:sqlite is broken). Default: try node:sqlite, then fall back.
const forced = process.env.PALWORLD_SQLITE_BACKEND;

if (forced !== "wasm") {
  try {
    ({ DatabaseSync: NodeDatabaseSync } = require("node:sqlite"));
    backend = "node";
  } catch { /* fall through to wasm */ }
}
if (!backend) {
  try {
    ({ Database: WasmDatabase } = require("node-sqlite3-wasm"));
    backend = "wasm";
  } catch (e) {
    throw new Error("No SQLite backend available (node:sqlite and node-sqlite3-wasm both failed): " + e.message);
  }
}

function namedKeys(sql) {
  const set = new Set();
  const re = /[@:$]([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m;
  while ((m = re.exec(sql))) set.add(m[1]);
  return set;
}

// node-sqlite3-wasm uses a "<dbfile>.lock" directory as its lock. A crashed
// process leaves it behind, deadlocking every future open. Remove it if present.
function clearStaleLock(file) {
  if (!file || file === ":memory:") return;
  try {
    const fs = require("fs");
    const lockDir = file + ".lock";
    if (fs.existsSync(lockDir)) {
      fs.rmSync(lockDir, { recursive: true, force: true });
    }
  } catch {}
}

function sleepSync(ms) {
  // busy-wait; only used briefly during open retries
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin */ }
}

// Retry an operation a few times if the WASM backend reports a transient lock.
function withLockRetry(fn) {
  let lastErr;
  for (let i = 0; i < 8; i++) {
    try { return fn(); }
    catch (e) {
      lastErr = e;
      if (!/locked|busy/i.test(e.message || "")) throw e;
      sleepSync(40 * (i + 1));
    }
  }
  throw lastErr;
}

// ---------- node:sqlite statement wrapper ----------
class NodeStatement {
  constructor(stmt, sql) {
    this._stmt = stmt;
    this._keys = namedKeys(sql);
    this._named = this._keys.size > 0;
  }
  _norm(args) {
    if (this._named && args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      const src = args[0], filtered = {};
      for (const k of this._keys) filtered[k] = src[k] === undefined ? null : src[k];
      return [filtered];
    }
    return args.map((a) => (a === undefined ? null : a));
  }
  run(...a) { return this._stmt.run(...this._norm(a)); }
  get(...a) { return this._stmt.get(...this._norm(a)); }
  all(...a) { return this._stmt.all(...this._norm(a)); }
}

// ---------- node-sqlite3-wasm statement wrapper ----------
// WASM backend wants named params keyed WITH the ':' prefix, and positional
// params as an array. We translate @name -> :name in the SQL and re-key objects.
class WasmStatement {
  constructor(db, sql) {
    this._keys = [...namedKeys(sql)];
    this._named = this._keys.length > 0;
    // WASM accepts :name, @name, and $name natively, so SQL text is unchanged.
    this._stmt = db.prepare(sql);
  }
  _bind(args) {
    if (this._named && args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      const src = args[0], out = {};
      for (const k of this._keys) out["@" + k] = src[k] === undefined ? null : src[k];
      return out;
    }
    // positional array
    return args.map((a) => (a === undefined ? null : a));
  }
  run(...a) { return withLockRetry(() => this._stmt.run(this._bind(a))); }
  get(...a) { return withLockRetry(() => this._stmt.get(this._bind(a))); }
  all(...a) { return withLockRetry(() => this._stmt.all(this._bind(a))); }
}

class Database {
  constructor(file) {
    this._backend = backend;
    if (backend === "node") {
      this._db = new NodeDatabaseSync(file);
    } else {
      // node-sqlite3-wasm locks via a "<file>.lock" DIRECTORY. If a previous run
      // crashed, that directory is left behind and every open throws
      // "database is locked" forever. Clear a stale lock before opening.
      clearStaleLock(file);
      let lastErr;
      for (let attempt = 0; attempt < 5; attempt++) {
        try { this._db = new WasmDatabase(file); lastErr = null; break; }
        catch (e) {
          lastErr = e;
          clearStaleLock(file);
          sleepSync(120);
        }
      }
      if (lastErr) throw lastErr;
    }
  }
  pragma(str) {
    // WAL journal mode is unreliable on the WASM backend's virtual filesystem;
    // skip it there. Node's built-in sqlite handles WAL fine.
    if (this._backend === "wasm" && /journal_mode/i.test(str)) return;
    try { this._db.exec(`PRAGMA ${str};`); } catch {}
  }
  exec(sql) { return withLockRetry(() => this._db.exec(sql)); }
  prepare(sql) {
    return this._backend === "node"
      ? new NodeStatement(this._db.prepare(sql), sql)
      : new WasmStatement(this._db, sql);
  }
  close() { try { this._db.close(); } catch {} }
}

// expose which backend is active (used in diagnostics)
Database.backend = backend;

module.exports = Database;
