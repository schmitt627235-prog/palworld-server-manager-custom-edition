// Windows fallback for systems where Electron's extract-zip step leaves an
// incomplete dist directory even though the verified download is complete.
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const electronRoot = path.join(process.cwd(), "node_modules", "electron");
const dist = path.join(electronRoot, "dist");
const executable = path.join(dist, "electron.exe");
const cacheRoot = process.env.electron_config_cache || path.join(process.cwd(), ".electron-cache");

if (fs.existsSync(executable)) process.exit(0);

function findElectronZips(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findElectronZips(full, found);
    else if (/^electron-v.+-win32-x64\.zip$/i.test(entry.name)) found.push(full);
  }
  return found;
}

const candidates = findElectronZips(cacheRoot)
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .filter((item) => item.size > 50 * 1024 * 1024)
  .sort((a, b) => b.size - a.size);

if (!candidates.length) {
  console.error(`No complete Electron archive was found below ${cacheRoot}`);
  process.exit(1);
}

console.log(`Extracting verified Electron archive: ${candidates[0].file}`);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
new AdmZip(candidates[0].file).extractAllTo(dist, true);
fs.writeFileSync(path.join(electronRoot, "path.txt"), "electron.exe");

if (!fs.existsSync(executable)) {
  console.error("Electron fallback extraction did not create electron.exe.");
  process.exit(1);
}

console.log("Electron fallback extraction completed successfully.");
