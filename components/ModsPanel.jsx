"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Icon, toast } from "@/components/ui";

export default function ModsPanel({ worldId, running }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [wsId, setWsId] = useState("");
  const [showWsHelp, setShowWsHelp] = useState(false);
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

  // Point PSM at the Steam library where Workshop content lives (for setups where
  // Steam isn't on C:). Saved machine-wide, so every future add finds mods on its own.
  const setSteamLibrary = async (path) => {
    setBusy(true);
    try {
      setData(await api(`/api/worlds/${worldId}/mods/steam-library`, { method: "POST", body: { path: path || null } }));
      toast(path ? "Steam library saved" : "Steam library reset to auto-detect", "success");
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };

  const pickSteamLibrary = async () => {
    if (!isElectron) return toast("Folder picker is available in the desktop app.");
    const dir = await window.desktop.pickDirectory();
    if (dir) setSteamLibrary(dir);
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
        <div style={{ display: "flex", gap: "0.4rem", flex: 1, minWidth: 240, alignItems: "center" }}>
          <input className="input" placeholder="Steam Workshop ID (already downloaded in Steam)" value={wsId} onChange={(e) => setWsId(e.target.value)} disabled={running} />
          <button className="btn btn-subtle" disabled={busy || running} onClick={addWorkshop}>Add</button>
          <button className="btn btn-ghost" style={{ padding: "0.4rem 0.5rem" }} title="How to find a Workshop ID" aria-label="How to find a Workshop ID" onClick={() => setShowWsHelp(true)}>
            <Icon name="info" size={16} />
          </button>
        </div>
      </div>

      {showWsHelp && <WorkshopHelpModal onClose={() => setShowWsHelp(false)} />}

      {/* Steam library location — where subscribed Workshop content is found. Auto-detected
          across drives; overridable for setups where Steam isn't on C:. */}
      <div className="panel-inset" style={{ padding: "0.8rem 0.95rem", marginBottom: "1.2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <div className="heading" style={{ fontSize: "0.9rem" }}>Steam library location</div>
            <div className="subtle" style={{ fontSize: "0.76rem", fontWeight: 600, wordBreak: "break-all" }}>
              {data.steamLibraryPath
                ? <>Using saved folder: <code>{data.steamLibraryPath}</code></>
                : data.steamLibrariesDetected?.length
                  ? <>Auto-detected {data.steamLibrariesDetected.length} Steam {data.steamLibrariesDetected.length === 1 ? "library" : "libraries"}. Set a folder only if your mods aren&apos;t found.</>
                  : <>No Steam install auto-detected. If Steam isn&apos;t on C:, set your Steam (or SteamLibrary) folder here.</>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button className="btn btn-ghost" disabled={busy} onClick={pickSteamLibrary}><Icon name="folder" size={14} /> {data.steamLibraryPath ? "Change" : "Set folder"}</button>
            {data.steamLibraryPath && <button className="btn btn-subtle" disabled={busy} onClick={() => setSteamLibrary(null)}>Reset</button>}
          </div>
        </div>
        {data.steamLibrariesDetected?.length > 0 && (
          <details style={{ marginTop: "0.5rem" }}>
            <summary className="subtle" style={{ fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>Detected libraries</summary>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
              {data.steamLibrariesDetected.map((p) => (
                <li key={p} className="subtle" style={{ fontSize: "0.72rem", fontWeight: 600, wordBreak: "break-all" }}><code>{p}</code></li>
              ))}
            </ul>
          </details>
        )}
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

// How-to for the Workshop ID field: getting an item's numeric id, and the fact that
// PSM can only add mods Steam has already downloaded (subscribe first) — otherwise
// use the .zip import instead.
function WorkshopHelpModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel animate-floatUp" style={{ width: 520, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto", padding: "1.4rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
          <div className="heading" style={{ fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="info" size={18} /> Adding a Steam Workshop mod
          </div>
          <button className="btn btn-ghost" style={{ padding: "0.35rem 0.5rem" }} onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>

        <p style={{ fontSize: "0.86rem", fontWeight: 600, marginBottom: "0.9rem", lineHeight: 1.5 }}>
          PSM adds a Workshop mod from the copy <b>Steam has already downloaded</b> on this PC — it
          doesn&apos;t download it for you. So the order is: subscribe in Steam first, then add it here by its ID.
        </p>

        <ol style={{ margin: "0 0 1rem", paddingLeft: "1.2rem", display: "grid", gap: "0.55rem", fontSize: "0.84rem", fontWeight: 600, lineHeight: 1.5 }}>
          <li><b>Subscribe in Steam.</b> Open the mod on the Palworld Steam Workshop and click <b>Subscribe</b>. Steam downloads it into your Steam library&apos;s workshop folder.</li>
          <li><b>Copy its Workshop ID.</b> It&apos;s the number at the end of the mod&apos;s URL —
            <code style={{ wordBreak: "break-all" }}>steamcommunity.com/sharedfiles/filedetails/?id=<b>1234567890</b></code>. The bold number is the ID.</li>
          <li><b>Paste the ID</b> into the field and click <b>Add</b>. PSM finds it across your Steam libraries (any drive) and installs it into this world.</li>
        </ol>

        <div className="panel-inset" style={{ padding: "0.7rem 0.9rem", borderLeft: "3px solid var(--accent)", fontSize: "0.82rem", fontWeight: 600, lineHeight: 1.5 }}>
          No Steam copy? Use <b>Import mod (.zip)</b> instead — pick a mod archive that contains an
          <code> Info.json</code> and PSM will install it directly, no subscription needed.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.1rem" }}>
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
