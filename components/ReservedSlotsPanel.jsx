"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Icon, toast } from "@/components/ui";

const EMPTY = { steam_id: "", display_name: "", role: "vip", note: "", enabled: true };

export default function ReservedSlotsPanel({ worldId, maxPlayers = 32, mode = "all" }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [dryRun, setDryRun] = useState(null);
  useEffect(() => {
    let active = true;
    api(`/api/worlds/${worldId}/reserved-slots`)
      .then((next) => { if (active) setData(next); })
      .catch((e) => { if (active) toast(e.message, "error"); });
    return () => { active = false; };
  }, [worldId]);

  if (!data) return <div className="subtle">{t("common.loading")}</div>;
  const settings = data.settings;
  const publicSlots = Math.max(1, Number(maxPlayers || 32) - Number(settings.reserved_slots || 1));

  const saveSettings = async () => {
    setBusy(true);
    try {
      const next = await api(`/api/worlds/${worldId}/reserved-slots`, { method: "POST", body: { action: "save-settings", ...settings } });
      setData(next); toast(t("reserved.saved"), "success");
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const savePlayer = async () => {
    setBusy(true);
    try {
      const next = await api(`/api/worlds/${worldId}/reserved-slots`, { method: "POST", body: { action: "save-player", ...form } });
      setData(next); setForm(EMPTY); toast(t("reserved.playerSaved"), "success");
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const remove = async (steamId) => {
    if (!confirm(t("reserved.confirmDelete", { steamId }))) return;
    try { setData(await api(`/api/worlds/${worldId}/reserved-slots?steam_id=${steamId}`, { method: "DELETE" })); }
    catch (e) { toast(e.message, "error"); }
  };
  const simulate = async () => {
    setBusy(true);
    try { setDryRun(await api(`/api/worlds/${worldId}/reserved-slots/dry-run`, { method: "POST", body: { maxPlayers } })); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const showManager = mode !== "guard";
  const showGuard = mode !== "manager";

  return <div style={{ display: "grid", gap: "1rem" }}>
    {showManager && <>
    <section className="panel-inset" style={{ padding: "1rem" }}>
      <h3 className="heading" style={{ marginTop: 0 }}>{t("reserved.title")}</h3>
      <p className="subtle">{t("reserved.managerModeHelp")}</p>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end" }}>
        <label><span className="label">{t("reserved.protection")}</span><button className={`btn ${settings.enabled ? "btn-primary" : "btn-ghost"}`} onClick={() => setData({ ...data, settings: { ...settings, enabled: settings.enabled ? 0 : 1 } })}>{settings.enabled ? t("common.on") : t("common.off")}</button></label>
        <label><span className="label">{t("reserved.slotCount")}</span><input className="input" style={{ width: 100 }} type="number" min="1" max="31" value={settings.reserved_slots} onChange={(e) => setData({ ...data, settings: { ...settings, reserved_slots: Number(e.target.value) } })} /></label>
        <div className="panel-inset" style={{ padding: "0.55rem 0.8rem" }}><b>{publicSlots}</b> {t("reserved.publicSlots")}</div>
      </div>
      <label className="label" style={{ marginTop: "0.8rem" }}>{t("reserved.message")}</label>
      <input className="input" value={settings.message} onChange={(e) => setData({ ...data, settings: { ...settings, message: e.target.value } })} />
      <button className="btn btn-primary" style={{ marginTop: "0.8rem" }} disabled={busy} onClick={saveSettings}><Icon name="check" /> {t("common.save")}</button>
    </section>

    <section className="panel-inset" style={{ padding: "1rem" }}>
      <h3 className="heading" style={{ marginTop: 0 }}>{t("reserved.players")}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 1.4fr auto", gap: "0.5rem", alignItems: "end" }}>
        <label><span className="label">SteamID64</span><input className="input" value={form.steam_id} onChange={(e) => setForm({ ...form, steam_id: e.target.value.replace(/\D/g, "").slice(0, 17) })} placeholder="76561190000000000" /></label>
        <label><span className="label">{t("reserved.name")}</span><input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
        <label><span className="label">{t("reserved.role")}</span><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{["owner","admin","moderator","vip","friend"].map((r) => <option key={r} value={r}>{t(`reserved.role.${r}`)}</option>)}</select></label>
        <label><span className="label">{t("reserved.note")}</span><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        <button className="btn btn-primary" disabled={busy || form.steam_id.length !== 17} onClick={savePlayer}><Icon name="plus" /> {t("common.save")}</button>
      </div>
      <div style={{ display: "grid", gap: "0.4rem", marginTop: "1rem" }}>
        {data.players.length === 0 ? <p className="subtle">{t("reserved.empty")}</p> : data.players.map((p) => <div key={p.steam_id} className="panel-inset" style={{ padding: "0.55rem 0.75rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <code>{p.steam_id}</code><b>{p.display_name || "—"}</b><span className="chip">{t(`reserved.role.${p.role}`)}</span><span className="subtle" style={{ flex: 1 }}>{p.note}</span>
          <button className="btn btn-ghost" onClick={() => setForm({ ...p, enabled: !!p.enabled })}>{t("common.edit")}</button>
          <button className="btn btn-danger" onClick={() => remove(p.steam_id)}><Icon name="trash" /></button>
        </div>)}
      </div>
    </section>

    </>}

    {showGuard && <section className="panel-inset" style={{ padding: "1rem", borderLeft: "4px solid var(--accent)" }}>
      <h3 className="heading" style={{ marginTop: 0 }}>{t("reserved.dryRunTitle")}</h3>
      <p className="subtle">{t("reserved.dryRunHelp")}</p>
      <button className="btn btn-primary" disabled={busy} onClick={simulate}><Icon name="activity" /> {t("reserved.runDryRun")}</button>
      {dryRun && <div style={{ marginTop: "1rem", display: "grid", gap: ".5rem" }}>
        <div className="chip">{dryRun.publicLimit} public slots · {dryRun.reservedOnline} reserved online · {dryRun.normalOnline} public online</div>
        <b style={{ color: dryRun.wouldRemove.length ? "var(--yellow)" : "var(--green-bright)" }}>{dryRun.wouldRemove.length ? t("reserved.wouldRemove", { count: dryRun.wouldRemove.length }) : t("reserved.noAction")}</b>
        {dryRun.players.map(p => <div key={p.steamId} className="panel-inset" style={{ padding: ".5rem .7rem", display: "flex", gap: ".7rem" }}><code>{p.steamId}</code><span>{p.name}</span><span className="chip">{p.reserved ? "RESERVED" : "PUBLIC"}</span>{p.wouldRemove && <b style={{ color: "var(--yellow)", marginLeft: "auto" }}>WOULD REMOVE</b>}</div>)}
      </div>}
    </section>}
  </div>;
}
