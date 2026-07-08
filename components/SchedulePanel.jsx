"use client";
import { useState } from "react";
import { api, Icon, fmtTime, toast } from "@/components/ui";

export default function SchedulePanel({ worldId, schedules, onChange }) {
  const [jobType, setJobType] = useState("restart");
  const [mode, setMode] = useState("interval");
  const [intervalHours, setIntervalHours] = useState(6);
  const [timeOfDay, setTimeOfDay] = useState("04:00");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await api(`/api/worlds/${worldId}/schedules`, {
        method: "POST",
        body: {
          job_type: jobType, mode,
          interval_hours: mode === "interval" ? Number(intervalHours) : null,
          time_of_day: mode === "daily" ? timeOfDay : null,
        },
      });
      toast("Schedule added", "success");
      onChange();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const remove = async (sid) => {
    try {
      await api(`/api/worlds/${worldId}/schedules?sid=${sid}`, { method: "DELETE" });
      onChange();
    } catch (e) { toast(e.message, "error"); }
  };

  const describe = (s) =>
    `${s.job_type[0].toUpperCase()}${s.job_type.slice(1)} · ${s.mode === "interval" ? `every ${s.interval_hours}h` : `daily at ${s.time_of_day}`}`;

  return (
    <div>
      <div className="panel-inset" style={{ padding: "0.9rem", marginBottom: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label className="label">Job</label>
          <select className="input" value={jobType} onChange={(e) => setJobType(e.target.value)}>
            <option value="restart">Restart</option>
            <option value="backup">Backup</option>
            <option value="update">Update</option>
          </select>
        </div>
        <div>
          <label className="label">When</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="interval">Every N hours</option>
            <option value="daily">Daily at time</option>
          </select>
        </div>
        {mode === "interval" ? (
          <div>
            <label className="label">Hours</label>
            <input className="input" type="number" min="1" value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} style={{ width: 90 }} />
          </div>
        ) : (
          <div>
            <label className="label">Time</label>
            <input className="input" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} style={{ width: 120 }} />
          </div>
        )}
        <button className="btn btn-primary" onClick={add} disabled={busy}><Icon name="plus" /> Add</button>
      </div>

      {schedules.length === 0 ? (
        <p className="subtle" style={{ fontWeight: 700 }}>No scheduled jobs. Add automatic restarts, backups, or updates on a maintenance window.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {schedules.map((s) => (
            <div key={s.id} className="panel-inset" style={{ padding: "0.6rem 0.8rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>
              <Icon name="clock" size={16} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "0.84rem" }}>{describe(s)}</div>
                <div className="subtle" style={{ fontSize: "0.72rem", fontWeight: 700 }}>Last run: {s.last_run ? fmtTime(s.last_run) : "never"}</div>
              </div>
              <button className="btn btn-danger" style={{ padding: "0.3rem 0.6rem" }} onClick={() => remove(s.id)}><Icon name="trash" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
