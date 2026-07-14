"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Icon, toast } from "@/components/ui";

export default function PlayitPanel({ world, running, onChange }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(!!world.playit_enabled);
  const [ip, setIp] = useState(world.playit_public_ip || "");
  const [port, setPort] = useState(world.playit_public_port || 14815);
  const [busy, setBusy] = useState(false);
  const args = [world.community_server ? "-publiclobby" : null, enabled && ip ? `-publicip=${ip}` : null, enabled ? `-publicport=${port}` : null, `-port=${world.game_port}`].filter(Boolean).join(" ");

  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/worlds/${world.world_id}`, { method: "PATCH", body: { playit_enabled: enabled, playit_public_ip: ip, playit_public_port: Number(port) } });
      toast(t("playit.saved"), "success"); onChange?.();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  return <div style={{ display: "grid", gap: "1rem" }}>
    <section className="panel-inset" style={{ padding: "1rem" }}>
      <h3 className="heading" style={{ marginTop: 0 }}><Icon name="globe" /> {t("playit.title")}</h3>
      <p className="subtle">{t("playit.help")}</p>
      {running && <div className="panel-inset" style={{ padding: "0.7rem", borderLeft: "3px solid var(--yellow)" }}>{t("playit.stopBeforeSave")}</div>}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end", marginTop: "0.8rem" }}>
        <label><span className="label">{t("playit.enabled")}</span><button className={`btn ${enabled ? "btn-primary" : "btn-ghost"}`} onClick={() => setEnabled(!enabled)} disabled={running}>{enabled ? t("common.on") : t("common.off")}</button></label>
        <label style={{ flex: 1, minWidth: 220 }}><span className="label">{t("playit.publicIp")}</span><input className="input" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.10" disabled={running} /></label>
        <label><span className="label">{t("playit.publicPort")}</span><input className="input" type="number" min="1" max="65535" value={port} onChange={(e) => setPort(e.target.value)} disabled={running} /></label>
        <label><span className="label">{t("playit.localPort")}</span><input className="input" value={`${world.game_port} UDP`} disabled /></label>
      </div>
      <label className="label" style={{ marginTop: "0.8rem" }}>{t("playit.launchPreview")}</label>
      <code className="panel-inset" style={{ display: "block", padding: "0.7rem", wordBreak: "break-all" }}>{args}</code>
      <button className="btn btn-primary" onClick={save} disabled={running || busy || (enabled && !ip)} style={{ marginTop: "0.8rem" }}><Icon name="check" /> {t("common.save")}</button>
    </section>
  </div>;
}
