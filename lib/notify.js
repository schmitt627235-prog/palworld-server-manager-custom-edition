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

// Fired by modules on notable events.
async function notify(kind, text) {
  const url = dbm.getSetting("discordWebhook", "");
  const enabled = dbm.getSetting("notifyEvents", {});
  if (!url) return;
  if (enabled && enabled[kind] === false) return;
  await post(url, { content: `**[${kind}]** ${text}` });
}

module.exports = { notify, post };
