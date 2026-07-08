"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { api, Icon, toast } from "@/components/ui";

export default function ChatPanel({ worldId, running }) {
  const [messages, setMessages] = useState([]);
  const [announce, setAnnounce] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { modInstalled, bundledAvailable }
  const [installing, setInstalling] = useState(false);
  const boxRef = useRef(null);
  const esRef = useRef(null);

  const loadStatus = useCallback(() => {
    api(`/api/worlds/${worldId}/chat`).then((r) =>
      setStatus({ modInstalled: r.modInstalled, bundledAvailable: r.bundledAvailable })
    ).catch(() => {});
  }, [worldId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const installMod = async () => {
    setInstalling(true);
    try {
      const r = await api(`/api/worlds/${worldId}/chat`, { method: "POST" });
      toast(r.ue4ssDetected
        ? "Chat mod installed. Restart the world to start capturing chat."
        : "Chat mod copied, but UE4SS was not detected — install UE4SS first.",
        r.ue4ssDetected ? "success" : "error");
      loadStatus();
    } catch (e) { toast(e.message, "error"); }
    finally { setInstalling(false); }
  };

  useEffect(() => {
    const es = new EventSource(`/api/worlds/${worldId}/chat/stream`);
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const entry = JSON.parse(ev.data);
        setMessages((prev) => {
          const next = [...prev, entry];
          return next.length > 400 ? next.slice(-400) : next;
        });
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [worldId]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!announce.trim()) return;
    setSending(true);
    try {
      await api(`/api/worlds/${worldId}/rest`, { method: "POST", body: { command: "announce", message: announce.trim() } });
      setAnnounce("");
      toast("Announcement sent", "success");
    } catch (e) { toast(e.message, "error"); }
    finally { setSending(false); }
  };

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 520 }}>
      {status && !status.modInstalled && (
        <div className="panel-inset" style={{ padding: "0.8rem 1rem", marginBottom: "0.8rem", borderLeft: "3px solid var(--yellow)" }}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: 4 }}>Chat capture needs a mod</div>
          <p className="subtle" style={{ fontWeight: 600, fontSize: "0.78rem", margin: "0 0 8px" }}>
            Palworld doesn’t expose in-game chat to servers on its own. Install the bundled
            capture mod (requires <b>UE4SS</b> in <code>Pal/Binaries/Win64</code>), then restart the world.
          </p>
          <button className="btn btn-primary" style={{ padding: "0.35rem 0.7rem" }}
            onClick={installMod} disabled={installing || !status.bundledAvailable}>
            <Icon name="download" size={15} /> {installing ? "Installing…" : "Install chat relay mod"}
          </button>
        </div>
      )}
      {status && status.modInstalled && (
        <div className="subtle" style={{ fontWeight: 700, fontSize: "0.72rem", marginBottom: "0.6rem" }}>
          <span className="s-running">● Chat mod installed</span> — player messages appear here live while the world runs.
        </div>
      )}
      <div ref={boxRef} className="panel-inset" style={{ flex: 1, overflowY: "auto", padding: "0.8rem", marginBottom: "0.8rem" }}>
        {messages.length === 0 ? (
          <div className="subtle" style={{ fontWeight: 600, textAlign: "center", marginTop: "2rem" }}>
            No chat yet. In-game player messages appear here live while the world is running.
            {!running && <div style={{ marginTop: 8 }}>Start the world to capture chat.</div>}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: "0.6rem", padding: "0.25rem 0", alignItems: "baseline" }}>
              <span className="subtle" style={{ fontSize: "0.68rem", fontWeight: 600, minWidth: 44 }}>{fmtTime(m.at)}</span>
              <span style={{ fontWeight: 800, color: "var(--accent)" }}>
                {m.channel && <span className="subtle" style={{ fontWeight: 700, marginRight: 4 }}>[{m.channel}]</span>}
                {m.name}
              </span>
              <span style={{ fontWeight: 500, wordBreak: "break-word" }}>{m.message}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input className="input" placeholder={running ? "Broadcast an announcement to all players…" : "Start the world to broadcast"}
          value={announce} disabled={!running || sending}
          onChange={(e) => setAnnounce(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn btn-primary" onClick={send} disabled={!running || sending}>
          <Icon name="bell" size={16} /> Announce
        </button>
      </div>
      <p className="subtle" style={{ fontSize: "0.72rem", fontWeight: 600, marginTop: 6, marginBottom: 0 }}>
        Palworld has no REST endpoint to send as a player, so admin messages go out as a server announcement (broadcast to everyone).
      </p>
    </div>
  );
}
