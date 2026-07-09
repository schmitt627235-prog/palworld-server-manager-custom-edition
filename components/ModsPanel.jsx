"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Icon, toast } from "@/components/ui";

export default function ModsPanel({ worldId, running }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [wsId, setWsId] = useState("");
  const isElectron = typeof window !== "undefined" && window.desktop?.isElectron;
  const isWindows = typeof navigator !== "undefined" && /Win/.test(navigator.platform);

  const load = useCallback(async () => {
    try { setData(await api(`/api/worlds/${worldId}/mods`)); }
    catch (e) { toast(e.message, "error"); }
  }, [worldId]);

  useEffect(() => { load(); }, [load]);

  const toggleGlobal = async (on) => {
    setBusy(true);
    try { setData(await api(`/api/worlds/${worldId}/mods/toggle`, { method: "POST", body: { global: on } })); toast(`Mods ${on ? "enabled" : "disabled"} — restart to apply`, "success"); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const toggleMod = async (packageName, enabled) => {
    setBusy(true);
    try { setData(await api(`/api/worlds/${worldId}/mods/toggle`, { method: "POST", body: { packageName, enabled } })); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const importZip = async () => {
    if (!isElectron) return toast("File picker is available in the desktop app.");
    const zipPath = await window.desktop.pickZip();
    if (!zipPath) return;
    setBusy(true);
    try {
      const { result } = await api(`/api/worlds/${worldId}/mods/import`, { method: "POST", body: { zipPath } });
      toast(`Imported ${result.packageName}${result.isServer ? "" : " (⚠ not a server mod)"}`, result.isServer ? "success" : "error");
      load();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const addWorkshop = async () => {
    if (!wsId.trim()) return;
    setBusy(true);
    try {
      const { result } = await api(`/api/worlds/${worldId}/mods/import`, { method: "POST", body: { workshopId: wsId.trim() } });
      toast(`Added workshop mod ${result.packageName || wsId}`, "success");
      setWsId(""); load();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const removeMod = async (pkg) => {
    if (!confirm(`Remove mod "${pkg}"? Its files will be deleted.`)) return;
    setBusy(true);
    try { setData(await api(`/api/worlds/${worldId}/mods?pkg=${encodeURIComponent(pkg)}`, { method: "DELETE" })); toast("Mod removed", "success"); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  if (!data) return <p className="subtle" style={{ fontWeight: 600 }}>Loading mods…</p>;

  return (
    <div>
      {/* platform + restart notices */}
      {data.windowsOnlyWarning && (
        <Notice color="var(--yellow)">
          Palworld server-side mods run on the <b>Windows</b> dedicated server only. This host isn&apos;t Windows, so mods may not load even if configured here.
        </Notice>
      )}
      {running ? (
        <Notice color="var(--red)">
          The world is <b>running</b>. Stop it to add, enable/disable, or remove mods — these changes only take effect at boot.
        </Notice>
      ) : (
        <Notice color="var(--accent)">
          Mods load only at server boot — <b>restart the world</b> after any change. On restart, Palworld deploys each active mod per its Info.json rules.
        </Notice>
      )}

      {/* global switch + import controls */}
      <div className="panel-inset" style={{ padding: "0.9rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div>
          <div className="heading" style={{ fontSize: "0.95rem" }}>Global mod system</div>
          <div className="subtle" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
            {data.globalEnable ? "Enabled — active mods will load on next start." : "Disabled — server launches with -NoMods."}
          </div>
        </div>
        <button className={`btn ${data.globalEnable ? "btn-primary" : "btn-ghost"}`} disabled={busy || running} onClick={() => toggleGlobal(!data.globalEnable)}>
          {data.globalEnable ? "On" : "Off"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy || running} onClick={importZip}><Icon name="upload" /> Import mod (.zip)</button>
        <div style={{ display: "flex", gap: "0.4rem", flex: 1, minWidth: 240 }}>
          <input className="input" placeholder="Steam Workshop ID (already downloaded in Steam)" value={wsId} onChange={(e) => setWsId(e.target.value)} disabled={running} />
          <button className="btn btn-subtle" disabled={busy || running} onClick={addWorkshop}>Add</button>
        </div>
      </div>

      {/* installed mods list */}
      {data.mods.length === 0 ? (
        <div className="panel-inset" style={{ padding: "2rem", textAlign: "center" }}>
          <div className="subtle" style={{ fontWeight: 600 }}>
            No mods installed. Import a Workshop-style mod (.zip containing Info.json), or add one you&apos;ve subscribed to in Steam by its Workshop ID.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {data.mods.map((m) => (
            <div key={m.folder} className="panel-inset" style={{ padding: "0.7rem 0.9rem", display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--card-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="shield" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8 }}>
                  {m.displayName}
                  {m.version && <span className="subtle" style={{ fontSize: "0.72rem", fontWeight: 600 }}>v{m.version}</span>}
                  {!m.isServer && <span className="chip" style={{ background: "var(--yellow)", color: "#1e1f22" }}>Not server mod</span>}
                  {m.infoError && <span className="chip" style={{ background: "var(--red)", color: "#fff" }}>Bad Info.json</span>}
                </div>
                <div className="subtle" style={{ fontSize: "0.72rem", fontWeight: 600 }}>{m.packageName || m.folder}</div>
              </div>
              <button className={`btn ${m.enabled ? "btn-primary" : "btn-ghost"}`} style={{ padding: "0.35rem 0.7rem" }}
                disabled={busy || running || !m.packageName || !m.isServer} onClick={() => toggleMod(m.packageName, !m.enabled)}>
                {m.enabled ? "Enabled" : "Disabled"}
              </button>
              <button className="btn btn-danger" style={{ padding: "0.35rem 0.6rem" }} disabled={busy || running} onClick={() => removeMod(m.packageName || m.folder)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {data.dangling?.length > 0 && (
        <Notice color="var(--yellow)">
          These mods are listed as active but their files aren&apos;t on disk: {data.dangling.join(", ")}. Re-import them or disable them.
        </Notice>
      )}
    </div>
  );
}

function Notice({ color, children }) {
  return (
    <div className="panel-inset" style={{ padding: "0.7rem 0.9rem", borderLeft: `3px solid ${color}`, marginBottom: "1rem", fontWeight: 600, fontSize: "0.84rem" }}>
      {children}
    </div>
  );
}
