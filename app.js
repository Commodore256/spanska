"use strict";

// =====================================================================
//  Lagring
// =====================================================================
const LS = {
  progress: "spanska.progress",   // progress för de färdiga lekarna
  cards: "spanska.cards",         // Mina kort
  oldMyWords: "spanska.mywords",  // gammalt format (flyttas till Mina kort)
  dir: "spanska.dir",
  ai: "spanska.ai",
  filter: "spanska.filter",
  sort: "spanska.sort"
};
const MAX_BOX = 5;       // 0 = nytt/svårt … 5 = sitter riktigt bra
const KNOWN_BOX = 3;     // från den här nivån räknas ordet som "kan"
const SESSION_SIZE = 10;

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full eller blockerad */ }
}

let progress = load(LS.progress, {});
function getBox(deckId, es) { return (progress[deckId] && progress[deckId][es]) || 0; }
function setBox(deckId, es, box) {
  progress[deckId] = progress[deckId] || {};
  progress[deckId][es] = clampBox(box);
  save(LS.progress, progress);
}
function clampBox(b) { return Math.max(0, Math.min(MAX_BOX, b)); }

// =====================================================================
//  Mina kort
// =====================================================================
// Ett kort: { id, sv, es, created, box, seen, right, wrong, lastSeen,
//             filled: "sv"|"es"|null  (vilken sida AI:n fyllde i),
//             check: { status, svFix, esFix, note } }
// status: "pending" (väntar på kontroll), "ok", "warn" (gul – något att rätta),
//         "unchecked" (ingen AI tillgänglig)
function newCard(sv, es) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    sv: sv || "", es: es || "", created: Date.now(),
    box: 0, seen: 0, right: 0, wrong: 0, lastSeen: 0, filled: null,
    check: { status: "pending" }
  };
}
function loadCards() {
  let list = load(LS.cards, null);
  if (Array.isArray(list)) return list;
  // Första gången: flytta över "Mina glosor" från den gamla versionen
  list = [];
  const old = load(LS.oldMyWords, "");
  if (typeof old === "string") {
    for (const line of old.split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i < 1) continue;
      const es = line.slice(0, i).trim(), sv = line.slice(i + 1).trim();
      if (!es || !sv) continue;
      const c = newCard(sv, es);
      c.box = getBox("mina", es);
      list.push(c);
    }
  }
  save(LS.cards, list);
  return list;
}
let cards = loadCards();
function saveCards() { save(LS.cards, cards); }
function cardById(id) { return cards.find(c => c.id === id); }

function isWarn(c) { return c.check?.status === "warn" || !c.sv || !c.es; }
function isKnown(c) { return c.box >= KNOWN_BOX; }
function isUnchecked(c) { return ["pending", "unchecked"].includes(c.check?.status); }

// =====================================================================
//  AI: översättning och stavningskontroll
// =====================================================================
function aiConfig() { return load(LS.ai, { url: "", key: "" }); }
function aiEnabled() { const c = aiConfig(); return !!(c.url && c.key); }

async function fetchJson(url, options = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: ctrl.signal });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return await resp.json();
  } finally { clearTimeout(t); }
}

// Frågar Claude via din Cloudflare Worker. Svar: { sv, es, svFix, esFix, note }
async function aiCheck(sv, es) {
  const { url, key } = aiConfig();
  return fetchJson(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": key },
    body: JSON.stringify({ sv, es })
  });
}

// ---------- Reserv utan AI ----------
// Korta begrepp (1–3 ord) slås upp i ett lexikon (svenska Wiktionary).
// Längre meningar och ord som inte finns i lexikonet går till MyMemory (bra på meningar).
const SHORT_MAX_WORDS = 3;
function wordCount(t) { return (t || "").trim().split(/\s+/).filter(Boolean).length; }

const SV_PREFIX = /^(att|en|ett)\s+/i;
const ES_ARTICLE = /^(el|la|los|las|un|una|unos|unas)\s+/i;

async function wiktionaryText(page) {
  const url = "https://sv.wiktionary.org/w/api.php?action=parse&format=json&origin=*&redirects=1&prop=wikitext&page="
    + encodeURIComponent(page);
  const data = await fetchJson(url, {}, 8000);
  return data?.parse?.wikitext?.["*"] || "";
}
function cleanWiki(t) {
  return t
    .replace(/\{\{[^{}]*\}\}/g, "")                 // mallar
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2") // [[länk|text]] → text
    .replace(/'{2,}/g, "")
    .replace(/\([^)]*\)/g, "")
    .split(/[;:]/)[0]
    .replace(/\s+/g, " ").trim();
}
// svenska → spanska: svenska Wiktionary har översättningstabeller med {{ö|es|ord}}
async function lexiconSvToEs(sv) {
  const base = sv.trim().toLowerCase().replace(SV_PREFIX, "");
  if (wordCount(base) > 2) return null;
  const wiki = await wiktionaryText(base);
  const found = [...wiki.matchAll(/\{\{ö\+?\|es\|([^}|]+)/g)].map(m => m[1].trim());
  const words = [...new Set(found)].filter(Boolean);
  if (!words.length) return null;
  return words.slice(0, 2).join(" / ");          // högst två förslag, t.ex. "ayudar / asistir"
}
// spanska → svenska: svenska Wiktionary har spanska uppslagsord med definitioner på svenska
async function lexiconEsToSv(es) {
  const base = es.trim().toLowerCase().replace(/^[¿¡]|[?!]$/g, "").replace(ES_ARTICLE, "");
  if (wordCount(base) > 2) return null;
  const wiki = await wiktionaryText(base);
  const start = wiki.search(/^==\s*Spanska\s*==\s*$/m);
  if (start < 0) return null;
  const rest = wiki.slice(start + 5);
  const end = rest.search(/^==[^=]/m);
  const section = end < 0 ? rest : rest.slice(0, end);
  const line = section.split("\n").find(l => /^#[^:*#]/.test(l));
  if (!line) return null;
  let sv = cleanWiki(line.replace(/^#\s*/, ""));
  if (!sv) return null;
  if (/(ar|er|ir|arse|erse|irse)$/.test(base) && !/^att /.test(sv) && wordCount(sv) <= 2) sv = "att " + sv;  // verb
  return sv;
}
async function myMemory(text, from, to) {
  const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + from + "|" + to;
  const data = await fetchJson(url, {}, 10000);
  const bad = t => !t || /MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(t);
  // För korta ord: välj den bästa träffen som gäller exakt samma ord
  if (wordCount(text) <= SHORT_MAX_WORDS && Array.isArray(data?.matches)) {
    const q = text.trim().toLowerCase();
    const best = data.matches
      .filter(m => (m.segment || "").trim().toLowerCase() === q && !bad(m.translation))
      .sort((a, b) => (Number(b.quality) || 0) - (Number(a.quality) || 0) || (b.match || 0) - (a.match || 0))[0];
    if (best && looksLikeGloss(text, best.translation)) return best.translation.trim();
  }
  const out = data?.responseData?.translatedText;
  if (bad(out)) return null;
  // Skräpskydd för korta ord: MyMemory returnerar ibland en bit av en helt annan mening
  if (wordCount(text) <= SHORT_MAX_WORDS && !looksLikeGloss(text, out)) return null;
  return out.trim();
}
function looksLikeGloss(src, out) {
  const t = out.trim();
  return wordCount(t) <= wordCount(src) + 2 && !/[-–,;:]$/.test(t) && !/[,;]/.test(t);
}
// Returnerar { text, by: "lex" | "mt" } eller null
async function freeTranslate(text, from, to) {
  if (wordCount(text) <= SHORT_MAX_WORDS) {
    try {
      const t = from === "sv" ? await lexiconSvToEs(text) : await lexiconEsToSv(text);
      if (t) return { text: t, by: "lex" };
    } catch { /* inte i lexikonet – prova MyMemory */ }
  }
  const t = await myMemory(text, from, to);
  return t ? { text: t, by: "mt" } : null;
}

function sameText(a, b) { return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase(); }

async function processCard(card) {
  if (aiEnabled()) {
    const r = await aiCheck(card.sv, card.es);         // kastar fel vid nätverksproblem → försök igen senare
    if (!card.sv && r.sv) { card.sv = r.sv.trim(); card.filled = "sv"; card.filledBy = "ai"; }
    if (!card.es && r.es) { card.es = r.es.trim(); card.filled = "es"; card.filledBy = "ai"; }
    const svFix = r.svFix && !sameText(r.svFix, card.sv) ? r.svFix.trim() : null;
    const esFix = r.esFix && !sameText(r.esFix, card.es) ? r.esFix.trim() : null;
    const missing = !card.sv || !card.es;
    card.check = {
      status: svFix || esFix || missing ? "warn" : "ok",
      byAi: true, svFix, esFix,
      note: missing ? "Kunde inte översätta – skriv in översättningen själv." : (r.note || null)
    };
  } else {
    try {
      if (!card.es && card.sv) {
        const t = await freeTranslate(card.sv, "sv", "es");
        if (t) { card.es = t.text; card.filled = "es"; card.filledBy = t.by; }
      } else if (!card.sv && card.es) {
        const t = await freeTranslate(card.es, "es", "sv");
        if (t) { card.sv = t.text; card.filled = "sv"; card.filledBy = t.by; }
      }
    } catch { /* offline eller tjänsten svarar inte */ }
    const missing = !card.sv || !card.es;
    card.check = missing
      ? { status: "warn", note: "Översättning saknas – skriv in den själv (eller koppla AI under ⚙)." }
      : { status: "unchecked" };
  }
  saveCards();
}

let queueRunning = false;
async function processQueue() {
  if (queueRunning || !navigator.onLine) return;
  queueRunning = true;
  try {
    // Med AI kontrolleras även kort som tidigare inte kunde kontrolleras
    // (men aldrig samma kort två gånger med AI, och aldrig kort du själv godkänt)
    const todo = () => cards.find(c => c.check?.status === "pending" ||
      (aiEnabled() && !c.check?.byAi && ["unchecked", "warn"].includes(c.check?.status)));
    let c, failures = 0;
    while ((c = todo()) && failures < 2) {
      c.check = { ...c.check, status: "pending" };
      try { await processCard(c); failures = 0; }
      catch (e) { console.warn("AI-kontroll misslyckades:", e); failures++; break; }
      refreshCardViews();
    }
  } finally {
    queueRunning = false;
    refreshCardViews();
  }
}
window.addEventListener("online", processQueue);

// =====================================================================
//  Uttal
// =====================================================================
let esVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  esVoice = voices.find(v => v.lang === "es-ES") || voices.find(v => v.lang.startsWith("es")) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/…/g, ""));
  u.lang = "es-ES";
  if (esVoice) u.voice = esVoice;
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

// =====================================================================
//  Rättning av skrivsvar
// =====================================================================
function normalize(s, lang) {
  let t = s.toLowerCase().replace(/[¿¡?!.,;:…"'()]/g, "").replace(/\s+/g, " ").trim();
  if (lang === "sv") t = t.replace(/^att /, "");
  return t;
}
function stripAccents(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
// "ok", "almost" (bara accent fel) eller "no"
function check(input, correct, lang) {
  const alts = correct.split(lang === "sv" ? /[\/,]/ : /\//).map(a => normalize(a, lang)).concat(normalize(correct, lang)).filter(Boolean);
  const given = normalize(input, lang);
  if (!given) return "no";
  if (alts.includes(given)) return "ok";
  if (alts.map(stripAccents).includes(stripAccents(given))) return "almost";
  return "no";
}

// =====================================================================
//  Hjälpfunktioner för vyer
// =====================================================================
const view = document.getElementById("view");
const titleEl = document.getElementById("title");
let goBack = null;          // vad ⌂-knappen gör
let reopen = null;          // hur man kommer tillbaka hit från Inställningar
let currentView = "home";

function render(tplId, name) {
  window.speechSynthesis?.cancel();
  document.onkeydown = null;
  view.innerHTML = "";
  view.appendChild(document.getElementById(tplId).content.cloneNode(true));
  view.scrollTop = 0;
  currentView = name;
}
function $(sel) { return view.querySelector(sel); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function setupAccents(root) {
  root.querySelectorAll(".accents").forEach(group => {
    group.querySelectorAll("button").forEach(b => {
      b.onmousedown = e => e.preventDefault();   // behåll fokus i textrutan
      b.onclick = () => {
        const input = document.getElementById(group.dataset.lastTarget || group.dataset.target);
        if (!input) return;
        const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
        input.value = input.value.slice(0, s) + b.dataset.ch + input.value.slice(e);
        input.focus();
        input.setSelectionRange(s + 1, s + 1);
      };
    });
  });
}

// =====================================================================
//  Startsida
// =====================================================================
function showHome() {
  titleEl.textContent = "¡Hola! Spanska";
  goBack = null; reopen = showHome;
  render("tpl-home", "home");
  const total = cards.length, known = cards.filter(isKnown).length, warn = cards.filter(isWarn).length;
  $("#myCardsInfo").textContent = total
    ? `${total} kort · ${known} kan du` + (warn ? ` · ${warn} att rätta 🟡` : "")
    : "Inga kort än – tryck här och lägg till dina egna ord";
  $("#myCardsBar").style.width = total ? `${Math.round(100 * cards.reduce((s, c) => s + c.box, 0) / (total * MAX_BOX))}%` : "0";
  $("#btnMyCards").onclick = showMyCards;

  const list = $("#deckList");
  for (const deck of BUILTIN_DECKS) {
    const boxes = deck.words.map(([es]) => getBox(deck.id, es));
    const known = boxes.filter(b => b >= KNOWN_BOX).length;
    const pct = Math.round(100 * boxes.reduce((s, b) => s + b, 0) / (deck.words.length * MAX_BOX));
    const btn = el("button", "deck-btn");
    btn.append(el("b", "", deck.name), el("span", "muted", `${deck.words.length} glosor · ${known} kan du`));
    const bar = el("div", "bar"), fill = el("i"); fill.style.width = pct + "%"; bar.append(fill); btn.append(bar);
    btn.onclick = () => showDeck(deck.id);
    list.appendChild(btn);
  }
  $("#btnUpdate").onclick = forceUpdate;
  $("#btnReset").onclick = () => {
    if (!confirm("Vill du nollställa all progress? (Dina kort finns kvar, bara statistiken nollas.)")) return;
    progress = {}; save(LS.progress, progress);
    cards.forEach(c => { c.box = 0; c.seen = 0; c.right = 0; c.wrong = 0; c.lastSeen = 0; });
    saveCards(); showHome();
  };
}

// =====================================================================
//  Mina kort
// =====================================================================
let listFilter = load(LS.filter, "all");
let listSort = load(LS.sort, "new");
let editingId = null;

function filteredCards() {
  const f = {
    all: () => true,
    warn: isWarn,
    known: isKnown,
    never: c => c.seen === 0,
    hard: c => c.wrong > c.right,
    unchecked: isUnchecked
  }[listFilter] || (() => true);
  const coll = (a, b, k, loc) => (a[k] || "").localeCompare(b[k] || "", loc);
  const s = {
    new: (a, b) => b.created - a.created,
    never: (a, b) => a.seen - b.seen || b.created - a.created,
    practiced: (a, b) => b.seen - a.seen,
    wrong: (a, b) => b.wrong - a.wrong || a.right - b.right,
    sv: (a, b) => coll(a, b, "sv", "sv"),
    es: (a, b) => coll(a, b, "es", "es")
  }[listSort] || (() => 0);
  return cards.filter(f).sort(s);
}

function showMyCards() {
  titleEl.textContent = "Mina kort";
  goBack = showHome; reopen = showMyCards;
  editingId = null;
  render("tpl-mycards", "mycards");

  const inSv = $("#inSv"), inEs = $("#inEs"), accents = $("#addForm .accents");
  [inSv, inEs].forEach(inp => inp.addEventListener("focus", () => { accents.dataset.lastTarget = inp.id; }));
  setupAccents(view);

  $("#btnImport").onclick = showImport;

  $("#addForm").onsubmit = e => {
    e.preventDefault();
    const sv = inSv.value.trim(), es = inEs.value.trim();
    if (!sv && !es) { inSv.focus(); return; }
    cards.unshift(newCard(sv, es));
    saveCards();
    inSv.value = ""; inEs.value = "";
    (sv ? inSv : inEs).focus();
    renderCardList();
    processQueue();
  };

  view.querySelectorAll("#filters .chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.filter === listFilter);
    chip.onclick = () => {
      listFilter = chip.dataset.filter; save(LS.filter, listFilter);
      view.querySelectorAll("#filters .chip").forEach(c => c.classList.toggle("active", c === chip));
      renderCardList();
    };
  });
  const sortSel = $("#sortSel");
  sortSel.value = listSort;
  sortSel.onchange = () => { listSort = sortSel.value; save(LS.sort, listSort); renderCardList(); };

  view.querySelectorAll("[data-practice]").forEach(b => {
    b.onclick = () => {
      const usable = filteredCards().filter(c => c.sv && c.es);
      if (!usable.length) { alert("Det finns inga färdiga kort (med båda språken) i listan just nu."); return; }
      const deck = myCardsDeck(usable);
      b.dataset.practice === "cards" ? runCards(deck) : runWrite(deck);
    };
  });

  renderCardList();
  processQueue();
}

function updateAiStatus() {
  const s = view.querySelector("#aiStatus");
  if (!s) return;
  const pending = cards.filter(c => c.check?.status === "pending").length;
  if (!aiEnabled()) s.textContent = "🤖 AI ej kopplad (⚙)";
  else if (!navigator.onLine) s.textContent = pending ? `📴 Offline – ${pending} väntar` : "📴 Offline";
  else s.textContent = pending ? `🤖 Kontrollerar ${pending}…` : "🤖 AI kopplad";
}

function refreshCardViews() {
  if (currentView === "mycards" && !editingId) renderCardList();
  else updateAiStatus();
}

function renderCardList() {
  const ul = $("#cardList");
  if (!ul) return;
  updateAiStatus();
  const list = filteredCards();
  $("#listCount").textContent = `${list.length} av ${cards.length} kort`;
  ul.innerHTML = "";
  if (!list.length) {
    ul.append(el("li", "empty muted", cards.length ? "Inga kort matchar filtret." : "Inga kort än. Skriv ett ord ovanför!"));
    return;
  }
  for (const c of list) ul.append(c.id === editingId ? cardEditRow(c) : cardRow(c));
}

function cardRow(c) {
  const li = el("li", "crd");
  if (isWarn(c)) li.classList.add("warn");
  else if (isKnown(c)) li.classList.add("known");

  const cols = el("div", "cols");
  const sv = el("span", "sv", c.sv || "—"), es = el("span", "es", c.es || "—");
  const tag = { ai: " 🤖", lex: " 📖", mt: " 🌐" }[c.filledBy || "ai"];
  const tagTitle = { ai: "Översatt av AI", lex: "Från lexikon (Wiktionary)", mt: "Maskinöversatt (MyMemory)" }[c.filledBy || "ai"];
  const mk = () => { const t = el("small", "ai-tag", tag); t.title = tagTitle; return t; };
  if (c.filled === "sv") sv.append(mk());
  if (c.filled === "es") es.append(mk());
  cols.append(sv, es);

  const actions = el("div", "actions");
  const bSpeak = el("button", "", "🔊"); bSpeak.title = "Lyssna"; bSpeak.onclick = () => speak(c.es);
  const bEdit = el("button", "", "✏️"); bEdit.title = "Ändra"; bEdit.onclick = () => { editingId = c.id; renderCardList(); };
  actions.append(bSpeak, bEdit);

  const stats = el("div", "stats");
  stats.title = "Övad · kunde · kunde inte";
  stats.innerHTML = `<span>Övad <b>${c.seen}</b></span><span class="ok">✓ <b>${c.right}</b></span><span class="no">✗ <b>${c.wrong}</b></span>`;
  if (c.check?.status === "pending") stats.append(el("span", "pend", "⏳"));
  else if (c.check?.status === "ok") stats.append(el("span", "chk", "✔︎ kontrollerad"));

  li.append(cols, actions, stats);

  // Gul ruta med förslag
  if (isWarn(c)) {
    const box = el("div", "fix");
    const addFix = (side, value) => {
      const row = el("div", "fix-row");
      row.append(document.createTextNode("Menar du "), el("b", "", value), document.createTextNode("? "));
      const use = el("button", "btn-small good", "Använd");
      use.onclick = () => applyFix(c, side);
      row.append(use);
      box.append(row);
    };
    if (c.check?.svFix) addFix("sv", c.check.svFix);
    if (c.check?.esFix) addFix("es", c.check.esFix);
    if (c.check?.note) box.append(el("div", "note", c.check.note));
    const btns = el("div", "fix-row");
    if (c.sv && c.es) {
      const ok = el("button", "btn-small", "Det är rätt"); ok.onclick = () => markOk(c);
      btns.append(ok);
    }
    const ed = el("button", "btn-small", "Ändra själv"); ed.onclick = () => { editingId = c.id; renderCardList(); };
    btns.append(ed);
    box.append(btns);
    li.append(box);
  }
  return li;
}

function cardEditRow(c) {
  const li = el("li", "crd editing");
  const cols = el("div", "cols");
  const sv = el("input"); sv.value = c.sv; sv.placeholder = "Svenska"; sv.lang = "sv";
  const es = el("input"); es.value = c.es; es.placeholder = "Español"; es.lang = "es"; es.id = "editEs";
  cols.append(sv, es);
  const btns = el("div", "fix-row");
  const bSave = el("button", "btn-small good", "Spara");
  const bCancel = el("button", "btn-small", "Avbryt");
  const bDel = el("button", "btn-small bad", "🗑 Ta bort");
  bSave.onclick = () => {
    const nsv = sv.value.trim(), nes = es.value.trim();
    if (nsv !== c.sv || nes !== c.es) {
      if (nsv !== c.sv && c.filled === "sv") c.filled = null;
      if (nes !== c.es && c.filled === "es") c.filled = null;
      c.sv = nsv; c.es = nes;
      c.check = { status: "pending" };
      saveCards();
    }
    editingId = null; renderCardList(); processQueue();
  };
  bCancel.onclick = () => { editingId = null; renderCardList(); };
  bDel.onclick = () => {
    if (!confirm(`Ta bort kortet "${c.sv} – ${c.es}"?`)) return;
    cards = cards.filter(x => x.id !== c.id); saveCards();
    editingId = null; renderCardList();
  };
  [sv, es].forEach(inp => inp.onkeydown = e => {
    if (e.key === "Enter") bSave.onclick();
    if (e.key === "Escape") bCancel.onclick();
  });
  btns.append(bSave, bCancel, bDel);
  li.append(cols, btns);
  setTimeout(() => sv.focus(), 0);
  return li;
}

function applyFix(c, side) {
  const fix = side === "sv" ? c.check.svFix : c.check.esFix;
  if (!fix) return;
  c[side] = fix;
  if (side === "sv") c.check.svFix = null; else c.check.esFix = null;
  if (!c.check.svFix && !c.check.esFix && c.sv && c.es) c.check = { status: "ok" };
  saveCards(); renderCardList();
}
function markOk(c) { c.check = { status: "ok" }; saveCards(); renderCardList(); }

// Gör om Mina kort till en "lek" för övningarna
function myCardsDeck(list) {
  return {
    id: "mina", name: "Mina kort", back: showMyCards,
    items: list.map(c => ({
      sv: c.sv, es: c.es,
      box: () => c.box,
      record: ok => {
        c.seen++; c.lastSeen = Date.now();
        if (ok) { c.right++; c.box = clampBox(c.box + 1); } else { c.wrong++; c.box = 0; }
        saveCards();
      }
    }))
  };
}
function builtinDeck(deck) {
  return {
    id: deck.id, name: deck.name, back: () => showDeck(deck.id),
    items: deck.words.map(([es, sv]) => ({
      sv, es,
      box: () => getBox(deck.id, es),
      record: ok => setBox(deck.id, es, ok ? getBox(deck.id, es) + 1 : 0)
    }))
  };
}

// =====================================================================
//  Importera flashcards från text
// =====================================================================
const LS_IMPORT_DRAFT = "spanska.importDraft";
const MAX_IMPORT_CHARS = 8000;

// Enkla, vanliga ord som inte blir kort när AI:n inte är kopplad
const ES_STOP = new Set(("el la lo los las un una unos unas y e o u ni pero sino que de del a al en con por para sin " +
  "sobre entre hasta desde hacia según durante contra ante tras es son era eran fue fueron ser soy eres somos sido " +
  "estar está están estoy estás estamos estaba tener tiene tengo tienes tienen tenía ir va voy vas van iba hacer hace " +
  "hago hacen hizo hay haber ha he has han había poder puede puedo pueden podía querer quiere quiero decir dice dijo " +
  "muy más menos mucho mucha muchos muchas poco poca pocos pocas también tampoco ya no sí se me te le nos os les " +
  "su sus mi mis tu tus nuestro nuestra este esta estos estas ese esa esos esas eso esto aquel aquella aquí allí ahí " +
  "cuando como donde porque pues si yo tú él ella ellos ellas usted ustedes nosotros vosotros todo toda todos todas " +
  "otro otra otros otras cada mismo misma qué cómo cuál cuáles quién dónde cuándo cuánto bien mal bueno buena día " +
  "días casa año años vez veces hoy ayer mañana ahora siempre nunca entonces luego después antes algo nada alguien " +
  "nadie algún alguna ningún ninguna tan tanto cosa cosas gran grande grandes").split(" "));
const SV_STOP = new Set(("och att det som en ett är var jag du han hon vi ni de den dem dig mig sig sin sitt sina " +
  "på i av för med till om har hade inte men så kan kunde ska skulle vill ville från eller när där här man hans " +
  "hennes deras vår vårt våra min mitt mina din ditt dina mycket också bara nu då efter under över vid än hur vad " +
  "vem vilken vilket vilka alla allt några någon något detta denna dessa blir blev vara varit finns fick får göra " +
  "gör gjorde kommer kom sedan redan även mer mest många lite dag dagar år").split(" "));

function localExtract(text) {
  const isSv = /[åäö]/i.test(text) && !/[ñ¿¡áéíóú]/i.test(text);
  const stop = isSv ? SV_STOP : ES_STOP;
  const counts = new Map();
  for (const m of text.matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñÅÄÖåäö]+/g)) {
    const w = m[0], lw = w.toLowerCase();
    if (lw.length < 4 || stop.has(lw)) continue;
    // Hoppa över troliga namn: stor bokstav mitt i en mening
    const pre = text.slice(0, m.index).replace(/[ \t]+$/, "");
    const sentenceStart = !pre.trim() || /[.!?¿¡:"«\n]$/.test(pre);
    if (/^[A-ZÁÉÍÓÚÑÅÄÖ]/.test(w) && !sentenceStart) continue;
    counts.set(lw, (counts.get(lw) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 30)
    .map(([w]) => isSv ? { sv: w, es: "", note: null } : { es: w, sv: "", note: null });
}

async function aiExtract(text) {
  const { url, key } = aiConfig();
  const known = cards.map(c => c.es).filter(Boolean).slice(0, 400);
  const r = await fetchJson(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": key },
    body: JSON.stringify({ mode: "extract", text, known })
  }, 90000);
  return Array.isArray(r.terms) ? r.terms : [];
}

// Översätter alla begrepp som saknar en sida (används utan AI), fyra åt gången
async function translateTerms(terms, onProgress) {
  const todo = terms.filter(t => !t.sv || !t.es);
  let done = 0, next = 0;
  async function worker() {
    while (next < todo.length) {
      const t = todo[next++];
      try {
        const r = t.es ? await freeTranslate(t.es, "es", "sv") : await freeTranslate(t.sv, "sv", "es");
        if (r) {
          if (t.es) { t.sv = r.text; t.filled = "sv"; } else { t.es = r.text; t.filled = "es"; }
          t.by = r.by;
        } else t.failed = true;
      } catch { t.failed = true; }
      onProgress?.(++done, todo.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
}

function showImport() {
  titleEl.textContent = "Importera";
  goBack = showMyCards; reopen = showImport;
  render("tpl-import", "import");
  const ta = $("#importText"), count = $("#importCount"), status = $("#importStatus"), submit = $("#btnSubmitText");
  ta.value = load(LS_IMPORT_DRAFT, "");
  const updateCount = () => {
    const n = ta.value.length;
    count.textContent = n ? `${n} tecken` + (n > MAX_IMPORT_CHARS ? ` – bara de första ${MAX_IMPORT_CHARS} analyseras` : "") : "";
  };
  updateCount();
  ta.oninput = () => { save(LS_IMPORT_DRAFT, ta.value); updateCount(); };
  $("#btnClearText").onclick = () => { ta.value = ""; save(LS_IMPORT_DRAFT, ""); updateCount(); status.textContent = ""; ta.focus(); };
  submit.onclick = async () => {
    const text = ta.value.trim().slice(0, MAX_IMPORT_CHARS);
    if (!text) { status.textContent = "Klistra in en text först."; ta.focus(); return; }
    submit.disabled = true;
    let terms = [], usedAi = false, notice = "";
    try {
      if (aiEnabled() && navigator.onLine) {
        status.textContent = "🤖 AI:n analyserar texten… det kan ta en halv minut.";
        try { terms = await aiExtract(text); usedAi = true; }
        catch (e) {
          console.warn("Textanalys misslyckades:", e);
          notice = "AI:n svarade inte, så ett enklare urval användes. ";
          terms = localExtract(text);
        }
      } else {
        notice = "Utan AI blir urvalet enklare. ";
        terms = localExtract(text);
      }
    } finally { submit.disabled = false; }

    // Ta bort dubbletter och ord som redan finns i Mina kort
    const seen = new Set();
    terms = terms.filter(t => {
      const k = (t.es || t.sv || "").trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return !cards.some(c => (t.es && sameText(c.es, t.es)) || (t.sv && sameText(c.sv, t.sv)));
    });
    if (!terms.length) { status.textContent = notice + "Hittade inga nya begrepp i texten."; return; }
    if (!usedAi && terms.some(t => !t.sv || !t.es)) {
      submit.disabled = true;
      status.textContent = `Översätter ${terms.length} ord…`;
      await translateTerms(terms, (d, n) => { status.textContent = `Översätter orden… ${d} / ${n}`; });
      submit.disabled = false;
      notice = "Utan AI blir urvalet enklare. ";
    }
    runSwipe(terms, usedAi, notice);
  };
}

function runSwipe(terms, usedAi, notice) {
  titleEl.textContent = "Välj kort";
  goBack = showImport; reopen = showImport;
  render("tpl-swipe", "swipe");
  const stack = $("#swipeStack"), info = $("#swipeInfo");
  const history = [];        // för ångra: { cardId } eller { cardId: null }
  let index = 0, added = 0, busy = false;

  function makeCard(t) {
    const c = el("div", "swipe-card");
    c.append(el("div", "stamp yes", "LÄGG TILL"), el("div", "stamp no", "HOPPA ÖVER"));
    c.append(el("small", "lang-tag", "Español"), el("div", "sc-es", t.es || "—"));
    const tag = { lex: " 📖", mt: " 🌐" }[t.by] || "";
    c.append(el("small", "lang-tag2", "Svenska"));
    const es = c.querySelector(".sc-es"), sv = el("div", "sc-sv", t.sv || "ingen översättning hittades – du kan skriva in den sen");
    c.append(sv);
    if (!t.sv) sv.classList.add("muted");
    if (!t.es) { es.textContent = "ingen översättning hittades"; es.classList.add("muted"); }
    if (tag) (t.filled === "es" ? es : sv).append(el("small", "ai-tag", tag));
    if (t.note) c.append(el("div", "sc-note", t.note));
    if (t.es) {
      const b = el("button", "sc-speak", "🔊");
      b.onpointerdown = e => e.stopPropagation();
      b.onclick = e => { e.stopPropagation(); speak(t.es); };
      c.append(b);
    }
    return c;
  }

  function show() {
    stack.innerHTML = "";
    if (index >= terms.length) return finish();
    if (terms[index + 1]) stack.append(Object.assign(makeCard(terms[index + 1]), { className: "swipe-card behind" }));
    const top = makeCard(terms[index]);
    stack.append(top);
    attachDrag(top);
    info.textContent = (index === 0 && notice ? notice : "") + `${index + 1} / ${terms.length} · ${added} tillagda`;
    $("#btnSwipeUndo").disabled = history.length === 0;
  }

  function decide(add) {
    if (busy || index >= terms.length) return;
    busy = true;
    const top = stack.querySelector(".swipe-card:not(.behind)");
    if (top) {
      top.style.transition = "transform .25s ease-out, opacity .25s";
      top.style.transform = `translateX(${add ? 140 : -140}%) rotate(${add ? 25 : -25}deg)`;
      top.style.opacity = "0";
    }
    setTimeout(() => {
      const t = terms[index];
      if (add) {
        const c = newCard(t.sv, t.es);
        if (usedAi && t.sv && t.es) { c.check = { status: "ok", byAi: true }; c.filledBy = "ai"; }
        else if (t.sv && t.es) { c.check = { status: "unchecked" }; c.filled = t.filled || null; c.filledBy = t.by || null; }
        cards.unshift(c); saveCards();
        history.push({ cardId: c.id }); added++;
      } else history.push({ cardId: null });
      index++; busy = false;
      show();
      if (add) processQueue();
    }, top ? 250 : 0);
  }

  function undo() {
    if (busy || !history.length) return;
    const h = history.pop();
    if (h.cardId) { cards = cards.filter(c => c.id !== h.cardId); saveCards(); added--; }
    index--;
    show();
  }

  function attachDrag(card) {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    const yes = card.querySelector(".stamp.yes"), no = card.querySelector(".stamp.no");
    card.onpointerdown = e => {
      dragging = true; startX = e.clientX; startY = e.clientY; dx = dy = 0;
      card.setPointerCapture(e.pointerId);
      card.style.transition = "none";
    };
    card.onpointermove = e => {
      if (!dragging) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      card.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx / 15}deg)`;
      yes.style.opacity = Math.max(0, Math.min(1, dx / 100));
      no.style.opacity = Math.max(0, Math.min(1, -dx / 100));
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (dx > 100) decide(true);
      else if (dx < -100) decide(false);
      else {
        card.style.transition = "transform .2s";
        card.style.transform = "";
        yes.style.opacity = 0; no.style.opacity = 0;
      }
    };
    card.onpointerup = end;
    card.onpointercancel = end;
  }

  function finish() {
    render("tpl-swipe-done", "swipe-done");
    goBack = showMyCards;
    $("#swipeDoneTitle").textContent = added ? `${added} nya kort!` : "Inga kort tillagda";
    $("#swipeDoneText").textContent = added
      ? `Du valde ${added} av ${terms.length} begrepp. De finns nu i Mina kort.`
      : "Du hoppade över alla begrepp.";
    $("#btnToMyCards").onclick = showMyCards;
    $("#btnImportMore").onclick = () => { save(LS_IMPORT_DRAFT, ""); showImport(); };
    processQueue();
  }

  $("#btnSwipeYes").onclick = () => decide(true);
  $("#btnSwipeNo").onclick = () => decide(false);
  $("#btnSwipeUndo").onclick = undo;
  document.onkeydown = e => {
    if (e.key === "ArrowRight") decide(true);
    else if (e.key === "ArrowLeft") decide(false);
    else if (e.key === "Backspace" || (e.key === "z" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); undo(); }
  };
  show();
}

// =====================================================================
//  Färdiga lekar
// =====================================================================
function showDeck(deckId) {
  const deck = BUILTIN_DECKS.find(d => d.id === deckId);
  if (!deck) return showHome();
  titleEl.textContent = deck.name;
  goBack = showHome; reopen = () => showDeck(deckId);
  render("tpl-deck", "deck");
  $("#deckName").textContent = deck.name;
  const known = deck.words.filter(([es]) => getBox(deck.id, es) >= KNOWN_BOX).length;
  $("#deckStats").textContent = `${deck.words.length} glosor · ${known} kan du`;
  const d = builtinDeck(deck);
  view.querySelectorAll(".mode").forEach(b => {
    b.onclick = () => {
      if (b.dataset.mode === "cards") runCards(d);
      else if (b.dataset.mode === "write") runWrite(d);
      else showList(deck);
    };
  });
  $("#btnCopyDeck").onclick = () => {
    let added = 0;
    for (const [es, sv] of deck.words) {
      if (cards.some(c => sameText(c.es, es))) continue;
      const c = newCard(sv, es); c.check = { status: "ok" }; c.created = Date.now() + added;
      cards.unshift(c); added++;
    }
    saveCards();
    alert(added ? `${added} ord kopierades till Mina kort.` : "Alla ord finns redan i Mina kort.");
  };
}

function showList(deck) {
  render("tpl-list", "list");
  goBack = () => showDeck(deck.id); reopen = () => showList(deck);
  const ul = $("#wordList");
  for (const [es, sv] of deck.words) {
    const li = el("li");
    const b = el("button", "", "🔊"); b.title = "Lyssna"; b.onclick = () => speak(es);
    li.append(b, el("span", "sv", sv), el("span", "es", es), el("span", "box", "★".repeat(getBox(deck.id, es))));
    ul.appendChild(li);
  }
}

// =====================================================================
//  Övningar (gemensamma för färdiga lekar och Mina kort)
// =====================================================================
// Väljer de ord som behöver övas mest och slumpar riktning per kort
function buildSession(deck) {
  const dir = load(LS.dir, "mix");
  return shuffle(deck.items)
    .sort((a, b) => a.box() - b.box())
    .slice(0, SESSION_SIZE)
    .map(item => ({ item, showSv: dir === "sv2es" ? true : dir === "es2sv" ? false : Math.random() < 0.5 }));
}
const LANG_NAME = { sv: "Svenska", es: "Español" };

function showDone(deck, text, again) {
  render("tpl-done", "done");
  $("#doneText").textContent = text;
  $("#btnAgain").onclick = again;
  $("#btnBack").onclick = deck.back;
}

function runCards(deck) {
  render("tpl-cards", "cards");
  goBack = deck.back; reopen = deck.back;
  const queue = buildSession(deck), total = queue.length;
  let right = 0, cur = null, flipped = false;
  const front = $("#cardFront"), back = $("#cardBack"), tag = $("#cardLang");

  function next() {
    if (!queue.length) return showDone(deck, `Du kunde ${right} av ${total} på första försöket.`, () => runCards(deck));
    cur = queue.shift(); flipped = false;
    const { item, showSv } = cur;
    tag.textContent = showSv ? LANG_NAME.sv : LANG_NAME.es;
    front.textContent = showSv ? item.sv : item.es;
    back.textContent = showSv ? item.es : item.sv;
    back.classList.add("hidden");
    $("#answerRow").classList.add("hidden");
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    if (!showSv) speak(item.es);
  }
  function flip() {
    if (flipped) return;
    flipped = true;
    back.classList.remove("hidden");
    $("#answerRow").classList.remove("hidden");
    if (cur.showSv) speak(cur.item.es);
  }
  $("#card").onclick = flip;
  $("#card").onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
  $("#btnSpeak").onclick = () => speak(cur.item.es);
  $("#btnRight").onclick = () => { if (!cur.retry) { right++; cur.item.record(true); } next(); };
  $("#btnWrong").onclick = () => {
    if (!cur.retry) cur.item.record(false);
    queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });   // kommer tillbaka snart
    next();
  };
  next();
}

function runWrite(deck) {
  render("tpl-write", "write");
  goBack = deck.back; reopen = deck.back;
  setupAccents(view);
  const queue = buildSession(deck), total = queue.length;
  let right = 0, cur = null, answered = false;
  const input = $("#answer"), feedback = $("#feedback"), btnNext = $("#btnNext");

  function next() {
    if (!queue.length) return showDone(deck, `Du hade ${right} av ${total} rätt på första försöket.`, () => runWrite(deck));
    cur = queue.shift(); answered = false;
    const { item, showSv } = cur;
    $("#promptLang").textContent = (showSv ? LANG_NAME.sv : LANG_NAME.es) + " → " + (showSv ? LANG_NAME.es : LANG_NAME.sv);
    $("#prompt").textContent = showSv ? item.sv : item.es;
    input.placeholder = showSv ? "Skriv på spanska…" : "Skriv på svenska…";
    input.lang = showSv ? "es" : "sv";
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    input.value = ""; input.disabled = false;
    feedback.className = "feedback hidden";
    btnNext.classList.add("hidden");
    input.focus();
    if (!showSv) speak(item.es);
  }

  $("#writeForm").onsubmit = e => {
    e.preventDefault();
    if (answered) return next();
    answered = true;
    const { item, showSv } = cur;
    const correct = showSv ? item.es : item.sv;
    const result = check(input.value, correct, showSv ? "es" : "sv");
    input.disabled = true;
    if (result !== "no") {
      if (!cur.retry) { right++; item.record(true); }
      feedback.className = "feedback " + (result === "ok" ? "ok" : "almost");
      feedback.textContent = result === "ok" ? `✓ Rätt! ${correct}` : `Nästan! Tänk på accenterna: ${correct}`;
    } else {
      if (!cur.retry) item.record(false);
      queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });
      feedback.className = "feedback no";
      feedback.textContent = `Rätt svar: ${correct}`;
    }
    speak(item.es);
    btnNext.classList.remove("hidden");
    btnNext.focus();
  };
  btnNext.onclick = next;
  next();
}

// =====================================================================
//  Inställningar
// =====================================================================
function showSettings() {
  const back = reopen || showHome;
  titleEl.textContent = "Inställningar";
  render("tpl-settings", "settings");
  goBack = back;
  const cfg = aiConfig();
  $("#aiUrl").value = cfg.url || "";
  $("#aiKey").value = cfg.key || "";
  const saveCfg = () => save(LS.ai, { url: $("#aiUrl").value.trim(), key: $("#aiKey").value.trim() });
  $("#btnSaveAi").onclick = () => { saveCfg(); $("#aiTestResult").textContent = "Sparat."; processQueue(); };
  $("#btnTestAi").onclick = async () => {
    saveCfg();
    const out = $("#aiTestResult");
    if (!aiEnabled()) { out.textContent = "Fyll i både adress och nyckel."; return; }
    out.textContent = "Testar…";
    try {
      const r = await aiCheck("att hjälpa", "ayuder");
      out.textContent = r.esFix ? `✓ Fungerar! AI:n rättade "ayuder" till "${r.esFix}".` : "✓ Fungerar!";
      processQueue();
    } catch (e) { out.textContent = "✗ Fungerade inte: " + e.message; }
  };
  const dirSel = $("#dirSel");
  dirSel.value = load(LS.dir, "mix");
  dirSel.onchange = () => save(LS.dir, dirSel.value);
}

// =====================================================================
//  Topplisten
// =====================================================================
document.getElementById("btnHome").onclick = () => (goBack || showHome)();
document.getElementById("btnSettings").onclick = () => { if (currentView !== "settings") showSettings(); };
document.getElementById("btnFull").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
};

// =====================================================================
//  PWA och uppdateringar
// =====================================================================
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  // Ladda om automatiskt när en ny version har tagit över (inte vid allra första installationen)
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .then(reg => {
      reg.update();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    })
    .catch(err => console.warn("Service worker:", err));
}

// Tvinga fram en uppdatering: töm cachen, avregistrera service workern och ladda om
async function forceUpdate() {
  try {
    if ("caches" in window) for (const key of await caches.keys()) await caches.delete(key);
    if ("serviceWorker" in navigator) for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
  } finally { location.reload(); }
}

document.getElementById("version").textContent = "v" + APP_VERSION;
document.title = "Spanska v" + APP_VERSION;

showHome();
processQueue();
