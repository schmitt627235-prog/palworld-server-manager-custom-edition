import { NextResponse } from "next/server";
const https = require("https");
const fs = require("fs");
const path = require("path");
const { P } = require("@/lib/paths");
const { validatePackText, MAX_BYTES } = require("@/lib/i18n/validate");
const { listLanguages } = require("@/lib/i18n/loader");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_REDIRECTS = 4;

// POST { url } — download a pack the user pastes a link to, then validate + save it
// exactly like an imported file. https-only, size-capped mid-stream, and time-boxed;
// the download is aborted the moment it exceeds the cap so a malicious host can't
// stream us an unbounded body.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return bad("Invalid request body."); }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  let parsed;
  try { parsed = new URL(url); } catch { return bad("Enter a valid URL."); }
  if (parsed.protocol !== "https:") return bad("Only https:// links are allowed.");

  let text;
  try { text = await getText(url); }
  catch (e) { return bad(e.message || "Download failed.", 502); }

  const { ok, pack, error } = validatePackText(text);
  if (!ok) return bad(error);

  try {
    const file = path.join(P.languagePacks(), `${pack.meta.code}.json`);
    fs.writeFileSync(file, JSON.stringify(pack, null, 2), "utf8");
  } catch {
    return bad("Could not save the language pack.", 500);
  }

  const language = listLanguages().find((l) => l.code === pack.meta.code) || null;
  return NextResponse.json({ ok: true, language });
}

function getText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "palworld-server-manager", Accept: "application/json, text/plain" },
      timeout: 8000,
    }, (res) => {
      // Follow https redirects (GitHub raw / release assets bounce through a CDN).
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy();
        if (redirects >= MAX_REDIRECTS) return reject(new Error("Too many redirects."));
        const next = new URL(res.headers.location, url);
        if (next.protocol !== "https:") return reject(new Error("Redirect left https."));
        return getText(next.toString(), redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.destroy(); return reject(new Error(`Server responded ${res.statusCode}.`)); }

      let bytes = 0;
      const chunks = [];
      res.on("data", (c) => {
        bytes += c.length;
        if (bytes > MAX_BYTES) { res.destroy(); reject(new Error("Pack is too large (max 512 KB).")); return; }
        chunks.push(c);
      });
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("error", () => reject(new Error("Could not reach that host.")));
    req.on("timeout", () => { req.destroy(); reject(new Error("Download timed out.")); });
  });
}

function bad(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
