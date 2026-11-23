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

// Reserv utan AI: gratis översättningstjänst (MyMemory). Ingen stavningskontroll.
async function freeTranslate(text, from, to) {
  const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + from + "|" + to;
  const data = await fetchJson(url, {}, 10000);
  const out = data?.responseData?.translatedText;
  return out && !/MYMEMORY WARNING|INVALID/i.test(out) ? out : null;
}

function sameText(a, b) { return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase(); }

async function processCard(card) {
  if (aiEnabled()) {
    const r = await aiCheck(card.sv, card.es);         // kastar fel vid nätverksproblem → försök igen senare
    if (!card.sv && r.sv) { card.sv = r.sv.trim(); card.filled = "sv"; }
    if (!card.es && r.es) { card.es = r.es.trim(); card.filled = "es"; }
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
      if (!card.es && card.sv) { const t = await freeTranslate(card.sv, "sv", "es"); if (t) { card.es = t; card.filled = "es"; } }
      else if (!card.sv && card.es) { const t = await freeTranslate(card.es, "es", "sv"); if (t) { card.sv = t; card.filled = "sv"; } }
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
  if (c.filled === "sv") sv.append(el("small", "ai-tag", " 🤖"));
  if (c.filled === "es") es.append(el("small", "ai-tag", " 🤖"));
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
