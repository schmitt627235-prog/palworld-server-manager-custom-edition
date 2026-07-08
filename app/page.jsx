"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Icon, StatusChip, fmtUptime, toast } from "@/components/ui";
import CreateWorldModal from "@/components/CreateWorldModal";

export default function WorldsPage() {
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState({});
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const { worlds } = await api("/api/worlds");
      setWorlds(worlds);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const doAction = async (id, action) => {
    setBusy((b) => ({ ...b, [id]: action }));
    try {
      await api(`/api/worlds/${id}/action`, { method: "POST", body: { action } });
      toast(`World ${action}ed`, "success");
      setTimeout(load, 600);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy((b) => ({ ...b, [id]: null })); }
  };

  const checkUpdates = async () => {
    setChecking(true);
    try {
      const r = await api("/api/updates/check");
      toast(r.latest ? `Latest build: ${r.latest} · ${r.worlds.length} need update` : "Could not reach Steam", r.latest ? "success" : "error");
      load();
    } catch (e) { toast(e.message, "error"); }
    finally { setChecking(false); }
  };

  const running = worlds.filter((w) => w.running).length;
  const players = worlds.reduce((a, w) => a + (w.live?.currentPlayers || 0), 0);

  return (
    <div>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.9rem", margin: 0 }}>Your worlds</h1>
          <p className="subtle" style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {worlds.length} {worlds.length === 1 ? "world" : "worlds"} · {running} running · {players} online
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button className="btn btn-ghost" onClick={checkUpdates} disabled={checking}>
            <Icon name="refresh" /> {checking ? "Checking…" : "Check updates"}
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" /> New world
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel" style={{ padding: "2rem", textAlign: "center" }} className="subtle">Loading…</div>
      ) : worlds.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {worlds.map((w) => (
            <WorldRow key={w.world_id} w={w} busy={busy[w.world_id]} onAction={doAction} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateWorldModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function WorldRow({ w, busy, onAction }) {
  const isBusy = !!busy;
  const accent = w.accent_color || "var(--accent)";
  return (
    <div className="panel world-card animate-floatUp" style={{ position: "relative", padding: "1rem 1.1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", overflow: "hidden", borderLeft: `3px solid ${accent}` }}>
      {/* banner: sits on the right, fades toward the center (|||| |  |) */}
      {w.banner_data && (
        <>
          <div aria-hidden style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: `url(${w.banner_data})`,
            backgroundSize: "cover", backgroundPosition: "left center",
            // fade from visible (left edge) to transparent (center) — |  | ||||
            WebkitMaskImage: "linear-gradient(to left, transparent 30%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0.75) 100%)",
            maskImage: "linear-gradient(to left, transparent 30%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0.75) 100%)",
            opacity: 0.85, pointerEvents: "none",
          }} />
          {/* left scrim keeps the icon + name readable over the banner */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
            background: "linear-gradient(to right, var(--card) 8%, color-mix(in srgb, var(--card) 55%, transparent) 34%, transparent 52%)",
          }} />
        </>
      )}

      <div style={{ position: "relative", zIndex: 1, width: 46, height: 46, borderRadius: 10, background: w.icon_data ? "transparent" : accent, border: `1px solid ${w.icon_data ? "transparent" : "var(--line)"}`, display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden", boxShadow: w.icon_data ? "0 2px 8px rgba(0,0,0,0.3)" : "none" }}>
        {w.icon_data ? <img src={w.icon_data} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="globe" size={24} />}
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link href={`/worlds/${w.world_id}`} className="heading" style={{ fontSize: "1.15rem", textDecoration: "none" }}>
            {w.display_name}
          </Link>
          <StatusChip status={w.status} running={w.running} />
          {w.community_server ? (
            <span className="chip" style={{ background: "var(--green-bright)", color: "#0b3d1a" }} title="Listed in the public server browser">Community</span>
          ) : (
            <span className="chip" style={{ background: "var(--line-strong)", color: "var(--ink-soft)" }} title="Private — join by IP">Private</span>
          )}
          {w.updateAvailable && (
            <span className="chip" style={{ background: "var(--yellow)", color: "#1e1f22" }}>Update available</span>
          )}
        </div>
        <div className="subtle" style={{ fontSize: "0.78rem", fontWeight: 700, marginTop: 3 }}>
          Game :{w.game_port} · REST :{w.rest_api_port} · build {w.build_id || "—"}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: "1.4rem", textAlign: "center" }}>
        <Stat label="Players" value={w.live ? `${w.live.currentPlayers}${w.live.maxPlayers ? "/" + w.live.maxPlayers : ""}` : "—"} />
        <Stat label="Uptime" value={w.live ? fmtUptime(w.live.uptime) : "—"} />
        <Stat label="Day" value={w.live?.days ?? "—"} />
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        {w.running ? (
          <>
            <button className="btn btn-ghost" disabled={isBusy} onClick={() => onAction(w.world_id, "restart")} title="Restart">
              <Icon name="restart" />
            </button>
            <button className="btn btn-danger" disabled={isBusy} onClick={() => onAction(w.world_id, "stop")} title="Stop">
              <Icon name="stop" />
            </button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={isBusy} onClick={() => onAction(w.world_id, "start")} title="Start">
            <Icon name="play" /> {busy === "start" ? "Starting…" : "Start"}
          </button>
        )}
        <Link href={`/worlds/${w.world_id}`} className="btn btn-ghost">Manage</Link>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="heading" style={{ fontSize: "1.05rem" }}>{value}</div>
      <div className="subtle" style={{ fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="panel" style={{ padding: "3rem 2rem", textAlign: "center" }}>
      <div style={{ width: 66, height: 66, borderRadius: 8, background: "var(--yellow)", display: "grid", placeItems: "center", margin: "0 auto 1rem" }}>
        <Icon name="globe" size={34} />
      </div>
      <h2 className="heading" style={{ fontSize: "1.4rem", margin: "0 0 0.4rem" }}>No worlds yet</h2>
      <p className="subtle" style={{ fontWeight: 700, maxWidth: 460, margin: "0 auto 1.3rem" }}>
        Create your first Palworld world. The manager installs the dedicated server with SteamCMD into a folder you choose, sets up its ports and admin password, and gets it ready to launch.
      </p>
      <button className="btn btn-primary" onClick={onCreate}><Icon name="plus" /> Create a world</button>
    </div>
  );
}
