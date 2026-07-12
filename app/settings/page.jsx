"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation, Trans } from "react-i18next";
import { useTheme } from "@/components/ThemeProvider";
import { switchLanguage } from "@/lib/i18n/client";
import { api, Icon, toast } from "@/components/ui";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [s, setS] = useState(null);
  const [steam, setSteam] = useState(null);
  const [saving, setSaving] = useState(false);
  const [backupLoc, setBackupLoc] = useState(null);
  const [backupPath, setBackupPath] = useState("");
  const [langs, setLangs] = useState([]);
  const [switching, setSwitching] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [packUrl, setPackUrl] = useState("");
  const isElectron = typeof window !== "undefined" && window.desktop?.isElectron;

  useEffect(() => {
    api("/api/settings").then((r) => setS(r.settings)).catch(() => {});
    api("/api/steamcmd").then(setSteam).catch(() => {});
    api("/api/settings/backup-dir").then((r) => { setBackupLoc(r.backup); setBackupPath(r.backup.custom ? r.backup.path : ""); }).catch(() => {});
    api("/api/i18n/languages").then((r) => setLangs(r.languages || [])).catch(() => {});
  }, []);

  const chooseLanguage = async (code) => {
    if (code === i18n.language) return;
    setSwitching(true);
    try {
      const meta = langs.find((l) => l.code === code);
      await switchLanguage(code, meta?.dir || "ltr");
      setS((prev) => (prev ? { ...prev, language: code } : prev));
    } catch (e) { toast(e.message, "error"); }
    finally { setSwitching(false); }
  };

  const refreshLangs = () => api("/api/i18n/languages").then((r) => setLangs(r.languages || [])).catch(() => {});

  // After a new pack lands, pull it into the live i18next instance so its strings are
  // usable immediately (and switch to it if the user just added the active language).
  const afterPackAdded = async (language) => {
    await refreshLangs();
    if (language?.code) {
      try { await switchLanguage(language.code, language.dir || "ltr"); setS((prev) => (prev ? { ...prev, language: language.code } : prev)); } catch {}
    }
  };

  const importPack = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPackBusy(true);
    try {
      const content = await file.text();
      const r = await api("/api/i18n/import", { method: "POST", body: { content } });
      toast(t("language.imported", { name: r.language?.nativeName || r.language?.code || "" }), "success");
      await afterPackAdded(r.language);
    } catch (err) { toast(err.message || t("language.readError"), "error"); }
    finally { setPackBusy(false); e.target.value = ""; }
  };

  const downloadPack = async () => {
    if (!packUrl.trim()) return;
    setPackBusy(true);
    try {
      const r = await api("/api/i18n/download", { method: "POST", body: { url: packUrl.trim() } });
      toast(t("language.imported", { name: r.language?.nativeName || r.language?.code || "" }), "success");
      setPackUrl("");
      await afterPackAdded(r.language);
    } catch (err) { toast(err.message, "error"); }
    finally { setPackBusy(false); }
  };

  const removePack = async (lang) => {
    if (!confirm(t("language.confirmRemove", { name: lang.nativeName || lang.code }))) return;
    setPackBusy(true);
    try {
      const r = await api(`/api/i18n/import?code=${encodeURIComponent(lang.code)}`, { method: "DELETE" });
      setLangs(r.languages || []);
      toast(t("language.removed"), "success");
      // If the removed pack was active, fall back to English.
      if (i18n.language === lang.code) { await switchLanguage("en", "ltr"); setS((prev) => (prev ? { ...prev, language: "en" } : prev)); }
    } catch (err) { toast(err.message, "error"); }
    finally { setPackBusy(false); }
  };

  const saveBackupDir = async (p) => {
    setSaving(true);
    try {
      const r = await api("/api/settings/backup-dir", { method: "POST", body: { path: p } });
      setBackupLoc(r.backup);
      setBackupPath(r.backup.custom ? r.backup.path : "");
      toast(r.backup.custom ? t("settings.backupLocationUpdated") : t("settings.backupLocationReset"), "success");
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const pickBackupDir = async () => {
    if (!isElectron) return;
    const p = await window.desktop.pickDirectory();
    if (p) setBackupPath(p);
  };

  const save = async (patch) => {
    setSaving(true);
    try {
      const r = await api("/api/settings", { method: "POST", body: patch });
      setS(r.settings);
      toast(t("settings.saved"), "success");
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  if (!s) return <div className="subtle" style={{ fontWeight: 700 }}>{t("common.loading")}</div>;

  return (
    <div>
      <h1 className="heading" style={{ fontSize: "1.9rem", margin: "0 0 1.2rem" }}>{t("settings.title")}</h1>

      <div className="panel" style={{ padding: "1.3rem", marginBottom: "1rem" }}>
        <h3 className="heading" style={{ fontSize: "1.05rem", marginTop: 0 }}>{t("settings.appearance")}</h3>
        <label className="label">{t("settings.theme")}</label>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button className={`btn ${theme === "light" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTheme("light")}><Icon name="sun" /> {t("settings.light")}</button>
          <button className={`btn ${theme === "dark" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTheme("dark")}><Icon name="moon" /> {t("settings.dark")}</button>
        </div>
      </div>

      <div className="panel" style={{ padding: "1.3rem", marginBottom: "1rem" }}>
        <h3 className="heading" style={{ fontSize: "1.05rem", marginTop: 0 }}>
          <Icon name="globe" size={17} /> {t("settings.language")}
        </h3>
        <p className="subtle" style={{ fontWeight: 600, fontSize: "0.78rem", margin: "0 0 0.6rem" }}>{t("settings.languageHelp")}</p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", maxWidth: 360 }}>
          <select className="input" style={{ flex: 1, minWidth: 200 }} value={i18n.language} disabled={switching}
            onChange={(e) => chooseLanguage(e.target.value)}>
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}{l.completeness < 100 ? ` — ${t("language.completeness", { percent: l.completeness })}` : ""}
              </option>
            ))}
          </select>
          {switching && <span className="subtle" style={{ fontSize: "0.78rem", fontWeight: 700 }}>…</span>}
        </div>
        {(() => {
          const cur = langs.find((l) => l.code === i18n.language);
          return cur && cur.completeness < 100 ? (
            <p className="subtle" style={{ fontWeight: 600, fontSize: "0.72rem", margin: "0.5rem 0 0" }}>{t("settings.languagePartial")}</p>
          ) : null;
        })()}

        {/* Import / download community packs */}
        <div style={{ marginTop: "1.1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <div className="heading" style={{ fontSize: "0.92rem" }}>{t("language.addPackTitle")}</div>
          <p className="subtle" style={{ fontWeight: 600, fontSize: "0.76rem", margin: "0.2rem 0 0.7rem" }}>{t("language.addPackDesc")}</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <label className="btn btn-ghost" style={{ cursor: packBusy ? "default" : "pointer" }}>
              <Icon name="upload" size={15} /> {packBusy ? t("language.importing") : t("language.importFile")}
              <input type="file" accept=".json,application/json" hidden disabled={packBusy} onChange={importPack} />
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t("language.downloadUrlPlaceholder")}
              value={packUrl} onChange={(e) => setPackUrl(e.target.value)} disabled={packBusy}
              onKeyDown={(e) => e.key === "Enter" && downloadPack()} />
            <button className="btn btn-primary" onClick={downloadPack} disabled={packBusy || !packUrl.trim()}>
              <Icon name="globe" size={15} /> {packBusy ? t("language.downloading") : t("language.download")}
            </button>
          </div>

          {langs.some((l) => l.custom) && (
            <div style={{ marginTop: "0.9rem" }}>
              <label className="label">{t("language.yourPacks")}</label>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {langs.filter((l) => l.custom).map((l) => (
                  <div key={l.code} className="panel-inset" style={{ padding: "0.5rem 0.7rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.84rem" }}>{l.nativeName}</span>
                    <span className="subtle" style={{ fontWeight: 700, fontSize: "0.72rem" }}>{l.code} · {t("language.completeness", { percent: l.completeness })}</span>
                    <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "0.25rem 0.55rem", fontSize: "0.74rem" }}
                      onClick={() => removePack(l)} disabled={packBusy}>
                      <Icon name="trash" size={13} /> {t("language.remove")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: "1.3rem", marginBottom: "1rem" }}>
        <h3 className="heading" style={{ fontSize: "1.05rem", marginTop: 0 }}>{t("settings.discordTitle")}</h3>
        <div className="panel-inset" style={{ padding: "0.9rem 1.1rem", borderLeft: "3px solid var(--yellow)" }}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: 4 }}>{t("settings.discordMoved")}</div>
          <p className="subtle" style={{ fontWeight: 600, fontSize: "0.8rem", margin: 0 }}>
            <Trans i18nKey="settings.discordMovedDesc" components={{ b: <b /> }} />
          </p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: "0.8rem", padding: "0.35rem 0.7rem" }}>
            <Icon name="globe" size={15} /> {t("settings.goToWorlds")}
          </Link>
        </div>
      </div>

      <div className="panel" style={{ padding: "1.3rem", marginBottom: "1rem" }}>
        <h3 className="heading" style={{ fontSize: "1.05rem", marginTop: 0 }}>{t("settings.chatCaptureTitle")}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button className={`btn ${s.chatCaptureEnabled !== false ? "btn-primary" : "btn-ghost"}`} style={{ padding: "0.35rem 0.7rem" }}
            onClick={() => save({ chatCaptureEnabled: !(s.chatCaptureEnabled !== false) })} disabled={saving}>
            {s.chatCaptureEnabled !== false ? t("common.on") : t("common.off")}
          </button>
          <span className="subtle" style={{ fontWeight: 600, fontSize: "0.78rem" }}>
            <Trans i18nKey="settings.chatCaptureDesc" components={{ b: <b /> }} />
          </span>
        </div>
      </div>

      <div className="panel" style={{ padding: "1.3rem", marginBottom: "1rem" }}>
        <h3 className="heading" style={{ fontSize: "1.05rem", marginTop: 0 }}>{t("settings.backupsTitle")}</h3>
        <label className="label">{t("settings.keepLastN")}</label>
        <div style={{ display: "flex", gap: "0.5rem", maxWidth: 260 }}>
          <input className="input" type="number" min="1" value={s.backupRetention ?? 10} onChange={(e) => setS({ ...s, backupRetention: Number(e.target.value) })} />
          <button className="btn btn-primary" onClick={() => save({ backupRetention: s.backupRetention })} disabled={saving}>{t("common.save")}</button>
        </div>

        {backupLoc && (
          <div style={{ marginTop: "1.1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <label className="label">{t("settings.backupLocation")}</label>
            <p className="subtle" style={{ fontWeight: 600, fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
              <Trans i18nKey="settings.backupLocationDesc"
                values={{ where: backupLoc.custom ? t("settings.customFolder") : t("settings.defaultFolder") }}
                components={{ b: <b />, w: <span style={{ fontWeight: 800 }} /> }} />
            </p>
            <p className="subtle" style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", margin: "0 0 0.6rem", wordBreak: "break-all" }}>{backupLoc.path}</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t("settings.backupPathPlaceholder")}
                value={backupPath} onChange={(e) => setBackupPath(e.target.value)} />
              {isElectron && (
                <button className="btn btn-ghost" onClick={pickBackupDir} disabled={saving}><Icon name="folder" size={15} /> {t("settings.chooseFolder")}</button>
              )}
              <button className="btn btn-primary" onClick={() => saveBackupDir(backupPath)} disabled={saving}>{t("common.save")}</button>
              {backupLoc.custom && (
                <button className="btn btn-ghost" onClick={() => saveBackupDir("")} disabled={saving}>{t("common.reset")}</button>
              )}
            </div>
            <p className="subtle" style={{ fontWeight: 600, fontSize: "0.72rem", margin: "0.5rem 0 0" }}>
              {t("settings.existingBackupsNote")}
            </p>
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: "1.3rem" }}>
        <h3 className="heading" style={{ fontSize: "1.05rem", marginTop: 0 }}>{t("settings.steamcmdTitle")}</h3>
        <p style={{ fontWeight: 700, fontSize: "0.86rem", margin: 0 }}>
          <span className={steam?.installed ? "s-running" : "s-crashed"}>
            {steam?.installed ? t("settings.steamcmdInstalled") : t("settings.steamcmdNotInstalled")}
          </span>
          <span className="subtle">{t("settings.steamcmdNote")}</span>
        </p>
        {steam?.path && <p className="subtle" style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", marginTop: 6 }}>{steam.path}</p>}
      </div>
    </div>
  );
}
