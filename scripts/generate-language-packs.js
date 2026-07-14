// Generates first-draft community language packs from the canonical English pack.
// Existing non-empty translations (notably German) are preserved. Machine output
// is deliberately marked in metadata and must be reviewed before being called native.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "public", "locales");
const source = JSON.parse(fs.readFileSync(path.join(ROOT, "en.json"), "utf8"));
const sourceStrings = source.strings;
const targets = [
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr", google: "de", preserve: true },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr", google: "pl" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr", google: "fr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr", google: "tr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr", google: "ja" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", google: "ar" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr", google: "ru" },
  { code: "zh-CN", name: "Simplified Chinese", nativeName: "简体中文", dir: "ltr", google: "zh-CN" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr", google: "it" },
  { code: "th", name: "Thai", nativeName: "ไทย", dir: "ltr", google: "th" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", google: "hi" },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr", google: "ko" },
];

const TECH = [
  "Palworld", "PalServer", "Pal\\Saved", "SteamCMD", "SteamID64", "Steam ID",
  "REST API", "RCON", "UE4SS", "Playit.gg", "Discord", "GitHub", "JSON", "INI",
  "CPU", "RAM", "FPS", "TPS", "UDP", "TCP", "Windows", "Linux", "macOS",
];

function protectedText(input) {
  const saved = [];
  let text = String(input);
  const protect = (value) => {
    const token = `ZXQPH${String(saved.length).padStart(3, "0")}QXZ`;
    saved.push(value);
    return token;
  };
  // Protect interpolation, markup, URLs, code spans and command-line flags first.
  text = text.replace(/{{[^{}]+}}|<\/?[A-Za-z][^>]*>|https?:\/\/[^\s)]+|`[^`]+`|--?[A-Za-z][A-Za-z0-9-]*/g, protect);
  for (const term of [...TECH].sort((a, b) => b.length - a.length)) {
    text = text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => protect(m));
  }
  return { text, saved };
}

function restoreText(text, saved) {
  let out = String(text);
  for (let i = 0; i < saved.length; i++) {
    const token = `ZXQPH${String(i).padStart(3, "0")}QXZ`;
    if (!out.includes(token)) throw new Error(`protected token ${token} was changed`);
    out = out.split(token).join(saved[i]);
  }
  return out;
}

function structuralTokens(text) {
  return (String(text).match(/{{[^{}]+}}|<\/?[A-Za-z][^>]*>/g) || []).sort();
}

async function translateRaw(text, target, attempt = 0) {
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
    encodeURIComponent(target) + "&dt=t&q=" + encodeURIComponent(text);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "PSM-CE-language-pack-builder/3.1.1" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return (json[0] || []).map((part) => part[0] || "").join("");
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    return translateRaw(text, target, attempt + 1);
  }
}

function chunksOf(entries, maxChars = 2600) {
  const chunks = [];
  let current = [], length = 0;
  for (const entry of entries) {
    const n = entry.protected.text.length + 32;
    if (current.length && length + n > maxChars) { chunks.push(current); current = []; length = 0; }
    current.push(entry); length += n;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function translateChunk(chunk, target, chunkNo) {
  const separator = `\nZXQSPLIT${String(chunkNo).padStart(4, "0")}QXZ\n`;
  const combined = chunk.map((x) => x.protected.text).join(separator);
  const result = await translateRaw(combined, target);
  const parts = result.split(separator);
  if (parts.length !== chunk.length) {
    // Translator altered a separator. Fall back to isolated requests for this chunk.
    return Promise.all(chunk.map((x) => translateRaw(x.protected.text, target)));
  }
  return parts;
}

async function buildPack(target) {
  const file = path.join(ROOT, `${target.code}.json`);
  let existing = null;
  // Always resume from an existing pack. This preserves human corrections and
  // lets an interrupted multi-language generation continue without retranslating
  // languages that were already completed.
  if (fs.existsSync(file)) {
    try { existing = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  }
  const output = {};
  const pending = [];
  for (const [key, value] of Object.entries(sourceStrings)) {
    const old = existing && existing.strings && existing.strings[key];
    if (typeof old === "string" && old.trim()) output[key] = old;
    else pending.push({ key, source: value, protected: protectedText(value) });
  }

  const chunks = chunksOf(pending);
  console.log(`${target.code}: translating ${pending.length} strings in ${chunks.length} batches`);
  let fallbackCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const translated = await translateChunk(chunks[i], target.google, i);
    for (let j = 0; j < chunks[i].length; j++) {
      const item = chunks[i][j];
      try {
        const restored = restoreText(translated[j], item.protected.saved).trim();
        if (JSON.stringify(structuralTokens(restored)) !== JSON.stringify(structuralTokens(item.source))) {
          throw new Error("placeholder/markup mismatch");
        }
        output[item.key] = restored || item.source;
      } catch {
        // Never ship broken placeholders. English fallback is safer and visible to reviewers.
        output[item.key] = item.source;
        fallbackCount++;
      }
    }
    process.stdout.write(`  ${i + 1}/${chunks.length}\r`);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  process.stdout.write("\n");

  const ordered = {};
  for (const key of Object.keys(sourceStrings)) ordered[key] = output[key];
  const pack = {
    meta: {
      code: target.code,
      name: target.name,
      nativeName: target.nativeName,
      dir: target.dir,
      schema: 1,
      authors: ["PSM Community Edition machine translation"],
      machineTranslated: true,
      humanReviewed: false,
      updatedAt: "2026-07-14",
    },
    strings: ordered,
  };
  fs.writeFileSync(file, JSON.stringify(pack, null, 2) + "\n", "utf8");
  console.log(`${target.code}: wrote ${Object.keys(ordered).length} keys; safe English fallbacks: ${fallbackCount}`);
}

async function main() {
  for (const target of targets) await buildPack(target);
}

main().catch((error) => { console.error(error); process.exit(1); });
