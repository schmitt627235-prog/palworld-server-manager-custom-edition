const fs = require("fs");
const path = require("path");

const root = process.cwd();
const english = JSON.parse(fs.readFileSync(path.join(root, "public", "locales", "en.json"), "utf8"));
const known = new Set(Object.keys(english.strings || {}));
const missing = new Map();

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|jsx)$/.test(entry.name)) {
      const source = fs.readFileSync(file, "utf8");
      const pattern = /\bt\(\s*["'`]([^"'`$]+)["'`]\s*[,)]/g;
      for (const match of source.matchAll(pattern)) {
        const key = match[1];
        const pluralized = known.has(`${key}_one`) && known.has(`${key}_other`);
        if (!known.has(key) && !pluralized) {
          if (!missing.has(key)) missing.set(key, []);
          missing.get(key).push(path.relative(root, file));
        }
      }
      const indirectPattern = /\b(?:labelKey|noteKey|reasonKey|integrityKey)\s*:\s*["']([^"']+)["']/g;
      for (const match of source.matchAll(indirectPattern)) {
        const key = match[1];
        if (!known.has(key)) {
          if (!missing.has(key)) missing.set(key, []);
          missing.get(key).push(path.relative(root, file));
        }
      }
    }
  }
}

walk(path.join(root, "app"));
walk(path.join(root, "components"));

if (missing.size) {
  for (const [key, files] of missing) console.error(`${key}: ${[...new Set(files)].join(", ")}`);
  process.exit(1);
}
console.log(`i18n usage OK: all ${known.size} canonical English keys are available to literal t() calls.`);
