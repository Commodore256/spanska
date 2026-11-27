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
  if (typeof onLocalSave === "function") onLocalSave(key);   // synk med kontot (sync.js)
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

// ---------- Kommentarer på rätt språk ----------
// Språk-konfiger får kommentarer på sitt eget språk (blandat med svenska). Ämnen får bara svenska.
const PHRASES = {
  sv: { praise: ["Snyggt!", "Utmärkt!", "Perfekt!", "Grymt!", "Helt rätt!", "Bra jobbat!"], cheer: ["Kör hårt!", "Du klarar det!", "Heja!", "Nu kör vi!"],
        hi: "Hej!", morning: "God morgon!", night: "God kväll!", wow: "Otroligt!", good: "Bra jobbat!", keep: "Fortsätt så!", nice: "Vad bra!", go: "Nu kör vi!" },
  es: { praise: ["¡Muy bien!", "¡Excelente!", "¡Genial!", "¡Perfecto!"], cheer: ["¡Vamos!", "¡Ánimo!", "¡Olé!"],
        hi: "¡Hola!", morning: "¡Buenos días!", night: "¡Buenas noches!", wow: "¡Increíble!", good: "¡Bien hecho!", keep: "¡Sigue así!", nice: "¡Qué bien!", go: "¡Vamos!" },
  en: { praise: ["Well done!", "Excellent!", "Great!", "Perfect!"], cheer: ["Let's go!", "Keep it up!", "You got this!"],
        hi: "Hello!", morning: "Good morning!", night: "Good evening!", wow: "Amazing!", good: "Well done!", keep: "Keep going!", nice: "Nice!", go: "Let's go!" },
  de: { praise: ["Sehr gut!", "Ausgezeichnet!", "Super!", "Perfekt!"], cheer: ["Los geht's!", "Weiter so!", "Du schaffst das!"],
        hi: "Hallo!", morning: "Guten Morgen!", night: "Guten Abend!", wow: "Unglaublich!", good: "Gut gemacht!", keep: "Weiter so!", nice: "Toll!", go: "Los geht's!" },
  fr: { praise: ["Très bien !", "Excellent !", "Génial !", "Parfait !"], cheer: ["Allez !", "Courage !", "Tu peux le faire !"],
        hi: "Salut !", morning: "Bonjour !", night: "Bonsoir !", wow: "Incroyable !", good: "Bien joué !", keep: "Continue comme ça !", nice: "Super !", go: "Allez !" },
  it: { praise: ["Molto bene!", "Eccellente!", "Fantastico!", "Perfetto!"], cheer: ["Andiamo!", "Forza!", "Coraggio!"],
        hi: "Ciao!", morning: "Buongiorno!", night: "Buonasera!", wow: "Incredibile!", good: "Ben fatto!", keep: "Continua così!", nice: "Che bello!", go: "Andiamo!" },
  pt: { praise: ["Muito bem!", "Excelente!", "Ótimo!", "Perfeito!"], cheer: ["Vamos!", "Força!", "Você consegue!"],
        hi: "Olá!", morning: "Bom dia!", night: "Boa noite!", wow: "Incrível!", good: "Bem feito!", keep: "Continue assim!", nice: "Que bom!", go: "Vamos!" }
};
function phraseLang(c = cfg()) { return isLanguage(c) && PHRASES[c.lang] ? c.lang : "sv"; }
// En lista (praise, cheer) eller en fras (hi, good …) för den aktiva konfigen
function phr(key) {
  const p = PHRASES[phraseLang()], sv = PHRASES.sv;
  return Array.isArray(p[key]) ? (p === sv ? sv[key] : [...p[key], ...sv[key]]) : (p[key] || sv[key]);
}
function phrPick(key) { const a = phr(key); return Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a; }
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
// Vilken sorts material du övar på just nu (sätts av kortlekar): "mixed", "grammar", "terms" eller "questions"
let practiceKind = "mixed";
const KIND_KEEP_VIEWS = new Set(["practice", "cards", "mc", "write", "listen", "speak", "memory", "hard", "done", "settings"]);
let progress = {}, hidden = {}, cards = [], listFilter = "all", listSort = "new", listSearch = "";
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

// =====================================================================
//  XP, nivåer och räknare
// =====================================================================
// XP är gemensamt för alla konfigar. Räknarna (övade / fullt inlärda) gäller aktiv konfig.
const XP_RIGHT = 3;     // rätt svar
const XP_WRONG = 1;     // du övade, även om det blev fel
const XP_MASTER = 50;   // första gången ett kort blir fullt inlärt (högsta nivån)
let stats = { studied: {}, mastered: {} };

function getXP() { return Number(load("app.xp", 0)) || 0; }
// Total XP som behövs för att nå en nivå: 2 → 100, 3 → 300, 4 → 600, 5 → 1000 …
function xpForLevel(n) { return 50 * (n - 1) * n; }
function levelFromXP(xp) { let n = 1; while (xp >= xpForLevel(n + 1)) n++; return n; }
function addXP(amount) {
  const before = getXP(), after = before + amount;
  save("app.xp", after);
  return levelFromXP(after) > levelFromXP(before) ? levelFromXP(after) : 0;   // ny nivå, eller 0
}

// Första gången i en konfig: räkna fram räknare och XP från det du redan har övat
function backfillStats() {
  const st = { studied: {}, mastered: {} };
  let xp = 0;
  for (const c of cards) {
    const k = "c:" + c.id;
    if (c.seen > 0) st.studied[k] = 1;
    if (c.box >= MAX_BOX) st.mastered[k] = 1;
    xp += (c.right || 0) * XP_RIGHT + (c.wrong || 0) * XP_WRONG;
  }
  for (const [deckId, words] of Object.entries(progress)) {
    if (deckId === "mina") continue;
    for (const [es, box] of Object.entries(words || {})) {
      const k = `d:${deckId}:${es}`;
      if (box > 0) { st.studied[k] = 1; xp += box * XP_RIGHT; }
      if (box >= MAX_BOX) st.mastered[k] = 1;
    }
  }
  xp += Object.keys(st.mastered).length * XP_MASTER;
  if (xp) addXP(xp);
  // Märkenas totaler får också det du redan gjort
  const t = getTotals();
  t.answers += cards.reduce((n, c) => n + (c.seen || 0), 0);
  t.correct += cards.reduce((n, c) => n + (c.right || 0), 0);
  t.mastered += Object.keys(st.mastered).length;
  if (t.answers) t.configs = { ...t.configs, [activeId]: 1 };
  saveTotals(t);
  return st;
}
function loadStats() {
  stats = load(lsKey("stats"), null);
  if (!stats || typeof stats !== "object") { stats = backfillStats(); save(lsKey("stats"), stats); }
  stats.studied = stats.studied || {}; stats.mastered = stats.mastered || {};
}
function studiedCount() { return Object.keys(stats.studied).length; }
function masteredCount() { return Object.keys(stats.mastered).length; }

// Anropas varje gång ett kort besvaras i en övning. Returnerar vad som hände.
// ---------- Dagar, streak, dagsmål och totaler (gäller alla konfigar) ----------
function todayKey(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function getDays() { return load("app.days", {}) || {}; }
// Dagens siffror per konfig (för XP-diagrammet): d.c = { <konfig-id>: { xp, n, ms } }
function addDayCfg(d, { xp = 0, n = 0, ms = 0 }) {
  d.c = d.c || {};
  const c = d.c[activeId] = d.c[activeId] || { xp: 0, n: 0, ms: 0 };
  c.xp += xp; c.n += n; c.ms += ms;
}
// Färgen för en konfig i diagrammet
const CFG_COLORS = ["#e03131", "#1c7ed6", "#2f9e44", "#f08c00", "#9c36b5", "#0c8599", "#e64980", "#5c940d"];
function cfgColor(c) {
  if (c?.color) return c.color;
  const i = Math.max(0, configs.findIndex(x => x.id === c?.id));
  return CFG_COLORS[i % CFG_COLORS.length];
}
// Egen fråga-ruta (i stället för webbläsarens confirm). Returnerar ett Promise<boolean>.
function confirmDialog({ title, text, ok = "Ja", cancel = "Avbryt", danger = false, icon = "⚠️" }) {
  return new Promise(resolve => {
    const bg = el("div", "cdlg-bg"), box = el("div", "cdlg" + (danger ? " danger" : ""));
    box.setAttribute("role", "alertdialog"); box.setAttribute("aria-modal", "true");
    box.append(el("div", "cdlg-icon", icon), el("h3", "", title));
    if (text) box.append(el("p", "", text));
    const row = el("div", "cdlg-row");
    const no = el("button", "btn secondary", cancel), yes = el("button", "btn " + (danger ? "bad" : "good"), ok);
    row.append(no, yes); box.append(row); bg.append(box); document.body.append(bg);
    requestAnimationFrame(() => bg.classList.add("show"));
    const done = v => { bg.classList.remove("show"); document.removeEventListener("keydown", key); setTimeout(() => bg.remove(), 200); resolve(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    document.addEventListener("keydown", key);
    no.onclick = () => done(false); yes.onclick = () => done(true);
    bg.onclick = e => { if (e.target === bg) done(false); };
    no.focus();
  });
}
function getGoal() { return Math.max(1, Math.min(500, Number(load("app.goal", 20)) || 20)); }
function todayCount() { return getDays()[todayKey()]?.n || 0; }
function currentStreak() {
  const days = getDays(), d = new Date();
  if (!days[todayKey(d)]?.n) d.setDate(d.getDate() - 1);     // idag räknas när du har övat
  let n = 0;
  while (days[todayKey(d)]?.n) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const TOTALS_DEFAULT = { answers: 0, correct: 0, mastered: 0, perfect: 0, maxCombo: 0, bestStreak: 0, goalDays: 0,
  night: 0, early: 0, memoryWins: 0, listen: 0, speak: 0, verbs: 0, mc: 0, configs: {} };
function getTotals() { return { ...TOTALS_DEFAULT, ...(load("app.totals", {}) || {}) }; }
function saveTotals(t) { save("app.totals", t); }

// Smart repetition: hur länge ett kort vilar innan det ska repeteras, per nivå (box)
const SR_DAYS = [0, 1, 3, 7, 14, 30];
function srOn() { return load("app.sr", "on") !== "off"; }

// Anropas varje gång ett kort besvaras i en övning. Returnerar vad som hände.
// opt: { mult (combo-multiplikator), mode (övningssätt), combo, isCard (räknas som kort), noBox (bara XP) }
function awardPractice(key, ok, box, opt = {}) {
  const { mult = 1, mode = "cards", combo = 0, isCard = true, noBox = false } = opt;
  let gained = ok ? XP_RIGHT * mult : XP_WRONG, mastered = false;
  if (isCard) {
    stats.studied[key] = 1;
    if (!noBox && ok && box >= MAX_BOX && !stats.mastered[key]) {
      stats.mastered[key] = 1; gained += XP_MASTER; mastered = true;
    }
  }
  if (!noBox) {
    stats.due = stats.due || {};
    stats.due[key] = Date.now() + (ok ? SR_DAYS[Math.min(box, MAX_BOX)] : 0) * 86400000;
  }
  save(lsKey("stats"), stats);

  // Dagens siffror (för streak, dagsmål och XP-kursen)
  const days = getDays(), k = todayKey(), d = days[k] || { n: 0, xp: 0 };
  const firstToday = !d.n;
  d.n++; d.xp += gained;
  // Mer detaljer för dagens utmaningar (mascot.js)
  if (ok) d.ok = (d.ok || 0) + 1;
  d.cb = Math.max(d.cb || 0, combo);
  if (mastered) d.ms = (d.ms || 0) + 1;
  if (ok && ["write", "mc", "listen", "speak", "verbs", "adv"].includes(mode)) d["m_" + mode] = (d["m_" + mode] || 0) + 1;
  addDayCfg(d, { xp: gained, n: 1, ms: mastered ? 1 : 0 });
  let goalReached = false;
  if (!d.goalHit && d.n >= getGoal()) { d.goalHit = true; goalReached = true; }
  days[k] = d; save("app.days", days);

  // Totaler för märkena
  const t = getTotals(), h = new Date().getHours();
  t.answers++; if (ok) t.correct++;
  if (mastered) t.mastered++;
  if (goalReached) t.goalDays++;
  if (h >= 22) t.night++;
  if (h < 7) t.early++;
  if (ok && ["listen", "speak", "verbs", "mc"].includes(mode)) t[mode]++;
  t.maxCombo = Math.max(t.maxCombo, combo);
  t.bestStreak = Math.max(t.bestStreak, currentStreak());
  t.configs = { ...t.configs, [activeId]: 1 };
  saveTotals(t);

  const levelUp = addXP(gained);
  const newAch = checkAchievements();
  // Mynt och maskotens reaktioner (mascot.js)
  const extra = typeof mascotAward === "function" ? mascotAward({ ok, mult, mastered, goalReached, firstToday }) : {};
  return { gained, mastered, levelUp, goalReached, newAch, coins: extra.coins || 0 };
}

// ---------- Märken ----------
const ACHIEVEMENTS = [
  { id: "ans10", icon: "🌱", name: "Första stegen", desc: "Svara på 10 kort", goal: 10, val: t => t.answers },
  { id: "ans100", icon: "📚", name: "Flitig", desc: "Svara på 100 kort", goal: 100, val: t => t.answers },
  { id: "ans1000", icon: "🏃", name: "Maratonplugg", desc: "Svara på 1 000 kort", goal: 1000, val: t => t.answers },
  { id: "m1", icon: "🥉", name: "Första guldet", desc: "Lär dig ett kort fullt ut", goal: 1, val: t => t.mastered },
  { id: "m25", icon: "🥈", name: "Ordförrådet växer", desc: "25 fullt inlärda kort", goal: 25, val: t => t.mastered },
  { id: "m100", icon: "🥇", name: "Levande ordbok", desc: "100 fullt inlärda kort", goal: 100, val: t => t.mastered },
  { id: "s3", icon: "🔥", name: "Tre i rad", desc: "Öva 3 dagar i rad", goal: 3, val: t => t.bestStreak },
  { id: "s7", icon: "📅", name: "En hel vecka", desc: "Öva 7 dagar i rad", goal: 7, val: t => t.bestStreak },
  { id: "s30", icon: "👑", name: "Månadsmästare", desc: "Öva 30 dagar i rad", goal: 30, val: t => t.bestStreak },
  { id: "g1", icon: "🎯", name: "Målet nått", desc: "Nå ditt dagsmål", goal: 1, val: t => t.goalDays },
  { id: "g10", icon: "🏹", name: "Målmedveten", desc: "Nå dagsmålet 10 gånger", goal: 10, val: t => t.goalDays },
  { id: "perfect", icon: "💯", name: "Felfri runda", desc: "Alla rätt på första försöket (minst 5 kort)", goal: 1, val: t => t.perfect },
  { id: "c10", icon: "⚡", name: "Combo ×10", desc: "10 rätt i rad", goal: 10, val: t => t.maxCombo },
  { id: "c25", icon: "🚀", name: "Ostoppbar", desc: "25 rätt i rad", goal: 25, val: t => t.maxCombo },
  { id: "night", icon: "🦉", name: "Nattuggla", desc: "Öva efter kl. 22", goal: 1, val: t => t.night },
  { id: "early", icon: "🐓", name: "Morgonpigg", desc: "Öva före kl. 7", goal: 1, val: t => t.early },
  { id: "mc", icon: "🔘", name: "Flervalsfantast", desc: "50 rätt i Flerval", goal: 50, val: t => t.mc },
  { id: "memory", icon: "🧠", name: "Minnesmästare", desc: "Klara 5 omgångar Memory", goal: 5, val: t => t.memoryWins },
  { id: "listen", icon: "🎧", name: "Bra öron", desc: "20 rätt i Lyssna och skriv", goal: 20, val: t => t.listen },
  { id: "speak", icon: "🎤", name: "Uttalsproffs", desc: "20 rätt i Uttal", goal: 20, val: t => t.speak },
  { id: "verbs", icon: "🔤", name: "Böjningskung", desc: "50 rätt i Verbböjning", goal: 50, val: t => t.verbs },
  { id: "lvl5", icon: "⭐", name: "Nivå 5", desc: "Nå nivå 5", goal: 5, val: () => levelFromXP(getXP()) },
  { id: "lvl10", icon: "🌟", name: "Nivå 10", desc: "Nå nivå 10", goal: 10, val: () => levelFromXP(getXP()) },
  { id: "poly", icon: "🌍", name: "Flerspråkig", desc: "Öva i två olika konfigar", goal: 2, val: t => Object.keys(t.configs || {}).length }
];
function unlockedAch() { return load("app.ach", {}) || {}; }
// Låser upp märken som har nåtts. Returnerar de nya.
function checkAchievements() {
  const t = getTotals(), un = unlockedAch(), fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!un[a.id] && a.val(t) >= a.goal) { un[a.id] = Date.now(); fresh.push(a); }
  }
  if (fresh.length) save("app.ach", un);
  return fresh;
}
function addTotal(name, n = 1) { const t = getTotals(); t[name] = (t[name] || 0) + n; saveTotals(t); return checkAchievements(); }
loadStats();   // körs här, när allt som behövs ovan är definierat
function saveCards() { save(lsKey("cards"), cards); }
function cardById(id) { return cards.find(c => c.id === id); }

function isWarn(c) { return c.check?.status === "warn" || !c.sv || !c.es; }
function isKnown(c) { return c.box >= KNOWN_BOX; }
function isUnchecked(c) { return ["pending", "unchecked"].includes(c.check?.status); }

// =====================================================================
//  AI: översättning och stavningskontroll
// =====================================================================
// AI: egen adress och appnyckel under ⚙, annars kontots inloggning (sync.js)
function aiConfig() {
  const c = load(LS_AI, { url: "", key: "" }) || {};
  if ((!c.url || !c.key) && typeof syncOn === "function" && syncOn() && syncToken()) return { url: WORKER_URL, key: "", token: syncToken() };
  return c;
}
function aiEnabled() { const c = aiConfig(); return !!(c.url && (c.key || c.token)); }
function aiHeaders(c) {
  return c.key ? { "Content-Type": "application/json", "X-App-Key": c.key }
               : { "Content-Type": "application/json", "Authorization": "Bearer " + c.token };
}

async function fetchJson(url, options = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: ctrl.signal });
    if (!resp.ok) {
      // Ta med serverns felmeddelande, så att det går att se vad som gick fel
      let msg = "HTTP " + resp.status;
      try { const d = await resp.json(); if (d && d.error) msg = d.error + (d.detail ? " – " + String(d.detail).slice(0, 160) : ""); } catch { /* inget JSON */ }
      const err = new Error(msg); err.status = resp.status; throw err;
    }
    return await resp.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Servern svarade inte i tid");
    throw e;
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
  const ai = aiConfig(), url = ai.url;
  return fetchJson(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: aiHeaders(ai),
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

let queueRunning = false, queueAgain = false, queueRetry = null;
// Skickar kort som väntar till AI:n, ett i taget. Läggs fler kort till under tiden körs kön igen.
async function processQueue() {
  if (!navigator.onLine) return;
  if (queueRunning) { queueAgain = true; return; }
  queueRunning = true; queueAgain = false;
  const id = activeId, c = cfg(), key = lsKey("cards");
  let failed = false;
  // Med AI kontrolleras även kort som tidigare inte kunde kontrolleras
  // (men aldrig samma kort två gånger med AI, och aldrig kort du själv godkänt eller gulmarkerat)
  const isTodo = x => x.check?.status === "pending" ||
    (aiEnabled() && !x.check?.byAi && !x.check?.manual && ["unchecked", "warn"].includes(x.check?.status));
  try {
    let card;
    // Läs alltid den aktuella listan – synken kan ha läst in korten på nytt under tiden
    while (activeId === id && (card = cards.find(isTodo))) {
      const before = { sv: card.sv, es: card.es };
      const work = { ...card, check: { ...card.check, status: "pending" } };
      try { await processCard(work, c); }
      catch (e) {
        console.warn("AI-kontroll misslyckades:", e);
        failed = true;
        // Visa felet på kortet i stället för att snurra för evigt, och lägg tillbaka en borttagen översättning
        const list = activeId === id ? cards : (load(key, []) || []);
        const target = list.find(x => x.id === work.id);
        if (target && target.check?.status === "pending") {
          const r = target.check.restore;
          if (r && !target[r.side]) { target[r.side] = r.value; target.filled = r.side; target.filledBy = r.by; }
          target.check = { status: "error", error: navigator.onLine ? String(e.message || e) : "Ingen internetanslutning" };
          if (activeId === id) saveCards(); else save(key, list);
        }
        break;
      }
      const result = { sv: work.sv, es: work.es, filled: work.filled, filledBy: work.filledBy, check: work.check };
      // Lägg in svaret på kortet som visas nu (om du inte hann ändra det under tiden)
      const list = activeId === id ? cards : (load(key, []) || []);
      const target = list.find(x => x.id === work.id);
      if (target && target.sv === before.sv && target.es === before.es) {
        Object.assign(target, result);
        if (activeId === id) saveCards(); else save(key, list);
      }
      if (activeId === id) refreshCardViews();
    }
  } finally {
    queueRunning = false;
    if (activeId === id) refreshCardViews();
    if (queueAgain || activeId !== id) setTimeout(processQueue, 0);
    else if (failed) { clearTimeout(queueRetry); queueRetry = setTimeout(processQueue, 20000); }   // försök igen om en stund
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
function speak(text, rate = 0.85) {
  if (!("speechSynthesis" in window) || !text || !isLanguage()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/…/g, ""));
  u.lang = langInfo().tts;
  if (voice) u.voice = voice;
  u.rate = rate;
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
  // Grammatik rättas exakt. Ämnen (begrepp, frågor, blandat) tål små stavfel.
  if (!isLanguage() && practiceKind !== "grammar") return checkLenient(input, correct);
  const alts = correct.split(lang === "sv" ? /[\/,]/ : /\//).map(a => normalize(a, lang)).concat(normalize(correct, lang)).filter(Boolean);
  const given = normalize(input, lang);
  if (!given) return "no";
  if (alts.includes(given)) return "ok";
  if (alts.map(stripAccents).includes(stripAccents(given))) return "almost";
  return "no";
}

// Ämnen (inte språk): små stavfel är okej, men årtal måste vara exakt rätt.
// "ok" = exakt, "almost" = rätt med små stavfel, "no" = fel
function checkLenient(input, correct) {
  const norm = s => stripAccents(String(s || "").toLowerCase()).replace(/[¿¡?!.,;:…"'()«»\-–—]/g, " ").replace(/\s+/g, " ").trim();
  const given = norm(input);
  if (!given) return "no";
  const YEAR = /\b\d{3,4}\b/g;
  const years = s => (s.match(YEAR) || []).sort().join(",");
  const alts = [correct, ...String(correct).split(/\s*[\/;]\s*/)].map(norm).filter(Boolean);
  for (const a of alts) {
    if (a === given) return "ok";
    if (years(a) !== years(given)) continue;            // fel eller saknat årtal = fel
    const A = a.replace(YEAR, "#"), G = given.replace(YEAR, "#");
    const allowed = A.length <= 4 ? 0 : A.length <= 8 ? 1 : A.length <= 14 ? 2 : Math.min(8, Math.round(A.length * 0.18));
    if (lev(A, G) <= allowed) return "almost";
  }
  return "no";
}
// Texten när svaret räknas som rätt men inte var exakt
function almostText(correct) {
  return isLanguage() ? `Nästan! Tänk på accenterna: ${correct}` : `Rätt! Små stavfel räknas inte – rätt stavning: ${correct}`;
}
// Stor "Jag vet inte"-knapp under förloppsmätaren (långt från skrivfältet, så att man inte råkar trycka på den)
function addDontKnow(onClick) {
  const b = el("button", "btn dontknow", "🤷 Jag vet inte");
  b.type = "button";
  b.title = "Visa svaret – kortet räknas inte som klart";
  b.onclick = () => { if (!b.classList.contains("hidden")) onClick(); };
  const after = view.querySelector(".pbar");
  if (after) after.after(b); else view.querySelector("section")?.prepend(b);
  return { show: () => b.classList.remove("hidden"), hide: () => b.classList.add("hidden"), el: b };
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
  view.onclick = null;
  document.body.classList.remove("adv-lesson", "adv-bg");   // lektionsläget döljer toppraden
  view.innerHTML = "";
  view.appendChild(document.getElementById(tplId).content.cloneNode(true));
  view.scrollTop = 0;
  playClass(view, "view-enter");
  document.body.classList.remove("login-mode");
  if (typeof onViewChange === "function") onViewChange(name);
  currentView = name;
  if (!KIND_KEEP_VIEWS.has(name)) practiceKind = "mixed";
  if (typeof klViewChange === "function") klViewChange(name);
  if (typeof mascotViewChange === "function") mascotViewChange(name);
}
function $(sel) { return view.querySelector(sel); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
// =====================================================================
//  Animationer
// =====================================================================
function animOn() { return document.documentElement.dataset.anim !== "off"; }
function wait(ms) { return new Promise(r => setTimeout(r, animOn() ? ms : 0)); }
// Spelar en CSS-animation (klass) en gång, även om den redan spelats
const ONE_SHOT = ["pop", "pop-in", "shake", "deal-in", "lift", "bounce-in", "row-new", "view-enter"];
function playClass(elem, cls) {
  if (!elem || !animOn()) return;
  // Bara en engångsanimation åt gången på samma element
  elem.classList.remove(...ONE_SHOT.filter(c => c !== "lift" || cls === "lift"));
  void elem.offsetWidth;
  elem.classList.add(cls);
  const done = ev => {
    if (ev.target !== elem || !ev.animationName) return;
    elem.classList.remove(cls);
    elem.removeEventListener("animationend", done);
  };
  elem.addEventListener("animationend", done);
}
// Liten konfetti-explosion från en punkt eller ett element
function burst(from, emojis = ["✨", "⭐", "🎉", "💫"], count = 12) {
  if (!animOn() || !from) return;
  let x, y;
  if (from instanceof Element) { const r = from.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  else ({ x, y } = from);
  for (let i = 0; i < count; i++) {
    const p = el("span", "particle", emojis[i % emojis.length]);
    p.style.left = x + "px"; p.style.top = y + "px";
    document.body.append(p);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 70;
    p.animate([
      { transform: "translate(-50%, -50%) scale(.4) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist - 30}px)) scale(1.1) rotate(${Math.random() * 360 - 180}deg)`, opacity: 1, offset: 0.7 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * dist * 1.15}px), calc(-50% + ${Math.sin(angle) * dist + 10}px)) scale(.8)`, opacity: 0 }
    ], { duration: 750 + Math.random() * 250, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
  }
}
// Ripple-effekt när man trycker på knappar
const RIPPLE_SEL = ".btn, .chip, .mode, .deck-btn, .round, .tool, .btn-small, .config-pick, .import-btn";
document.addEventListener("pointerdown", e => {
  if (!animOn()) return;
  const b = e.target.closest(RIPPLE_SEL);
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
  const rip = el("span", "ripple");
  rip.style.width = rip.style.height = size + "px";
  rip.style.left = (e.clientX - r.left - size / 2) + "px";
  rip.style.top = (e.clientY - r.top - size / 2) + "px";
  b.append(rip);
  rip.addEventListener("animationend", () => rip.remove());
});
// Är vyn fortfarande kvar? (om man lämnat övningen under en animation)
function alive(elem) { return !!elem && document.body.contains(elem); }
function setPbar(done, total) {
  const f = view.querySelector("#pbarFill");
  if (f) f.style.width = (total ? Math.round(100 * done / total) : 0) + "%";
}

// Flytande text, t.ex. "+3 XP", som stiger uppåt från ett element
function floatText(text, from, cls = "") {
  if (!from) return;
  const r = from.getBoundingClientRect();
  const f = el("span", "float-xp " + cls, text);
  f.style.left = (r.left + r.width / 2) + "px"; f.style.top = (r.top) + "px";
  document.body.append(f);
  if (!animOn()) { setTimeout(() => f.remove(), 900); return; }
  f.animate([
    { transform: "translate(-50%, 0) scale(.7)", opacity: 0 },
    { transform: "translate(-50%, -22px) scale(1.1)", opacity: 1, offset: 0.25 },
    { transform: "translate(-50%, -70px) scale(1)", opacity: 0 }
  ], { duration: 1100, easing: "ease-out" }).onfinish = () => f.remove();
}
// Visar XP-belöningen efter ett svar: +XP, firande vid fullt inlärt kort och ny nivå
function showXP(res, from) {
  if (!res) return;
  floatText(`+${res.gained} XP` + (res.coins ? `  +${res.coins} 🪙` : ""), from, res.mastered ? "big" : "");
  if (res.mastered) {
    toast(`🏆 Fullt inlärt! +${XP_MASTER} XP`);
    burst(from, ["🏆", "⭐", "✨", "💎", "🎉"], 16);
  }
  if (res.levelUp) {
    toast(`⭐ Ny nivå: ${res.levelUp}!`);
    setTimeout(() => burst({ x: innerWidth / 2, y: innerHeight / 3 }, ["⭐", "🌟", "✨", "🎊", "🎉"], 22), 300);
  }
  if (res.goalReached) {
    toast(`🎯 Dagsmålet nått! ${getGoal()} kort idag`);
    setTimeout(() => burst({ x: innerWidth / 2, y: innerHeight / 3 }, ["🎯", "🔥", "✨", "🎉"], 18), 300);
  }
  announceAch(res.newAch);
}
function announceAch(list) {
  for (const a of list || []) toast(`🏅 Nytt märke: ${a.icon} ${a.name}`);
  if (list?.length && typeof mReconcile === "function") mReconcile();   // mynt och prylar för märket
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
  const dueN = srOn() ? dueItems(myCardsDeck(cards.filter(c => c.sv && c.es)).items).length : 0;
  $("#myCardsInfo").textContent = total
    ? `${total} kort · ${known} kan du` + (warn ? ` · ${warn} att rätta 🟡` : "") + (dueN ? ` · 📅 ${dueN} att repetera` : "")
    : (isLanguage() ? "Inga kort än – tryck här och lägg till dina egna ord" : "Inga kort än – tryck här och lägg till begrepp");
  $("#myCardsBar").dataset.w = total ? `${Math.round(100 * cards.reduce((s, c) => s + c.box, 0) / (total * MAX_BOX))}%` : "0%";
  $("#btnMyCards").onclick = showMyCards;
  $("#btnAdventure").onclick = () => showAdventure({ back: showHome });
  renderStatsPanel();

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
    btn.style.setProperty("--i", list.children.length);
    list.appendChild(btn);
  }
  // Staplarna fylls upp med en liten animation
  view.querySelectorAll(".bar > i").forEach(i => { if (!i.dataset.w) { i.dataset.w = i.style.width || "0%"; } i.style.width = "0%"; });
  requestAnimationFrame(() => requestAnimationFrame(() => view.querySelectorAll(".bar > i").forEach(i => { i.style.width = i.dataset.w; })));
  $("#btnUpdate").onclick = forceUpdate;

}

// Panelen överst på startsidan: nivå, XP och räknare
function countUp(elem, to) {
  if (!animOn() || to === 0) { elem.textContent = to; return; }
  const start = performance.now(), dur = Math.min(1200, 400 + to * 15);
  const step = now => {
    const t = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - t, 3);
    elem.textContent = Math.round(to * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function renderStatsPanel() {
  const xp = getXP(), lvl = levelFromXP(xp);
  const lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1);
  $("#lvlBadge").textContent = lvl;
  $("#lvlName").textContent = `Nivå ${lvl}`;
  $("#xpText").textContent = `${xp} XP`;
  $("#xpNext").textContent = `${hi - xp} XP kvar till nivå ${lvl + 1}`;
  const bar = $("#xpBar");
  bar.dataset.w = Math.round(100 * (xp - lo) / (hi - lo)) + "%";
  bar.style.width = "0%";
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = bar.dataset.w; }));
  countUp($("#cntStudied"), studiedCount());
  countUp($("#cntMastered"), masteredCount());
  $("#statsScope").textContent = `Räknarna gäller ${cfg().icon || ""} ${cfg().name}. XP, streak och dagsmål gäller alla konfigar.`;
  // Streak
  const st = currentStreak(), practicedToday = todayCount() > 0;
  $("#streakNum").textContent = st;
  $("#streakTxt").textContent = st === 1 ? "dag i rad" : "dagar i rad";
  view.querySelector(".streak-chip").classList.toggle("cold", !practicedToday);
  view.querySelector(".streak-chip").title = practicedToday
    ? "Du har övat idag – bra jobbat!" : (st ? "Öva idag för att hålla din streak vid liv!" : "Öva idag för att starta en streak!");
  // Dagsmål
  const goal = getGoal(), n = todayCount(), arc = $("#goalArc"), C = 2 * Math.PI * 18;
  $("#goalNum").textContent = `${Math.min(n, goal)}/${goal}`;
  arc.style.strokeDasharray = C;
  arc.style.strokeDashoffset = C;
  view.querySelector(".goal").classList.toggle("done", n >= goal);
  requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = C * (1 - Math.min(1, n / goal)); }));
  $("#btnGoal").onclick = () => {
    const v = prompt("Hur många kort vill du öva per dag?", String(goal));
    if (v === null) return;
    const num = Math.round(Number(v));
    if (!num || num < 1 || num > 500) { toast("Skriv ett tal mellan 1 och 500"); return; }
    save("app.goal", num);
    toast(`🎯 Nytt dagsmål: ${num} kort`);
    renderStatsPanel();
  };
  $("#btnAch").onclick = showAch;
  playClass($("#lvlBadge"), "pop");
}

// =====================================================================
//  Mina kort
// =====================================================================
let editingId = null;
let justAdded = null;   // id på kortet som nyss lades till (glider in)

// Be AI:n översätta/kontrollera kort på nytt. En sida som fyllts i av lexikon eller
// maskinöversättning (📖/🌐) töms först, så att AI:n översätter den själv.
function askAi(list) {
  if (!aiEnabled()) { toast("AI:n är inte kopplad – logga in eller fyll i AI-koppling under ⚙"); return; }
  let n = 0;
  for (const c of list) {
    if (!c.sv && !c.es) continue;
    let restore = null;
    if (c.filled && c.filledBy !== "ai" && c[c.filled === "sv" ? "es" : "sv"]) {
      restore = { side: c.filled, value: c[c.filled], by: c.filledBy };
      c[c.filled] = ""; c.filled = null; c.filledBy = null;
    }
    c.check = { status: "pending", restore };
    n++;
  }
  if (!n) return;
  saveCards();
  renderCardList();
  toast(n === 1 ? "🤖 Skickat till AI:n" : `🤖 ${n} kort skickade till AI:n`);
  processQueue();
}
// Lägg till ett ord i Mina kort (från Äventyr). Returnerar false om det redan finns.
function addToMyCards(sv, es, cat = null) {
  if (!sv || !es) return false;
  if (cards.some(c => sameText(c.es, es) || (sameText(c.sv, sv) && sameText(c.es, es)))) return false;
  const c = newCard(sv, es);
  c.check = { status: "ok" };
  c.cat = cat;
  cards.unshift(c);
  saveCards();
  return true;
}
function inMyCards(es) { return cards.some(c => sameText(c.es, es)); }

function filteredCards() {
  const f = {
    all: () => true,
    warn: isWarn,
    known: isKnown,
    never: c => c.seen === 0,
    hard: c => c.wrong > c.right,
    unchecked: isUnchecked,
    noai: c => !c.check?.byAi
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
  const q = searchNorm(listSearch);
  const hit = c => !q || searchNorm(c.sv).includes(q) || searchNorm(c.es).includes(q);
  return cards.filter(c => inCat(c, listCat) && f(c) && hit(c)).sort(s);
}
// Sökningen bryr sig inte om stora/små bokstäver eller accenter
function searchNorm(s) { return stripAccents(String(s || "").toLowerCase()).replace(/\s+/g, " ").trim(); }

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
    justAdded = nc.id;
    renderCardList();
    justAdded = null;
    playClass(e.submitter || view.querySelector("#addForm .btn.good"), "pop");
    processQueue();
  };

  view.querySelectorAll("#filters .chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.filter === listFilter);
    chip.onclick = () => {
      listFilter = chip.dataset.filter; save(lsKey("filter"), listFilter);
      view.querySelectorAll("#filters .chip").forEach(c => c.classList.toggle("active", c === chip));
      playClass(chip, "pop");
      renderCardList();
    };
  });
  // Sök
  const search = $("#cardSearch");
  search.value = listSearch;
  let searchT = null;
  search.oninput = () => { clearTimeout(searchT); searchT = setTimeout(() => { listSearch = search.value; renderCardList(); }, 120); };
  search.onkeydown = e => { if (e.key === "Escape") { search.value = ""; listSearch = ""; renderCardList(); } };
  $("#btnDupes").onclick = () => showDupes(true);

  const sortSel = $("#sortSel");
  sortSel.value = listSort;
  sortSel.onchange = () => { listSort = sortSel.value; save(lsKey("sort"), listSort); renderCardList(); };

  $("#btnPractice").onclick = () => {
    const usable = filteredCards().filter(c => c.sv && c.es);
    showPracticeMenu(myCardsDeck(usable));
  };

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
  $("#listCount").textContent = `${list.length} av ${cards.length} kort` + (listSearch.trim() ? ` · sökning ”${listSearch.trim()}”` : "");
  const bulk = view.querySelector("#btnAiAll");
  if (bulk) {
    bulk.classList.toggle("hidden", listFilter !== "noai" || !list.length);
    bulk.textContent = `🤖 Låt AI:n ta alla ${list.length}`;
    bulk.onclick = () => askAi(list);
  }
  const info = view.querySelector("#practiceInfo");
  if (info) {
    const usable = list.filter(c => c.sv && c.es);
    const due = srOn() ? dueItems(myCardsDeck(usable).items).length : 0;
    info.textContent = srOn() && due
      ? `📅 ${due} kort att repetera idag bland korten som visas i listan.`
      : (srOn() && usable.length ? "📅 Inga kort att repetera idag – du kan öva i förväg." : "Övningen använder korten som visas i listan just nu.");
  }
  ul.innerHTML = "";
  if (!list.length) {
    ul.append(el("li", "empty muted", !cards.length ? "Inga kort än. Skriv ett ord ovanför!"
      : listSearch.trim() ? `Inga kort innehåller ”${listSearch.trim()}”.` : "Inga kort matchar filtret."));
    return;
  }
  for (const c of list) {
    const row = c.id === editingId ? cardEditRow(c) : cardRow(c);
    if (c.id === justAdded) playClass(row, "row-new");
    ul.append(row);
  }
}

function cardRow(c) {
  const li = el("li", "crd");
  // Importläge från en kortlek: ＋ för att kopiera kortet dit
  if (typeof klPickButton === "function") { const pb = klPickButton(c); if (pb) { li.classList.add("pickable"); li.append(pb); } }
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
  bMark.onclick = () => {
    const r = bMark.getBoundingClientRect();
    const on = toggleYellow(c); renderCardList();
    if (on) burst({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, ["🟡", "✨"], 6);
  };
  const bTrash = el("button", "", "🗑"); bTrash.title = "Ta bort";
  bTrash.onclick = () => { if (confirm(`Ta bort kortet "${c.sv} – ${c.es}"?`)) { deleteCard(c); renderCardList(); } };
  const bAi = el("button", c.check?.status === "pending" ? "ai-busy" : "", "🤖");
  bAi.title = "Låt AI:n översätta och kontrollera kortet";
  bAi.onclick = () => askAi([c]);
  actions.append(bSpeak, bEdit, bAi, bMark, bTrash);

  const stats = el("div", "stats");
  stats.title = "Övad · kunde · kunde inte";
  stats.innerHTML = `<span>Övad <b>${c.seen}</b></span><span class="ok">✓ <b>${c.right}</b></span><span class="no">✗ <b>${c.wrong}</b></span>`;
  if (c.cat && catById(c.cat) && listCat === "all") stats.append(el("span", "cat-tag", "📁 " + catLabel(c.cat)));
  if (c.check?.status === "pending") stats.append(el("span", "pend", "⏳"));
  if (c.check?.status === "error") {
    const er = el("span", "ai-err", "⚠ AI-fel: " + (c.check.error || "okänt fel") + " – tryck 🤖 för att försöka igen");
    stats.append(er);
  }
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

// =====================================================================
//  Dubletter: AI:n föreslår par, du tar själv bort det du vill
// =====================================================================
async function aiFindDupes(list, c = cfg()) {
  const ai = aiConfig();
  return fetchJson(ai.url.replace(/\/+$/, ""), {
    method: "POST", headers: aiHeaders(ai),
    body: JSON.stringify({ mode: "dupes", cards: list, cfg: aiCfgPayload(c) })
  }, 90000);
}
const DUPE_BATCH = 400;
function pairKey(a, b) { return [a, b].sort().join("|"); }
function showDupes(doScan = false) {
  titleEl.textContent = "Dubletter";
  goBack = showMyCards; reopen = () => showDupes(false);
  render("tpl-dupes", "dupes");
  const info = $("#dupInfo"), listEl = $("#dupList"), btnScan = $("#btnDupScan");
  const stored = () => load(lsKey("dupes"), null) || { pairs: [], dismissed: {} };

  function draw() {
    const d = stored(), byId = new Map(cards.map(c => [c.id, c]));
    const pairs = (d.pairs || []).filter(p => byId.has(p.a) && byId.has(p.b) && !d.dismissed?.[pairKey(p.a, p.b)]);
    listEl.innerHTML = "";
    view.querySelector(".dup-head").classList.toggle("hidden", !pairs.length);
    if (!d.at) { info.textContent = "AI:n har inte letat efter dubletter än."; return; }
    info.textContent = pairs.length
      ? `AI:n tror att de här ${pairs.length === 1 ? "två korten är dubletter" : pairs.length + " paren är dubletter"}. Ta bort det kort du inte vill ha – eller tryck ”Inte dubletter”. Skannat ${dateLabel(new Date(d.at))} ${new Date(d.at).toTimeString().slice(0, 5)} (${d.count} kort).`
      : `🎉 Inga dubletter kvar bland dina ${cards.length} kort. Skannat ${dateLabel(new Date(d.at))} ${new Date(d.at).toTimeString().slice(0, 5)}.`;
    pairs.forEach((p, i) => {
      const row = el("div", "dup-row");
      row.style.setProperty("--i", i);
      const pair = el("div", "dup-pair");
      for (const id of [p.a, p.b]) {
        const c = byId.get(id), box = el("div", "dup-card");
        box.append(el("b", "", c.sv || "—"), el("span", "", c.es || "—"));
        const meta = el("small", "muted", `Övad ${c.seen || 0} · ✓ ${c.right || 0} · ✗ ${c.wrong || 0}` + (c.created ? ` · ${dateLabel(new Date(c.created))}` : ""));
        const del = el("button", "btn-small bad dup-del", "🗑 Ta bort");
        del.onclick = async () => {
          const yes = await confirmDialog({ title: "Ta bort kortet?", icon: "🗑️", danger: true, ok: "Ta bort", cancel: "Behåll",
            text: `”${c.sv} – ${c.es}” tas bort. Det andra kortet finns kvar.` });
          if (!yes) return;
          deleteCard(c);
          toast("🗑 Kortet är borttaget");
          draw();
        };
        box.append(meta, del);
        pair.append(box);
      }
      row.append(pair);
      const foot = el("div", "dup-foot");
      foot.append(el("small", "dup-reason", "🤖 " + (p.reason || "Liknar varandra")));
      const keep = el("button", "btn-small", "Inte dubletter");
      keep.title = "Behåll båda – visa inte paret igen";
      keep.onclick = () => { const d2 = stored(); d2.dismissed = d2.dismissed || {}; d2.dismissed[pairKey(p.a, p.b)] = 1; save(lsKey("dupes"), d2); draw(); };
      foot.append(keep);
      row.append(foot);
      listEl.append(row);
    });
  }

  async function scan() {
    if (!aiEnabled()) { info.textContent = "AI:n är inte kopplad – logga in eller fyll i AI-koppling under ⚙."; return; }
    if (!navigator.onLine) { info.textContent = "Du är offline – AI:n kan inte skanna just nu."; return; }
    const usable = cards.filter(c => c.sv || c.es);
    if (usable.length < 2) { info.textContent = "Du behöver minst två kort."; return; }
    btnScan.disabled = true; listEl.innerHTML = "";
    view.querySelector(".dup-head").classList.add("hidden");
    // Sorterat i bokstavsordning så att liknande kort hamnar i samma omgång
    const sorted = [...usable].sort((a, b) => searchNorm(a.sv || a.es).localeCompare(searchNorm(b.sv || b.es), "sv"));
    const idx = sorted.map(c => c.id);
    const found = new Map();
    // Exakt samma text (utan accenter, artiklar och skiljetecken) hittas direkt, utan AI
    const plain = s => searchNorm(s).replace(/^(att|en|ett|el|la|los|las|un|una|the|a|an|to|der|die|das|le|les|il)\s+/, "").replace(/[^\p{L}\p{N} ]/gu, "").trim();
    for (const side of ["sv", "es"]) {
      const seen = new Map();
      for (const c of sorted) {
        const k = plain(c[side]);
        if (!k) continue;
        if (seen.has(k)) found.set(pairKey(seen.get(k), c.id), { a: seen.get(k), b: c.id, reason: `Samma ${side === "sv" ? sideLabels().sv.toLowerCase() : sideLabels().es.toLowerCase()}` });
        else seen.set(k, c.id);
      }
    }
    try {
      for (let start = 0; start < sorted.length; start += DUPE_BATCH) {
        const part = sorted.slice(start, start + DUPE_BATCH);
        info.textContent = `🤖 AI:n letar efter dubletter bland ${usable.length} kort` + (sorted.length > DUPE_BATCH ? ` (del ${start / DUPE_BATCH + 1} av ${Math.ceil(sorted.length / DUPE_BATCH)})` : "") + "… det kan ta en halv minut.";
        const r = await aiFindDupes(part.map((c, i) => ({ i: start + i, f: c.sv || "", b: c.es || "" })));
        if (!alive(info)) return;
        for (const p of r.pairs || []) {
          const a = idx[p.a], b = idx[p.b];
          if (a && b && a !== b) found.set(pairKey(a, b), { a, b, reason: p.reason || "" });
        }
      }
      const d = stored();
      save(lsKey("dupes"), { at: Date.now(), count: usable.length, pairs: [...found.values()], dismissed: d.dismissed || {} });
    } catch (err) {
      if (!alive(info)) return;
      info.textContent = "⚠ AI:n kunde inte skanna: " + (err.message || err) + (found.size ? " – visar bara exakta dubletter." : "");
      if (found.size) save(lsKey("dupes"), { ...stored(), at: Date.now(), count: usable.length, pairs: [...found.values()] });
      btnScan.disabled = false;
      if (found.size) { const msg = info.textContent; draw(); info.textContent = msg; }
      return;
    }
    btnScan.disabled = false;
    draw();
    const n = view.querySelectorAll(".dup-row").length;
    toast(n ? `🤖 Hittade ${n} möjliga dubletter` : "🎉 Inga dubletter hittades");
  }
  btnScan.onclick = scan;
  draw();
  if (doScan === true || !stored().at) scan();
}

// Meddelanden visas ett i taget, i tur och ordning
const toastQueue = [];
let toastBusy = false;
function toast(text) {
  toastQueue.push(text);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const t = document.getElementById("toast");
  const text = toastQueue.shift();
  if (text === undefined) { toastBusy = false; return; }
  toastBusy = true;
  t.textContent = text;
  t.classList.add("show");
  setTimeout(() => { t.classList.remove("show"); setTimeout(nextToast, 250); }, 2000);
}

// Gör om Mina kort till en "lek" för övningarna
function myCardsDeck(list) {
  return {
    id: "mina", name: "Mina kort", back: showMyCards,
    refresh: () => myCardsDeck(list.filter(c => cards.includes(c))),
    items: list.map(c => ({
      id: c.id, sv: c.sv, es: c.es,
      isYellow: () => isWarn(c),
      toggleYellow: () => toggleYellow(c),
      yellowText: on => on ? "🟡 Gulmarkerad – finns under 🟡 Att rätta" : "Gulmarkeringen borttagen",
      remove: () => deleteCard(c),
      box: () => c.box,
      key: "c:" + c.id,
      due: () => stats.due?.["c:" + c.id] || 0,
      record: (ok, opt = {}) => {
        c.seen++; c.lastSeen = Date.now();
        if (ok) { c.right++; c.box = clampBox(c.box + 1); } else { c.wrong++; c.box = 0; }
        saveCards();
        return awardPractice("c:" + c.id, ok, c.box, opt);
      },
      touch: (ok, opt = {}) => awardPractice("c:" + c.id, ok, c.box, { ...opt, noBox: true })
    }))
  };
}
function builtinDeck(deck) {
  return {
    id: deck.id, name: deck.name, back: () => showDeck(deck.id),
    refresh: () => builtinDeck(deck),
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
      key: `d:${deck.id}:${es}`,
      due: () => stats.due?.[`d:${deck.id}:${es}`] || 0,
      record: (ok, opt = {}) => {
        setBox(deck.id, es, ok ? getBox(deck.id, es) + 1 : 0);
        return awardPractice(`d:${deck.id}:${es}`, ok, getBox(deck.id, es), opt);
      },
      touch: (ok, opt = {}) => awardPractice(`d:${deck.id}:${es}`, ok, getBox(deck.id, es), { ...opt, noBox: true })
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
  const ai = aiConfig(), url = ai.url;
  const known = cards.map(c => isLanguage() ? c.es : c.sv).filter(Boolean).slice(0, 400);
  const r = await fetchJson(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: aiHeaders(ai),
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
        burst(stack, ["💚", "✨", "⭐", "💛"], 10);
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
    b.onclick = () => { if (b.dataset.mode === "practice") showPracticeMenu(d); else showList(deck); };
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
function dueItems(items) { const now = Date.now(); return items.filter(i => (i.due ? i.due() : 0) <= now); }
function buildSession(deck, size = SESSION_SIZE) {
  const dir = load(lsKey("dir"), "mix");
  let pool = deck.items;
  if (deck.all) size = pool.length;   // repetition: alla kort, utan smart repetition
  // Smart repetition: kort som ska repeteras idag först. Finns inga övar du i förväg.
  else if (srOn()) { const due = dueItems(pool); if (due.length) pool = due; }
  return shuffle(pool)
    .sort((a, b) => a.box() - b.box())
    .slice(0, size)
    // Frågor visas alltid som fråga → svar
    .map(item => ({ item, showSv: practiceKind === "questions" ? true : dir === "sv2es" ? true : dir === "es2sv" ? false : Math.random() < 0.5 }));
}


// En övningsomgång: håller koll på combo (rätt i rad) och delar ut XP
function practiceSession() {
  let combo = 0;
  const mult = () => combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
  function show() {
    const b = view.querySelector("#combo");
    if (!b) return;
    if (combo >= 2) {
      b.classList.remove("hidden");
      b.textContent = `🔥 ${combo} i rad` + (mult() > 1 ? ` · ×${mult()} XP` : "");
      playClass(b, "pop");
    } else b.classList.add("hidden");
  }
  return {
    // Svar på ett kort. retry = kortet kom tillbaka efter fel (ger ingen XP)
    answer(item, ok, fromEl, mode, retry = false, xpOnly = false) {
      combo = ok ? combo + 1 : 0;
      let res = null;
      if (!retry) {
        const opt = { mult: ok ? mult() : 1, mode, combo };
        res = xpOnly && item.touch ? item.touch(ok, opt) : item.record(ok, opt);
        showXP(res, fromEl);
      }
      show();
      return res;
    },
    breakCombo() { combo = 0; show(); }
  };
}

function showDone(deck, text, again, right = 0, total = 0, { countPerfect = true } = {}) {
  if (countPerfect && total >= 5 && right === total) announceAch(addTotal("perfect"));
  render("tpl-done", "done");
  $("#doneText").textContent = text;
  const big = view.querySelector(".big");
  const share = total ? right / total : 0;
  big.textContent = share >= 0.8 ? "🎉" : share >= 0.5 ? "💪" : "🌱";
  view.querySelector("h2").textContent = share >= 0.8 ? PHRASES[phraseLang()].praise[0] : share >= 0.5 ? phr("good") : phr("keep");
  playClass(big, "bounce-in");
  if (share >= 0.5) setTimeout(() => burst(big, ["🎉", "⭐", "✨", "🎊", "💫"], 18), 250);
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
    playClass(bMark, "pop");
    if (on) burst(bMark, ["🟡", "✨"], 6);
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

// ---------- Flashcards: vilket håll korten visas ----------
// std = som korten är inskrivna (vänster sida först), mix = slumpat, rev = tvärtom
const CARD_DIRS = [["std", "Standard", "Som i Mina kort"], ["mix", "Slump", "Blandat håll"], ["rev", "Tvärtom", "Andra hållet"]];
function cardDir() { const v = load(lsKey("cardDir"), "mix"); return CARD_DIRS.some(d => d[0] === v) ? v : "mix"; }
function cardDirShowSv(d = cardDir()) { return d === "std" ? true : d === "rev" ? false : practiceKind === "questions" ? true : Math.random() < 0.5; }
// Tre-lägesknapp: vänster standard, mitten slump, höger tvärtom
function cardDirSwitch(onChange) {
  const wrap = el("div", "dir3");
  wrap.setAttribute("role", "radiogroup"); wrap.setAttribute("aria-label", "Vilket håll flashcards visas");
  const thumb = el("span", "dir3-thumb"); wrap.append(thumb);
  const L = sideLabels();
  const hint = { std: `${L.sv} → ${L.es}`, mix: "Blandat håll", rev: `${L.es} → ${L.sv}` };
  const btns = CARD_DIRS.map(([id, name], i) => {
    const b = el("button", "dir3-opt"); b.type = "button";
    b.setAttribute("role", "radio"); b.dataset.i = i;
    b.append(el("b", "", name), el("small", "", hint[id]));
    b.onclick = () => { save(lsKey("cardDir"), id); draw(); playClass(thumb, "pop"); onChange?.(id); };
    wrap.append(b); return b;
  });
  function draw() {
    const cur = cardDir(), i = CARD_DIRS.findIndex(d => d[0] === cur);
    wrap.style.setProperty("--pos", i);
    btns.forEach((b, j) => { b.classList.toggle("on", j === i); b.setAttribute("aria-checked", j === i); });
  }
  draw();
  return wrap;
}

function runCards(deck) {
  render("tpl-cards", "cards");
  goBack = deck.back; reopen = deck.back;
  const queue = buildSession(deck), total = queue.length;
  queue.forEach(q => { q.showSv = cardDirShowSv(); });
  let right = 0, cur = null, flipped = false, revealed = false, busy = false, done = 0;
  const sess = practiceSession();
  const card = $("#card"), front = $("#cardFront"), back = $("#cardBack");
  const answerRow = $("#answerRow");
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });
  // Byt håll mitt i övningen: gäller resten av korten, och det här om det inte är vänt än
  view.querySelector(".pbar").after(cardDirSwitch(() => {
    queue.forEach(q => { q.showSv = cardDirShowSv(); });
    if (cur && !revealed) { cur.showSv = cardDirShowSv(); fill(); playClass(card, "deal-in"); }
  }));

  function fill() {
    const { item, showSv } = cur;
    const L = sideLabels();
    const q = showSv ? item.sv : item.es, a = showSv ? item.es : item.sv;
    $("#cardLang").textContent = showSv ? L.sv : L.es;
    $("#cardLangBack").textContent = showSv ? L.es : L.sv;
    front.textContent = q; back.textContent = a; $("#cardQ").textContent = q;
    front.classList.toggle("long", q.length > 40);
    back.classList.toggle("long", a.length > 40);
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    setPbar(done, total);
  }
  function setFace(toBack) {
    flipped = toBack;
    card.classList.toggle("flipped", toBack);
    playClass(card, "lift");                       // kortet lyfts lite medan det vänds
  }
  function next() {
    if (!queue.length) return showDone(deck, `Du kunde ${right} av ${total} på första försöket.` + (deck.doneNote ? " " + deck.doneNote() : ""), () => runCards(deck.restart ? deck.restart() : deck), right, total);
    cur = queue.shift(); revealed = false;
    refreshTools();
    // Lägg det nya kortet med framsidan upp utan vändanimation
    card.classList.add("no-trans"); card.classList.remove("flipped"); flipped = false;
    fill();
    void card.offsetWidth; card.classList.remove("no-trans");
    answerRow.classList.add("hidden");
    playClass(card, "deal-in");
    if (!cur.showSv) speak(cur.item.es);
  }
  function flip() {
    if (busy) return;
    setFace(!flipped);
    if (!revealed) {
      revealed = true;
      answerRow.classList.remove("hidden");
      playClass(answerRow, "pop-in");
      if (cur.showSv) speak(cur.item.es);
    }
  }
  async function answer(ok, btn) {
    if (busy || !revealed) return;
    busy = true;
    if (ok && !cur.retry) right++;
    sess.answer(cur.item, ok, btn, "cards", cur.retry);
    if (ok) { done++; burst(btn); }
    else if (!deck.noRetry) queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });   // kommer tillbaka snart
    setPbar(done, total);
    if (!ok) { playClass(card, "shake"); await wait(260); if (!alive(card)) return; }
    card.classList.add(ok ? "out-right" : "out-left");
    await wait(330);
    if (!alive(card)) return;
    card.classList.remove("out-right", "out-left");
    busy = false;
    next();
  }
  card.onclick = flip;
  card.onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
  document.onkeydown = e => {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") answer(true, $("#btnRight"));
    else if (e.key === "ArrowLeft") answer(false, $("#btnWrong"));
    else if (e.key === " " && e.target === document.body) { e.preventDefault(); flip(); }
  };
  $("#btnSpeak").onclick = e => { e.stopPropagation(); speak(cur.item.es); };
  $("#btnRight").onclick = e => answer(true, e.currentTarget);
  $("#btnWrong").onclick = e => answer(false, e.currentTarget);
  next();
}

function runWrite(deck) {
  render("tpl-write", "write");
  goBack = deck.back; reopen = deck.back;
  setupAccents(view);
  const queue = buildSession(deck), total = queue.length;
  let right = 0, cur = null, answered = false, done = 0;
  const sess = practiceSession();
  const input = $("#answer"), feedback = $("#feedback"), btnNext = $("#btnNext");
  const promptCard = view.querySelector(".card.static");
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });
  const dk = addDontKnow(() => { if (answered) return; input.value = ""; $("#writeForm").requestSubmit(); });

  function next() {
    if (!queue.length) return showDone(deck, `Du hade ${right} av ${total} rätt på första försöket.`, () => runWrite(deck), right, total);
    cur = queue.shift(); answered = false; dk.show();
    refreshTools();
    const { item, showSv } = cur;
    const L = sideLabels();
    $("#promptLang").textContent = promptLabel(showSv);
    $("#prompt").textContent = showSv ? item.sv : item.es;
    input.placeholder = showSv ? `Skriv på ${langInfo().name.toLowerCase()}…` : "Skriv på svenska…";
    input.lang = showSv ? cfg().lang : "sv";
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    setPbar(done, total);
    playClass(promptCard, "deal-in");
    input.value = ""; input.disabled = false;
    feedback.className = "feedback hidden";
    btnNext.classList.add("hidden");
    input.focus();
    if (!showSv) speak(item.es);
  }

  $("#writeForm").onsubmit = e => {
    e.preventDefault();
    if (answered) return next();
    answered = true; dk.hide();
    const { item, showSv } = cur;
    const correct = showSv ? item.es : item.sv;
    const result = check(input.value, correct, showSv ? "es" : "sv");
    input.disabled = true;
    if (result !== "no") {
      if (!cur.retry) right++;
      sess.answer(item, true, promptCard, "write", cur.retry);
      feedback.className = "feedback " + (result === "ok" ? "ok" : "almost");
      feedback.textContent = result === "ok" ? `✓ Rätt! ${correct}` : almostText(correct);
      done++;
      playClass(promptCard, "pop");
      burst(promptCard, result === "ok" ? ["✨", "⭐", "🎉", "💫"] : ["⭐", "✨"], result === "ok" ? 12 : 6);
    } else {
      sess.answer(item, false, promptCard, "write", cur.retry);
      queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });
      feedback.className = "feedback no";
      feedback.textContent = `Rätt svar: ${correct}`;
      playClass(promptCard, "shake");
    }
    setPbar(done, total);
    playClass(feedback, "pop-in");
    speak(item.es);
    btnNext.classList.remove("hidden");
    btnNext.focus();
  };
  btnNext.onclick = next;
  next();
}

// =====================================================================
//  Öva-menyn
// =====================================================================
const MODES = [
  { id: "cards", icon: "🃏", name: "Flashcards", desc: "Vänd korten och säg om du kunde", run: d => runCards(d) },
  { id: "hard", icon: "💪", name: "Svårt läge", desc: "Bara flashcards och skrivfrågor – ingen uteslutningsmetod. AI:n rättar långa svar", run: d => runHard(d) },
  { id: "mc", icon: "🔘", name: "Flerval", desc: "Välj rätt bland fyra – felsvaren är luriga", run: d => runMC(d), min: 2 },
  { id: "write", icon: "⌨️", name: "Skrivförhör", desc: "Skriv översättningen", run: d => runWrite(d), lang: true },
  { id: "memory", icon: "🧠", name: "Memory", desc: "Vänd två kort i taget och hitta paren", run: d => runMemory(d), min: 3 },
  { id: "listen", icon: "🎧", name: "Lyssna och skriv", desc: "Hör ordet och skriv det du hör", run: d => runListen(d), lang: true, tts: true },
  { id: "speak", icon: "🎤", name: "Uttal", desc: "Säg ordet – appen lyssnar och rättar", run: d => runSpeak(d), lang: true, mic: true },
  { id: "verbs", icon: "🔤", name: "Verbböjning", desc: "Böj vanliga verb i olika tider", run: d => runVerbsStart(d), es: true, noDeck: true }
];
function speechRecognitionClass() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

function showPracticeMenu(deck) {
  if (deck.refresh) deck = deck.refresh();
  titleEl.textContent = "Öva";
  goBack = deck.back; reopen = () => showPracticeMenu(deck);
  render("tpl-practice", "practice");
  const n = deck.items.length;
  $("#pmInfo").textContent = n
    ? `${deck.name} · ${n} kort` + (srOn() ? ` · 📅 ${dueItems(deck.items).length} att repetera idag` : "")
    : `${deck.name} · inga färdiga kort i listan just nu`;
  const grid = $("#pmGrid");
  practiceKind = deck.kind || "mixed";
  if (typeof klPracticeBanner === "function") klPracticeBanner(deck);
  const RECOMMENDED = { grammar: ["write", "hard"], terms: ["mc", "cards"], questions: ["hard", "cards"] }[practiceKind] || [];
  // När en övning är klar kommer du tillbaka hit
  const sub = { ...deck, back: () => showPracticeMenu(deck) };
  $("#pmAdventure").onclick = () => showAdventure({ back: () => showPracticeMenu(deck) });
  MODES.forEach((m, i) => {
    if (m.lang && !isLanguage()) return;
    if (m.es && !(isLanguage() && cfg().lang === "es")) return;
    let why = "";
    if (!m.noDeck && n < (m.min || 1)) why = n ? `Behöver minst ${m.min} kort` : "Lägg till kort först";
    if (m.mic && !speechRecognitionClass()) why = "Stöds inte i den här webbläsaren – prova Chrome";
    if (m.tts && !("speechSynthesis" in window)) why = "Uppläsning stöds inte här";
    const b = el("button", "pm-mode");
    b.style.setProperty("--i", i);
    b.append(el("span", "pm-icon", m.icon), el("b", "", m.name), el("small", "", why || m.desc));
    if (!why && RECOMMENDED.includes(m.id)) { b.classList.add("recommended"); b.append(el("span", "pm-rec", "★ Passar kortleken")); }
    if (why) { b.disabled = true; b.classList.add("off"); }
    b.onclick = () => m.run(sub);
    grid.append(b);
  });
}

// =====================================================================
//  Svårt läge: flashcards och skrivfrågor blandat. Långa svar rättas av AI:n.
// =====================================================================
// Ett långt svar (förklaring, mening) går inte att rätta bokstav för bokstav
// Rubriken ovanför frågan, anpassad efter typen av kortlek
const KIND_TAG = { grammar: "🔤 Grammatik", terms: "📖 Begrepp", questions: "❓ Fråga" };
function promptLabel(showSv) {
  const L = sideLabels(), base = (showSv ? L.sv : L.es) + " → " + (showSv ? L.es : L.sv);
  if (practiceKind === "questions") return showSv ? "❓ Fråga → svar" : "💬 Svar → vilken fråga?";
  return KIND_TAG[practiceKind] ? `${KIND_TAG[practiceKind]} · ${base}` : base;
}
function isLongAnswer(text) { return wordCount(text) > (isLanguage() ? 4 : 3) || String(text).length > 40; }
async function aiGrade(question, correct, answer, c = cfg()) {
  const ai = aiConfig();
  return fetchJson(ai.url.replace(/\/+$/, ""), {
    method: "POST", headers: aiHeaders(ai),
    body: JSON.stringify({ mode: "grade", question, correct, answer, kind: practiceKind, cfg: aiCfgPayload(c) })
  }, 30000);
}
function runHard(deck) {
  titleEl.textContent = "Svårt läge";
  render("tpl-hard", "hard");
  goBack = deck.back; reopen = deck.back;
  setupAccents(view);
  // Grammatik och frågor får fler skrivfrågor
  const writeShare = { grammar: 0.75, questions: 0.65 }[practiceKind] ?? 0.5;
  const queue = buildSession(deck).map(q => ({ ...q, kind: Math.random() < writeShare ? "write" : "flash" })), total = queue.length;
  let right = 0, cur = null, answered = false, done = 0;
  const sess = practiceSession(), L = sideLabels();
  const promptCard = view.querySelector(".hard-card"), input = $("#hardInput"), form = $("#hardForm");
  const feedback = $("#feedback"), btnNext = $("#btnNext"), flash = $("#hardFlash");
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });
  const dk = addDontKnow(() => giveUp());
  $("#btnSpeakQ").onclick = () => speak(cur.item.es);

  const q = () => cur.showSv ? cur.item.sv : cur.item.es;          // det du ser
  const facit = () => cur.showSv ? cur.item.es : cur.item.sv;      // det du ska kunna
  const answerLabel = () => cur.showSv ? L.es : L.sv;

  function next() {
    if (!queue.length) return showDone(deck, `Svårt läge: ${right} av ${total} rätt på första försöket.`, () => runHard(deck), right, total);
    cur = queue.shift(); answered = false;
    refreshTools(); dk.show();
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    setPbar(done, total);
    $("#promptLang").textContent = promptLabel(cur.showSv);
    $("#hardKind").textContent = cur.kind === "flash" ? "🃏 Flashcard" : isLongAnswer(facit()) ? "✍️ Skriv – AI:n rättar" : "⌨️ Skriv";
    $("#prompt").textContent = q();
    $("#prompt").classList.toggle("long", q().length > 60);
    $("#btnSpeakQ").classList.toggle("hidden", !isLanguage() || cur.showSv);
    feedback.className = "feedback hidden"; feedback.innerHTML = "";
    btnNext.classList.add("hidden"); $("#judgeRow").classList.add("hidden");
    playClass(promptCard, "deal-in");
    const isFlash = cur.kind === "flash";
    flash.classList.toggle("hidden", !isFlash); form.classList.toggle("hidden", isFlash);
    if (isFlash) {
      $("#btnReveal").classList.remove("hidden");
      $("#hardAnswer").classList.add("hidden"); $("#selfRow").classList.add("hidden");
      $("#btnReveal").focus();
    } else {
      const long = isLongAnswer(facit());
      input.value = ""; input.disabled = false; $("#btnGrade").disabled = false;
      input.rows = long ? 4 : 1;
      input.classList.toggle("long", long);
      input.lang = cur.showSv && isLanguage() ? cfg().lang : "sv";
      input.placeholder = long ? `Skriv ${answerLabel().toLowerCase()} med egna ord…` : `Skriv ${isLanguage() ? "på " + answerLabel().toLowerCase() : answerLabel().toLowerCase()}…`;
      input.focus();
    }
    if (!cur.showSv && isLanguage()) speak(cur.item.es);
  }

  // Resultat av ett kort (gemensamt för alla vägar)
  function finish(ok, mode, fromEl) {
    answered = true; dk.hide();
    if (ok) { if (!cur.retry) right++; done++; playClass(promptCard, "pop"); burst(promptCard, ["✨", "⭐", "💪", "💫"], 10); }
    else { queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true }); playClass(promptCard, "shake"); }
    sess.answer(cur.item, ok, fromEl || promptCard, mode, cur.retry);
    setPbar(done, total);
    if (isLanguage()) speak(cur.item.es);
    btnNext.classList.remove("hidden"); btnNext.focus();
  }
  function showFacit(cls, title, extra) {
    feedback.className = "feedback " + cls; feedback.innerHTML = "";
    feedback.append(el("b", "", title));
    if (extra) feedback.append(el("div", "hard-ai", extra));
    const f = el("div", "hard-facit"); f.append(el("small", "", answerLabel() + ":"), el("span", "", facit()));
    feedback.append(f);
    playClass(feedback, "pop-in");
  }

  // Flashcard
  $("#btnReveal").onclick = () => {
    $("#btnReveal").classList.add("hidden");
    $("#answerLang").textContent = answerLabel();
    $("#answerText").textContent = facit();
    $("#hardAnswer").classList.remove("hidden"); $("#selfRow").classList.remove("hidden");
    playClass($("#hardAnswer"), "pop-in");
    dk.hide();
    if (cur.showSv && isLanguage()) speak(cur.item.es);
    $("#btnSelfYes").focus();
  };
  const self = ok => { if (answered) return; $("#selfRow").classList.add("hidden"); finish(ok, "cards", ok ? $("#btnSelfYes") : null); };
  $("#btnSelfYes").onclick = () => self(true);
  $("#btnSelfNo").onclick = () => self(false);

  // Jag vet inte
  function giveUp() {
    if (answered) return;
    input.disabled = true;
    if (cur.kind === "flash") { $("#btnReveal").classList.add("hidden"); $("#selfRow").classList.add("hidden"); }
    showFacit("no", "Inga problem – här är svaret. Kortet kommer tillbaka snart.");
    finish(false, cur.kind === "flash" ? "cards" : "write");
  }

  // Skrivfråga
  input.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey && (!input.classList.contains("long") || e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = async e => {
    e.preventDefault();
    if (answered) return next();
    const given = input.value.trim(), correct = facit();
    if (!given) { toast("Skriv ett svar – eller tryck på ”Jag vet inte”"); input.focus(); return; }
    input.disabled = true; $("#btnGrade").disabled = true; dk.hide();
    if (!isLongAnswer(correct)) {
      const r = check(given, correct, cur.showSv ? "es" : "sv");
      if (r === "ok") showFacit("ok", "✓ " + phrPick("praise"));
      else if (r === "almost") showFacit("almost", "✓ " + almostText(correct).split(":")[0]);
      else showFacit("no", "✗ Inte riktigt");
      return finish(r !== "no", "write");
    }
    // Långt svar: AI:n rättar, annars bedömer du själv
    if (aiEnabled() && navigator.onLine) {
      feedback.className = "feedback pending"; feedback.textContent = "🤖 AI:n rättar ditt svar…";
      const id = cur;
      try {
        const g = await aiGrade(q(), correct, given);
        if (cur !== id || !alive(feedback)) return;
        showFacit(g.ok ? "ok" : "no", g.ok ? `✓ ${phrPick("praise")} (${g.score} %)` : `✗ Inte riktigt (${g.score} %)`, g.feedback ? "🤖 " + g.feedback : "");
        return finish(!!g.ok, "write");
      } catch (err) {
        if (cur !== id || !alive(feedback)) return;
        showFacit("almost", "AI:n kunde inte rätta just nu – jämför själv med facit:", String(err.message || err));
      }
    } else {
      showFacit("almost", "Jämför ditt svar med facit:", aiEnabled() ? "Du är offline, så AI:n kan inte rätta." : "Koppla AI:n för att få långa svar rättade automatiskt.");
    }
    $("#judgeRow").classList.remove("hidden");
    $("#btnJudgeYes").focus();
  };
  const judge = ok => { if (answered) return; $("#judgeRow").classList.add("hidden"); finish(ok, "write"); };
  $("#btnJudgeYes").onclick = () => judge(true);
  $("#btnJudgeNo").onclick = () => judge(false);
  btnNext.onclick = next;
  next();
}

// =====================================================================
//  Hjälp för jämförelser
// =====================================================================
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function similarity(a, b) { const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 1; }

// =====================================================================
//  Flerval – med felsvar som liknar det rätta
// =====================================================================
const LEAD_WORDS = ["el", "la", "los", "las", "un", "una", "att", "en", "ett", "the", "a", "to", "der", "die", "das", "le", "les", "il"];
function distractorScore(c, a) {
  let s = 0;
  const ca = stripAccents(c), aa = stripAccents(a);
  if (wordCount(c) === wordCount(a)) s += 3;
  const fc = c.split(" ")[0], fa = a.split(" ")[0];
  if (LEAD_WORDS.includes(fa) && fa === fc) s += 4;           // samma artikel / "att"
  if (aa.slice(-2) === ca.slice(-2)) s += 3;                  // samma ändelse (-ar, -en …)
  if (aa.slice(-3) === ca.slice(-3)) s += 1;
  if (aa[0] === ca[0]) s += 1.5;                              // samma första bokstav
  s += Math.max(0, 3 - Math.abs(a.length - c.length) / 2);    // ungefär lika långt
  const d = lev(aa, ca);
  if (d <= 3) s += 5 - d;                                     // nästan samma stavning
  return s + Math.random() * 2;                               // lite slump så det varierar
}
// Påhittade felstavningar om det finns för få riktiga ord att välja bland
function nearMisses(word) {
  const out = new Set(), w = word.trim();
  const swaps = [["a", "o"], ["o", "a"], ["e", "a"], ["i", "e"], ["ar", "er"], ["er", "ir"], ["ir", "ar"], ["en", "et"], ["et", "en"]];
  for (const [x, y] of swaps) if (w.endsWith(x)) out.add(w.slice(0, -x.length) + y);
  const acc = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
  const plain = stripAccents(w);
  if (plain !== w) out.add(plain);
  else { const m = w.match(/[aeiou](?=[^aeiou]*[aeiou][^aeiou]*$)/); if (m) out.add(w.slice(0, m.index) + acc[m[0]] + w.slice(m.index + 1)); }
  out.delete(w);
  return [...out];
}
function mcPool(deck) {
  const pairs = deck.items.map(i => ({ sv: i.sv, es: i.es }));
  for (const c of cards) if (c.sv && c.es) pairs.push({ sv: c.sv, es: c.es });
  if (hasBuiltinDecks()) for (const d of BUILTIN_DECKS) for (const [es, sv] of d.words) pairs.push({ sv, es });
  return pairs;
}
function pickDistractors(answer, side, pool, n = 3) {
  const A = answer.trim().toLowerCase();
  const alts = A.split("/").map(x => x.trim());
  const seen = new Set([A]), cands = [];
  for (const p of pool) {
    const c = (p[side] || "").trim(), C = c.toLowerCase();
    if (!c || seen.has(C)) continue;
    seen.add(C);
    if (C.split("/").map(x => x.trim()).some(x => alts.includes(x))) continue;
    cands.push({ text: c, score: distractorScore(C, A) });
  }
  cands.sort((x, y) => y.score - x.score);
  const picked = cands.slice(0, n).map(c => c.text);
  if (picked.length < n) for (const f of nearMisses(answer)) if (picked.length < n && !picked.some(p => sameText(p, f))) picked.push(f);
  return picked;
}

function runMC(deck) {
  titleEl.textContent = "Flerval";
  render("tpl-mc", "mc");
  goBack = deck.back; reopen = deck.back;
  const queue = buildSession(deck), total = queue.length, pool = mcPool(deck);
  let right = 0, cur = null, answered = false, done = 0;
  const sess = practiceSession();
  const promptCard = view.querySelector(".card.static"), opts = $("#options"), btnNext = $("#btnNext");
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });
  $("#btnSpeakQ").classList.toggle("hidden", !isLanguage());
  $("#btnSpeakQ").onclick = () => speak(cur.item.es);

  const dkM = addDontKnow(() => {
    if (answered) return;
    answered = true; dkM.hide();
    opts.querySelectorAll(".mc-opt").forEach(b => { b.disabled = true; if (b.dataset.correct) b.classList.add("right"); });
    sess.answer(cur.item, false, promptCard, "mc", cur.retry);
    queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });
    speak(cur.item.es);
    btnNext.classList.remove("hidden"); btnNext.focus();
  });
  function next() {
    if (!queue.length) return showDone(deck, `Du hade ${right} av ${total} rätt på första försöket.`, () => runMC(deck), right, total);
    cur = queue.shift(); answered = false; dkM.show();
    refreshTools();
    const { item, showSv } = cur, L = sideLabels();
    const answerSide = showSv ? "es" : "sv", correct = item[answerSide];
    $("#promptLang").textContent = promptLabel(showSv);
    $("#prompt").textContent = showSv ? item.sv : item.es;
    $("#prompt").classList.toggle("long", (showSv ? item.sv : item.es).length > 40);
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    setPbar(done, total);
    playClass(promptCard, "deal-in");
    btnNext.classList.add("hidden");
    const choices = shuffle([correct, ...pickDistractors(correct, answerSide, pool)]);
    opts.innerHTML = "";
    choices.forEach((text, i) => {
      const b = el("button", "mc-opt");
      b.append(el("span", "mc-key", String(i + 1)), el("span", "mc-text", text));
      if (text.length > 40) b.classList.add("long");
      b.style.setProperty("--i", i);
      b.onclick = () => choose(b, text === correct);
      b.dataset.correct = text === correct ? "1" : "";
      opts.append(b);
    });
    if (!showSv) speak(item.es);
  }
  async function choose(btn, ok) {
    if (answered) return;
    answered = true; dkM.hide();
    opts.querySelectorAll(".mc-opt").forEach(b => { b.disabled = true; if (b.dataset.correct) b.classList.add("right"); });
    if (ok) {
      if (!cur.retry) right++;
      done++;
      playClass(btn, "pop"); burst(btn);
      sess.answer(cur.item, true, btn, "mc", cur.retry);
      speak(cur.item.es);
      setPbar(done, total);
      await wait(900);
      if (alive(opts)) next();
    } else {
      btn.classList.add("wrong"); playClass(btn, "shake");
      sess.answer(cur.item, false, btn, "mc", cur.retry);
      queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });
      speak(cur.item.es);
      btnNext.classList.remove("hidden"); btnNext.focus();
    }
  }
  btnNext.onclick = next;
  document.onkeydown = e => {
    if (e.target.closest("input, textarea, select")) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4 && !answered) opts.querySelectorAll(".mc-opt")[n - 1]?.click();
  };
  next();
}

// =====================================================================
//  Memory
// =====================================================================
// ---------- Memory: hur länge korten ligger uppvända, och text som krymper tills den får plats ----------
function memDelay() { const v = Math.round(Number(load("app.memDelay", 3))); return Math.min(15, Math.max(1, v || 3)); }
function memDelaySlider() {
  const wrap = el("div", "mem-slider");
  const top = el("div", "mem-slider-top");
  const val = el("b", "mem-slider-val");
  top.append(el("span", "", "Visningstid"), val);
  const input = el("input"); input.type = "range"; input.min = 1; input.max = 15; input.step = 1; input.value = memDelay();
  input.setAttribute("aria-label", "Sekunder korten är uppvända");
  const scale = el("div", "mem-slider-scale"); scale.append(el("span", "", "1 s"), el("span", "", "8 s"), el("span", "", "15 s"));
  const draw = () => { val.textContent = `${input.value} s`; input.style.setProperty("--p", ((input.value - 1) / 14 * 100) + "%"); };
  input.oninput = () => { save("app.memDelay", Number(input.value)); draw(); };
  input.onchange = () => playClass(val, "pop");
  draw();
  wrap.append(top, input, scale);
  return wrap;
}
// Minskar textstorleken tills texten (och varje enskilt ord) får plats i rutan
function fitText(textEl, box, max = 17, min = 9) {
  textEl.style.overflowWrap = "normal";
  let size = max;
  textEl.style.fontSize = size + "px";
  // Inget ord får sticka ut åt sidan, och hela texten ska rymmas på höjden
  const fits = () => textEl.scrollWidth <= textEl.clientWidth + 1 && textEl.scrollHeight <= box.clientHeight + 1;
  while (size > min && !fits()) { size -= 0.5; textEl.style.fontSize = size + "px"; }
  if (!fits()) textEl.style.overflowWrap = "anywhere";   // sista utvägen: bryt mitt i ord
}

function klFillIconsSafe() { if (typeof klFillIcons === "function") klFillIcons(); }
function runMemory(deck) {
  titleEl.textContent = "Memory";
  render("tpl-memory", "memory");
  goBack = deck.back; reopen = deck.back;
  // Kort som ska repeteras först, sen fylls det på så att det blir 6 par
  const pairs = buildSession(deck, 6).map(x => x.item);
  for (const it of shuffle(deck.items)) { if (pairs.length >= 6) break; if (!pairs.includes(it)) pairs.push(it); }
  const sess = practiceSession(), L = sideLabels();
  const tiles = shuffle(pairs.flatMap((it, i) => [{ i, side: "sv", text: it.sv }, { i, side: "es", text: it.es }]));
  const grid = $("#memGrid");
  let open = [], matched = 0, moves = 0, lock = false, skipWait = null;
  // Inställning för visningstid direkt i memory
  klFillIconsSafe();
  $("#btnMemSettings").onclick = () => {
    const box = $("#memSettings");
    if (!box.childElementCount) box.append(memDelaySlider());
    box.classList.toggle("hidden");
    if (!box.classList.contains("hidden")) playClass(box, "pop-in");
  };
  const color = deck.color || cfgColor(cfg());
  const backIcon = deck.klId && typeof klDeck === "function" ? klDeck(deck.klId)?.icon : "layers";
  const status = () => { $("#progress").textContent = `Par: ${matched} / ${pairs.length} · Drag: ${moves}`; };
  status();
  tiles.forEach((t, idx) => {
    const b = el("button", "mtile");
    b.style.setProperty("--i", idx);
    const inner = el("span", "mtile-inner");
    const back = el("span", "mt-face mt-back");
    if (typeof klPaint === "function") klPaint(back, color);
    back.append(el("span", "mt-blob"), typeof klIconEl === "function" ? klIconEl(backIcon || "layers", "mt-back-ic") : el("span", "mt-back-ic", "Ñ"));
    const front = el("span", "mt-face mt-front");
    const textBox = el("span", "mt-textbox"), text = el("span", "mt-text", t.text);
    textBox.append(text);
    front.append(el("small", "", t.side === "sv" ? L.sv : L.es), textBox, el("i", "mt-timer"));
    inner.append(back, front); b.append(inner);
    b._fit = () => fitText(text, textBox);
    b.onclick = () => flipTile(b, t);
    grid.append(b);
  });
  // Anpassa textstorleken när korten finns på sidan (och om fönstret ändrar storlek)
  // Långa förklaringar: färre och större kort, så att texten inte blir pytteliten
  const longest = Math.max(...tiles.map(t => t.text.length));
  grid.classList.toggle("roomy", longest > 40);
  grid.classList.toggle("xroomy", longest > 90);
  const fitAll = () => grid.querySelectorAll(".mtile").forEach(b => b._fit?.());
  requestAnimationFrame(() => requestAnimationFrame(fitAll));
  document.fonts?.ready?.then(() => alive(grid) && fitAll());
  let fitT = null;
  const onResize = () => { if (!alive(grid)) return window.removeEventListener("resize", onResize); clearTimeout(fitT); fitT = setTimeout(fitAll, 150); };
  window.addEventListener("resize", onResize);

  async function flipTile(b, t) {
    // Två uppvända kort som inte var ett par: tryck på något av dem för att vända tillbaka direkt
    if (skipWait && b.classList.contains("open")) { skipWait(); return; }
    if (lock || b.classList.contains("open") || b.classList.contains("matched")) return;
    b.classList.add("open");
    open.push({ b, t });
    if (t.side === "es") speak(t.text);
    if (open.length < 2) return;
    moves++; lock = true;
    const [x, y] = open; open = [];
    if (x.t.i === y.t.i && x.t.side !== y.t.side) {
      await wait(350);
      if (!alive(grid)) return;
      x.b.classList.add("matched"); y.b.classList.add("matched");
      playClass(x.b, "pop"); playClass(y.b, "pop");
      burst(y.b, ["✨", "⭐", "💫"], 8);
      sess.answer(pairs[x.t.i], true, y.b, "memory", false, true);   // XP, men kortets nivå ändras inte
      matched++;
      lock = false; status();
      if (matched === pairs.length) {
        announceAch(addTotal("memoryWins"));
        await wait(700);
        if (!alive(grid)) return;
        showDone(deck, `Du hittade alla ${pairs.length} par på ${moves} drag!`, () => runMemory(deck), pairs.length, moves, { countPerfect: false });
      }
    } else {
      sess.breakCombo();
      const ms = memDelay() * 1000;
      [x.b, y.b].forEach(tb => { tb.classList.add("waiting"); tb.style.setProperty("--wait", ms + "ms"); });
      await new Promise(res => { const tm = setTimeout(res, ms); skipWait = () => { clearTimeout(tm); res(); }; });
      skipWait = null;
      [x.b, y.b].forEach(tb => tb.classList.remove("waiting"));
      if (!alive(grid)) return;
      playClass(x.b, "shake"); playClass(y.b, "shake");
      x.b.classList.remove("open"); y.b.classList.remove("open");
      lock = false; status();
    }
  }
}

// =====================================================================
//  Lyssna och skriv
// =====================================================================
function runListen(deck) {
  titleEl.textContent = "Lyssna och skriv";
  render("tpl-listen", "listen");
  goBack = deck.back; reopen = deck.back;
  setupAccents(view);
  const queue = buildSession(deck), total = queue.length, sess = practiceSession();
  let right = 0, cur = null, answered = false, done = 0;
  const input = $("#answer"), feedback = $("#feedback"), btnNext = $("#btnNext"), card = view.querySelector(".listen-card");
  input.lang = cfg().lang;
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });
  const play = (rate = 0.85) => { speak(cur.item.es, rate); playClass($("#btnPlay"), "pop"); };
  $("#btnPlay").onclick = () => play();
  $("#btnSlow").onclick = () => play(0.5);
  $("#btnHint").onclick = () => { $("#hint").textContent = `Betyder: ${cur.item.sv}`; $("#hint").classList.remove("hidden"); };

  const dkL = addDontKnow(() => { if (answered) return; input.value = ""; $("#writeForm").requestSubmit(); });
  function next() {
    if (!queue.length) return showDone(deck, `Du hade ${right} av ${total} rätt på första försöket.`, () => runListen(deck), right, total);
    cur = queue.shift(); answered = false; dkL.show();
    refreshTools();
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    setPbar(done, total);
    $("#hint").classList.add("hidden");
    input.value = ""; input.disabled = false;
    feedback.className = "feedback hidden";
    btnNext.classList.add("hidden");
    playClass(card, "deal-in");
    input.focus();
    setTimeout(() => play(), 250);
  }
  $("#writeForm").onsubmit = e => {
    e.preventDefault();
    if (answered) return next();
    answered = true; dkL.hide();
    const result = check(input.value, cur.item.es, "es");
    input.disabled = true;
    if (result !== "no") {
      if (!cur.retry) right++;
      done++;
      feedback.className = "feedback " + (result === "ok" ? "ok" : "almost");
      feedback.textContent = result === "ok" ? `✓ Rätt! ${cur.item.es} = ${cur.item.sv}` : `Nästan! Tänk på accenterna: ${cur.item.es}`;
      playClass(card, "pop"); burst(card);
      sess.answer(cur.item, true, card, "listen", cur.retry);
    } else {
      feedback.className = "feedback no";
      feedback.textContent = `Det var: ${cur.item.es} (${cur.item.sv})`;
      playClass(card, "shake");
      sess.answer(cur.item, false, card, "listen", cur.retry);
      queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });
    }
    setPbar(done, total);
    playClass(feedback, "pop-in");
    btnNext.classList.remove("hidden"); btnNext.focus();
  };
  btnNext.onclick = next;
  next();
}

// =====================================================================
//  Uttal (taligenkänning)
// =====================================================================
function speechMatches(heardList, target) {
  const art = langInfo().article;
  const norm = t => stripAccents(normalize(t, "es")).replace(art, "").trim();
  const targets = target.split("/").map(norm).filter(Boolean);
  return heardList.some(h => {
    const H = norm(h);
    return targets.some(tg => tg === H || (` ${H} `).includes(` ${tg} `) || similarity(tg, H) >= 0.75);
  });
}
function runSpeak(deck) {
  titleEl.textContent = "Uttal";
  render("tpl-speak", "speak");
  goBack = deck.back; reopen = deck.back;
  const SR = speechRecognitionClass();
  const queue = buildSession(deck), total = queue.length, sess = practiceSession();
  let right = 0, cur = null, tries = 0, done = 0, rec = null, finished = false;
  const card = view.querySelector(".card.static"), mic = $("#btnMic"), status = $("#micStatus"), btnNext = $("#btnNext");
  const refreshTools = practiceTools(() => cur, id => { dropFromQueue(queue, id); next(); });
  $("#btnSpeakQ").onclick = () => speak(cur.item.es);

  function next() {
    rec?.abort?.();
    if (!queue.length) return showDone(deck, `Du sa ${right} av ${total} rätt.`, () => runSpeak(deck), right, total);
    cur = queue.shift(); tries = 0; finished = false;
    refreshTools();
    $("#prompt").textContent = cur.item.es;
    $("#promptSv").textContent = cur.item.sv;
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    setPbar(done, total);
    status.textContent = "Tryck på mikrofonen och säg ordet.";
    status.className = "muted center";
    mic.disabled = false; mic.classList.remove("listening");
    btnNext.classList.add("hidden"); $("#btnSkip").classList.remove("hidden");
    playClass(card, "deal-in");
  }
  function finish(ok, heard) {
    finished = true;
    mic.disabled = true;
    if (ok) {
      if (!cur.retry) right++;
      done++;
      status.textContent = `✓ Perfekt! Jag hörde "${heard}"`;
      status.className = "center feedback ok";
      playClass(card, "pop"); burst(mic);
    } else {
      status.textContent = `Inte riktigt – lyssna på hur det låter och försök nästa gång.`;
      status.className = "center feedback no";
      speak(cur.item.es);
    }
    sess.answer(cur.item, ok, mic, "speak", cur.retry);
    setPbar(done, total);
    btnNext.classList.remove("hidden"); $("#btnSkip").classList.add("hidden");
    btnNext.focus();
  }
  mic.onclick = () => {
    if (finished || !SR) return;
    if (rec) { rec.abort(); rec = null; }
    rec = new SR();
    rec.lang = langInfo().tts;
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    mic.classList.add("listening");
    status.textContent = "🎙 Lyssnar… säg ordet nu";
    status.className = "center";
    rec.onresult = e => {
      const heard = [...e.results[0]].map(a => a.transcript);
      mic.classList.remove("listening");
      if (speechMatches(heard, cur.item.es)) finish(true, heard[0]);
      else {
        tries++;
        if (tries >= 3) finish(false, heard[0]);
        else {
          status.textContent = `Jag hörde "${heard[0]}". Försök igen (${3 - tries} försök kvar).`;
          status.className = "center feedback almost";
          playClass(card, "shake");
        }
      }
    };
    rec.onerror = e => {
      mic.classList.remove("listening");
      status.className = "center feedback no";
      status.textContent = e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Mikrofonen är blockerad. Tillåt mikrofonen för sidan i webbläsaren och försök igen."
        : e.error === "no-speech" ? "Jag hörde inget – tryck och försök igen."
        : e.error === "network" ? "Taligenkänningen behöver internet. Försök igen när du är online."
        : "Något gick fel med mikrofonen (" + e.error + "). Försök igen.";
    };
    rec.onend = () => mic.classList.remove("listening");
    try { rec.start(); } catch { /* redan igång */ }
  };
  $("#btnSkip").onclick = () => { if (!finished) finish(false, ""); };
  btnNext.onclick = next;
  next();
}

// =====================================================================
//  Verbböjning (spanska)
// =====================================================================
function runVerbsStart(deck) {
  titleEl.textContent = "Verbböjning";
  render("tpl-verbs-start", "verbs-start");
  goBack = deck.back; reopen = deck.back;
  let chosen = load("app.verbTenses", ["pres", "pret"]);
  const chips = $("#tenseChips");
  for (const [id, t] of Object.entries(VERB_TENSES)) {
    const c = el("button", "chip" + (chosen.includes(id) ? " active" : ""), t.name);
    c.title = t.sv;
    c.onclick = () => {
      chosen = chosen.includes(id) ? chosen.filter(x => x !== id) : [...chosen, id];
      if (!chosen.length) chosen = [id];
      chips.querySelectorAll(".chip").forEach((b, i) => b.classList.toggle("active", chosen.includes(Object.keys(VERB_TENSES)[i])));
      playClass(c, "pop");
      save("app.verbTenses", chosen);
    };
    chips.append(c);
  }
  $("#btnStartVerbs").onclick = () => runVerbs(deck, chosen);
}
function runVerbs(deck, tenses) {
  render("tpl-verbs", "verbs");
  goBack = deck.back; reopen = deck.back;
  setupAccents(view);
  stats.vbox = stats.vbox || {};
  const vbox = k => stats.vbox[k] || 0;
  // 10 frågor: verb, tid och person – de former du kan sämst kommer oftare
  const all = [];
  for (const [inf, sv] of VERBS) for (const t of tenses) for (let p = 0; p < 6; p++) all.push({ inf, sv, tense: t, p, key: `v:${inf}:${t}:${p}` });
  const picked = [], usedVerbs = new Set();
  for (const q of shuffle(all).sort((a, b) => vbox(a.key) - vbox(b.key))) {
    if (picked.length >= 10) break;
    if (usedVerbs.has(q.inf)) continue;
    usedVerbs.add(q.inf); picked.push(q);
  }
  const queue = picked.map(q => ({
    q, retry: false,
    item: {
      record: (ok, opt = {}) => {
        stats.vbox[q.key] = ok ? clampBox(vbox(q.key) + 1) : 0;
        return awardPractice(q.key, ok, stats.vbox[q.key], { ...opt, isCard: false, noBox: true, mode: "verbs" });
      }
    }
  }));
  const total = queue.length, sess = practiceSession();
  let right = 0, cur = null, answered = false, done = 0;
  const input = $("#answer"), feedback = $("#feedback"), btnNext = $("#btnNext"), card = view.querySelector(".card.static");

  function next() {
    if (!queue.length) return showDone(deck, `Du böjde ${right} av ${total} verb rätt.`, () => runVerbs(deck, tenses), right, total);
    cur = queue.shift(); answered = false;
    const { q } = cur;
    $("#verbTense").textContent = VERB_TENSES[q.tense].name;
    $("#verbInf").textContent = q.inf;
    $("#verbSv").textContent = q.sv;
    $("#verbPerson").textContent = "";
    $("#verbPerson").append(el("b", "", VERB_PERSONS[q.p].es), el("small", "", ` (${VERB_PERSONS[q.p].sv})`));
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    setPbar(done, total);
    input.value = ""; input.disabled = false;
    feedback.className = "feedback hidden";
    $("#verbTable").classList.add("hidden");
    btnNext.classList.add("hidden");
    playClass(card, "deal-in");
    input.focus();
  }
  function showTable(q) {
    const tb = $("#verbTable");
    tb.innerHTML = "";
    tb.append(el("div", "vt-title", `${q.inf} – ${VERB_TENSES[q.tense].name.toLowerCase()}`));
    VERB_PERSONS.forEach((p, i) => {
      const row = el("div", "vt-row" + (i === q.p ? " hl" : ""));
      row.append(el("span", "", p.es), el("b", "", conjugate(q.inf, q.tense, i)));
      tb.append(row);
    });
    tb.classList.remove("hidden");
    playClass(tb, "pop-in");
  }
  $("#writeForm").onsubmit = e => {
    e.preventDefault();
    if (answered) return next();
    answered = true;
    const { q } = cur, correct = conjugate(q.inf, q.tense, q.p);
    const given = input.value.trim().toLowerCase();
    input.disabled = true;
    if (given === correct) {
      if (!cur.retry) right++;
      done++;
      feedback.className = "feedback ok";
      feedback.textContent = `✓ Rätt! ${VERB_PERSONS[q.p].es.split(" / ")[0]} ${correct}`;
      playClass(card, "pop"); burst(card);
      sess.answer(cur.item, true, card, "verbs", cur.retry);
    } else {
      const almost = stripAccents(given) === stripAccents(correct);
      feedback.className = "feedback " + (almost ? "almost" : "no");
      feedback.textContent = almost ? `Nästan! Accenten gör skillnad: ${correct}` : `Rätt svar: ${correct}`;
      playClass(card, "shake");
      sess.answer(cur.item, false, card, "verbs", cur.retry);
      queue.splice(Math.min(3, queue.length), 0, { ...cur, retry: true });
    }
    speak(correct);
    setPbar(done, total);
    showTable(q);
    playClass(feedback, "pop-in");
    btnNext.classList.remove("hidden"); btnNext.focus();
  };
  btnNext.onclick = next;
  next();
}

// =====================================================================
//  Märken & statistik, med XP-kursen
// =====================================================================
const SV_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const SV_DAYS = ["sön", "mån", "tis", "ons", "tors", "fre", "lör"];
function dateLabel(d, withDay = false) { return (withDay ? SV_DAYS[d.getDay()] + " " : "") + d.getDate() + " " + SV_MONTHS[d.getMonth()]; }

// Siffror per dag, både totalt och per konfig.
// Dagar från innan konfig-uppdelningen fanns räknas till Spanska (eller den första konfigen).
function xpSeries(range) {
  const days = getDays(), keys = Object.keys(days).sort();
  let n = range === "all" ? 7 : Number(range);
  if (range === "all" && keys.length) {
    const first = new Date(keys[0] + "T12:00:00");
    n = Math.max(7, Math.round((Date.now() - first) / 86400000) + 1);
  }
  const legacy = (configs.find(c => c.id === "spanska") || configs[0]).id;
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const v = days[todayKey(d)] || {}, per = {};
    for (const [id, c] of Object.entries(v.c || {})) per[id] = { xp: c.xp || 0, n: c.n || 0, ms: c.ms || 0 };
    const sum = k => Object.values(per).reduce((t, c) => t + c[k], 0);
    const rest = { xp: Math.max(0, (v.xp || 0) - sum("xp")), n: Math.max(0, (v.n || 0) - sum("n")), ms: Math.max(0, (v.ms || 0) - sum("ms")) };
    if (rest.xp || rest.n || rest.ms) {
      const t = per[legacy] = per[legacy] || { xp: 0, n: 0, ms: 0 };
      t.xp += rest.xp; t.n += rest.n; t.ms += rest.ms;
    }
    out.push({ date: d, xp: v.xp || 0, n: v.n || 0, ms: v.ms || 0, per });
  }
  return out;
}

function showAch() {
  titleEl.textContent = "Märken";
  goBack = showHome; reopen = showAch;
  render("tpl-ach", "ach");
  let range = load("app.chartRange", "30");
  const chips = view.querySelectorAll(".tk-ranges .chip");
  chips.forEach(c => {
    c.classList.toggle("active", c.dataset.range === String(range));
    c.onclick = () => {
      range = c.dataset.range; save("app.chartRange", range);
      chips.forEach(x => x.classList.toggle("active", x === c));
      drawTicker(range);
    };
  });
  drawTicker(range);

  // Siffror
  const t = getTotals(), st = $("#achStats");
  const tiles = [
    ["🔥", currentStreak(), "dagar i rad nu"], ["🏆", Math.max(t.bestStreak, currentStreak()), "bästa streak"],
    ["📚", t.answers, "svar totalt"], ["✅", t.answers ? Math.round(100 * t.correct / t.answers) + " %" : "–", "rätt"],
    ["⚡", t.maxCombo, "bästa combo"], ["💯", t.perfect, "felfria rundor"]
  ];
  for (const [icon, val, label] of tiles) {
    const d = el("div", "ach-stat");
    d.append(el("span", "", icon), el("b", "", String(val)), el("small", "", label));
    st.append(d);
  }

  // Märken: upplåsta först
  const un = unlockedAch(), grid = $("#achGrid");
  $("#achCount").textContent = `${Object.keys(un).length} / ${ACHIEVEMENTS.length}`;
  const sorted = [...ACHIEVEMENTS].sort((a, b) => (un[b.id] ? 1 : 0) - (un[a.id] ? 1 : 0));
  sorted.forEach((a, i) => {
    const got = !!un[a.id];
    const d = el("div", "badge" + (got ? " got" : ""));
    d.style.setProperty("--i", i);
    d.append(el("span", "badge-icon", a.icon), el("b", "", a.name), el("small", "", a.desc));
    if (got) d.append(el("small", "badge-date", "✓ " + dateLabel(new Date(un[a.id]))));
    else {
      const v = Math.min(a.val(t), a.goal);
      const bar = el("div", "bar"), fill = el("i"); fill.style.width = Math.round(100 * v / a.goal) + "%"; bar.append(fill);
      d.append(bar, el("small", "badge-prog", `${v} / ${a.goal}`));
    }
    grid.append(d);
  });
}

// Aktie-liknande diagram över XP per dag – en färgad linje per konfig
let tkHidden = new Set();   // konfiger du har släckt i förklaringen
function drawTicker(range) {
  const data = xpSeries(range), box = $("#tkChart");
  const today = data[data.length - 1].xp, yest = data.length > 1 ? data[data.length - 2].xp : 0;
  $("#tkVal").textContent = today;
  const diff = today - yest, ch = $("#tkChange");
  ch.className = "tk-change " + (diff > 0 ? "up" : diff < 0 ? "down" : "flat");
  ch.textContent = (diff > 0 ? "▲ +" : diff < 0 ? "▼ " : "■ ") + diff + " XP" +
    (yest ? ` (${diff >= 0 ? "+" : ""}${Math.round(100 * diff / yest)} %)` : "") + " mot igår";

  // Vilka konfiger som syns: de som finns, plus de som har XP i perioden
  const series = configs.map(c => ({ c, color: cfgColor(c), total: data.reduce((t, p) => t + (p.per[c.id]?.xp || 0), 0) }));
  const shown = series.filter(s => !tkHidden.has(s.c.id));

  // Tabell (samma siffror utan diagram)
  const table = $("#tkTable");
  table.innerHTML = "<thead><tr><th>Dag</th><th>XP</th><th>Kort övade</th><th>Inlärda</th></tr></thead>";
  const tb = el("tbody");
  for (const p of [...data].reverse()) {
    const tr = el("tr");
    tr.append(el("td", "", dateLabel(p.date, true)), el("td", "", String(p.xp)), el("td", "", String(p.n)), el("td", "", String(p.ms)));
    tb.append(tr);
  }
  table.append(tb);

  // Förklaring: tryck för att visa/dölja en konfig
  const leg = $("#tkLegend");
  leg.innerHTML = "";
  if (series.length > 1) {
    for (const s of series) {
      const b = el("button", "tk-leg" + (tkHidden.has(s.c.id) ? " off" : ""));
      b.title = tkHidden.has(s.c.id) ? "Visa i diagrammet" : "Dölj i diagrammet";
      const dot = el("i"); dot.style.background = s.color;
      b.append(dot, el("span", "", `${s.c.icon || ""} ${s.c.name}`), el("small", "", `${s.total} XP`));
      b.onclick = () => { tkHidden.has(s.c.id) ? tkHidden.delete(s.c.id) : tkHidden.add(s.c.id); drawTicker(range); };
      leg.append(b);
    }
  }

  // SVG
  const W = Math.max(300, box.clientWidth || 340), H = 250, pl = 36, pr = 12, pt = 16, pb = 26;
  const max = Math.max(10, ...data.flatMap(p => shown.map(s => p.per[s.c.id]?.xp || 0)));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const x = i => pl + (data.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (data.length - 1));
  const y = v => pt + (H - pt - pb) * (1 - v / top);
  const ns = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const svg = mk("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": `XP per dag och konfig, senaste ${data.length} dagarna. Idag ${today} XP totalt.` });
  // rutnät och y-etiketter
  for (const v of [0, top / 4, top / 2, top * 3 / 4, top]) {
    svg.append(mk("line", { x1: pl, x2: W - pr, y1: y(v), y2: y(v), class: "tk-grid" + (v ? "" : " base") }));
    if (v === 0 || v === top / 2 || v === top) {
      const lab = mk("text", { x: pl - 6, y: y(v) + 4, class: "tk-axis", "text-anchor": "end" }); lab.textContent = Math.round(v); svg.append(lab);
    }
  }
  // x-etiketter: första, mitten, sista
  const idxs = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  for (const i of idxs) {
    const lab = mk("text", { x: x(i), y: H - 7, class: "tk-axis", "text-anchor": i === 0 ? "start" : i === data.length - 1 ? "end" : "middle" });
    lab.textContent = i === data.length - 1 ? "idag" : dateLabel(data[i].date); svg.append(lab);
  }
  const cross = mk("line", { y1: pt, y2: H - pb, class: "tk-cross", visibility: "hidden" });
  svg.append(cross);
  // En linje och en punkt per dag för varje konfig
  const r = data.length <= 31 ? 4 : data.length <= 92 ? 2.6 : 0;
  const lines = [], dotGroups = [];
  for (const s of shown) {
    const pts = data.map((p, i) => `${x(i).toFixed(1)},${y(p.per[s.c.id]?.xp || 0).toFixed(1)}`);
    if (shown.length === 1) {
      const gid = "tkGrad" + s.c.id.replace(/[^a-z0-9]/gi, "");
      const grad = mk("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(mk("stop", { offset: "0%", "stop-color": s.color, "stop-opacity": 0.25 }), mk("stop", { offset: "100%", "stop-color": s.color, "stop-opacity": 0 }));
      const defs = mk("defs", {}); defs.append(grad); svg.append(defs);
      svg.append(mk("path", { d: `M${x(0)},${y(0)} L${pts.join(" L")} L${x(data.length - 1)},${y(0)} Z`, fill: `url(#${gid})` }));
    }
    const line = mk("polyline", { points: pts.join(" "), fill: "none", stroke: s.color, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round", class: "tk-line" });
    svg.append(line); lines.push(line);
    const g = mk("g", {});
    if (r) data.forEach((p, i) => g.append(mk("circle", { cx: x(i), cy: y(p.per[s.c.id]?.xp || 0), r, fill: s.color, stroke: "var(--card)", "stroke-width": 1.5, class: "tk-pt" })));
    svg.append(g); dotGroups.push(g);
  }
  // Markerade punkter för vald dag
  const marks = shown.map(s => { const m = mk("circle", { r: 6.5, fill: s.color, stroke: "var(--card)", "stroke-width": 2.5, visibility: "hidden" }); svg.append(m); return m; });
  box.innerHTML = ""; box.append(svg);
  const tip = el("div", "tk-tip hidden"); box.append(tip);
  if (!shown.length) { const e = el("p", "muted center tk-empty", "Alla konfiger är dolda – tryck på en i listan under."); box.append(e); }

  let cur = data.length - 1;
  const showAt = i => {
    cur = Math.max(0, Math.min(data.length - 1, i));
    const p = data[cur];
    cross.setAttribute("x1", x(cur)); cross.setAttribute("x2", x(cur)); cross.setAttribute("visibility", "visible");
    shown.forEach((s, j) => { marks[j].setAttribute("cx", x(cur)); marks[j].setAttribute("cy", y(p.per[s.c.id]?.xp || 0)); marks[j].setAttribute("visibility", "visible"); });
    tip.textContent = "";
    tip.append(el("small", "tk-tip-day", dateLabel(p.date, true) + (cur === data.length - 1 ? " (idag)" : "")),
      el("b", "", `${p.xp} XP`), el("small", "", `${p.n} kort övade · ${p.ms} inlärda`));
    const rows = series.filter(s => p.per[s.c.id] && (p.per[s.c.id].xp || p.per[s.c.id].n));
    if (rows.length && series.length > 1) {
      const list = el("div", "tk-tip-rows");
      for (const s of rows) {
        const v = p.per[s.c.id], row = el("div", "tk-tip-row"), dot = el("i"); dot.style.background = s.color;
        row.append(dot, el("span", "", `${s.c.icon || ""} ${s.c.name}`), el("b", "", `${v.xp} XP`), el("small", "", `${v.n} kort${v.ms ? ` · ${v.ms} inlärda` : ""}`));
        list.append(row);
      }
      tip.append(list);
    }
    if (!p.n && !p.xp) tip.append(el("small", "", "Ingen övning den dagen"));
    tip.classList.remove("hidden");
    const rect = svg.getBoundingClientRect(), sx = rect.width / W, tw = tip.offsetWidth || 160;
    const px = x(cur) * sx;
    // Rutan hamnar bredvid punkten, så att fingret inte täcker den
    tip.style.left = Math.min(Math.max(px + (px > rect.width / 2 ? -tw / 2 - 18 : tw / 2 + 18), tw / 2), rect.width - tw / 2) + "px";
    tip.style.top = "4px";
  };
  const hide = () => { cross.setAttribute("visibility", "hidden"); marks.forEach(m => m.setAttribute("visibility", "hidden")); tip.classList.add("hidden"); };
  const idxAt = e => {
    const rect = svg.getBoundingClientRect(), px = (e.clientX - rect.left) * (W / rect.width);
    return Math.round((px - pl) / ((W - pl - pr) / Math.max(1, data.length - 1)));
  };
  // Mus: visa när du håller över. Finger/penna: håll in, dra för att byta dag.
  let holding = false, hideT = null;
  svg.addEventListener("pointerdown", e => {
    holding = true; clearTimeout(hideT);
    try { svg.setPointerCapture(e.pointerId); } catch { /* ignorera */ }
    showAt(idxAt(e));
    if (navigator.vibrate && e.pointerType === "touch") navigator.vibrate(8);
  });
  svg.addEventListener("pointermove", e => {
    if (holding || e.pointerType === "mouse") { clearTimeout(hideT); showAt(idxAt(e)); }
  });
  const release = e => {
    holding = false;
    clearTimeout(hideT);
    hideT = setTimeout(hide, e.pointerType === "mouse" ? 1500 : 3500);
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);
  svg.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !holding) hide(); });
  svg.addEventListener("contextmenu", e => e.preventDefault());
  svg.setAttribute("tabindex", 0);
  svg.addEventListener("focus", () => showAt(cur));
  svg.addEventListener("blur", hide);
  svg.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); showAt(cur - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); showAt(cur + 1); }
  });
  // linjerna ritas fram
  if (animOn()) lines.forEach(line => {
    if (!line.getTotalLength) return;
    const L = line.getTotalLength();
    line.style.strokeDasharray = L; line.style.strokeDashoffset = L;
    line.getBoundingClientRect();
    line.style.transition = "stroke-dashoffset 1s ease-out"; line.style.strokeDashoffset = 0;
  });
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
  if (typeof setupAccountSettings === "function") setupAccountSettings();
  const dark = $("#darkToggle");
  dark.checked = currentTheme() === "dark";
  dark.onchange = () => setTheme(dark.checked ? "dark" : "light");
  const goalIn = $("#goalInput");
  goalIn.value = getGoal();
  goalIn.onchange = () => {
    const num = Math.round(Number(goalIn.value));
    if (!num || num < 1 || num > 500) { goalIn.value = getGoal(); toast("Skriv ett tal mellan 1 och 500"); return; }
    save("app.goal", num); toast(`🎯 Nytt dagsmål: ${num} kort`);
  };
  const sr = $("#srToggle");
  sr.checked = srOn();
  sr.onchange = () => { save("app.sr", sr.checked ? "on" : "off"); toast(sr.checked ? "📅 Smart repetition på" : "Smart repetition av"); };
  const anim = $("#animToggle");
  anim.checked = animOn();
  anim.onchange = () => {
    document.documentElement.dataset.anim = anim.checked ? "on" : "off";
    save("app.anim", anim.checked ? "on" : "off");
    if (anim.checked) burst(anim.closest(".setting-row"), ["✨", "⭐", "🎉"], 10);
  };

  const c0 = cfg();
  $("#resetWhat").textContent = `Nollställer nivåerna och räknarna för ${c0.icon || ""} ${c0.name}.`;
  $("#btnReset").onclick = async () => {
    const yes = await confirmDialog({
      title: `Nollställa progress för ${c0.name}?`, icon: "🗑️", danger: true, ok: "Ja, nollställ", cancel: "Nej, behåll",
      text: "Alla kortens nivåer och räknarna (övade / fullt inlärda) börjar om från noll. Dina kort, din XP, din nivå, dina mynt och märken finns kvar. Det går inte att ångra."
    });
    if (!yes) return;
    progress = {}; save(lsKey("progress"), progress);
    stats = { studied: {}, mastered: {} }; save(lsKey("stats"), stats);
    cards.forEach(c => { c.box = 0; c.seen = 0; c.right = 0; c.wrong = 0; c.lastSeen = 0; });
    saveCards();
    toast("🗑️ Progressen är nollställd");
  };

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
  $("#cardDirBox").append(cardDirSwitch(id => toast(`🃏 Flashcards: ${CARD_DIRS.find(d => d[0] === id)[1]}`)));
  $("#memDelayBox").append(memDelaySlider());
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
    const decks = el("button", "config-edit-btn config-decks-btn", "🗂️"); decks.title = "Kortlekar i " + c.name;
    decks.onclick = () => { switchConfig(c.id); if (typeof showKortlekar === "function") showKortlekar(); };
    li.append(pick, decks, edit);
    ul.append(li);
  }
}
function switchConfig(id) {
  closeDrawer();
  if (id === activeId) { showHome(); return; }
  activeId = id; save("app.active", id);
  loadConfigData();
  loadStats();
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
    $("#cfgColor").value = cfgColor(existing);
    setType(existing.type || "language");
    // Typen och språket kan inte ändras när det redan finns kort (de skulle bli fel)
    if ((load(keyFor(existing.id, "cards"), []) || []).length) {
      view.querySelectorAll('input[name="cfgType"]').forEach(r => r.disabled = true);
      lang.disabled = true;
      $("#cfgLocked").classList.remove("hidden");
    }
    if (configs.length > 1) $("#btnDeleteCfg").classList.remove("hidden");
  } else {
    setType("language");
    $("#cfgColor").value = CFG_COLORS.find(col => !configs.some(c => cfgColor(c) === col)) || CFG_COLORS[configs.length % CFG_COLORS.length];
  }
  // Färgrutor att välja bland
  const sw = $("#cfgSwatches"), colorIn = $("#cfgColor");
  const markSw = () => sw.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.c.toLowerCase() === colorIn.value.toLowerCase()));
  for (const col of CFG_COLORS) {
    const b = el("button", "swatch"); b.type = "button"; b.dataset.c = col; b.style.background = col; b.title = col;
    b.onclick = () => { colorIn.value = col; markSw(); };
    sw.append(b);
  }
  // Ikoner att välja bland
  // Flaggor (ritas som bilder, se FLAG_SVG) och ämnesikoner
  const CFG_ICONS = ["🇸🇪", "🇪🇸", "🇬🇧", "🇫🇷", "🇩🇪", "🇮🇹",
    "⚖️", "💼", "📊", "💰", "🏛️", "🌍", "🧪", "🔬", "🧮", "📐", "💻", "🧠", "🩺", "🎨", "🎵", "⚽", "📚", "📘", "📝", "🗣️", "🎓", "🌱", "⭐", "🚀"];
  const iconBox = $("#cfgIcons");
  const markIcon = () => iconBox.querySelectorAll(".cfg-icon-opt").forEach(b => b.classList.toggle("on", b.dataset.emoji === icon.value.trim()));
  for (const ic of CFG_ICONS) {
    const b = el("button", "cfg-icon-opt", ic); b.type = "button"; b.dataset.emoji = ic;
    b.onclick = () => { icon.value = ic; markIcon(); playClass(b, "pop"); };
    iconBox.append(b);
  }
  icon.addEventListener("input", markIcon);
  // Konfigens färg används som ring när du håller över ett val
  const section = view.querySelector(".config-edit");
  const paintRing = () => section.style.setProperty("--cfgc", colorIn.value);
  colorIn.oninput = () => { markSw(); paintRing(); };
  sw.addEventListener("click", paintRing);
  markSw(); paintRing();
  setTimeout(markIcon, 0);

  // Föreslå namn och ikon när man väljer språk
  const FLAGS = { es: "🇪🇸", en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", it: "🇮🇹", pt: "🇵🇹" };
  lang.onchange = () => {
    if (!name.value || Object.values(LANGS).some(l => l.name === name.value)) name.value = LANGS[lang.value].name;
    if (!icon.value || Object.values(FLAGS).includes(icon.value)) icon.value = FLAGS[lang.value];
    view.querySelectorAll(".cfg-icon-opt").forEach(b => b.classList.toggle("on", b.dataset.emoji === icon.value.trim()));
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
      back: type === "subject" ? (back.value.trim() || "Förklaring") : undefined,
      color: $("#cfgColor").value
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
    for (const base of ["cards", "progress", "hidden", "filter", "sort", "dir", "importDraft", "cats", "listCat", "stats"]) {
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


// =====================================================================
//  Flaggor som bilder
// =====================================================================
// Windows kan inte visa flagg-emojis (där blir de bokstäver som "ES"). Därför byts de sex
// flaggorna appen använder ut mot små ritade flaggor, var de än står på sidan.
const FLAG_SVG = {
  SE: ["Sverige", '<svg viewBox="0 0 16 10"><rect width="16" height="10" fill="#006aa7"/><rect x="5" width="2" height="10" fill="#fecc02"/><rect y="4" width="16" height="2" fill="#fecc02"/></svg>'],
  ES: ["Spanien", '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#c60b1e"/><rect y=".5" width="3" height="1" fill="#ffc400"/></svg>'],
  GB: ["Storbritannien", '<svg viewBox="0 0 60 30"><clipPath id="ukc"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" clip-path="url(#ukc)" stroke="#c8102e" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>'],
  FR: ["Frankrike", '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ed2939"/></svg>'],
  DE: ["Tyskland", '<svg viewBox="0 0 5 3"><rect width="5" height="1" fill="#000"/><rect y="1" width="5" height="1" fill="#dd0000"/><rect y="2" width="5" height="1" fill="#ffce00"/></svg>'],
  IT: ["Italien", '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>']
};
const FLAG_RE = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/g, FLAG_TEST = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/;
function flagCode(emoji) { return [...emoji].map(ch => String.fromCharCode(ch.codePointAt(0) - 0x1F1E6 + 65)).join(""); }
function flagSpan(code) {
  const f = FLAG_SVG[code], s = document.createElement("span");
  s.className = "flag-ic"; s.setAttribute("role", "img"); s.setAttribute("aria-label", f[0]); s.title = f[0];
  s.innerHTML = f[1];
  return s;
}
function replaceFlags(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => FLAG_TEST.test(n.nodeValue) && !n.parentElement?.closest("script, style, textarea, title")
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const txt = n.nodeValue, frag = document.createDocumentFragment();
    let last = 0;
    for (const m of txt.matchAll(FLAG_RE)) {
      const code = flagCode(m[0]);
      if (!FLAG_SVG[code]) continue;
      frag.append(txt.slice(last, m.index), flagSpan(code));
      last = m.index + m[0].length;
    }
    if (!last) continue;
    frag.append(txt.slice(last));
    n.replaceWith(frag);
  }
}
(function watchFlags() {
  let queued = false;
  const run = () => { queued = false; replaceFlags(document.body); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  run();
})();