"use client";
// components/FirstRunWizard.jsx
// A one-time modal shown on first launch, before the user has seen much English UI,
// asking which language to use. A fresh installation deliberately starts in English
// so the first-run experience is deterministic on every PC. The dialog points users
// to Settings, where the language remains changeable at any time. Dismissing it sets
// the `onboarded` flag so it never shows again.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { switchLanguage } from "@/lib/i18n/client";
import { Icon } from "@/components/ui";

export default function FirstRunWizard() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [langs, setLangs] = useState([]);
  const [selected, setSelected] = useState("en");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/settings").then((x) => x.json());
        if (cancelled || r.settings?.onboarded) return; // already done — never flash the modal
        const ll = await fetch("/api/i18n/languages").then((x) => x.json());
        const list = ll.languages || [];
        if (cancelled) return;
        setLangs(list);
        setSelected("en");
        setShow(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const finish = async () => {
    setBusy(true);
    try {
      const meta = langs.find((l) => l.code === selected);
      if (selected !== "en") await switchLanguage(selected, meta?.dir || "ltr");
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarded: true, language: selected }),
      });
      setShow(false);
    } catch {
      setShow(false); // never trap the user behind the wizard
    } finally { setBusy(false); }
  };

  // Live-preview the selection: switch the app language as the user browses options,
  // so the wizard's own text reflects the choice immediately.
  const onPick = async (code) => {
    setSelected(code);
    const meta = langs.find((l) => l.code === code);
    try { await switchLanguage(code, meta?.dir || "ltr"); } catch {}
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)",
      display: "grid", placeItems: "center", padding: "1.5rem",
    }}>
      <div className="panel" style={{ padding: "1.8rem", maxWidth: 440, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
          <Icon name="globe" size={22} />
          <h2 className="heading" style={{ fontSize: "1.25rem", margin: 0 }}>{t("wizard.title")}</h2>
        </div>
        <p className="subtle" style={{ fontWeight: 600, fontSize: "0.85rem", margin: "0 0 1.1rem" }}>{t("wizard.subtitle")}</p>

        <label className="label">{t("settings.language")}</label>
        <select className="input" style={{ width: "100%" }} value={selected} disabled={busy}
          onChange={(e) => onPick(e.target.value)}>
          {langs.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName}
              {l.completeness < 100 ? ` — ${t("language.completeness", { percent: l.completeness })}` : ""}
              {l.machineTranslated ? ` — ${t("language.machineTranslated")}` : ""}
            </option>
          ))}
        </select>

        <p className="subtle" style={{ fontWeight: 600, fontSize: "0.74rem", margin: "0.7rem 0 1.2rem" }}>{t("wizard.help")}</p>

        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={finish} disabled={busy}>
          <Icon name="check" size={16} /> {t("wizard.continue")}
        </button>
      </div>
    </div>
  );
}
