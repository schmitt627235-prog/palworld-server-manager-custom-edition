// lib/notify.js  (spec §10)
const https = require("https");
const dbm = require("./db");

function post(url, payload) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const data = JSON.stringify(payload);
      const req = https.request(
        { hostname: u.hostname, path: u.pathname + u.search, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
        (res) => { res.on("data", () => {}); res.on("end", resolve); }
      );
      req.on("error", resolve);
      req.write(data); req.end();
    } catch { resolve(); }
  });
}

// Parse a world's per-world notify_events JSON. A missing/blank value means "all on".
function notifyEventsFor(world) {
  if (!world || !world.notify_events) return {};
  try { return JSON.parse(world.notify_events) || {}; } catch { return {}; }
}

// Fired by modules on notable events. The Discord webhook is now per-world, so callers
// pass the world id; we look up that world's webhook and event toggles.
async function notify(worldId, kind, text) {
  const world = dbm.getWorld(worldId);
  if (!world) return;
  const url = (world.discord_webhook || "").trim();
  if (!url) return;
  const enabled = notifyEventsFor(world);
  if (enabled[kind] === false) return;
  await post(url, { content: `**[${kind}]** ${text}` });
}

module.exports = { notify, post, notifyEventsFor };
