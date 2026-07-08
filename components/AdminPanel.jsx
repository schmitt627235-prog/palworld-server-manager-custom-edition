"use client";
import { useState } from "react";
import { api, Icon, toast } from "@/components/ui";

export default function AdminPanel({ world, running, onChange }) {
  const [announce, setAnnounce] = useState("");
  const [name, setName] = useState(world.display_name);
  const [password, setPassword] = useState(world.admin_password);
  const [extraArgs, setExtraArgs] = useState(world.extra_args || "");
  const [autostart, setAutostart] = useState(!!world.autostart);
  const [crashGuard, setCrashGuard] = useState(!!world.crash_guard);
  const [community, setCommunity] = useState(!!world.community_server);
  const [saving, setSaving] = useState(false);

  const broadcast = async () => {
    if (!announce.trim()) return;
    try {
      await api(`/api/worlds/${world.world_id}/rest`, { method: "POST", body: { command: "announce", message: announce.trim() } });
      toast("Broadcast sent", "success");
      setAnnounce("");
    } catch (e) { toast(e.message, "error"); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api(`/api/worlds/${world.world_id}`, {
        method: "PATCH",
        body: { display_name: name, admin_password: password, extra_args: extraArgs, autostart: autostart ? 1 : 0, crash_guard: crashGuard ? 1 : 0, community_server: community ? 1 : 0 },
      });
      toast("Profile saved", "success");
      onChange();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "grid", gap: "1.6rem" }}>
      <section>
        <h3 className="heading" style={{ fontSize: "1rem", marginTop: 0 }}>Broadcast to players</h3>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input className="input" placeholder="Announcement message…" value={announce} onChange={(e) => setAnnounce(e.target.value)} disabled={!running} />
          <button className="btn btn-primary" onClick={broadcast} disabled={!running}><Icon name="bell" /> Send</button>
        </div>
        {!running && <p className="subtle" style={{ fontWeight: 700, fontSize: "0.74rem", marginTop: 4 }}>Start the world to broadcast.</p>}
      </section>

      <section>
        <h3 className="heading" style={{ fontSize: "1rem" }}>World profile</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
          <div>
            <label className="label">Display name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Admin password (REST API)</label>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Extra launch arguments</label>
            <input className="input" value={extraArgs} onChange={(e) => setExtraArgs(e.target.value)} placeholder="-e.g. -NoAsyncLoadingThread" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.9rem", flexWrap: "wrap" }}>
          <Toggle label="Autostart on app launch" on={autostart} onClick={() => setAutostart((v) => !v)} />
          <Toggle label="Crash guardian (auto-restart)" on={crashGuard} onClick={() => setCrashGuard((v) => !v)} />
        </div>

        <div className="panel-inset" style={{ padding: "0.9rem 1.1rem", marginTop: "0.9rem", borderLeft: `3px solid ${community ? "var(--green-bright)" : "var(--line-strong)"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ minWidth: 240, flex: 1 }}>
              <div className="heading" style={{ fontSize: "0.92rem" }}>Community server (public listing)</div>
              <div className="subtle" style={{ fontWeight: 600, fontSize: "0.78rem", marginTop: 2 }}>
                Lists this world in Palworld's in-game <b>public server browser</b> so anyone can find and join it.
                Off means private — friends join by IP only. Adds the <code>-publiclobby</code> launch flag.
              </div>
            </div>
            <Toggle label={community ? "Public" : "Private"} on={community} onClick={() => setCommunity((v) => !v)} />
          </div>
          <div className="subtle" style={{ fontWeight: 600, fontSize: "0.72rem", marginTop: 8 }}>
            Note: to actually appear in the list, the server must be reachable from the internet (port-forwarded or tunneled).
            {" "}Restart the world after changing this.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}><Icon name="download" /> {saving ? "Saving…" : "Save profile"}</button>
        </div>
        {world.crash_count > 0 && (
          <p className="subtle" style={{ fontWeight: 700, fontSize: "0.76rem", marginTop: "0.6rem" }}>
            Crash guardian has restarted this world {world.crash_count} time{world.crash_count === 1 ? "" : "s"}.
          </p>
        )}
      </section>

      <section>
        <h3 className="heading" style={{ fontSize: "1rem" }}>Connection</h3>
        <div className="panel-inset" style={{ padding: "0.8rem 1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.6rem", fontSize: "0.82rem", fontWeight: 700 }}>
          <div><span className="subtle">Game port</span><br />{world.game_port}</div>
          <div><span className="subtle">Query port</span><br />{world.query_port}</div>
          <div><span className="subtle">REST API port</span><br />{world.rest_api_port}</div>
          <div><span className="subtle">RCON port (legacy)</span><br />{world.rcon_enabled ? world.rcon_port : "off"}</div>
        </div>
        <p className="subtle" style={{ fontWeight: 700, fontSize: "0.74rem", marginTop: "0.5rem" }}>
          Only the game UDP port needs to be reachable by players. Keep the REST API port LAN-only. RCON is deprecated by Pocketpair and disabled by default — this manager uses the REST API for all administration.
        </p>
      </section>
    </div>
  );
}

function Toggle({ label, on, onClick }) {
  return (
    <button className={`btn ${on ? "btn-primary" : "btn-ghost"}`} onClick={onClick}>
      <span className="statdot" style={{ background: on ? "var(--accent-ink)" : "var(--ink-soft)" }} /> {label}
    </button>
  );
}
