"use client";
import { useState } from "react";
import { Icon } from "@/components/ui";

const GUIDES = [
  { id: "internet", title: "How to host your server on the internet", subtitle: "Make your world joinable by friends anywhere — free, no port forwarding", icon: "globe" },
];

export default function InfoPage() {
  const [open, setOpen] = useState("internet");
  return (
    <div>
      <h1 className="heading" style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Info & Guides</h1>
      <p className="subtle" style={{ fontWeight: 600, marginBottom: "1.4rem" }}>Optional help for getting the most out of your server.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        {GUIDES.map((g) => (
          <div key={g.id} className="panel" style={{ overflow: "hidden" }}>
            <button onClick={() => setOpen(open === g.id ? null : g.id)}
              style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "1rem 1.2rem", display: "flex", alignItems: "center", gap: "0.9rem", textAlign: "left", color: "var(--ink)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>
                <Icon name={g.icon} size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="heading" style={{ fontSize: "1.05rem" }}>{g.title}</div>
                <div className="subtle" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{g.subtitle}</div>
              </div>
              <Icon name={open === g.id ? "chevronDown" : "chevronRight"} size={18} />
            </button>
            {open === g.id && g.id === "internet" && <PlayitGuide />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayitGuide() {
  const openPlayit = () => window.open("https://playit.gg", "_blank", "noopener");
  return (
    <div className="tab-content" style={{ padding: "0 1.2rem 1.4rem", borderTop: "1px solid var(--line)" }}>
      <div className="panel-inset" style={{ padding: "0.9rem 1.1rem", margin: "1.1rem 0", borderLeft: "3px solid var(--accent)" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>What is playit.gg?</div>
        <div className="subtle" style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          A free tunneling service that gives your local server a public address, so friends can join over the internet
          without port forwarding or router changes. This is a recommendation, not a requirement — if you already have port
          forwarding set up, you don't need it.
        </div>
      </div>

      <button className="btn btn-primary" onClick={openPlayit} style={{ marginBottom: "1.2rem" }}>
        <Icon name="globe" size={16} /> Open playit.gg
      </button>

      <Step n="1" title="Download the agent">
        Go to playit.gg, create a free account, and download the <b>playit agent</b> for Windows.
      </Step>
      <Step n="2" title="Set up the agent">
        Run the downloaded agent and sign in / link it to your account when the browser opens. Leave it running.
      </Step>
      <Step n="3" title="Create a tunnel">
        In the playit.gg dashboard, add a new <b>tunnel</b>.
      </Step>
      <Step n="4" title="Select tunnel type: UDP (Free)">
        Palworld uses UDP. Choose the <b>UDP</b> tunnel type on the free tier.
      </Step>
      <Step n="5" title="Set port count = 1">
        You only need a single port for one world, so set the port allocation to <b>1</b>.
      </Step>
      <Step n="6" title="Fill in the local details">
        Point the tunnel at your machine:
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li><b>Local IP:</b> <code>127.0.0.1</code></li>
          <li><b>Local port:</b> your world's game port (e.g. <code>8211</code> — shown on the world page)</li>
        </ul>
      </Step>
      <Step n="7" title="Get your public address" last>
        playit.gg gives you a <b>public IP and port</b>. Share that with friends — in Palworld they use
        <b> Join Multiplayer → Connect via IP</b> and paste it. Done!
      </Step>
    </div>
  );
}

function Step({ n, title, children, last }) {
  return (
    <div style={{ display: "flex", gap: "0.9rem", paddingBottom: last ? 0 : "1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "0.85rem", flexShrink: 0 }}>{n}</div>
        {!last && <div style={{ flex: 1, width: 2, background: "var(--line)", marginTop: 4 }} />}
      </div>
      <div style={{ paddingTop: 2 }}>
        <div className="heading" style={{ fontSize: "0.98rem", marginBottom: 2 }}>{title}</div>
        <div className="subtle" style={{ fontWeight: 600, fontSize: "0.86rem", lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}
