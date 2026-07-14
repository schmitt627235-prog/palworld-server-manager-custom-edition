const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), "public", "locales");
const english = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
const keys = Object.keys(english.strings);
const keySet = new Set(keys);
const tokenPattern = /{{[^{}]+}}|<\/?[A-Za-z][^>]*>/g;
let failed = false;

function tokens(value) {
  return (String(value).match(tokenPattern) || []).sort();
}

for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
  const full = path.join(dir, file);
  let pack;
  try { pack = JSON.parse(fs.readFileSync(full, "utf8")); }
  catch (error) { console.error(`${file}: invalid JSON: ${error.message}`); failed = true; continue; }
  const localKeys = Object.keys(pack.strings || {});
  const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(pack.strings || {}, key));
  const extra = localKeys.filter((key) => !keySet.has(key));
  const empty = keys.filter((key) => typeof pack.strings?.[key] !== "string" || !pack.strings[key].trim());
  const broken = keys.filter((key) => JSON.stringify(tokens(pack.strings?.[key])) !== JSON.stringify(tokens(english.strings[key])));
  const leaked = keys.filter((key) => /ZXQ(?:PH|SPLIT)\w*QXZ/.test(pack.strings?.[key] || ""));
  const unchanged = keys.filter((key) => pack.strings?.[key] === english.strings[key]).length;
  const expectedDir = pack.meta?.code === "ar" ? "rtl" : "ltr";
  const dirOk = pack.meta?.dir === expectedDir;
  const ok = !missing.length && !extra.length && !empty.length && !broken.length && !leaked.length && dirOk;
  console.log(`${file}: ${ok ? "OK" : "FAIL"} | ${localKeys.length}/${keys.length} keys | English fallbacks/exact matches: ${unchanged} | dir=${pack.meta?.dir}`);
  if (!ok) {
    if (missing.length) console.error("  missing:", missing.slice(0, 10));
    if (extra.length) console.error("  extra:", extra.slice(0, 10));
    if (empty.length) console.error("  empty:", empty.slice(0, 10));
    if (broken.length) console.error("  broken tokens:", broken.slice(0, 10));
    if (leaked.length) console.error("  leaked tokens:", leaked.slice(0, 10));
    if (!dirOk) console.error(`  expected direction: ${expectedDir}`);
    failed = true;
  }
}

if (failed) process.exit(1);
