const net = require("net");
const { spawn } = require("child_process");
const treeKill = require("tree-kill");

const HOST = "127.0.0.1";
const FIRST_PORT = 4317;
const LAST_PORT = 4399;

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: HOST, port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findPort() {
  for (let port = FIRST_PORT; port <= LAST_PORT; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free preview port between ${FIRST_PORT} and ${LAST_PORT}.`);
}

function waitForPort(port, child) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 60000;
    const probe = () => {
      if (child.exitCode !== null) return reject(new Error("Next.js stopped before it became ready."));
      const socket = net.connect({ host: HOST, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) reject(new Error("Timed out while waiting for Next.js."));
        else setTimeout(probe, 250);
      });
    };
    probe();
  });
}

function stop(child) {
  if (!child || !child.pid || child.exitCode !== null) return;
  treeKill(child.pid, "SIGTERM", () => {});
}

(async () => {
  const port = await findPort();
  const url = `http://${HOST}:${port}`;
  console.log(`Using free preview port ${port}.`);

  const nextBin = require.resolve("next/dist/bin/next");
  const next = spawn(process.execPath, [nextBin, "dev", "-H", HOST, "-p", String(port)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  let electron;
  const shutdown = () => {
    stop(electron);
    stop(next);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await waitForPort(port, next);
  if (process.env.PSM_PREVIEW_PORT_TEST === "1") {
    console.log(`PORT_TEST_OK=${port}`);
    treeKill(next.pid, "SIGTERM", () => process.exit(0));
    return;
  }

  const electronBin = require("electron");
  electron = spawn(electronBin, ["."], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_START_URL: url,
      NODE_ENV: "development",
    },
    stdio: "inherit",
  });

  electron.once("exit", (code) => {
    const exitCode = code || 0;
    if (next.pid && next.exitCode === null) {
      treeKill(next.pid, "SIGTERM", () => process.exit(exitCode));
    } else {
      process.exit(exitCode);
    }
  });
  next.once("exit", (code) => {
    if (!electron || electron.exitCode === null) stop(electron);
    if (code && !process.exitCode) process.exitCode = code;
  });
})().catch((error) => {
  console.error(`Preview start failed: ${error.message}`);
  process.exitCode = 1;
});
