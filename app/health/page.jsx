"use client";
import { useEffect, useState } from "react";
import { api, Icon } from "@/components/ui";
import { useTranslation } from "react-i18next";

const COLORS={green:"#22c55e",yellow:"#f59e0b",red:"#ef4444"};
export default function HealthPage(){
  const {t}=useTranslation(); const [data,setData]=useState(null); const [busy,setBusy]=useState(false);
  const run=async()=>{setBusy(true);try{setData(await api("/api/health"));}finally{setBusy(false)}};
  useEffect(()=>{run()},[]);
  return <div style={{display:"grid",gap:"1rem"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><h1 className="heading">{t("health.title")}</h1><p className="subtle">{t("health.subtitle")}</p></div><button className="btn btn-primary" onClick={run} disabled={busy}><Icon name="activity"/> {t("health.run")}</button></div>
    {data&&<section className="panel" style={{padding:"1rem"}}><div style={{display:"flex",alignItems:"center",gap:".7rem"}}><span style={{width:18,height:18,borderRadius:99,background:COLORS[data.severity]}}/><b>{t(`health.${data.severity}`)}</b>{data.preview&&<span className="chip">SAFE PREVIEW</span>}</div></section>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:".8rem"}}>{data?.checks?.map(c=><section key={c.id} className="panel-inset" style={{padding:"1rem",borderLeft:`4px solid ${COLORS[c.status]}`}}><h3 className="heading" style={{margin:"0 0 .35rem"}}>{c.title}</h3><div className="subtle" style={{wordBreak:"break-word"}}>{c.detail}</div></section>)}</div>
  </div>;
}
