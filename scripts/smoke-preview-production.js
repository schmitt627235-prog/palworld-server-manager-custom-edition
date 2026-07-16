const { spawn } = require("child_process");
const path = require("path");

const port = 4381;
const standalone = path.join(process.cwd(), "dist-standalone");
const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  windowsHide: true,
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    PALWORLD_MANAGER_DATA_DIR: path.join(process.cwd(), ".preview-data"),
    PALWORLD_SQLITE_BACKEND: "wasm",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  const body = await response.text();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}: ${body.slice(0, 200)}`);
  console.log(`OK ${response.status} ${route}`);
  return body;
}

async function post(route, json) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(json),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}: ${body.slice(0, 200)}`);
  console.log(`OK ${response.status} ${route}`);
  return body;
}

(async () => {
  let ready = false;
  for (let i = 0; i < 60; i += 1) {
    try {
      await get("/api/worlds");
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  if (!ready) throw new Error(`Production server did not start.\n${logs}`);
  await get("/api/health");
  const dryRun = JSON.parse(await post("/api/worlds/ce-2-3-0-preview-world/reserved-slots/dry-run", { maxPlayers: 32 }));
  if (dryRun.publicLimit !== 31 || dryRun.noActionsExecuted !== true) {
    throw new Error(`Reserved-slot 32-slot logic failed: ${JSON.stringify(dryRun)}`);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  child.kill();
});
