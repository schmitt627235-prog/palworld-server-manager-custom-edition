"use client";
import { useEffect, useState } from "react";
import { api, Icon } from "@/components/ui";
import { useTranslation } from "react-i18next";
export default function Page(){
  const {t}=useTranslation(); const [d,setD]=useState(null);
  useEffect(()=>{api("/api/update-center").then(setD)},[]);
  return <div><h1 className="heading">{t("update.title")}</h1><p className="subtle">{t("update.subtitle")}</p>
    <section className="panel" style={{padding:"1rem",display:"grid",gap:".6rem"}}>
      {d?.steps.map((s,i)=><div className="panel-inset" key={s.id} style={{padding:".8rem",display:"flex",gap:".7rem"}}><span className="chip">{i+1}</span><b>{t(s.labelKey)}</b><span style={{marginLeft:"auto",color:"var(--green-bright)"}}>READY</span></div>)}
      {d&&<div className="chip" style={{marginTop:".5rem"}}>{t(d.noteKey)}</div>}<button className="btn btn-primary" onClick={()=>window.open("https://github.com/schmitt627235-prog/palworld-server-manager-custom-edition/releases/latest","_blank")}><Icon name="download"/> {t("update.openDownloads")}</button>
    </section></div>;
}
