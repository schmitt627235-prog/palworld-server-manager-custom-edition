const fs = require("fs");
const path = require("path");

const localeDir = path.join(process.cwd(), "public", "locales");
const english = JSON.parse(fs.readFileSync(path.join(localeDir, "en.json"), "utf8"));
const tokenPattern = /{{[^{}]+}}|<\/?[A-Za-z][^>]*>/g;

function tokens(value) {
  return (String(value).match(tokenPattern) || []).sort().join("\u0000");
}

for (const name of fs.readdirSync(localeDir).filter((name) => name.endsWith(".json") && name !== "en.json")) {
  const file = path.join(localeDir, name);
  const pack = JSON.parse(fs.readFileSync(file, "utf8"));
  const ordered = {};
  let fallbacks = 0;
  for (const [key, source] of Object.entries(english.strings)) {
    const translated = pack.strings && pack.strings[key];
    if (typeof translated !== "string" || !translated.trim() || tokens(translated) !== tokens(source)) {
      ordered[key] = source;
      fallbacks += 1;
    } else {
      ordered[key] = translated;
    }
  }
  pack.strings = ordered;
  fs.writeFileSync(file, JSON.stringify(pack, null, 2) + "\n", "utf8");
  console.log(`${name}: ${Object.keys(ordered).length} keys, ${fallbacks} safe English fallbacks added`);
}
