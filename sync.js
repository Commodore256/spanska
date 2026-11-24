"use strict";
// =====================================================================
//  Delat konto: inloggning med lösenord och synk mellan enheter.
//  All data som sparas i appen synkas via Cloudflare-workern. När två enheter
//  har ändrat samtidigt slås ändringarna ihop (kort för kort, högsta XP osv.).
// =====================================================================

const SYNC_PREFIXES = ["spanska.", "cfg.", "app."];
// Inställningar som hör till den här enheten och inte ska delas
const SYNC_DEVICE_ONLY = new Set(["spanska.ai", "spanska.mywords", "app.theme", "app.anim", "app.chartRange",
  "app.active", "app.advAudio", "app.advMic"]);
const SYNC_DEVICE_SUFFIX = [".filter", ".sort", ".listCat", ".importDraft"];
// Vyer där det är säkert att ladda in ändringar från andra enheter (inte mitt i en övning)
const SYNC_SAFE_VIEWS = new Set(["home", "mycards", "adv", "ach", "settings", "deck", "list", "practice", "cats", "config-edit", "import"]);

function syncOn() { return typeof WORKER_URL === "string" && !!WORKER_URL.trim(); }
function syncToken() { return load("sync.token", null); }
function isSyncedKey(k) {
  return !!k && SYNC_PREFIXES.some(p => k.startsWith(p)) && !SYNC_DEVICE_ONLY.has(k) && !SYNC_DEVICE_SUFFIX.some(s => k.endsWith(s));
}
function localSyncState() {
  const st = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isSyncedKey(k)) { try { st[k] = JSON.parse(localStorage.getItem(k)); } catch { /* hoppa över */ } }
  }
  return st;
}

// ---------- Sammanslagning ----------
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function same(a, b) { return stable(a) === stable(b); }
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const hasIds = v => Array.isArray(v) && v.length > 0 && v.every(x => isObj(x) && x.id !== undefined);

// Trevägs-sammanslagning: base = senast synkade, local = den här enheten, remote = servern
function merge3(base, local, remote) {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;      // bara servern har ändrats
  if (same(remote, base)) return local;      // bara den här enheten har ändrats
  // Båda har ändrats:
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (typeof local === "number" && typeof remote === "number") return Math.max(local, remote);   // XP, räknare
  if ((hasIds(local) || hasIds(remote)) && Array.isArray(local) && Array.isArray(remote)) {
    // Listor med id (kort, kategorier, konfigar): slå ihop post för post
    const map = a => new Map((a || []).filter(isObj).map(x => [x.id, x]));
    const B = map(base), Lm = map(local), R = map(remote), out = [];
    const ids = [...new Set([...Lm.keys(), ...R.keys()])];
    for (const id of ids) {
      const m = merge3(B.get(id), Lm.get(id), R.get(id));
      if (m !== undefined) out.push(m);
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const seen = new Set(), out = [];
    for (const x of [...local, ...remote]) { const k = stable(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
    return out;
  }
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {}, out = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const m = merge3(b[k], local[k], remote[k]);
      if (m !== undefined) out[k] = m;
    }
    return out;
  }
  return local;
}
function mergeStates(base, local, remote) {
  const out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const m = merge3(base[k], local[k], remote[k]);
    if (m !== undefined) out[k] = m;
  }
  return out;
}

// ---------- Server ----------
async function syncApi(body, timeoutMs = 20000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { "Content-Type": "application/json" };
    if (syncToken()) headers.Authorization = "Bearer " + syncToken();
    const resp = await fetch(WORKER_URL.replace(/\/+$/, ""), { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    let data = {};
    try { data = await resp.json(); } catch { /* tomt svar */ }
    return { status: resp.status, ok: resp.ok, data };
  } finally { clearTimeout(t); }
}

// ---------- Synk ----------
let syncTimer = null, syncing = false, syncPending = false, syncStatus = "idle";
function setSyncStatus(s) {
  syncStatus = s;
  const el2 = document.getElementById("syncState");
  if (el2) {
    el2.textContent = { ok: "☁️", busy: "🔄", offline: "📴", error: "⚠️", idle: "" }[s] || "";
    el2.title = { ok: "Synkat med kontot", busy: "Synkar…", offline: "Offline – synkar när du är online igen", error: "Kunde inte synka", idle: "" }[s] || "";
    el2.classList.toggle("spin", s === "busy");
  }
  const info = document.getElementById("acctStatus");
  if (info) info.textContent = accountText();
}
function accountText() {
  if (!syncOn()) return "Inget konto – data sparas bara på den här enheten.";
  if (!syncToken()) return "Inte inloggad.";
  const last = load("sync.last", 0);
  const when = last ? new Date(last).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "aldrig";
  return { busy: "Synkar…", offline: "Offline – synkar när du är online igen.", error: "Kunde inte synka senast. Försöker igen." }[syncStatus]
    || `Inloggad på det delade kontot · senast synkat ${when}`;
}
function scheduleSync(delay = 2500) {
  if (!syncOn() || !syncToken()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, delay);
}
// Anropas av save() i app.js
function onLocalSave(key) { if (isSyncedKey(key)) scheduleSync(); }
// Anropas av render() i app.js
function onViewChange(name) {
  if (syncPending && SYNC_SAFE_VIEWS.has(name)) { syncPending = false; scheduleSync(400); }
  setSyncStatus(syncStatus);
}

async function syncNow({ force = false } = {}) {
  if (!syncOn() || !syncToken() || syncing) return;
  if (!navigator.onLine) { setSyncStatus("offline"); return; }
  if (!force && !SYNC_SAFE_VIEWS.has(currentView)) { syncPending = true; return; }
  syncing = true; setSyncStatus("busy");
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const pull = await syncApi({ mode: "pull" });
      if (pull.status === 401) { syncLoggedOut(); return; }
      if (!pull.ok) throw new Error("pull " + pull.status);
      const remote = pull.data.state || {}, version = pull.data.version || 0;
      const base = load("sync.base", {}) || {}, local = localSyncState();
      const merged = mergeStates(base, local, remote);
      if (!same(merged, remote)) {
        const push = await syncApi({ mode: "push", baseVersion: version, state: merged });
        if (push.status === 409) continue;                 // någon annan hann före – försök igen
        if (push.status === 401) { syncLoggedOut(); return; }
        if (!push.ok) throw new Error("push " + push.status);
      }
      const changed = applySyncState(merged, local);
      save("sync.base", merged);
      save("sync.last", Date.now());
      setSyncStatus("ok");
      if (changed) refreshAfterSync();
      return;
    }
    throw new Error("för många krockar");
  } catch (e) {
    console.warn("Synk misslyckades:", e);
    setSyncStatus(navigator.onLine ? "error" : "offline");
    scheduleSync(30000);
  } finally { syncing = false; }
}
// Skriv in det sammanslagna i den här enhetens lagring. Returnerar true om något ändrades.
function applySyncState(merged, local) {
  let changed = false;
  for (const [k, v] of Object.entries(merged)) {
    if (!same(v, local[k])) { try { localStorage.setItem(k, JSON.stringify(v)); changed = true; } catch { /* full */ } }
  }
  for (const k of Object.keys(local)) if (!(k in merged)) { localStorage.removeItem(k); changed = true; }
  return changed;
}
// Ladda om allt i minnet efter att ändringar kommit från en annan enhet
function refreshAfterSync() {
  configs = load("app.configs", null);
  if (!Array.isArray(configs) || !configs.length) { configs = [DEFAULT_CONFIG]; save("app.configs", configs); }
  if (!configs.some(c => c.id === activeId)) { activeId = configs[0].id; save("app.active", activeId); }
  loadConfigData();
  loadStats();
  applyConfigUI();
  const typing = document.activeElement && document.activeElement.matches("input, textarea");
  if (currentView === "mycards") { if (!editingId) renderCardList(); }
  else if (!typing && SYNC_SAFE_VIEWS.has(currentView) && typeof reopen === "function") reopen();
}

// ---------- Inloggning ----------
function syncLoggedOut() {
  localStorage.removeItem("sync.token");
  setSyncStatus("idle");
  showLogin("Du har blivit utloggad – logga in igen.");
}
function showLogin(message = "") {
  render("tpl-login", "login");
  document.body.classList.add("login-mode");
  goBack = null; reopen = null;
  const pw = $("#loginPw"), btn = $("#loginBtn"), msg = $("#loginMsg");
  msg.textContent = message;
  $("#loginShow").onclick = () => { pw.type = pw.type === "password" ? "text" : "password"; pw.focus(); };
  setTimeout(() => pw.focus(), 100);
  $("#loginForm").onsubmit = async e => {
    e.preventDefault();
    if (!pw.value) { pw.focus(); return; }
    if (!navigator.onLine) { msg.textContent = "Du behöver vara ansluten till internet för att logga in."; return; }
    btn.disabled = true; btn.textContent = "Loggar in…"; msg.textContent = "";
    try {
      const r = await syncApi({ mode: "login", password: pw.value });
      if (r.ok && r.data.token) {
        save("sync.token", r.data.token);
        document.body.classList.remove("login-mode");
        burst(btn, ["✨", "🎉", "⭐"], 14);
        await syncNow({ force: true });   // hämta kontots kort och lägg till det som redan fanns här
        showHome();
        toast("✅ Inloggad – allt synkas med kontot");
        return;
      }
      msg.textContent = r.data.error || (r.status === 401 ? "Fel lösenord" : "Något gick fel – försök igen");
      playClass($("#loginCard"), "shake");
      pw.select();
    } catch {
      msg.textContent = "Kunde inte nå servern. Kontrollera internet och försök igen.";
    } finally { btn.disabled = false; btn.textContent = "Logga in"; }
  };
}
function logout() {
  if (!confirm("Logga ut från kontot på den här enheten?")) return;
  localStorage.removeItem("sync.token");
  localStorage.removeItem("sync.base");
  setSyncStatus("idle");
  showLogin("Du är utloggad.");
}
// Kontodelen under ⚙ Inställningar
function setupAccountSettings() {
  const box = $("#acctBox");
  if (!box) return;
  $("#acctStatus").textContent = accountText();
  const on = syncOn() && syncToken();
  $("#btnSyncNow").classList.toggle("hidden", !on);
  $("#btnLogout").classList.toggle("hidden", !on);
  $("#btnSyncNow").onclick = () => syncNow({ force: true });
  $("#btnLogout").onclick = logout;
}

// ---------- Start ----------
if (syncOn()) {
  if (!syncToken()) showLogin();
  else setTimeout(() => syncNow(), 300);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleSync(300); });
  window.addEventListener("online", () => scheduleSync(300));
  window.addEventListener("offline", () => setSyncStatus("offline"));
  setInterval(() => { if (document.visibilityState === "visible") scheduleSync(0); }, 60000);
}
