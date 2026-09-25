"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  username: string;
  full_name: string;
  role: string;
  location_code?: string | null;
};

type Location = { id: string; code: string; name: string; type: string };
type Stock = {
  article_id: string;
  sifra: string;
  naziv: string;
  barkod: string | null;
  jm: string;
  stanje: number;
  image_url?: string | null;
};

const n = (v: number) =>
  Number(v || 0).toLocaleString("sr-RS", { maximumFractionDigits: 3 });

export default function TrebovanjePage() {
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [q, setQ] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMsg, setScannerMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);


  function stopScanner() {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerOpen(false);
  }

  async function startScanner() {
    setScannerMsg("");
    setScannerOpen(true);
    try {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setScannerMsg("Ovaj telefon/pregledač ne podržava skeniranje barkoda kamerom. Otvori aplikaciju u Chrome-u.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
      });

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes?.[0]?.rawValue?.trim();
          if (!value) return;

          setQ(value);
          const found = stock.find((x) => (x.barkod || "").trim() === value);
          setScannerMsg(found ? `Pronađen artikal: ${found.naziv}` : `Barkod ${value} nije pronađen u stanju.`);
          window.setTimeout(() => stopScanner(), found ? 350 : 900);
        } catch {
          // Kamera još nije spremna za sledeći kadar.
        }
      }, 450);
    } catch (e: any) {
      setScannerMsg(
        e?.name === "NotAllowedError"
          ? "Dozvoli pristup kameri pa pokušaj ponovo."
          : "Ne mogu da pokrenem kameru. Probaj iz Chrome-a."
      );
    }
  }

  useEffect(() => () => stopScanner(), []);

  async function load() {
    const r = await fetch("/api/trebovanje-data", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      setUser(null);
      return;
    }
    setUser(j.user);
    setLocation(j.location || null);
    setAvailableLocations(j.locations || []);
    setStock(j.stock || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function doLogin() {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/trebovanje-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(login),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) return setMsg(j.message || "Pogrešan user ili lozinka.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function bindLocation(code: string) {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/bind-location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location_code: code }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) return setMsg(j.message || "Greška pri izboru prodavnice.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setLocation(null);
    setStock([]);
    setQty({});
    setReview(false);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return stock;
    return stock.filter(
      (x) =>
        x.naziv.toLowerCase().includes(s) ||
        x.sifra.toLowerCase().includes(s) ||
        (x.barkod || "").toLowerCase().includes(s)
    );
  }, [stock, q]);

  const selected = useMemo(
    () =>
      stock
        .filter((x) => Number(qty[x.article_id] || 0) > 0)
        .map((x) => ({ ...x, trazeno: Number(qty[x.article_id]) })),
    [stock, qty]
  );

  async function send() {
    if (!selected.length) return setMsg("Nema artikala u trebovanju.");
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: selected.map((x) => ({ article_id: x.article_id, qty: x.trazeno })),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) return setMsg(j.message || "Greška pri slanju trebovanja.");
      setQty({});
      setReview(false);
      setMsg(`Trebovanje je poslato centralnom magacinu — ${j.location}.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main className="login">
        <section className="loginBox">
          <img src="/pili-logo.png" className="logo" alt="PILI logo" />
          <div style={{ fontWeight: 900, letterSpacing: ".1em", color: "#1c2f82" }}>
            PILI
          </div>
          <div className="h1" style={{ color: "#1c2f82" }}>
            Trebovanje robe
          </div>
          <p className="muted">Prijava prodavnice</p>

          <div className="field">
            <label>User</label>
            <input
              value={login.username}
              onChange={(e) => setLogin({ ...login, username: e.target.value })}
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>Lozinka</label>
            <input
              type="password"
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && doLogin()}
              autoComplete="current-password"
            />
          </div>

          <button className="btn" style={{ width: "100%", background: "#1c2f82", color: "white" }} onClick={doLogin} disabled={busy}>
            {busy ? "PRIJAVA…" : "ULOGUJ SE"}
          </button>
          {msg && <div className="error">{msg}</div>}
        </section>
      </main>
    );
  }

  if (user && !location) {
    return (
      <main className="page">
        <header className="top">
          <div>
            <strong>PILI — TREBOVANJE ROBE</strong>
            <small>{user.full_name}</small>
          </div>
          <button className="btn btnGhost" onClick={logout}>Odjava</button>
        </header>
        <div className="wrap">
          <section className="banner hero">
            <div className="big">Prvi ulaz</div>
            <div>Izaberi svoju prodavnicu. Ovo se pamti i sledeći put je nećeš birati.</div>
          </section>
          <section className="banner">
            <h2>Koja je tvoja prodavnica?</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:14}}>
              {availableLocations.map((x) => (
                <button
                  key={x.id}
                  className="btn"
                  style={{minHeight:100,background:"#eef2ff",color:"#1c2f82",fontSize:20}}
                  onClick={() => bindLocation(x.code)}
                  disabled={busy}
                >
                  🏪 {x.name}
                </button>
              ))}
            </div>
            {msg && <div className="error">{msg}</div>}
          </section>
        </div>
      </main>
    );
  }

  if (review) {
    return (
      <main className="page">
        <header className="top">
          <div>
            <strong>PILI — TREBOVANJE ROBE</strong>
            <small>{location?.name} · {user.full_name}</small>
          </div>
          <button className="btn btnGhost" onClick={logout}>Odjava</button>
        </header>
        <div className="wrap">
          <section className="banner hero">
            <div className="big">Kontroliši ceo spisak</div>
            <div>{location?.name} · Trebuje: {user.full_name}</div>
          </section>

          <section className="banner">
            <div className="cardList">
              {selected.map((x) => (
                <div className="itemCard" key={x.article_id}>
                  <div>
                    <b>{x.naziv}</b>
                    <small style={{ display: "block" }}>
                      Šifra {x.sifra}{x.barkod ? ` · Barkod ${x.barkod}` : ""} · Dostupno {n(x.stanje)} {x.jm}
                    </small>
                  </div>
                  <div style={{ fontWeight: 1000, fontSize: 22, color: "#1c2f82" }}>
                    {n(x.trazeno)} {x.jm}
                  </div>
                </div>
              ))}
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btnGhost grow" onClick={() => setReview(false)}>
                ← VRATI SE I ISPRAVI
              </button>
              <button className="btn btnGreen grow" onClick={send} disabled={busy}>
                {busy ? "ŠALJEM…" : "POŠALJI TREBOVANJE"}
              </button>
            </div>
            {msg && <div className="error">{msg}</div>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="top">
        <div>
          <strong>PILI — TREBOVANJE ROBE</strong>
          <small>{location?.name} · {user.full_name}</small>
        </div>
        <button className="btn btnGhost" onClick={logout}>Odjava</button>
      </header>

      <div className="wrap">
        <section className="banner hero">
          <div className="big">{location?.name}</div>
          <div>Izaberi robu i količinu. Stanje je iz centralnog magacina.</div>
        </section>

        {msg && <div className={msg.includes("poslato") ? "success" : "error"}>{msg}</div>}

        <section className="banner">
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "stretch" }}>
            <input
              className="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Traži po nazivu, šifri ili barkodu"
            />
            <button
              className="btn"
              style={{ background: "#ef7d00", color: "white", minWidth: 138, fontWeight: 1000 }}
              onClick={startScanner}
              type="button"
            >
              📷 SKENIRAJ
            </button>
          </div>

          {scannerOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.88)",
                zIndex: 1000,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
              onClick={(e) => e.currentTarget === e.target && stopScanner()}
            >
              <div style={{ width: "min(520px,100%)", background: "white", borderRadius: 22, overflow: "hidden" }}>
                <div style={{ background: "#1c2f82", color: "white", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>SKENIRAJ BARKOD</b>
                  <button className="btn" style={{ background: "white", color: "#1c2f82", minHeight: 38, padding: "6px 12px" }} onClick={stopScanner}>✕</button>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#111", minHeight: 280 }}>
                    <video ref={videoRef} playsInline muted style={{ width: "100%", minHeight: 280, objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", left: "10%", right: "10%", top: "43%", height: 4, background: "#ef7d00", boxShadow: "0 0 12px #ef7d00" }} />
                  </div>
                  <div style={{ textAlign: "center", marginTop: 12, fontWeight: 800 }}>
                    Usmeri kameru na barkod artikla.
                  </div>
                  {scannerMsg && <div className="error" style={{ marginTop: 10 }}>{scannerMsg}</div>}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            {filtered.map((x) => {
              const requested = Number(qty[x.article_id] || 0);
              return (
                <div
                  key={x.article_id}
                  style={{
                    border: requested > 0 ? "3px solid #ef7d00" : "1px solid #dde3ed",
                    borderRadius: 20,
                    background: "white",
                    padding: 14,
                    boxShadow: "0 8px 24px #0000000b",
                  }}
                >
                  <div
                    style={{
                      height: 100,
                      borderRadius: 14,
                      background: "#f3f5f9",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 46,
                      overflow: "hidden",
                    }}
                  >
                    {x.image_url ? (
                      <img
                        src={x.image_url}
                        alt={x.naziv}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 1000, fontSize: 16, color: "#1c2f82", marginTop: 10 }}>
                    {x.naziv}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", minHeight: 42 }}>
                    Šifra {x.sifra}<br />
                    {x.barkod ? (
                      <span style={{ display: "inline-block", marginTop: 3, fontWeight: 900, color: "#111827", letterSpacing: ".06em" }}>
                        ▥ {x.barkod}
                      </span>
                    ) : (
                      <span style={{ display: "inline-block", marginTop: 3 }}>Bez barkoda</span>
                    )}
                  </div>
                  <div style={{ marginTop: 8, padding: 9, borderRadius: 12, background: "#eef2ff", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 900 }}>NA STANJU</div>
                    <div style={{ fontSize: 24, fontWeight: 1000, color: "#1c2f82" }}>
                      {n(x.stanje)} {x.jm}
                    </div>
                  </div>

                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Trebujem</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={requested || ""}
                      onChange={(e) =>
                        setQty({ ...qty, [x.article_id]: Math.max(0, Number(e.target.value || 0)) })
                      }
                      style={{ fontSize: 22, fontWeight: 900, textAlign: "center" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div
          style={{
            position: "sticky",
            bottom: 10,
            background: "#1c2f82",
            color: "white",
            borderRadius: 18,
            padding: 14,
            marginTop: 14,
            zIndex: 20,
          }}
        >
          <div className="row">
            <div className="grow">
              <b style={{ fontSize: 20 }}>{selected.length} artikala</b>
              <div style={{ opacity: 0.8, fontSize: 12 }}>Trebovanje: {location?.name}</div>
            </div>
            <button
              className="btn"
              style={{ background: "#ef7d00", color: "white", minHeight: 54 }}
              disabled={!selected.length}
              onClick={() => setReview(true)}
            >
              KONTROLIŠI SPISAK →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
