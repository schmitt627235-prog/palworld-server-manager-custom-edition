"use client";
import { useState } from "react";
import { api, Icon, toast } from "@/components/ui";

export default function PlayersPanel({ worldId, players, onChange }) {
  const [busy, setBusy] = useState(null);
  const list = players?.players || [];

  const act = async (command, userid, name) => {
    setBusy(userid);
    try {
      await api(`/api/worlds/${worldId}/rest`, { method: "POST", body: { command, userid } });
      toast(`${name} ${command === "kick" ? "kicked" : command === "ban" ? "banned" : command}`, "success");
      setTimeout(onChange, 700);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(null); }
  };

  if (!list.length) {
    return <p className="subtle" style={{ fontWeight: 700, padding: "0.5rem 0" }}>No players online right now.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            {["Name", "Level", "Ping", "Location", ""].map((h) => (
              <th key={h} className="subtle" style={{ padding: "0.4rem 0.6rem", fontFamily: "var(--font-display)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const uid = p.userId || p.playerId || p.name;
            return (
              <tr key={uid} style={{ borderTop: "1.5px solid var(--line)" }}>
                <td style={{ padding: "0.55rem 0.6rem", fontWeight: 800 }}>
                  {p.name}
                  <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700 }}>{p.accountName || p.userId || ""}</div>
                </td>
                <td style={{ padding: "0.55rem 0.6rem", fontWeight: 700 }}>{p.level ?? "—"}</td>
                <td style={{ padding: "0.55rem 0.6rem", fontWeight: 700 }}>{p.ping != null ? Math.round(p.ping) + " ms" : "—"}</td>
                <td style={{ padding: "0.55rem 0.6rem" }} className="subtle">
                  {p.location_x != null ? `${Math.round(p.location_x)}, ${Math.round(p.location_y)}` : "—"}
                </td>
                <td style={{ padding: "0.55rem 0.6rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem", marginRight: 6 }} disabled={busy === uid} onClick={() => act("kick", uid, p.name)}>Kick</button>
                  <button className="btn btn-danger" style={{ padding: "0.3rem 0.6rem" }} disabled={busy === uid} onClick={() => act("ban", uid, p.name)}>Ban</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
