"use strict";

// =====================================================================
//  Grundläggande lagring
// =====================================================================
const MAX_BOX = 5;       // 0 = nytt/svårt … 5 = sitter riktigt bra
const KNOWN_BOX = 3;     // från den här nivån räknas ordet som "kan"
const SESSION_SIZE = 10;
const LS_AI = "spanska.ai";   // AI-inställningarna gäller alla konfigar

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full eller blockerad */ }
}

// =====================================================================
//  Konfigar (språk och ämnen)
// =====================================================================
// En konfig: { id, name, icon, type: "language" | "subject", lang?, front?, back? }
// Fälten i korten heter sv (svenska sidan / begreppet) och es (målspråket / förklaringen).
const LANGS = {
  es: { name: "Spanska", native: "Español", tts: "es-ES", accents: "á é í ó ú ñ ü ¿ ¡",
        article: /^(el|la|los|las|un|una|unos|unas)\s+/i, verb: /(ar|er|ir)(se)?$/ },
  en: { name: "Engelska", native: "English", tts: "en-GB", accents: "",
        article: /^(the|a|an)\s+/i, verb: null },
  de: { name: "Tyska", native: "Deutsch", tts: "de-DE", accents: "ä ö ü ß",
        article: /^(der|die|das|den|dem|ein|eine|einen)\s+/i, verb: /(en|ern|eln)$/ },
  fr: { name: "Franska", native: "Français", tts: "fr-FR", accents: "é è ê à â ç ô û ù ë ï œ",
        article: /^(le|la|les|l'|un|une|des)\s*/i, verb: /(er|ir|re)$/ },
  it: { name: "Italienska", native: "Italiano", tts: "it-IT", accents: "à è é ì ò ù",
        article: /^(il|lo|la|i|gli|le|l'|un|uno|una)\s*/i, verb: /(are|ere|ire)$/ },
  pt: { name: "Portugisiska", native: "Português", tts: "pt-PT", accents: "á â ã à é ê í ó ô õ ú ç",
        article: /^(o|a|os|as|um|uma)\s+/i, verb: /(ar|er|ir)$/ }
};
const DEFAULT_CONFIG = { id: "spanska", name: "Spanska", icon: "🇪🇸", type: "language", lang: "es" };

let configs = load("app.configs", null);
if (!Array.isArray(configs) || !configs.length) { configs = [DEFAULT_CONFIG]; save("app.configs", configs); }
let activeId = load("app.active", configs[0].id);
if (!configs.some(c => c.id === activeId)) activeId = configs[0].id;

function cfg() { return configs.find(c => c.id === activeId) || configs[0]; }
function isLanguage(c = cfg()) { return c.type !== "subject"; }
function langInfo(c = cfg()) { return LANGS[c.lang] || LANGS.es; }
function sideLabels(c = cfg()) {
  return isLanguage(c) ? { sv: "Svenska", es: langInfo(c).native } : { sv: c.front || "Begrepp", es: c.back || "Förklaring" };
}
function hasBuiltinDecks() { return activeId === "spanska" && typeof BUILTIN_DECKS !== "undefined"; }
// Spanska-konfigen behåller sina gamla nycklar så att ingen data försvinner
function keyFor(id, base) { return id === "spanska" ? "spanska." + base : "cfg." + id + "." + base; }
function lsKey(base) { return keyFor(activeId, base); }
function saveConfigs() { save("app.configs", configs); }

// =====================================================================
//  Data för aktiv konfig
// =====================================================================
let progress = {}, hidden = {}, cards = [], listFilter = "all", listSort = "new";
let cats = [], listCat = "all";   // kategorier i Mina kort och vald kategori ("all", "none" eller id)

function getBox(deckId, es) { return (progress[deckId] && progress[deckId][es]) || 0; }
function setBox(deckId, es, box) {
  progress[deckId] = progress[deckId] || {};
  progress[deckId][es] = clampBox(box);
  save(lsKey("progress"), progress);
}
function clampBox(b) { return Math.max(0, Math.min(MAX_BOX, b)); }

// Ord du tagit bort ur de färdiga lekarna (döljs, kan visas igen)
function isHidden(deckId, es) { return (hidden[deckId] || []).includes(es); }
function hideWord(deckId, es) { hidden[deckId] = [...new Set([...(hidden[deckId] || []), es])]; save(lsKey("hidden"), hidden); }
function visibleWords(deck) { return deck.words.filter(([es]) => !isHidden(deck.id, es)); }

// =====================================================================
//  Mina kort
// =====================================================================
// Ett kort: { id, sv, es, created, box, seen, right, wrong, lastSeen,
//             filled: "sv"|"es"|null  (vilken sida som fylldes i automatiskt),
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
  let list = load(lsKey("cards"), null);
  if (Array.isArray(list)) return list;
  list = [];
  // Första gången i Spanska: flytta över "Mina glosor" från den allra första versionen
  const old = activeId === "spanska" ? load("spanska.mywords", "") : "";
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
  save(lsKey("cards"), list);
  return list;
}
function loadConfigData() {
  progress = load(lsKey("progress"), {});
  hidden = load(lsKey("hidden"), {});
  cards = loadCards();
  listFilter = load(lsKey("filter"), "all");
  listSort = load(lsKey("sort"), "new");
  cats = load(lsKey("cats"), null);
  if (!Array.isArray(cats)) {
    // Spanska får en färdig huvudkategori för läroboken
    cats = activeId === "spanska"
      ? [{ id: "caminando3", name: "Caminando 3", parent: null }, { id: "caminando3-k1", name: "Kapitel 1", parent: "caminando3" }]
      : [];
    save(lsKey("cats"), cats);
  }
  listCat = load(lsKey("listCat"), "all");
  if (listCat !== "all" && listCat !== "none" && !cats.some(c => c.id === listCat)) listCat = "all";
}

// ---------- Kategorier ----------
function saveCats() { save(lsKey("cats"), cats); }
function catById(id) { return cats.find(c => c.id === id); }
function catLabel(id) {
  const c = catById(id); if (!c) return "";
  const p = c.parent ? catById(c.parent) : null;
  return p ? `${p.name} › ${c.name}` : c.name;
}
function mainCats() { return cats.filter(c => !c.parent); }
function subCats(id) { return cats.filter(c => c.parent === id); }
// Kategorin som nya kort hamnar i (den som är vald i Mina kort)
function catForNew() { return catById(listCat) ? listCat : null; }
function inCat(card, id) {
  if (id === "all") return true;
  if (id === "none") return !card.cat || !catById(card.cat);
  return card.cat === id || catById(card.cat)?.parent === id;
}
function newCatId(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 20) + "-" + Math.random().toString(36).slice(2, 6);
}
function fillCatSelect(sel, { withAll = false, value = null } = {}) {
  sel.innerHTML = "";
  const add = (v, text) => { const o = el("option", "", text); o.value = v; sel.append(o); };
  if (withAll) add("all", "Alla kort");
  add("none", withAll ? "Utan kategori" : "— Ingen kategori —");
  for (const m of mainCats()) {
    add(m.id, m.name);
    for (const sc of subCats(m.id)) add(sc.id, "   › " + sc.name);
  }
  sel.value = value ?? (withAll ? "all" : "none");
}
loadConfigData();
function saveCards() { save(lsKey("cards"), cards); }
function cardById(id) { return cards.find(c => c.id === id); }

function isWarn(c) { return c.check?.status === "warn" || !c.sv || !c.es; }
function isKnown(c) { return c.box >= KNOWN_BOX; }
function isUnchecked(c) { return ["pending", "unchecked"].includes(c.check?.status); }

// =====================================================================
//  AI: översättning och stavningskontroll
// =====================================================================
function aiConfig() { return load(LS_AI, { url: "", key: "" }); }
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

// Vad AI:n behöver veta om konfigen
function aiCfgPayload(c = cfg()) {
  return isLanguage(c)
    ? { type: "language", lang: c.lang, langName: langInfo(c).name }
    : { type: "subject", subject: c.name, front: sideLabels(c).sv, back: sideLabels(c).es };
}

// Frågar Claude via din Cloudflare Worker. Svar: { sv, es, svFix, esFix, note }
async function aiCheck(sv, es, c = cfg()) {
  const { url, key } = aiConfig();
  return fetchJson(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": key },
    body: JSON.stringify({ sv, es, cfg: aiCfgPayload(c) })
  });
}

// ---------- Reserv utan AI (bara för språk-konfigar) ----------
// Korta begrepp (1–3 ord) slås upp i ett lexikon (svenska Wiktionary).
// Längre meningar och ord som inte finns i lexikonet går till MyMemory (bra på meningar).
const SHORT_MAX_WORDS = 3;
function wordCount(t) { return (t || "").trim().split(/\s+/).filter(Boolean).length; }

const SV_PREFIX = /^(att|en|ett)\s+/i;

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
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
// svenska → målspråket: svenska Wiktionary har översättningstabeller med {{ö|es|ord}}
async function lexiconFromSv(sv, lang) {
  const base = sv.trim().toLowerCase().replace(SV_PREFIX, "");
  if (wordCount(base) > 2) return null;
  const wiki = await wiktionaryText(base);
  const re = new RegExp("\\{\\{ö\\+?\\|" + escapeRe(lang) + "\\|([^}|]+)", "g");
  const words = [...new Set([...wiki.matchAll(re)].map(m => m[1].trim()))].filter(Boolean);
  if (!words.length) return null;
  return words.slice(0, 2).join(" / ");          // högst två förslag, t.ex. "ayudar / asistir"
}
// målspråket → svenska: svenska Wiktionary har uppslagsord på andra språk med svenska definitioner
async function lexiconToSv(word, lang) {
  const info = LANGS[lang] || LANGS.es;
  const base = word.trim().toLowerCase().replace(/^[¿¡]|[?!]$/g, "").replace(info.article, "");
  if (wordCount(base) > 2) return null;
  const wiki = await wiktionaryText(base);
  const start = wiki.search(new RegExp("^==\\s*" + info.name + "\\s*==\\s*$", "m"));
  if (start < 0) return null;
  const rest = wiki.slice(start + 5);
  const end = rest.search(/^==[^=]/m);
  const section = end < 0 ? rest : rest.slice(0, end);
  const line = section.split("\n").find(l => /^#[^:*#]/.test(l));
  if (!line) return null;
  let sv = cleanWiki(line.replace(/^#\s*/, ""));
  if (!sv) return null;
  if (info.verb && info.verb.test(base) && /===\s*Verb\s*===/.test(section) &&
      !/^att /.test(sv) && wordCount(sv) <= 2) sv = "att " + sv;  // verb får "att"
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
// toTarget = true: svenska → målspråket, annars målspråket → svenska.
// Returnerar { text, by: "lex" | "mt" } eller null
async function freeTranslate(text, toTarget, c = cfg()) {
  if (!isLanguage(c)) return null;
  const lang = c.lang;
  if (wordCount(text) <= SHORT_MAX_WORDS) {
    try {
      const t = toTarget ? await lexiconFromSv(text, lang) : await lexiconToSv(text, lang);
      if (t) return { text: t, by: "lex" };
    } catch { /* inte i lexikonet – prova MyMemory */ }
  }
  const t = toTarget ? await myMemory(text, "sv", lang) : await myMemory(text, lang, "sv");
  return t ? { text: t, by: "mt" } : null;
}

function sameText(a, b) { return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase(); }

async function processCard(card, c = cfg()) {
  if (aiEnabled()) {
    const r = await aiCheck(card.sv, card.es, c);       // kastar fel vid nätverksproblem → försök igen senare
    if (!card.sv && r.sv) { card.sv = r.sv.trim(); card.filled = "sv"; card.filledBy = "ai"; }
    if (!card.es && r.es) { card.es = r.es.trim(); card.filled = "es"; card.filledBy = "ai"; }
    const svFix = r.svFix && !sameText(r.svFix, card.sv) ? r.svFix.trim() : null;
    const esFix = r.esFix && !sameText(r.esFix, card.es) ? r.esFix.trim() : null;
    const missing = !card.sv || !card.es;
    card.check = {
      status: svFix || esFix || missing ? "warn" : "ok",
      byAi: true, svFix, esFix,
      note: missing ? "Kunde inte fylla i den andra sidan – skriv in den själv." : (r.note || null)
    };
  } else {
    try {
      if (!card.es && card.sv) {
        const t = await freeTranslate(card.sv, true, c);
        if (t) { card.es = t.text; card.filled = "es"; card.filledBy = t.by; }
      } else if (!card.sv && card.es) {
        const t = await freeTranslate(card.es, false, c);
        if (t) { card.sv = t.text; card.filled = "sv"; card.filledBy = t.by; }
      }
    } catch { /* offline eller tjänsten svarar inte */ }
    const missing = !card.sv || !card.es;
    const what = isLanguage(c) ? "Översättning saknas" : `${sideLabels(c).es} saknas`;
    card.check = missing
      ? { status: "warn", note: `${what} – skriv in den själv (eller koppla AI under ⚙).` }
      : { status: "unchecked" };
  }
}

let queueRunning = false;
async function processQueue() {
  if (queueRunning || !navigator.onLine) return;
  queueRunning = true;
  // Kön hör till konfigen som var aktiv när den startade, även om du byter under tiden
  const id = activeId, c = cfg(), key = lsKey("cards"), list = cards;
  try {
    // Med AI kontrolleras även kort som tidigare inte kunde kontrolleras
    // (men aldrig samma kort två gånger med AI, och aldrig kort du själv godkänt eller gulmarkerat)
    const todo = () => list.find(x => x.check?.status === "pending" ||
      (aiEnabled() && !x.check?.byAi && !x.check?.manual && ["unchecked", "warn"].includes(x.check?.status)));
    let card;
    while ((card = todo())) {
      card.check = { ...card.check, status: "pending" };
      try { await processCard(card, c); }
      catch (e) { console.warn("AI-kontroll misslyckades:", e); break; }
      finally { save(key, list); }
      if (activeId === id) refreshCardViews();
    }
  } finally {
    queueRunning = false;
    if (activeId === id) refreshCardViews();
    else processQueue();      // fortsätt med den konfig som är aktiv nu
  }
}
window.addEventListener("online", processQueue);

// =====================================================================
//  Uttal
// =====================================================================
let voice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const tts = langInfo().tts, short = tts.slice(0, 2);
  const voices = speechSynthesis.getVoices();
  voice = voices.find(v => v.lang === tts) || voices.find(v => v.lang.startsWith(short)) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!("speechSynthesis" in window) || !text || !isLanguage()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/…/g, ""));
  u.lang = langInfo().tts;
  if (voice) u.voice = voice;
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
    // Knapparna byggs efter konfigens språk (inga för engelska och ämnen)
    const chars = isLanguage() ? langInfo().accents.split(" ").filter(Boolean) : [];
    group.innerHTML = "";
    group.classList.toggle("hidden", !chars.length);
    for (const ch of chars) { const b = el("button", "", ch); b.type = "button"; b.dataset.ch = ch; group.append(b); }
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
  titleEl.textContent = homeTitle();
  goBack = null; reopen = showHome;
  render("tpl-home", "home");
  const total = cards.length, known = cards.filter(isKnown).length, warn = cards.filter(isWarn).length;
  $("#myCardsInfo").textContent = total
    ? `${total} kort · ${known} kan du` + (warn ? ` · ${warn} att rätta 🟡` : "")
    : (isLanguage() ? "Inga kort än – tryck här och lägg till dina egna ord" : "Inga kort än – tryck här och lägg till begrepp");
  $("#myCardsBar").style.width = total ? `${Math.round(100 * cards.reduce((s, c) => s + c.box, 0) / (total * MAX_BOX))}%` : "0";
  $("#btnMyCards").onclick = showMyCards;

  const list = $("#deckList");
  if (!hasBuiltinDecks()) { $(".lead").classList.add("hidden"); list.classList.add("hidden"); }
  let lastGroup = null;
  for (const deck of hasBuiltinDecks() ? BUILTIN_DECKS : []) {
    const group = deck.group || "Grundord";
    if (group !== lastGroup) {
      const h = el("h3", "deck-group", group);
      if (group === "Spanska steg 3") h.append(el("small", "muted", " – egna ord på steg 3-teman"));
      list.appendChild(h);
      lastGroup = group;
    }
    const words = visibleWords(deck);
    const boxes = words.map(([es]) => getBox(deck.id, es));
    const known = boxes.filter(b => b >= KNOWN_BOX).length;
    const pct = words.length ? Math.round(100 * boxes.reduce((s, b) => s + b, 0) / (words.length * MAX_BOX)) : 0;
    const btn = el("button", "deck-btn");
    btn.append(el("b", "", deck.name), el("span", "muted", `${words.length} glosor · ${known} kan du`));
    const bar = el("div", "bar"), fill = el("i"); fill.style.width = pct + "%"; bar.append(fill); btn.append(bar);
    btn.onclick = () => showDeck(deck.id);
    list.appendChild(btn);
  }
  $("#btnUpdate").onclick = forceUpdate;
  $("#btnReset").onclick = () => {
    if (!confirm("Vill du nollställa all progress? (Dina kort finns kvar, bara statistiken nollas.)")) return;
    progress = {}; save(lsKey("progress"), progress);
    cards.forEach(c => { c.box = 0; c.seen = 0; c.right = 0; c.wrong = 0; c.lastSeen = 0; });
    saveCards(); showHome();
  };
}

// =====================================================================
//  Mina kort
// =====================================================================
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
  return cards.filter(c => inCat(c, listCat) && f(c)).sort(s);
}

function showMyCards() {
  titleEl.textContent = "Mina kort";
  goBack = showHome; reopen = showMyCards;
  editingId = null;
  render("tpl-mycards", "mycards");

  const inSv = $("#inSv"), inEs = $("#inEs"), accents = $("#addForm .accents");
  const L = sideLabels();
  $("#lblSv").textContent = L.sv; $("#lblEs").textContent = L.es;
  if (isLanguage()) {
    const ex = { es: ["att hjälpa", "ayudar"], en: ["att hjälpa", "to help"], de: ["att hjälpa", "helfen"],
                 fr: ["att hjälpa", "aider"], it: ["att hjälpa", "aiutare"], pt: ["att hjälpa", "ajudar"] }[cfg().lang] || ["", ""];
    inSv.placeholder = "t.ex. " + ex[0]; inEs.placeholder = "t.ex. " + ex[1];
    inEs.lang = cfg().lang;
  } else {
    inSv.placeholder = "t.ex. inflation"; inEs.placeholder = "lämna tom så skriver AI:n";
    inEs.lang = "sv";
    $("#addHelp").textContent = "Skriv begreppet, och förklaringen om du vill. Lämnar du förklaringen tom skriver AI:n en (kräver AI under ⚙).";
    view.querySelector('[data-practice="write"]').classList.add("hidden");
  }
  [inSv, inEs].forEach(inp => inp.addEventListener("focus", () => { accents.dataset.lastTarget = inp.id; }));
  setupAccents(view);

  $("#btnImport").onclick = showImport;

  // Kategori: vilka kort som visas, och var nya kort hamnar
  const catSel = $("#catSel");
  fillCatSelect(catSel, { withAll: true, value: listCat });
  const updateCatHint = () => {
    $("#catHint").textContent = catForNew()
      ? `Nya och importerade kort hamnar i ${catLabel(catForNew())}.`
      : (listCat === "none" ? "Visar kort utan kategori." : "Visar alla kort. Välj en kategori för att lägga kort i den.");
  };
  updateCatHint();
  catSel.onchange = () => { listCat = catSel.value; save(lsKey("listCat"), listCat); updateCatHint(); renderCardList(); };
  $("#btnCats").onclick = showCats;

  $("#addForm").onsubmit = e => {
    e.preventDefault();
    const sv = inSv.value.trim(), es = inEs.value.trim();
    if (!sv && !es) { inSv.focus(); return; }
    const nc = newCard(sv, es); nc.cat = catForNew();
    cards.unshift(nc);
    saveCards();
    inSv.value = ""; inEs.value = "";
    (sv ? inSv : inEs).focus();
    renderCardList();
    processQueue();
  };

  view.querySelectorAll("#filters .chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.filter === listFilter);
    chip.onclick = () => {
      listFilter = chip.dataset.filter; save(lsKey("filter"), listFilter);
      view.querySelectorAll("#filters .chip").forEach(c => c.classList.toggle("active", c === chip));
      renderCardList();
    };
  });
  const sortSel = $("#sortSel");
  sortSel.value = listSort;
  sortSel.onchange = () => { listSort = sortSel.value; save(lsKey("sort"), listSort); renderCardList(); };

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
  const bMark = el("button", isWarn(c) ? "active" : "", "🟡");
  bMark.title = isWarn(c) ? "Ta bort gulmarkering" : "Gulmarkera";
  bMark.onclick = () => { toggleYellow(c); renderCardList(); };
  const bTrash = el("button", "", "🗑"); bTrash.title = "Ta bort";
  bTrash.onclick = () => { if (confirm(`Ta bort kortet "${c.sv} – ${c.es}"?`)) { deleteCard(c); renderCardList(); } };
  actions.append(bSpeak, bEdit, bMark, bTrash);

  const stats = el("div", "stats");
  stats.title = "Övad · kunde · kunde inte";
  stats.innerHTML = `<span>Övad <b>${c.seen}</b></span><span class="ok">✓ <b>${c.right}</b></span><span class="no">✗ <b>${c.wrong}</b></span>`;
  if (c.cat && catById(c.cat) && listCat === "all") stats.append(el("span", "cat-tag", "📁 " + catLabel(c.cat)));
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
  const L = sideLabels();
  const sv = el("input"); sv.value = c.sv; sv.placeholder = L.sv; sv.lang = "sv";
  const es = el("input"); es.value = c.es; es.placeholder = L.es; es.lang = isLanguage() ? cfg().lang : "sv"; es.id = "editEs";
  cols.append(sv, es);
  const btns = el("div", "fix-row");
  const bSave = el("button", "btn-small good", "Spara");
  const bCancel = el("button", "btn-small", "Avbryt");
  const bDel = el("button", "btn-small bad", "🗑 Ta bort");
  bSave.onclick = () => {
    const newCat = catSel.value === "none" ? null : catSel.value;
    if ((c.cat || null) !== newCat) { c.cat = newCat; saveCards(); }
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
  const catRow = el("label", "fix-row edit-cat", "📁 ");
  const catSel = el("select");
  fillCatSelect(catSel, { value: c.cat && catById(c.cat) ? c.cat : "none" });
  catRow.append(catSel);
  li.append(cols, catRow, btns);
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

// Gulmarkera för hand / ta bort gulmarkeringen. Returnerar true om kortet nu är gult.
function toggleYellow(c) {
  if (isWarn(c) && c.sv && c.es) {
    c.check = c.check?.manual ? (c.check.prev || { status: "ok" }) : { status: "ok" };
  } else if (!isWarn(c)) {
    c.check = { status: "warn", manual: true, note: "Gulmarkerad av dig.", prev: c.check };
  }
  saveCards();
  return isWarn(c);
}
function deleteCard(c) { cards = cards.filter(x => x.id !== c.id); saveCards(); }

let toastTimer = null;
function toast(text) {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// Gör om Mina kort till en "lek" för övningarna
function myCardsDeck(list) {
  return {
    id: "mina", name: "Mina kort", back: showMyCards,
    items: list.map(c => ({
      id: c.id, sv: c.sv, es: c.es,
      isYellow: () => isWarn(c),
      toggleYellow: () => toggleYellow(c),
      yellowText: on => on ? "🟡 Gulmarkerad – finns under 🟡 Att rätta" : "Gulmarkeringen borttagen",
      remove: () => deleteCard(c),
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
    items: visibleWords(deck).map(([es, sv]) => ({
      id: deck.id + ":" + es, sv, es,
      // Gulmarkering av ett ord i en färdig lek: ordet kopieras till Mina kort som gult kort
      isYellow: () => cards.some(c => sameText(c.es, es) && isWarn(c)),
      toggleYellow: () => {
        let c = cards.find(x => sameText(x.es, es));
        if (!c) { c = newCard(sv, es); c.check = { status: "ok" }; cards.unshift(c); }
        return toggleYellow(c);
      },
      yellowText: on => on ? "🟡 Kopierad till Mina kort som gult kort" : "Gulmarkeringen borttagen i Mina kort",
      remove: () => hideWord(deck.id, es),
      box: () => getBox(deck.id, es),
      record: ok => setBox(deck.id, es, ok ? getBox(deck.id, es) + 1 : 0)
    }))
  };
}

// =====================================================================
//  Hantera kategorier
// =====================================================================
function askName(question, current = "") {
  const n = prompt(question, current);
  return n && n.trim() ? n.trim().slice(0, 40) : null;
}
function cardsInCat(id) { return cards.filter(c => inCat(c, id)).length; }

function showCats() {
  titleEl.textContent = "Kategorier";
  goBack = showMyCards; reopen = showCats;
  render("tpl-cats", "cats");
  const ul = $("#catList");
  const row = (c, isSub) => {
    const li = el("li", isSub ? "cat-item sub" : "cat-item");
    li.append(el("span", "cat-name", (isSub ? "› " : "📁 ") + c.name), el("small", "muted", `${cardsInCat(c.id)} kort`));
    const btns = el("span", "cat-btns");
    if (!isSub) {
      const add = el("button", "btn-small", "＋ Underkategori");
      add.onclick = () => {
        const n = askName(`Namn på underkategorin i ${c.name}:`, `Kapitel ${subCats(c.id).length + 1}`);
        if (!n) return;
        cats.push({ id: newCatId(n), name: n, parent: c.id }); saveCats(); showCats();
      };
      btns.append(add);
    }
    const ren = el("button", "btn-small", "✏️"); ren.title = "Byt namn";
    ren.onclick = () => { const n = askName("Nytt namn:", c.name); if (n) { c.name = n; saveCats(); showCats(); } };
    const del = el("button", "btn-small", "🗑"); del.title = "Ta bort kategorin";
    del.onclick = () => {
      const n = cardsInCat(c.id);
      const what = isSub ? "" : " och dess underkategorier";
      if (!confirm(`Ta bort kategorin "${c.name}"${what}? Korten (${n} st) finns kvar, men utan kategori.`)) return;
      const ids = new Set([c.id, ...subCats(c.id).map(x => x.id)]);
      cards.forEach(card => { if (ids.has(card.cat)) card.cat = null; });
      cats = cats.filter(x => !ids.has(x.id));
      if (ids.has(listCat)) { listCat = "all"; save(lsKey("listCat"), listCat); }
      saveCats(); saveCards(); showCats();
    };
    btns.append(ren, del);
    li.append(btns);
    return li;
  };
  if (!mainCats().length) ul.append(el("li", "muted empty", "Inga kategorier än."));
  for (const m of mainCats()) {
    ul.append(row(m, false));
    for (const sc of subCats(m.id)) ul.append(row(sc, true));
  }
  $("#btnNewMainCat").onclick = () => {
    const n = askName("Namn på huvudkategorin (t.ex. en lärobok):");
    if (!n) return;
    cats.push({ id: newCatId(n), name: n, parent: null }); saveCats(); showCats();
  };
}

// =====================================================================
//  Importera flashcards från text
// =====================================================================
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
const EN_STOP = new Set(("the and that this with from have has had was were are been being will would could should " +
  "they them their there then than what when where which while about into over under after before very also just " +
  "some more most much many such only other your yours ours mine these those here because").split(" "));
const SV_STOP = new Set(("och att det som en ett är var jag du han hon vi ni de den dem dig mig sig sin sitt sina " +
  "på i av för med till om har hade inte men så kan kunde ska skulle vill ville från eller när där här man hans " +
  "hennes deras vår vårt våra min mitt mina din ditt dina mycket också bara nu då efter under över vid än hur vad " +
  "vem vilken vilket vilka alla allt några någon något detta denna dessa blir blev vara varit finns fick får göra " +
  "gör gjorde kommer kom sedan redan även mer mest många lite dag dagar år").split(" "));

function localExtract(text) {
  // Ämnen och svenska texter: plocka svenska ord. Annars ord på målspråket.
  const isSv = !isLanguage() || (/[åäö]/i.test(text) && !/[ñ¿¡áéíóúßçèêàœ]/i.test(text));
  const stop = isSv ? SV_STOP : (cfg().lang === "es" ? ES_STOP : (cfg().lang === "en" ? EN_STOP : new Set()));
  const counts = new Map();
  for (const m of text.matchAll(/\p{L}+/gu)) {
    const w = m[0], lw = w.toLowerCase();
    if (lw.length < 4 || stop.has(lw)) continue;
    // Hoppa över troliga namn: stor bokstav mitt i en mening
    const pre = text.slice(0, m.index).replace(/[ \t]+$/, "");
    const sentenceStart = !pre.trim() || /[.!?¿¡:"«\n]$/.test(pre);
    if (/^\p{Lu}/u.test(w) && !sentenceStart) continue;
    counts.set(lw, (counts.get(lw) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 30)
    .map(([w]) => isSv ? { sv: w, es: "", note: null } : { es: w, sv: "", note: null });
}

async function aiExtract(text) {
  const { url, key } = aiConfig();
  const known = cards.map(c => isLanguage() ? c.es : c.sv).filter(Boolean).slice(0, 400);
  const r = await fetchJson(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": key },
    body: JSON.stringify({ mode: "extract", text, known, cfg: aiCfgPayload() })
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
        const r = t.es ? await freeTranslate(t.es, false) : await freeTranslate(t.sv, true);
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
  $("#importCat").textContent = catForNew() ? `📁 Korten hamnar i: ${catLabel(catForNew())}` : "📁 Korten hamnar utan kategori (välj kategori i Mina kort).";
  ta.value = load(lsKey("importDraft"), "");
  const updateCount = () => {
    const n = ta.value.length;
    count.textContent = n ? `${n} tecken` + (n > MAX_IMPORT_CHARS ? ` – bara de första ${MAX_IMPORT_CHARS} analyseras` : "") : "";
  };
  updateCount();
  ta.oninput = () => { save(lsKey("importDraft"), ta.value); updateCount(); };
  $("#btnClearText").onclick = () => { ta.value = ""; save(lsKey("importDraft"), ""); updateCount(); status.textContent = ""; ta.focus(); };
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
    if (!usedAi && isLanguage() && terms.some(t => !t.sv || !t.es)) {
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
    const L = sideLabels(), lang = isLanguage();
    // Språk: målspråket stort överst. Ämnen: begreppet stort, förklaringen under.
    const top = lang ? "es" : "sv", bottom = lang ? "sv" : "es";
    const missing = lang ? "ingen översättning hittades" : "ingen förklaring än – AI:n kan skriva en";
    const c = el("div", "swipe-card");
    c.append(el("div", "stamp yes", "LÄGG TILL"), el("div", "stamp no", "HOPPA ÖVER"));
    const topEl = el("div", "sc-es", t[top] || missing), botEl = el("div", "sc-sv", t[bottom] || missing);
    c.append(el("small", "lang-tag", L[top]), topEl, el("small", "lang-tag2", L[bottom]), botEl);
    if (!t[top]) topEl.classList.add("muted");
    if (!t[bottom]) botEl.classList.add("muted");
    if ((t[bottom] || "").length > 40) botEl.classList.add("long");
    const tag = { lex: " 📖", mt: " 🌐" }[t.by] || "";
    if (tag && t.filled) (t.filled === top ? topEl : botEl).append(el("small", "ai-tag", tag));
    if (t.note) c.append(el("div", "sc-note", t.note));
    if (t.es && lang) {
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
        const c = newCard(t.sv, t.es); c.cat = catForNew();
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
    $("#btnImportMore").onclick = () => { save(lsKey("importDraft"), ""); showImport(); };
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
  const words = visibleWords(deck);
  const known = words.filter(([es]) => getBox(deck.id, es) >= KNOWN_BOX).length;
  $("#deckStats").textContent = `${words.length} glosor · ${known} kan du`;
  const nHidden = deck.words.length - words.length;
  if (nHidden) {
    const bu = $("#btnUnhide");
    bu.textContent = `Visa ${nHidden} borttagna ord igen`;
    bu.classList.remove("hidden");
    bu.onclick = () => { delete hidden[deck.id]; save(lsKey("hidden"), hidden); showDeck(deck.id); };
  }
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
  for (const [es, sv] of visibleWords(deck)) {
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
  const dir = load(lsKey("dir"), "mix");
  return shuffle(deck.items)
    .sort((a, b) => a.box() - b.box())
    .slice(0, SESSION_SIZE)
    .map(item => ({ item, showSv: dir === "sv2es" ? true : dir === "es2sv" ? false : Math.random() < 0.5 }));
}


function showDone(deck, text, again) {
  render("tpl-done", "done");
  $("#doneText").textContent = text;
  $("#btnAgain").onclick = again;
  $("#btnBack").onclick = deck.back;
}

// 🟡- och 🗑-knapparna i övningarna
function practiceTools(getCur, onRemoved) {
  const bMark = $("#btnMark"), bTrash = $("#btnTrash");
  const refresh = () => { const cur = getCur(); bMark.classList.toggle("active", !!cur && cur.item.isYellow()); };
  bMark.onclick = () => {
    const cur = getCur(); if (!cur) return;
    const on = cur.item.toggleYellow();
    toast(cur.item.yellowText(on));
    refresh();
  };
  bTrash.onclick = () => {
    const cur = getCur(); if (!cur) return;
    if (!confirm(`Ta bort kortet "${cur.item.sv} – ${cur.item.es}"?`)) return;
    cur.item.remove();
    toast("🗑 Kortet borttaget");
    onRemoved(cur.item.id);
  };
  return refresh;
}
function dropFromQueue(queue, id) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].item.id === id) queue.splice(i, 1);
}

function runCards(deck) {
  render("tpl-cards", "cards");
  goBack = deck.back; reopen = deck.back;
  const queue = buildSession(deck), total = queue.length;
  let right = 0, cur = null, flipped = false;
  const front = $("#cardFront"), back = $("#cardBack"), tag = $("#cardLang");
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });

  function next() {
    if (!queue.length) return showDone(deck, `Du kunde ${right} av ${total} på första försöket.`, () => runCards(deck));
    cur = queue.shift(); flipped = false;
    refreshTools();
    const { item, showSv } = cur;
    const L = sideLabels();
    tag.textContent = showSv ? L.sv : L.es;
    back.classList.toggle("long", (showSv ? item.es : item.sv).length > 40);
    front.classList.toggle("long", (showSv ? item.sv : item.es).length > 40);
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
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });

  function next() {
    if (!queue.length) return showDone(deck, `Du hade ${right} av ${total} rätt på första försöket.`, () => runWrite(deck));
    cur = queue.shift(); answered = false;
    refreshTools();
    const { item, showSv } = cur;
    const L = sideLabels();
    $("#promptLang").textContent = (showSv ? L.sv : L.es) + " → " + (showSv ? L.es : L.sv);
    $("#prompt").textContent = showSv ? item.sv : item.es;
    input.placeholder = showSv ? `Skriv på ${langInfo().name.toLowerCase()}…` : "Skriv på svenska…";
    input.lang = showSv ? cfg().lang : "sv";
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
// ---------- Ljust / mörkt läge ----------
function currentTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  save("app.theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#8e2a20" : "#c0392b");
}

function showSettings() {
  const back = reopen || showHome;
  titleEl.textContent = "Inställningar";
  render("tpl-settings", "settings");
  goBack = back;
  const dark = $("#darkToggle");
  dark.checked = currentTheme() === "dark";
  dark.onchange = () => setTheme(dark.checked ? "dark" : "light");

  const ai = aiConfig();
  $("#aiUrl").value = ai.url || "";
  $("#aiKey").value = ai.key || "";
  const L = sideLabels();
  $("#optSv2Es").textContent = `${L.sv} → ${L.es.toLowerCase()}`;
  $("#optEs2Sv").textContent = `${L.es} → ${L.sv.toLowerCase()}`;
  const saveCfg = () => save(LS_AI, { url: $("#aiUrl").value.trim(), key: $("#aiKey").value.trim() });
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
  dirSel.value = load(lsKey("dir"), "mix");
  dirSel.onchange = () => save(lsKey("dir"), dirSel.value);
}

// =====================================================================
//  ☰ Konfig-menyn
// =====================================================================
const drawer = document.getElementById("drawer"), drawerBg = document.getElementById("drawerBg");
function openDrawer() {
  renderConfigList();
  drawer.classList.add("open"); drawerBg.classList.add("open");
}
function closeDrawer() { drawer.classList.remove("open"); drawerBg.classList.remove("open"); }

function configSummary(c) {
  const n = (load(keyFor(c.id, "cards"), []) || []).length;
  const kind = isLanguage(c) ? `Svenska ↔ ${langInfo(c).name.toLowerCase()}` : `Ämne: ${sideLabels(c).sv} ↔ ${sideLabels(c).es.toLowerCase()}`;
  return `${kind} · ${n} kort`;
}
function renderConfigList() {
  const ul = document.getElementById("configList");
  ul.innerHTML = "";
  for (const c of configs) {
    const li = el("li", "config-item" + (c.id === activeId ? " active" : ""));
    const pick = el("button", "config-pick");
    pick.append(el("span", "config-icon", c.icon || "📘"));
    const txt = el("span", "config-text");
    txt.append(el("b", "", c.name), el("small", "", configSummary(c)));
    pick.append(txt);
    if (c.id === activeId) pick.append(el("span", "config-check", "✓"));
    pick.onclick = () => switchConfig(c.id);
    const edit = el("button", "config-edit-btn", "✏️"); edit.title = "Ändra konfig";
    edit.onclick = () => { closeDrawer(); showConfigEdit(c.id); };
    li.append(pick, edit);
    ul.append(li);
  }
}
function switchConfig(id) {
  closeDrawer();
  if (id === activeId) { showHome(); return; }
  activeId = id; save("app.active", id);
  loadConfigData();
  applyConfigUI();
  showHome();
  processQueue();
}

function showConfigEdit(id) {
  const existing = configs.find(c => c.id === id);
  titleEl.textContent = existing ? "Ändra konfig" : "Ny konfig";
  goBack = reopen || showHome;
  render("tpl-config-edit", "config-edit");
  const name = $("#cfgName"), icon = $("#cfgIcon"), lang = $("#cfgLang"), front = $("#cfgFront"), back = $("#cfgBack");
  for (const [code, info] of Object.entries(LANGS)) {
    const o = el("option", "", `${info.name} (${info.native})`); o.value = code; lang.append(o);
  }
  const setType = type => {
    view.querySelectorAll('input[name="cfgType"]').forEach(r => { r.checked = r.value === type; });
    $("#cfgLangBox").classList.toggle("hidden", type !== "language");
    $("#cfgSubjectBox").classList.toggle("hidden", type !== "subject");
  };
  view.querySelectorAll('input[name="cfgType"]').forEach(r => r.onchange = () => setType(r.value));

  if (existing) {
    $("#cfgTitle").textContent = `Ändra ${existing.name}`;
    name.value = existing.name; icon.value = existing.icon || "";
    lang.value = existing.lang || "es";
    front.value = existing.front || ""; back.value = existing.back || "";
    setType(existing.type || "language");
    // Typen och språket kan inte ändras när det redan finns kort (de skulle bli fel)
    if ((load(keyFor(existing.id, "cards"), []) || []).length) {
      view.querySelectorAll('input[name="cfgType"]').forEach(r => r.disabled = true);
      lang.disabled = true;
      $("#cfgLocked").classList.remove("hidden");
    }
    if (configs.length > 1) $("#btnDeleteCfg").classList.remove("hidden");
  } else setType("language");

  // Föreslå namn och ikon när man väljer språk
  const FLAGS = { es: "🇪🇸", en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", it: "🇮🇹", pt: "🇵🇹" };
  lang.onchange = () => {
    if (!name.value || Object.values(LANGS).some(l => l.name === name.value)) name.value = LANGS[lang.value].name;
    if (!icon.value || Object.values(FLAGS).includes(icon.value)) icon.value = FLAGS[lang.value];
  };
  if (!existing) lang.onchange();

  $("#btnSaveCfg").onclick = () => {
    const type = view.querySelector('input[name="cfgType"]:checked').value;
    const n = name.value.trim();
    if (!n) { name.focus(); toast("Ge konfigen ett namn"); return; }
    const data = {
      name: n, icon: icon.value.trim() || (type === "language" ? FLAGS[lang.value] : "📚"), type,
      lang: type === "language" ? lang.value : undefined,
      front: type === "subject" ? (front.value.trim() || "Begrepp") : undefined,
      back: type === "subject" ? (back.value.trim() || "Förklaring") : undefined
    };
    if (existing) {
      Object.assign(existing, data);
      saveConfigs(); applyConfigUI();
      toast("Sparat");
      showHome();
    } else {
      const slug = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "konfig";
      const c = { id: slug + "-" + Math.random().toString(36).slice(2, 6), ...data };
      configs.push(c); saveConfigs();
      toast(`${c.icon} ${c.name} skapad`);
      switchConfig(c.id);
    }
  };
  $("#btnDeleteCfg").onclick = () => {
    if (!existing || configs.length < 2) return;
    const n = (load(keyFor(existing.id, "cards"), []) || []).length;
    if (!confirm(`Ta bort konfigen "${existing.name}" och alla dess ${n} kort? Det går inte att ångra.`)) return;
    for (const base of ["cards", "progress", "hidden", "filter", "sort", "dir", "importDraft", "cats", "listCat"]) {
      try { localStorage.removeItem(keyFor(existing.id, base)); } catch { /* ignorera */ }
    }
    configs = configs.filter(c => c.id !== existing.id); saveConfigs();
    toast(`${existing.name} borttagen`);
    if (activeId === existing.id) switchConfig(configs[0].id); else showHome();
  };
}

document.getElementById("btnMenu").onclick = openDrawer;
document.getElementById("btnCloseDrawer").onclick = closeDrawer;
drawerBg.onclick = closeDrawer;
document.getElementById("btnNewConfig").onclick = () => { closeDrawer(); showConfigEdit(null); };

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
function homeTitle() { const c = cfg(); return `${c.icon || "📘"} ${c.name}`; }
function applyConfigUI() {
  document.title = `${cfg().name} v${APP_VERSION}`;
  document.body.classList.toggle("no-tts", !isLanguage());
  pickVoice();
}
applyConfigUI();

showHome();
processQueue();
