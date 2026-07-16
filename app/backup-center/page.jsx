"use client";
import { useEffect, useMemo, useState } from "react";
import { api, fmtBytes, fmtTime } from "@/components/ui";
import { useTranslation } from "react-i18next";

export default function Page() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  useEffect(() => { api("/api/backup-center").then(setData); }, []);
  const entries = useMemo(() => (data?.worlds || []).flatMap((world) =>
    (world.backups || []).map((backup) => ({ ...backup, worldName: world.name }))
  ).sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0)), [data]);

  return <div>
    <h1 className="heading">{t("backupCenter.title")}</h1>
    <p className="subtle">{t("backupCenter.subtitle")}</p>
    {!data ? <p className="subtle">{t("common.loading")}</p> : entries.length === 0
      ? <section className="panel-inset" style={{padding:"1rem"}}><b>{t("backupCenter.empty")}</b><p className="subtle">{t("backupCenter.emptyHelp")}</p></section>
      : <div style={{display:"grid",gap:".7rem"}}>{entries.map((backup) =>
        <section className="panel-inset" style={{padding:"1rem",display:"grid",gridTemplateColumns:"1fr auto auto",gap:"1rem"}} key={`${backup.world_id}-${backup.id}`}>
          <div><b>{backup.note || t("backupCenter.backup")}</b><div className="subtle">{backup.worldName} · {fmtTime(backup.created_at)}</div></div>
          <span className="chip">{fmtBytes(backup.size || 0)}</span>
          <span style={{color:"var(--green-bright)"}}>✓ {t("backupCenter.recorded")}</span>
        </section>)}</div>}
  </div>;
}
