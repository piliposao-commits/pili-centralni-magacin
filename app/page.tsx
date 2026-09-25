"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  username: string;
  full_name: string;
  role: "ADMIN" | "MAGACIONER" | "PRODAVNICA";
};

type Stock = {
  article_id: string;
  sifra: string;
  naziv: string;
  barkod: string | null;
  jm: string;
  stanje: number;
  maloprodajna_cena?: number;
  vrednost?: number;
  image_url?: string | null;
  initial_qty?: number;
  inbound_qty?: number;
  outbound_qty?: number;
  calculated_qty?: number;
};

type Location = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type TransferLine = {
  article_id: string;
  sifra: string;
  naziv: string;
  barkod: string | null;
  jm: string;
  qty: number;
  stock: number;
};

type RequestLine = {
  article_id: string;
  sifra: string;
  naziv: string;
  jm: string;
  qty: number;
};

type Req = {
  id: string;
  location_id: string;
  location_name: string;
  requested_by: string;
  status: string;
  created_at: string;
  lines: RequestLine[];
};

type PreparedLine = RequestLine & {
  stock: number;
  sendQty: number;
  checked: boolean;
};

const money = (n: any) =>
  Number(n || 0).toLocaleString("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " RSD";

const qtyLabel = (n: number) =>
  Number(n || 0).toLocaleString("sr-RS", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

const articleImageKey = (x: { sifra?: string; barkod?: string | null; article_id?: string }) =>
  x.sifra ? `sifra:${x.sifra}` : x.barkod ? `barkod:${x.barkod}` : `id:${x.article_id || "unknown"}`;


function CalculationPageCard({
  file,
  index,
  canAddMore,
  onAdd,
  onRemove,
}: {
  file: File;
  index: number;
  canAddMore: boolean;
  onAdd: (file?: File | null) => void;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        border: "2px solid #dbe2ef",
        background: "#fff",
        minHeight: 220,
      }}
    >
      {previewUrl && (
        <img
          src={previewUrl}
          alt={`Strana ${index + 1}`}
          style={{
            display: "block",
            width: "100%",
            height: 260,
            objectFit: "cover",
            background: "#eef2f8",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: 10,
          top: 10,
          background: "rgba(28,47,130,.92)",
          color: "white",
          borderRadius: 999,
          padding: "7px 11px",
          fontWeight: 1000,
          fontSize: 14,
        }}
      >
        Strana {index + 1}
      </div>

      <button
        type="button"
        aria-label={`Obriši stranu ${index + 1}`}
        title="Obriši ovu stranu"
        onClick={onRemove}
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          width: 42,
          height: 42,
          borderRadius: "50%",
          border: "2px solid white",
          background: "rgba(15,23,42,.82)",
          color: "white",
          fontSize: 20,
          fontWeight: 1000,
          cursor: "pointer",
        }}
      >
        ×
      </button>

      {canAddMore && (
        <label
          aria-label="Dodaj sledeću stranu"
          title="Dodaj sledeću stranu"
          style={{
            position: "absolute",
            right: 14,
            bottom: 14,
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "4px solid white",
            background: "#ef7d00",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            lineHeight: 1,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(0,0,0,.24)",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
            <span style={{ fontSize: 40 }}>+</span>
            <span style={{ fontSize: 8, fontWeight: 1000, marginTop: 2 }}>JOŠ</span>
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              onAdd(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
        </label>
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "28px 12px 10px",
          background: "linear-gradient(transparent, rgba(0,0,0,.72))",
          color: "white",
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {file.name}
      </div>
    </div>
  );
}


export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("menu");
  const [stock, setStock] = useState<Stock[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [dest, setDest] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Stock | null>(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [images, setImages] = useState<Record<string, string>>({});

  const [activeReq, setActiveReq] = useState<Req | null>(null);
  const [adminReq, setAdminReq] = useState<Req | null>(null);
  const [prepared, setPrepared] = useState<PreparedLine[]>([]);
  const [editingLine, setEditingLine] = useState<PreparedLine | null>(null);
  const [editingQty, setEditingQty] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [finishingRequest, setFinishingRequest] = useState(false);

  const [scan, setScan] = useState<any>(null);
  const [scanBusy, setScanBusy] = useState(false);
  
  const [inboundBusy, setInboundBusy] = useState(false);
  const [savingArticleMeta, setSavingArticleMeta] = useState<string | null>(null);
  const [pendingArticleImages, setPendingArticleImages] = useState<Record<string, File>>({});
  const [savingArticleImage, setSavingArticleImage] = useState<string | null>(null);
const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [inventoryQty, setInventoryQty] = useState<Record<string, number>>({});
  const [savingInventory, setSavingInventory] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState("default");
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const imageMigrationRunningRef = useRef(false);

  async function migrateLocalImagesToServer(userInfo: User, rows: Stock[]) {
    if (userInfo.role !== "ADMIN" || imageMigrationRunningRef.current) return;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem("cm_article_images") || "{}");
    } catch {
      return;
    }
    const missing = rows.filter((x) => !x.image_url && String(saved[articleImageKey(x)] || "").startsWith("data:image/"));
    if (!missing.length) return;

    imageMigrationRunningRef.current = true;
    try {
      for (const article of missing) {
        const dataUrl = saved[articleImageKey(article)];
        try {
          const blob = await fetch(dataUrl).then((r) => r.blob());
          const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
          const fd = new FormData();
          fd.append("article_id", article.article_id);
          fd.append("file", new File([blob], `${article.sifra || article.article_id}.${ext}`, { type: blob.type || "image/jpeg" }));
          const r = await fetch("/api/article-image", { method: "POST", body: fd });
          const j = await r.json().catch(() => null);
          if (r.ok && j?.ok && j.image_url) {
            article.image_url = j.image_url;
            saved[articleImageKey(article)] = j.image_url;
          }
        } catch {}
      }
      localStorage.setItem("cm_article_images", JSON.stringify(saved));
      setImages((prev) => ({ ...prev, ...saved }));
    } finally {
      imageMigrationRunningRef.current = false;
    }
  }

  function playRequestSound() {
    try {
      const audio = alertAudioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {}
  }

  async function showRequestNotification(req: Req) {
    playRequestSound();
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const title = `Novo trebovanje — ${req.location_name}`;
    const body = `${req.requested_by || "Prodavnica"} · ${(req.lines || []).length} stavki`;
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: "/pili-logo.png",
          badge: "/pili-logo.png",
          tag: `cm-request-${req.id}`,
          data: { url: "/" },
        });
      } else {
        new Notification(title, { body, icon: "/pili-logo.png", tag: `cm-request-${req.id}` });
      }
    } catch {}
  }

  async function enableRequestAlerts() {
    if (!("Notification" in window)) {
      setMsg("Ovaj pregledač ne podržava sistemske notifikacije.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      localStorage.setItem("cm_request_alerts", "1");
      setAlertsEnabled(true);
      playRequestSound();
      setMsg("✓ Notifikacije i zvuk za nova trebovanja su uključeni.");
    } else {
      localStorage.removeItem("cm_request_alerts");
      setAlertsEnabled(false);
      setMsg("Notifikacije nisu dozvoljene u pregledaču.");
    }
  }

  async function load() {
    const r = await fetch("/api/data");
    if (r.status === 401) {
      setUser(null);
      return;
    }
    const j = await r.json();
    if (j.ok) {
      setUser(j.user);
      setStock(j.stock || []);
      const serverImages = Object.fromEntries((j.stock || []).filter((x: any) => x.image_url).map((x: any) => [articleImageKey(x), x.image_url]));
      setImages((prev) => ({ ...prev, ...serverImages }));
      setInventoryQty(Object.fromEntries((j.stock || []).map((x: any) => [x.article_id, Number(x.stanje || 0)])));
      setLocations(j.locations || []);
      setRequests(j.requests || []);
      void migrateLocalImagesToServer(j.user, j.stock || []);
    }
  }

  useEffect(() => {
    load();
    try {
      const saved = localStorage.getItem("cm_article_images");
      if (saved) setImages(JSON.parse(saved));
      alertAudioRef.current = new Audio("/notification.wav");
      alertAudioRef.current.preload = "auto";
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
        setAlertsEnabled(Notification.permission === "granted" && localStorage.getItem("cm_request_alerts") === "1");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user || user.role !== "MAGACIONER") return;
    let stopped = false;
    let initialized = false;
    const known = new Set<string>();

    const checkRequests = async () => {
      try {
        const r = await fetch("/api/request", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok || !j.ok || stopped) return;
        const rows: Req[] = Array.isArray(j.requests) ? j.requests : [];
        const activeRows = rows.filter((x) => x.status === "NOVO" || x.status === "U PRIPREMI");
        setRequests(rows);
        if (!initialized) {
          activeRows.forEach((x) => known.add(x.id));
          initialized = true;
          return;
        }
        const fresh = activeRows.filter((x) => !known.has(x.id));
        activeRows.forEach((x) => known.add(x.id));
        for (const req of fresh.reverse()) {
          setMsg(`🔔 Novo trebovanje: ${req.location_name} — ${(req.lines || []).length} stavki.`);
          await showRequestNotification(req);
        }
      } catch {}
    };

    void checkRequests();
    const timer = window.setInterval(checkRequests, 8000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN" && tab === "menu") setTab("ulaz");
  }, [user, tab]);

  function saveImages(next: Record<string, string>) {
    setImages(next);
    try {
      localStorage.setItem("cm_article_images", JSON.stringify(next));
    } catch {}
  }

  async function doLogin() {
    setMsg("");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(login),
    });
    const j = await r.json();
    if (!j.ok) {
      setMsg(j.message || "Pogrešan user ili lozinka.");
      return;
    }
    if (j.user?.role === "PRODAVNICA") {
      window.location.href = "/trebovanje";
      return;
    }
    setUser(j.user);
    await load();
  }

  async function markAdminRequestRead(r: Req) {
    if (r.status !== "NOVO") return r;
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "status", request_id: r.id, status: "U PRIPREMI" }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) return r;

      const updated = { ...r, status: "U PRIPREMI" };
      setRequests((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      return updated;
    } catch {
      return r;
    }
  }

  async function openAdminRequest(r: Req) {
    setAdminReq(r);
    const updated = await markAdminRequestRead(r);
    if (updated.status !== r.status) setAdminReq(updated);
  }

  async function printAdminRequest() {
    if (!adminReq) return;
    const updated = await markAdminRequestRead(adminReq);
    if (updated.status !== adminReq.status) setAdminReq(updated);
    window.setTimeout(() => window.print(), 80);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
  }

  const stores = locations.filter((x) => x.type !== "CENTRAL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stock.filter(
      (x) =>
        !q ||
        x.naziv.toLowerCase().includes(q) ||
        x.sifra.toLowerCase().includes(q) ||
        (x.barkod || "").includes(q)
    );
  }, [stock, search]);

  function openArticle(s: Stock) {
    setSelectedArticle(s);
    const existing = lines.find((x) => x.article_id === s.article_id);
    setSelectedQty(existing?.qty || 1);
  }

  function addSelected() {
    if (!selectedArticle) return;
    const qty = Number(selectedQty || 0);
    if (qty <= 0) return setMsg("Količina mora biti veća od 0.");
    if (qty > Number(selectedArticle.stanje))
      return setMsg(
        `${selectedArticle.naziv}: na stanju je ${qtyLabel(Number(selectedArticle.stanje))} ${selectedArticle.jm}.`
      );

    const existing = lines.find((x) => x.article_id === selectedArticle.article_id);
    if (existing) {
      setLines(
        lines.map((x) =>
          x.article_id === selectedArticle.article_id ? { ...x, qty } : x
        )
      );
    } else {
      setLines([
        ...lines,
        {
          article_id: selectedArticle.article_id,
          sifra: selectedArticle.sifra,
          naziv: selectedArticle.naziv,
          barkod: selectedArticle.barkod,
          jm: selectedArticle.jm,
          qty,
          stock: Number(selectedArticle.stanje),
        },
      ]);
    }
    setSelectedArticle(null);
    setMsg("");
  }

  async function finishTransfer() {
    if (!dest || !lines.length)
      return setMsg("Izaberi prodavnicu i dodaj artikle.");
    const bad = lines.find((x) => x.qty > x.stock || x.qty <= 0);
    if (bad)
      return setMsg(
        `${bad.naziv}: količina nije dozvoljena. Na stanju ${bad.stock}.`
      );

    const r = await fetch("/api/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        destination_id: dest,
        request_id: requestId,
        lines: lines.map((x) => ({ article_id: x.article_id, qty: x.qty })),
      }),
    });
    const j = await r.json();
    if (!j.ok) return setMsg(j.message);

    setMsg("Prenos je završen i stanje je ažurirano.");
    setLines([]);
    setDest("");
    setRequestId(null);
    await load();
  }

  function setArticleImage(key: string, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (url) saveImages({ ...images, [key]: url });
    };
    reader.readAsDataURL(file);
  }

  async function saveArticleImage(article: Stock) {
    const file = pendingArticleImages[article.article_id];
    if (!file) return setMsg("Izaberi sliku pa klikni SAČUVAJ SLIKU.");
    setSavingArticleImage(article.article_id);
    try {
      const fd = new FormData();
      fd.append("article_id", article.article_id);
      fd.append("file", file);
      const r = await fetch("/api/article-image", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.message || "Greška pri čuvanju slike.");
      setPendingArticleImages((prev) => { const n = { ...prev }; delete n[article.article_id]; return n; });
      setMsg("✓ Slika je sačuvana i zaključana za ovaj artikal.");
      await load();
    } catch (e: any) {
      const poruka = e?.message || "Greška pri čuvanju slike.";
      setMsg(`GREŠKA: ${poruka}`);
      alert(poruka);
    } finally {
      setSavingArticleImage(null);
    }
  }

  function scanItemExists(x: any) {
    const sifra = String(x?.sifra || "").trim();
    const barkod = String(x?.barkod || "").trim();
    return stock.some((s) =>
      (sifra && String(s.sifra || "").trim() === sifra) ||
      (barkod && String(s.barkod || "").trim() === barkod)
    );
  }

  function scanItemKey(x: any) {
    return articleImageKey({
      sifra: String(x?.sifra || "").trim(),
      barkod: String(x?.barkod || "").trim() || null,
    });
  }

  async function saveArticleMeta(article_id: string, barkod: string | null) {
    setSavingArticleMeta(article_id);
    try {
      const cleaned = String(barkod || "").trim();
      const r = await fetch("/api/article", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          article_id,
          barkod: !cleaned || cleaned === "0" || cleaned === "-" ? null : cleaned,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.message || "Greška pri čuvanju barkoda.");
      setMsg("✓ Barkod je sačuvan.");
      await load();
    } catch (e: any) {
      const poruka = e?.message || "Greška pri čuvanju barkoda.";
      setMsg(`GREŠKA: ${poruka}`);
      alert(poruka);
    } finally {
      setSavingArticleMeta(null);
    }
  }

  async function openRequest(r: Req) {
    setActiveReq(r);
    setReviewOpen(false);
    if (r.status === "NOVO") {
      try {
        await fetch("/api/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "status", request_id: r.id, status: "U PRIPREMI" }),
        });
        setRequests((all) => all.map((x) => x.id === r.id ? { ...x, status: "U PRIPREMI" } : x));
      } catch {}
    }
    const rows = (r.lines || []).map((l) => {
      const s = stock.find((x) => x.article_id === l.article_id);
      const current = Number(s?.stanje || 0);
      const requested = Number(l.qty || 0);
      return {
        ...l,
        stock: current,
        sendQty: Math.min(requested, current),
        checked: false,
      };
    });
    setPrepared(rows);
  }

  function togglePrepared(articleId: string) {
    setPrepared((rows) =>
      rows.map((x) => {
        if (x.article_id !== articleId) return x;
        if (x.sendQty <= 0 || x.sendQty > x.stock) return x;
        return { ...x, checked: !x.checked };
      })
    );
  }

  function openEdit(line: PreparedLine) {
    setEditingLine(line);
    setEditingQty(line.sendQty);
  }

  function saveEdit() {
    if (!editingLine) return;
    const q = Math.max(0, Number(editingQty || 0));
    if (q > editingLine.stock)
      return setMsg(
        `Ne može više od stanja: ${qtyLabel(editingLine.stock)} ${editingLine.jm}.`
      );
    setPrepared((rows) =>
      rows.map((x) =>
        x.article_id === editingLine.article_id
          ? { ...x, sendQty: q, checked: q > 0 ? x.checked : false }
          : x
      )
    );
    setEditingLine(null);
    setMsg("");
  }

  function goToReview() {
    if (!activeReq) return;
    const invalid = prepared.find((x) => x.sendQty > 0 && !x.checked);
    if (invalid)
      return setMsg(`Proveri i čekiraj stavku: ${invalid.naziv}.`);
    setReviewOpen(true);
    setMsg("");
  }

  async function finishRequestTransfer() {
    if (!activeReq || finishingRequest) return;
    const toSend = prepared.filter((x) => x.sendQty > 0);
    if (!toSend.length) return setMsg("Nema stavki za slanje.");

    setFinishingRequest(true);
    try {
      const r = await fetch("/api/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destination_id: activeReq.location_id,
          request_id: activeReq.id,
          lines: toSend.map((x) => ({ article_id: x.article_id, qty: x.sendQty })),
        }),
      });
      const j = await r.json();
      if (!j.ok) return setMsg(j.message);

      setMsg("Trebovanje je završeno. Poslate količine su oduzete iz centralnog magacina.");
      setActiveReq(null);
      setPrepared([]);
      setReviewOpen(false);
      await load();
    } finally {
      setFinishingRequest(false);
    }
  }

  function addScanFiles(fileList?: FileList | File[] | null) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    setMsg("");
    setScan(null);

    setScanFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (!file.type.startsWith("image/")) {
          setMsg("Možeš dodati samo fotografije kalkulacije.");
          continue;
        }
        if (next.length >= 8) {
          setMsg("Najviše 8 strana može biti u jednoj kalkulaciji.");
          break;
        }
        next.push(file);
      }
      return next;
    });
  }

  function addScanFile(file?: File | null) {
    if (!file) return;
    addScanFiles([file]);
  }

  function removeScanFile(index: number) {
    setScan(null);
    setScanFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearCalculationPhotos() {
    setScan(null);
    setScanFiles([]);
    setMsg("");
  }

  async function scanCalculation() {
    if (!scanFiles.length) {
      setMsg("Dodaj bar jednu stranu kalkulacije.");
      return;
    }
    setScanBusy(true);
    setMsg("");
    const fd = new FormData();
    scanFiles.forEach((file) => fd.append("files", file));
    try {
      const r = await fetch("/api/scan-calculation", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) {
        setMsg(j.message || "Dokument nije pročitan.");
        return;
      }
      setScan(j);
      if (Array.isArray(j.page_item_counts) && j.page_item_counts.length > 1) {
        const ukupno = (j.items || []).length;
        setMsg(`Spojeno ${j.pages} strana u jednu kalkulaciju — ${ukupno} stavki. Po stranama: ${j.page_item_counts.join(" + ")}.`);
      }
    } catch {
      setMsg("Greška pri slanju fotografija. Pokušaj ponovo.");
    } finally {
      setScanBusy(false);
    }
  }

  function patchItem(i: number, k: string, v: any) {
    setScan({
      ...scan,
      items: scan.items.map((x: any, idx: number) =>
        idx === i ? { ...x, [k]: v } : x
      ),
    });
  }

  function removeScanItem(i: number) {
    const item = scan?.items?.[i];
    const naziv = item?.naziv || item?.sifra || "stavka";

    if (!confirm(`Izbaciti "${naziv}" iz ovog ulaza robe?`)) return;

    setScan((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: Array.isArray(prev.items)
          ? prev.items.filter((_: any, idx: number) => idx !== i)
          : [],
      };
    });

    setMsg(`Stavka "${naziv}" je izbačena iz ulaza robe.`);
  }

  async function confirmInbound() {
    if (inboundBusy) return;

    const items = Array.isArray(scan?.items) ? scan.items : [];
    if (!items.length) {
      setMsg("Nema stavki za knjiženje.");
      return;
    }

    setInboundBusy(true);
    setMsg("Knjiženje ulaza robe je u toku...");

    try {
      const r = await fetch("/api/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document_no: scan.document_no,
          supplier: scan.supplier,
          lines: items.map((x: any) => ({
            ...x,
            barkod:
              !x?.barkod ||
              String(x.barkod).trim() === "0" ||
              String(x.barkod).trim() === "-"
                ? null
                : String(x.barkod).trim(),
          })),
        }),
      });

      const text = await r.text();
      let j: any = null;

      try {
        j = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(text || `Server je vratio grešku ${r.status}.`);
      }

      if (!r.ok || !j?.ok) {
        throw new Error(j?.message || `Greška pri knjiženju (${r.status}).`);
      }

      setMsg("✓ Ulaz robe je uspešno knjižen.");
      setScan(null);
      setScanFiles([]);
      await load();
      alert("Ulaz robe je uspešno knjižen.");
    } catch (e: any) {
      const poruka = e?.message || "Greška pri knjiženju ulaza robe.";
      setMsg(`GREŠKA: ${poruka}`);
      alert(`GREŠKA PRI KNJIŽENJU:\n${poruka}`);
    } finally {
      setInboundBusy(false);
    }
  }

  async function finishInventoryCount() {
    if (!stock.length) return setMsg("Nema artikala za popis. Prvo ubaci robu preko slike/kalkulacije.");
    setSavingInventory(true);
    setMsg("");
    const lines = stock.map((x) => ({ article_id: x.article_id, qty: Number(inventoryQty[x.article_id] ?? 0) }));
    const r = await fetch("/api/inventory-count", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const j = await r.json();
    setSavingInventory(false);
    if (!j.ok) return setMsg(j.message || "Greška pri čuvanju popisa.");
    setMsg(`Popis robe je završen. Ažurirano ${j.updated || 0} artikala.`);
    await load();
  }

  if (!user)
    return (
      <main className="login">
        <section className="loginBox">
          <img src="/pili-logo.png" className="logo" alt="PILI logo" />
          <div style={{ fontWeight: 900, letterSpacing: ".1em", color: "#1c2f82" }}>
            PILI
          </div>
          <div className="h1" style={{ color: "#1c2f82" }}>
            Centralni magacin
          </div>
          <p className="muted">Prijava zaposlenih</p>
          <div className="field">
            <label>User</label>
            <input
              value={login.username}
              onChange={(e) => setLogin({ ...login, username: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Lozinka</label>
            <input
              type="password"
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && doLogin()}
            />
          </div>
          <button
            className="btn"
            style={{ width: "100%", background: "#1c2f82", color: "white" }}
            onClick={doLogin}
          >
            ULOGUJ SE
          </button>
          {msg && <div className="error">{msg}</div>}
        </section>
      </main>
    );

  const total = stock.reduce((a, x) => a + Number(x.vrednost || 0), 0);
  const currentDest = stores.find((x) => x.id === dest);
  const unopenedRequests = requests.filter((r) => r.status === "NOVO");
  const workRequests = requests.filter((r) => r.status === "NOVO" || r.status === "U PRIPREMI");

  return (
    <main className="page">
      <header className="top" style={{ background: "#1c2f82" }}>
        <div>
          <strong>PILI — CENTRALNI MAGACIN</strong>
          <small>
            {user.full_name} · {user.role}
          </small>
        </div>
        <button className="btn btnGhost" onClick={logout}>
          Odjava
        </button>
      </header>

      <div className="wrap">
        <section
          className="banner hero"
          style={{ background: "linear-gradient(135deg,#1c2f82,#3147ab)" }}
        >
          <div className="big">Centralni magacin</div>
          <div>
            {user.role === "ADMIN"
              ? `Vrednost robe: ${money(total)}`
              : tab === "menu" ? "Izaberi operaciju" : "Touchscreen rad magacionera"}
          </div>
        </section>

        {user.role === "MAGACIONER" && (
          <section
            className="banner"
            style={{
              marginBottom: 14,
              border: alertsEnabled ? "2px solid #15915f" : "2px solid #ef7d00",
              background: alertsEnabled ? "#effbf5" : "#fff7ed",
            }}
          >
            <div className="row">
              <div className="grow">
                <div style={{ fontWeight: 1000, fontSize: 18 }}>🔔 Obaveštenja za nova trebovanja</div>
                <div className="muted">
                  {alertsEnabled && notificationPermission === "granted"
                    ? "UKLJUČENA — novo trebovanje aktivira zvuk i sistemsku notifikaciju."
                    : "Uključi jednom na ovom uređaju magacionera."}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={enableRequestAlerts}
                style={{ background: alertsEnabled ? "#15915f" : "#ef7d00", color: "white", minHeight: 48 }}
              >
                {alertsEnabled ? "✓ UKLJUČENO" : "UKLJUČI NOTIFIKACIJE"}
              </button>
            </div>
          </section>
        )}

        {user.role === "ADMIN" && (
          <div className="tabs">
            <button className={`btn ${tab === "ulaz" ? "active" : "btnGhost"}`} onClick={() => setTab("ulaz")}>📷 Ulaz robe</button>
            <button className={`btn ${tab === "pocetno" ? "active" : "btnGhost"}`} onClick={() => setTab("pocetno")}>📦 Početno stanje</button>
            <button className={`btn ${tab === "popis" ? "active" : "btnGhost"}`} onClick={() => setTab("popis")}>🧾 Popis robe</button>
            <button className={`btn ${tab === "stanje" ? "active" : "btnGhost"}`} onClick={() => setTab("stanje")}>Stanje / vrednost</button>
            <button className={`btn ${tab === "trebovanja" ? "active" : "btnGhost"}`} onClick={() => setTab("trebovanja")}>Trebovanja {unopenedRequests.length > 0 ? `(${unopenedRequests.length} neotvorenih)` : ""}</button>
          </div>
        )}

        {user.role === "MAGACIONER" && tab !== "menu" && (
          <div style={{ margin: "14px 0" }}>
            <button
              className="btn btnGhost"
              style={{ minHeight: 52, fontSize: 17, padding: "0 22px" }}
              onClick={() => { setTab("menu"); setActiveReq(null); setDest(""); setLines([]); setMsg(""); }}
            >
              ← GLAVNI MENI
            </button>
          </div>
        )}

        {user.role === "MAGACIONER" && tab === "menu" && (
          <section style={{ marginTop: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                gap: 18,
              }}
            >
              <button
                onClick={() => { setTab("izlaz"); setActiveReq(null); }}
                style={{
                  minHeight: 220,
                  border: 0,
                  borderRadius: 28,
                  background: "linear-gradient(135deg,#1c2f82,#3147ab)",
                  color: "white",
                  padding: 28,
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 18px 40px #1c2f8230",
                }}
              >
                <div style={{ fontSize: 72, lineHeight: 1 }}>📦</div>
                <div style={{ fontSize: 32, fontWeight: 1000, marginTop: 18 }}>IZLAZ ROBE</div>
                <div style={{ fontSize: 17, opacity: .88, marginTop: 8 }}>Izaberi prodavnicu i dodaj robu dodirom</div>
              </button>

              <button
                onClick={() => setTab("trebovanja")}
                style={{
                  minHeight: 220,
                  border: 0,
                  borderRadius: 28,
                  background: "linear-gradient(135deg,#ef7d00,#ff9d2e)",
                  color: "white",
                  padding: 28,
                  textAlign: "left",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: "0 18px 40px #ef7d0030",
                }}
              >
                {unopenedRequests.length > 0 && (
                  <div style={{ position: "absolute", top: 18, right: 18, minWidth: 50, height: 50, borderRadius: 999, background: "white", color: "#ef7d00", display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 22 }}>
                    {unopenedRequests.length}
                  </div>
                )}
                <div style={{ fontSize: 72, lineHeight: 1 }}>🧾</div>
                <div style={{ fontSize: 32, fontWeight: 1000, marginTop: 18 }}>TREBOVANJA</div>
                <div style={{ fontSize: 17, opacity: .92, marginTop: 8 }}>Nova trebovanja prodavnica i kontrola stavki</div>
              </button>
            </div>
          </section>
        )}

        {msg && (
          <div className={msg.includes("završen") || msg.includes("knjižen") || msg.includes("poslata") ? "success" : "error"}>
            {msg}
          </div>
        )}

        {user.role === "MAGACIONER" && tab === "izlaz" && (
          <>
            {!dest && <section className="banner" style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 26 }}>1. DODIRNI PRODAVNICU</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 14 }}>
                {stores.map((x) => {
                  const active = dest === x.id;
                  return (
                    <button
                      key={x.id}
                      onClick={() => { setDest(x.id); setLines([]); setRequestId(null); }}
                      style={{
                        minHeight: 130,
                        border: active ? "4px solid #ef7d00" : "2px solid #dfe5ee",
                        borderRadius: 22,
                        background: active ? "#fff7ed" : "white",
                        color: "#1c2f82",
                        cursor: "pointer",
                        fontWeight: 1000,
                        fontSize: 23,
                        boxShadow: active ? "0 10px 28px #ef7d0025" : "0 8px 20px #0000000a",
                      }}
                    >
                      <div style={{ fontSize: 40, marginBottom: 7 }}>🏪</div>
                      {x.name}
                    </button>
                  );
                })}
              </div>
            </section>}

            {dest && (
              <section
                className="banner"
                style={{
                  marginBottom: 14,
                  background: "#eef2ff",
                  border: "2px solid #1c2f82",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 900, color: "#59657a" }}>TRENUTNI PRENOS</div>
                <div style={{ fontSize: 28, fontWeight: 1000, color: "#1c2f82" }}>
                  CENTRALNI MAGACIN → {currentDest?.name}
                </div>
                <button
                  className="btn btnGhost"
                  style={{ marginTop: 10 }}
                  onClick={() => { setDest(""); setLines([]); setRequestId(null); setSearch(""); }}
                >
                  ← PROMENI PRODAVNICU
                </button>
              </section>
            )}

            {dest && (
              <section className="banner">
                <h2>2. Dodirni artikal</h2>
                <input
                  className="search"
                  placeholder="Pretraga: naziv, šifra ili barkod"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minHeight: 54, fontSize: 17 }}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))",
                    gap: 12,
                    marginTop: 14,
                  }}
                >
                  {filtered.map((s) => {
                    const chosen = lines.find((x) => x.article_id === s.article_id);
                    return (
                      <div
                        key={s.article_id}
                        style={{
                          position: "relative",
                          border: chosen ? "3px solid #ef7d00" : "1px solid #dce2ec",
                          borderRadius: 18,
                          background: "white",
                          overflow: "hidden",
                          boxShadow: "0 6px 18px #00000010",
                        }}
                      >
                        <button
                          onClick={() => openArticle(s)}
                          style={{
                            width: "100%",
                            border: 0,
                            background: "transparent",
                            padding: 10,
                            cursor: "pointer",
                            textAlign: "center",
                            color: "inherit",
                          }}
                        >
                          <div
                            style={{
                              height: 108,
                              borderRadius: 14,
                              background: "#f5f7fb",
                              display: "grid",
                              placeItems: "center",
                              overflow: "hidden",
                              marginBottom: 8,
                            }}
                          >
                            {images[articleImageKey(s)] ? (
                              <img
                                src={images[articleImageKey(s)]}
                                alt={s.naziv}
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              />
                            ) : (
                              <div style={{ fontSize: 42 }}>📷</div>
                            )}
                          </div>
                          <div style={{ fontWeight: 900, minHeight: 40, lineHeight: 1.15 }}>{s.naziv}</div>
                          <div style={{ fontSize: 12, color: "#748095", marginTop: 4 }}>Šifra {s.sifra}</div>
                          <div
                            style={{
                              marginTop: 8,
                              padding: "9px 6px",
                              borderRadius: 12,
                              background: "#eef2ff",
                              fontWeight: 1000,
                              color: "#1c2f82",
                              fontSize: 18,
                            }}
                          >
                            {qtyLabel(Number(s.stanje))} {s.jm}
                          </div>
                          {chosen && (
                            <div
                              style={{
                                marginTop: 7,
                                padding: 7,
                                borderRadius: 10,
                                background: "#fff3e5",
                                color: "#a34d00",
                                fontWeight: 900,
                              }}
                            >
                              U PRENOSU: {qtyLabel(chosen.qty)} {chosen.jm}
                            </div>
                          )}
                        </button>

                        {!images[articleImageKey(s)] && (
                          <label
                            style={{
                              display: "block",
                              padding: "9px 7px",
                              textAlign: "center",
                              background: "#f8fafc",
                              borderTop: "1px solid #e5e7eb",
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#1c2f82",
                              cursor: "pointer",
                            }}
                          >
                            📷 PRVI UNOS SLIKE
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              style={{ display: "none" }}
                              onChange={(e) => setArticleImage(articleImageKey(s), e.target.files?.[0])}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {dest && lines.length > 0 && (
              <section
                className="banner"
                style={{
                  position: "sticky",
                  bottom: 10,
                  zIndex: 15,
                  marginTop: 14,
                  border: "2px solid #1c2f82",
                }}
              >
                <div className="row">
                  <div className="grow">
                    <div style={{ fontWeight: 1000, fontSize: 20 }}>{lines.length} stavki u prenosu</div>
                    <div className="muted">{currentDest?.name}</div>
                  </div>
                  <button
                    className="btn"
                    style={{ background: "#ef7d00", color: "white", minHeight: 54, fontSize: 17 }}
                    onClick={finishTransfer}
                  >
                    ZAVRŠI PRENOS
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {user.role === "MAGACIONER" && tab === "trebovanja" && !activeReq && (
          <section className="banner">
            <h2>Trebovanja <span style={{fontSize:16,color:"#ef7d00"}}>· NEOTVORENA: {unopenedRequests.length}</span></h2>
            <p className="muted">Prodavnica je već unela stavke. Ti samo kontrolišeš, čekiraš i po potrebi ispravljaš količinu.</p>
            <div className="cardList" style={{ marginTop: 14 }}>
              {workRequests.length === 0 && <p className="muted">Nema aktivnih trebovanja.</p>}
              {workRequests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openRequest(r)}
                  style={{
                    width: "100%",
                    border: "2px solid #ef7d00",
                    background: "#fffaf4",
                    borderRadius: 18,
                    padding: 18,
                    textAlign: "left",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 1000, color: r.status === "NOVO" ? "#ef7d00" : "#1c2f82" }}>
                    {r.status === "NOVO" ? "NEOTVORENO TREBOVANJE" : "OTVORENO · U PRIPREMI"}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 1000, color: "#1c2f82" }}>{r.location_name}</div>
                  <div style={{ marginTop: 6, color: "#6b7280" }}>
                    {r.requested_by} · {new Date(r.created_at).toLocaleString("sr-RS")} · {(r.lines || []).length} stavki
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {user.role === "MAGACIONER" && tab === "trebovanja" && activeReq && !reviewOpen && (
          <>
            <section
              className="banner"
              style={{ background: "#fff7ed", border: "2px solid #ef7d00", marginBottom: 14 }}
            >
              <div style={{ fontSize: 13, fontWeight: 1000, color: "#c66000" }}>TREBOVANJE ZA</div>
              <div style={{ fontSize: 30, fontWeight: 1000, color: "#1c2f82" }}>{activeReq.location_name}</div>
              <div className="muted">Tražio: {activeReq.requested_by}</div>
            </section>

            <section className="banner">
              <h2>Kontrola stavki</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                {prepared.map((l) => {
                  const enough = l.stock >= l.sendQty && l.sendQty > 0;
                  return (
                    <div
                      key={l.article_id}
                      style={{
                        border: l.checked ? "3px solid #15915f" : "2px solid #dce2ec",
                        borderRadius: 18,
                        padding: 12,
                        background: l.checked ? "#effbf5" : "white",
                      }}
                    >
                      <div
                        style={{
                          height: 115,
                          borderRadius: 14,
                          background: "#f5f7fb",
                          display: "grid",
                          placeItems: "center",
                          overflow: "hidden",
                        }}
                      >
                        {images[articleImageKey(l)] ? (
                          <img
                            src={images[articleImageKey(l)]}
                            alt={l.naziv}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <div style={{ fontSize: 46 }}>📦</div>
                        )}
                      </div>

                      <div style={{ fontWeight: 1000, fontSize: 18, marginTop: 10 }}>{l.naziv}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>Šifra {l.sifra}</div>

                      <div style={{ marginTop: 10, display: "grid", gap: 5 }}>
                        <div>
                          Traženo: <b>{qtyLabel(Number(l.qty))} {l.jm}</b>
                        </div>
                        <div>
                          Na stanju: <b>{qtyLabel(l.stock)} {l.jm}</b>
                        </div>
                        <div style={{ color: l.sendQty < Number(l.qty) ? "#b45309" : "#166534" }}>
                          Šaljem: <b>{qtyLabel(l.sendQty)} {l.jm}</b>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => togglePrepared(l.article_id)}
                          disabled={!enough}
                          style={{
                            border: 0,
                            borderRadius: 12,
                            minHeight: 50,
                            fontWeight: 1000,
                            cursor: enough ? "pointer" : "not-allowed",
                            background: l.checked ? "#15915f" : enough ? "#eef2ff" : "#fee2e2",
                            color: l.checked ? "white" : enough ? "#1c2f82" : "#991b1b",
                          }}
                        >
                          {l.checked ? "✓ SPREMNO" : enough ? "☐ ČEKIRAJ" : "NEMA DOVOLJNO"}
                        </button>
                        <button
                          onClick={() => openEdit(l)}
                          title="Ispravi količinu"
                          style={{
                            width: 52,
                            minHeight: 50,
                            border: 0,
                            borderRadius: 12,
                            background: "#fff3e5",
                            fontSize: 24,
                            cursor: "pointer",
                          }}
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn btnGhost" onClick={() => { setActiveReq(null); setPrepared([]); }}>
                  ← Nazad
                </button>
                <div className="grow" />
                <button
                  className="btn"
                  style={{ background: "#ef7d00", color: "white", minHeight: 54, fontSize: 17 }}
                  onClick={goToReview}
                >
                  KONTROLIŠI CEO SPISAK →
                </button>
              </div>
            </section>
          </>
        )}

        {user.role === "MAGACIONER" && tab === "trebovanja" && activeReq && reviewOpen && (
          <section className="banner" style={{ border: "2px solid #1c2f82" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 1000, color: "#6b7280" }}>ZAVRŠNA KONTROLA</div>
              <h2 style={{ fontSize: 30, color: "#1c2f82" }}>{activeReq.location_name}</h2>
              <p className="muted">Proveri da li je ovo tačno pre završetka.</p>
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Artikal</th>
                    <th className="right">Traženo</th>
                    <th className="right">Poslato</th>
                    <th className="right">Razlika</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prepared.map((l) => (
                    <tr key={l.article_id}>
                      <td><b>{l.naziv}</b><div style={{ fontSize: 12, color: "#6b7280" }}>Šifra {l.sifra}</div></td>
                      <td className="right">{qtyLabel(Number(l.qty))} {l.jm}</td>
                      <td className="right"><b>{qtyLabel(l.sendQty)} {l.jm}</b></td>
                      <td className="right" style={{ color: l.sendQty < Number(l.qty) ? "#b45309" : "#166534" }}>
                        {qtyLabel(Number(l.qty) - l.sendQty)} {l.jm}
                      </td>
                      <td>{l.checked ? "✓ Provereno" : l.sendQty === 0 ? "Nema za slanje" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btnGhost" onClick={() => setReviewOpen(false)}>
                ← VRATI SE I ISPRAVI
              </button>
              <div className="grow" />
              <button
                className="btn"
                style={{ background: "#15915f", color: "white", minHeight: 56, fontSize: 17 }}
                onClick={finishRequestTransfer}
                disabled={finishingRequest}
              >
                {finishingRequest ? "KNJIŽIM STANJE…" : "✓ POTVRDI I ZAVRŠI TREBOVANJE"}
              </button>
            </div>
          </section>
        )}

        {editingLine && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(7,16,31,.65)",
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <div className="banner" style={{ width: "min(440px,96vw)" }}>
              <div style={{ fontSize: 13, fontWeight: 1000, color: "#ef7d00" }}>ISPRAVKA KOLIČINE</div>
              <h2>{editingLine.naziv}</h2>
              <p>Traženo: <b>{qtyLabel(Number(editingLine.qty))} {editingLine.jm}</b></p>
              <p>Na stanju: <b>{qtyLabel(editingLine.stock)} {editingLine.jm}</b></p>
              <div className="field">
                <label>Koliko stvarno šalješ?</label>
                <input
                  autoFocus
                  type="number"
                  step="0.001"
                  value={editingQty}
                  onChange={(e) => setEditingQty(Number(e.target.value))}
                  style={{ fontSize: 26, fontWeight: 1000, textAlign: "center" }}
                />
              </div>
              <div className="row">
                <button className="btn btnGhost grow" onClick={() => setEditingLine(null)}>Odustani</button>
                <button className="btn grow" style={{ background: "#ef7d00", color: "white" }} onClick={saveEdit}>SAČUVAJ</button>
              </div>
            </div>
          </div>
        )}

        {selectedArticle && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(7,16,31,.65)",
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <div className="banner" style={{ width: "min(440px,96vw)", textAlign: "center" }}>
              <div
                style={{
                  height: 160,
                  background: "#f5f7fb",
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {images[articleImageKey(selectedArticle)] ? (
                  <img
                    src={images[articleImageKey(selectedArticle)]}
                    alt={selectedArticle.naziv}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ fontSize: 54 }}>📦</div>
                )}
              </div>
              <h2 style={{ marginTop: 12 }}>{selectedArticle.naziv}</h2>
              <div style={{ fontSize: 18, color: "#1c2f82", fontWeight: 900 }}>
                Na stanju: {qtyLabel(Number(selectedArticle.stanje))} {selectedArticle.jm}
              </div>
              <div className="field">
                <label>Količina za slanje</label>
                <input
                  autoFocus
                  type="number"
                  step="0.001"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(Number(e.target.value))}
                  style={{ fontSize: 28, fontWeight: 1000, textAlign: "center" }}
                />
              </div>
              <div className="row">
                <button className="btn btnGhost grow" onClick={() => setSelectedArticle(null)}>Odustani</button>
                <button className="btn grow" style={{ background: "#ef7d00", color: "white" }} onClick={addSelected}>DODAJ</button>
              </div>
            </div>
          </div>
        )}

        {user.role === "ADMIN" && tab === "ulaz" && (
          <section className="banner">
            <h2 style={{ fontSize: 28, color: "#1c2f82" }}>ULAZ ROBE — SLIKA KALKULACIJE</h2>

            <div
              style={{
                marginTop: 14,
                border: "2px dashed #bfc9dc",
                borderRadius: 20,
                padding: 22,
                background: "#f8faff",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 52 }}>📷</div>
              <div style={{ fontWeight: 1000, fontSize: 20, color: "#1c2f82" }}>
                SLIKANJE / UBACIVANJE KALKULACIJE
              </div>
              <p className="notice" style={{ fontSize: 14 }}>
                Na računaru možeš odjednom izabrati više slika iste kalkulacije (Ctrl/Shift). Na telefonu dodaj prvu stranu, pa preko + dodaj sledeće.
              </p>

              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "center",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <label
                    className="btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#1c2f82",
                      color: "white",
                      minHeight: 56,
                      padding: "0 20px",
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: 1000,
                    }}
                  >
                    🖼 IZABERI VIŠE SLIKA
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const files = e.currentTarget.files;
                        addScanFiles(files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <label
                    className="btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#ef7d00",
                      color: "white",
                      minHeight: 56,
                      padding: "0 20px",
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: 1000,
                    }}
                  >
                    📷 SLIKAJ JEDNU STRANU
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        addScanFile(e.currentTarget.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                <div style={{ color: "#65708a", fontSize: 14, marginTop: 10 }}>
                  <b>Računar:</b> klikni „IZABERI VIŠE SLIKA“, drži Ctrl i označi sve strane iste kalkulacije.
                  <br />
                  <b>Telefon:</b> možeš izabrati više slika iz galerije ili slikati jednu po jednu.
                </div>
              </div>

              {scanFiles.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 1000, color: "#1c2f82", fontSize: 20 }}>
                    IZABRANO: {scanFiles.length} {scanFiles.length === 1 ? "STRANA" : "STRANE"}
                  </div>
                  <div style={{ color: "#65708a", fontSize: 14, marginTop: 5 }}>
                    Sve strane će biti spojene u jednu kalkulaciju. Možeš dodati još preko narandžastog <b>+</b>.
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 12,
                      background: "#ffffff",
                      border: "1px solid #dbe2ef",
                      textAlign: "left",
                      fontSize: 13,
                      color: "#334155",
                    }}
                  >
                    {scanFiles.map((f, i) => (
                      <div key={`${f.name}-${f.lastModified}-${i}`}>
                        <b>{i + 1}.</b> {f.name}
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                      gap: 14,
                      marginTop: 14,
                    }}
                  >
                    {scanFiles.map((file, index) => (
                      <CalculationPageCard
                        key={`${file.name}-${file.lastModified}-${index}`}
                        file={file}
                        index={index}
                        canAddMore={index === scanFiles.length - 1 && scanFiles.length < 8}
                        onAdd={addScanFile}
                        onRemove={() => removeScanFile(index)}
                      />
                    ))}
                  </div>

                  {scanFiles.length >= 8 && (
                    <div style={{ marginTop: 10, fontWeight: 900, color: "#9a3412" }}>
                      Dostignut je maksimum od 8 strana.
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      justifyContent: "center",
                      flexWrap: "wrap",
                      marginTop: 16,
                    }}
                  >
                    <button
                      type="button"
                      className="btn btnGhost"
                      onClick={clearCalculationPhotos}
                      disabled={scanBusy}
                    >
                      OBRIŠI SVE STRANE
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: "#ef7d00",
                        color: "white",
                        minHeight: 54,
                        padding: "0 24px",
                        fontSize: 16,
                      }}
                      onClick={scanCalculation}
                      disabled={scanBusy}
                    >
                      {scanBusy ? "AI ČITA…" : `OBRADI SVE (${scanFiles.length}) KAO JEDNU KALKULACIJU`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {scanBusy && (
              <div
                style={{
                  marginTop: 14,
                  padding: 16,
                  borderRadius: 16,
                  background: "#eef2ff",
                  color: "#1c2f82",
                  fontWeight: 900,
                  textAlign: "center",
                }}
              >
                AI ČITA KALKULACIJU…
              </div>
            )}

            {scan && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  <div className="banner" style={{ boxShadow: "none", background: "#eef2ff" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#65708a" }}>BROJ DOKUMENTA</div>
                    <input
                      className="search"
                      value={scan.document_no || ""}
                      onChange={(e) => setScan({ ...scan, document_no: e.target.value })}
                      style={{ marginTop: 8, fontWeight: 900 }}
                    />
                  </div>
                  <div className="banner" style={{ boxShadow: "none", background: "#fff7ed" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#8a5a21" }}>DOBAVLJAČ</div>
                    <input
                      className="search"
                      value={scan.supplier || ""}
                      onChange={(e) => setScan({ ...scan, supplier: e.target.value })}
                      style={{ marginTop: 8, fontWeight: 900 }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 25, fontWeight: 1000, color: "#1c2f82", marginBottom: 10 }}>
                    KONTROLA STAVKI
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                      gap: 14,
                    }}
                  >
                    {(scan.items || []).map((x: any, i: number) => {
                      const exists = scanItemExists(x);
                      const key = scanItemKey(x);
                      const hasImage = !!images[key];

                      return (
                        <div
                          key={`${x.sifra}-${i}`}
                          style={{
                            border: exists ? "2px solid #dfe5ee" : "3px solid #ef7d00",
                            borderRadius: 22,
                            overflow: "hidden",
                            background: "white",
                            boxShadow: "0 8px 24px #0000000d",
                          }}
                        >
                          <div
                            style={{
                              padding: "9px 12px",
                              background: exists ? "#eef2ff" : "#fff3e5",
                              color: exists ? "#1c2f82" : "#9a4b00",
                              fontWeight: 1000,
                              textAlign: "center",
                            }}
                          >
                            {exists ? "POSTOJEĆI ARTIKAL" : "🆕 NOVI ARTIKAL — PRVI UNOS"}
                          </div>

                          <div style={{ padding: 12 }}>
                            <div
                              style={{
                                height: 145,
                                borderRadius: 16,
                                background: "#f4f6fa",
                                display: "grid",
                                placeItems: "center",
                                overflow: "hidden",
                                marginBottom: 10,
                              }}
                            >
                              {hasImage ? (
                                <img
                                  src={images[key]}
                                  alt={x.naziv || "Artikal"}
                                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                />
                              ) : (
                                <div style={{ textAlign: "center", color: "#1c2f82" }}>
                                  <div style={{ fontSize: 48 }}>📷</div>
                                  <div style={{ fontSize: 12, fontWeight: 900 }}>
                                    {exists ? "DODAJ SLIKU" : "SLIKA NIJE OBAVEZNA"}
                                  </div>
                                </div>
                              )}
                            </div>

                            <label
                              style={{
                                display: "block",
                                background: hasImage ? "#eef2ff" : "#1c2f82",
                                color: hasImage ? "#1c2f82" : "white",
                                borderRadius: 12,
                                padding: 11,
                                textAlign: "center",
                                fontWeight: 1000,
                                cursor: "pointer",
                                marginBottom: 10,
                              }}
                            >
                              📷 {hasImage ? "PROMENI SLIKU" : "USLIKAJ ARTIKAL"}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: "none" }}
                                onChange={(e) => setArticleImage(key, e.target.files?.[0])}
                              />
                            </label>

                            <div className="field" style={{ margin: "8px 0" }}>
                              <label>Šifra</label>
                              <input value={x.sifra || ""} onChange={(e) => patchItem(i, "sifra", e.target.value)} />
                            </div>
                            <div className="field" style={{ margin: "8px 0" }}>
                              <label>Naziv</label>
                              <input value={x.naziv || ""} onChange={(e) => patchItem(i, "naziv", e.target.value)} />
                            </div>
                            <div className="field" style={{ margin: "8px 0" }}>
                              <label>Barkod</label>
                              <input value={x.barkod || ""} onChange={(e) => patchItem(i, "barkod", e.target.value)} />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div className="field" style={{ margin: 0 }}>
                                <label>JM</label>
                                <input value={x.jm || ""} onChange={(e) => patchItem(i, "jm", e.target.value)} />
                              </div>
                              <div className="field" style={{ margin: 0 }}>
                                <label>Količina</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  value={x.kolicina}
                                  onChange={(e) => patchItem(i, "kolicina", Number(e.target.value))}
                                />
                              </div>
                            </div>

                            <div className="field" style={{ marginBottom: 0 }}>
                              <label>Maloprodajna cena</label>
                              <input
                                type="number"
                                step="0.01"
                                value={x.maloprodajna_cena}
                                onChange={(e) => patchItem(i, "maloprodajna_cena", Number(e.target.value))}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeScanItem(i)}
                              style={{
                                width: "100%",
                                marginTop: 10,
                                padding: "10px 12px",
                                border: "2px solid #dc2626",
                                borderRadius: 12,
                                background: "#fff1f2",
                                color: "#b91c1c",
                                fontWeight: 1000,
                                cursor: "pointer",
                              }}
                            >
                              ✕ IZBACI STAVKU
                            </button>

                            {!exists && (
                              <div
                                style={{
                                  marginTop: 10,
                                  borderRadius: 12,
                                  padding: 10,
                                  background: hasImage ? "#dcfce7" : "#eef2ff",
                                  color: hasImage ? "#166534" : "#1c2f82",
                                  fontWeight: 900,
                                  textAlign: "center",
                                }}
                              >
                                {hasImage ? "✓ SLIKA DODATA" : "SLIKU MOŽEŠ DODATI NAKNADNO"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    position: "sticky",
                    bottom: 10,
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 18,
                    background: "#1c2f82",
                    color: "white",
                    zIndex: 20,
                  }}
                >
                  <div className="row">
                    <div className="grow">
                      <div style={{ fontWeight: 1000, fontSize: 20 }}>
                        {(scan.items || []).length} stavki za knjiženje
                      </div>
                      <div style={{ opacity: .8, fontSize: 13 }}>
                        SLIKA NIJE OBAVEZNA • BARKOD NIJE OBAVEZAN • OBA MOGU NAKNADNO.
                      </div>
                    </div>
                    <button
                      className="btn"
                      style={{
                        background: "#ef7d00",
                        color: "white",
                        minHeight: 56,
                        fontSize: 17,
                      }}
                      onClick={confirmInbound}
                      disabled={inboundBusy}
                    >
                      {inboundBusy ? "KNJIŽIM..." : "POTVRDI ULAZ ROBE"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {user.role === "ADMIN" && tab === "pocetno" && (
          <section className="banner">
            <h2 style={{ fontSize: 28, color: "#1c2f82" }}>📦 STANJE OD NULE</h2>
            <p className="muted">
              Početno stanje svih artikala je 0. Stanje se računa automatski: <b>ULAZ ROBE − SVA UNEŠENA TREBOVANJA = TRENUTNO STANJE</b>.
              Čim prodavnica pošalje trebovanje, količina se odmah skida sa stanja centralnog magacina. Status magacionera ne menja ovu računicu.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 14, marginTop: 16 }}>
              {stock.map((s) => {
                const ulaz = Number(s.inbound_qty || 0);
                const izlaz = Number(s.outbound_qty || 0);
                const racunato = Number(s.calculated_qty ?? (ulaz - izlaz));
                return (
                  <div key={s.article_id} style={{ border: "1px solid #dfe5ee", borderRadius: 18, padding: 14, background: "white" }}>
                    <div style={{ fontWeight: 1000, color: "#1c2f82", fontSize: 18, minHeight: 44 }}>{s.naziv}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Šifra {s.sifra} · {s.barkod || "bez barkoda"}</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                      <div style={{ padding: 10, borderRadius: 12, background: "#f3f4f6" }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>POČETNO</div>
                        <div style={{ fontSize: 22, fontWeight: 1000 }}>0 {s.jm}</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 12, background: "#ecfdf5" }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#047857" }}>UKUPNO UŠLO</div>
                        <div style={{ fontSize: 22, fontWeight: 1000, color: "#047857" }}>+{qtyLabel(ulaz)}</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 12, background: "#fff7ed" }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#c2410c" }}>TREBOVANO</div>
                        <div style={{ fontSize: 22, fontWeight: 1000, color: "#c2410c" }}>−{qtyLabel(izlaz)}</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 12, background: "#eef2ff" }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#1c2f82" }}>TRENUTNO</div>
                        <div style={{ fontSize: 22, fontWeight: 1000, color: "#1c2f82" }}>{qtyLabel(racunato)} {s.jm}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 10, background: "#f8fafc", fontSize: 12, fontWeight: 900, color: "#475569", textAlign: "center" }}>
                      0 + {qtyLabel(ulaz)} − {qtyLabel(izlaz)} = {qtyLabel(racunato)} {s.jm}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}


        {user.role === "ADMIN" && tab === "popis" && (
          <section className="banner">
            <h2 style={{ fontSize: 28, color: "#1c2f82" }}>🧾 POPIS ROBE</h2>
            <p className="muted">Unesi stvarno fizičko stanje za svaki artikal. Kada klikneš ZAVRŠI POPIS, stanje centralnog magacina se postavlja tačno na unete količine.</p>
            {stock.length === 0 ? (
              <div style={{ padding: 24, borderRadius: 16, background: "#f7f9fc", fontWeight: 900, color: "#6b7280" }}>
                Nema artikala za popis. Prvo ubaci artikle preko slike/kalkulacije.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14, marginTop: 16 }}>
                  {stock.map((s) => (
                    <div key={s.article_id} style={{ border: "1px solid #dfe5ee", borderRadius: 18, padding: 14, background: "white" }}>
                      <div style={{ fontWeight: 1000, color: "#1c2f82", fontSize: 18, minHeight: 44 }}>{s.naziv}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Šifra {s.sifra} · {s.barkod || "bez barkoda"}</div>
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 900 }}>SISTEMSKO STANJE: {qtyLabel(Number(s.stanje))} {s.jm}</div>
                      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: "#6b7280" }}>FIZIČKI POPIS ({s.jm})</div>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={inventoryQty[s.article_id] ?? 0}
                        onChange={(e) => setInventoryQty({ ...inventoryQty, [s.article_id]: Number(e.target.value) })}
                        style={{ width: "100%", marginTop: 6, minHeight: 52, borderRadius: 12, border: "2px solid #dfe5ee", padding: "0 12px", fontSize: 22, fontWeight: 1000, textAlign: "center" }}
                      />
                      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 900, color: Number(inventoryQty[s.article_id] ?? 0) === Number(s.stanje) ? "#16803a" : "#b45309" }}>
                        Razlika: {qtyLabel(Number(inventoryQty[s.article_id] ?? 0) - Number(s.stanje))} {s.jm}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="btn"
                  onClick={finishInventoryCount}
                  disabled={savingInventory}
                  style={{ width: "100%", marginTop: 18, minHeight: 64, background: "#1c2f82", color: "white", fontSize: 20, fontWeight: 1000 }}
                >
                  {savingInventory ? "ČUVAM POPIS..." : "ZAVRŠI POPIS ROBE"}
                </button>
              </>
            )}
          </section>
        )}

        {user.role === "ADMIN" && tab === "stanje" && (
          <section className="banner">
            <h2>Stanje centralnog magacina</h2>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr><th>Slika</th><th>Šifra</th><th>Naziv</th><th>Barkod</th><th className="right">Stanje</th><th className="right">Malopr. cena</th><th className="right">Vrednost</th></tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.article_id}>
                      <td style={{ minWidth: 145 }}>
                        <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                          {(s.image_url || images[articleImageKey(s)]) ? (
                            <img
                              src={s.image_url || images[articleImageKey(s)]}
                              alt={s.naziv}
                              style={{ width: 76, height: 76, objectFit: "contain", borderRadius: 10, background: "#f7f9fc" }}
                            />
                          ) : (
                            <div style={{ width: 76, height: 76, borderRadius: 10, background: "#f7f9fc", display: "grid", placeItems: "center", fontSize: 28 }}>📷</div>
                          )}
                          {s.image_url ? (
                            <div style={{ fontWeight: 1000, color: "#16803a", fontSize: 11 }}>✓ SLIKA SAČUVANA</div>
                          ) : (
                            <>
                              <label style={{ cursor: "pointer", fontWeight: 900, color: "#1c2f82", fontSize: 12 }}>
                                {pendingArticleImages[s.article_id] ? "✓ SLIKA IZABRANA" : "DODAJ SLIKU"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setPendingArticleImages((prev) => ({ ...prev, [s.article_id]: file }));
                                    setArticleImage(articleImageKey(s), file);
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                className="btn"
                                disabled={!pendingArticleImages[s.article_id] || savingArticleImage === s.article_id}
                                onClick={() => saveArticleImage(s)}
                                style={{ width: "100%", background: "#ef7d00", color: "white", minHeight: 34, fontSize: 11 }}
                              >
                                {savingArticleImage === s.article_id ? "ČUVAM..." : "SAČUVAJ SLIKU"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td>{s.sifra}</td>
                      <td>{s.naziv}</td>
                      <td style={{ minWidth: 190 }}>
                        {s.barkod ? (
                          <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: "11px 9px", fontWeight: 1000 }}>
                            {s.barkod}<div style={{ fontSize: 10, marginTop: 3 }}>✓ SAČUVAN — ZAKLJUČAN</div>
                          </div>
                        ) : (
                          <>
                            <input
                              defaultValue=""
                              placeholder="Dodaj barkod naknadno"
                              id={`barcode-${s.article_id}`}
                              style={{ width: "100%", minHeight: 40, border: "1px solid #dfe5ee", borderRadius: 8, padding: "0 8px" }}
                            />
                            <button
                              type="button"
                              className="btn"
                              disabled={savingArticleMeta === s.article_id}
                              onClick={() => {
                                const el = document.getElementById(`barcode-${s.article_id}`) as HTMLInputElement | null;
                                saveArticleMeta(s.article_id, el?.value || null);
                              }}
                              style={{ marginTop: 6, width: "100%", background: "#1c2f82", color: "white", minHeight: 38, fontSize: 12 }}
                            >
                              {savingArticleMeta === s.article_id ? "ČUVAM..." : "SAČUVAJ BARKOD"}
                            </button>
                          </>
                        )}
                      </td>
                      <td className="right">{s.stanje} {s.jm}</td>
                      <td className="right">{money(s.maloprodajna_cena)}</td>
                      <td className="right"><b>{money(s.vrednost)}</b></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={6}><b>UKUPNA VREDNOST</b></td><td className="right"><b>{money(total)}</b></td></tr></tfoot>
              </table>
            </div>
          </section>
        )}

        {user.role === "ADMIN" && tab === "trebovanja" && !adminReq && (
          <section className="banner screenOnly">
            <div className="row">
              <div className="grow">
                <h2>Trebovanja prodavnica</h2>
                <p className="muted">Neotvorena trebovanja: <b style={{color:"#ef7d00"}}>{unopenedRequests.length}</b></p>
              </div>
              <div style={{
                minWidth: 92, minHeight: 72, borderRadius: 18, background:"#fff3e5",
                color:"#a34d00", display:"grid", placeItems:"center", fontWeight:1000, fontSize:28
              }}>
                {unopenedRequests.length}
              </div>
            </div>

            <div className="cardList" style={{marginTop:14}}>
              {requests.length === 0 && <p className="muted">Nema trebovanja.</p>}
              {requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openAdminRequest(r)}
                  style={{
                    width:"100%", border:r.status==="NOVO" ? "3px solid #ef7d00" : "1px solid #dfe5ee",
                    background:r.status==="NOVO" ? "#fffaf4" : "white", borderRadius:18, padding:18,
                    textAlign:"left", cursor:"pointer", color:"inherit"
                  }}
                >
                  <div style={{fontSize:12,fontWeight:1000,color:r.status==="NOVO" ? "#ef7d00" : "#1c2f82"}}>
                    {r.status==="NOVO" ? "NEOTVORENO TREBOVANJE" : r.status}
                  </div>
                  <div style={{fontSize:24,fontWeight:1000,color:"#1c2f82"}}>{r.location_name}</div>
                  <div style={{marginTop:5,color:"#6b7280"}}>
                    {r.requested_by} · {new Date(r.created_at).toLocaleString("sr-RS")} · {(r.lines||[]).length} stavki
                  </div>
                  <div style={{marginTop:10,fontWeight:900,color:"#1c2f82"}}>OTVORI →</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {user.role === "ADMIN" && tab === "trebovanja" && adminReq && (
          <>
            <section className="banner screenOnly" style={{border:"2px solid #1c2f82"}}>
              <div className="row">
                <div className="grow">
                  <div style={{fontSize:12,fontWeight:1000,color:"#6b7280"}}>TREBOVANJE</div>
                  <h2 style={{fontSize:30,color:"#1c2f82"}}>{adminReq.location_name}</h2>
                  <div className="muted">Trebuje: <b>{adminReq.requested_by}</b></div>
                  <div className="muted">{new Date(adminReq.created_at).toLocaleString("sr-RS")} · Status: <b>{adminReq.status}</b></div>
                </div>
                <button className="btn btnGhost" onClick={() => setAdminReq(null)}>← NAZAD</button>
                <button className="btn" style={{background:"#ef7d00",color:"white"}} onClick={printAdminRequest}>
                  🖨 PRIHVATI / SAČUVAJ PDF
                </button>
              </div>

              <div className="tableWrap" style={{marginTop:16}}>
                <table className="table">
                  <thead><tr><th>Šifra</th><th>Artikal</th><th className="right">Količina</th><th>JM</th></tr></thead>
                  <tbody>
                    {(adminReq.lines||[]).map((l:any) => (
                      <tr key={l.article_id}>
                        <td>{l.sifra}</td><td><b>{l.naziv}</b></td><td className="right">{qtyLabel(Number(l.qty))}</td><td>{l.jm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="printOnly">
              <div style={{textAlign:"center",marginBottom:22}}>
                <h1 style={{margin:0}}>PILI — CENTRALNI MAGACIN</h1>
                <h2 style={{margin:"8px 0"}}>TREBOVANJE ROBE</h2>
              </div>
              <div style={{marginBottom:18}}>
                <div><b>Prodavnica:</b> {adminReq.location_name}</div>
                <div><b>Trebovao/la:</b> {adminReq.requested_by}</div>
                <div><b>Datum:</b> {new Date(adminReq.created_at).toLocaleString("sr-RS")}</div>
                <div><b>Status:</b> {adminReq.status}</div>
                <div><b>Broj trebovanja:</b> {adminReq.id}</div>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr><th style={{border:"1px solid #999",padding:8,textAlign:"left"}}>Šifra</th><th style={{border:"1px solid #999",padding:8,textAlign:"left"}}>Artikal</th><th style={{border:"1px solid #999",padding:8,textAlign:"right"}}>Količina</th><th style={{border:"1px solid #999",padding:8,textAlign:"left"}}>JM</th></tr>
                </thead>
                <tbody>
                  {(adminReq.lines||[]).map((l:any) => (
                    <tr key={l.article_id}>
                      <td style={{border:"1px solid #bbb",padding:8}}>{l.sifra}</td>
                      <td style={{border:"1px solid #bbb",padding:8}}>{l.naziv}</td>
                      <td style={{border:"1px solid #bbb",padding:8,textAlign:"right"}}>{qtyLabel(Number(l.qty))}</td>
                      <td style={{border:"1px solid #bbb",padding:8}}>{l.jm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{marginTop:28,fontSize:12}}>Štampano iz PILI Centralni Magacin</div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
