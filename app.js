"use strict";

// ---------- Lagring ----------
const LS_PROGRESS = "spanska.progress";
const LS_MYWORDS = "spanska.mywords";
const LS_SVFIRST = "spanska.svFirst";
const MAX_BOX = 5;          // Box 0 = nytt/svårt, box 5 = kan det väl
const SESSION_SIZE = 10;

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked */ }
}

let progress = load(LS_PROGRESS, {});

function getBox(deckId, es) { return (progress[deckId] && progress[deckId][es]) || 0; }
function setBox(deckId, es, box) {
  progress[deckId] = progress[deckId] || {};
  progress[deckId][es] = Math.max(0, Math.min(MAX_BOX, box));
  save(LS_PROGRESS, progress);
}

// ---------- Lekar ----------
function parseMyWords(text) {
  return text.split(/\r?\n/)
    .map(line => line.split("="))
    .filter(parts => parts.length >= 2 && parts[0].trim() && parts[1].trim())
    .map(parts => [parts[0].trim(), parts.slice(1).join("=").trim()]);
}
function allDecks() {
  const decks = [...BUILTIN_DECKS];
  const mine = parseMyWords(load(LS_MYWORDS, ""));
  if (mine.length) decks.unshift({ id: "mina", name: "✏️ Mina glosor", words: mine });
  return decks;
}
function deckById(id) { return allDecks().find(d => d.id === id); }
function deckStats(deck) {
  const learned = deck.words.filter(([es]) => getBox(deck.id, es) >= 3).length;
  return { learned, total: deck.words.length };
}

// ---------- Uttal ----------
let esVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  esVoice = voices.find(v => v.lang === "es-ES") || voices.find(v => v.lang.startsWith("es")) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
function speak(text) {
  if (!("speechSynthesis" in window)) { alertMsg("Uppläsning stöds inte i den här webbläsaren."); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace("…", ""));
  u.lang = "es-ES";
  if (esVoice) u.voice = esVoice;
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

// ---------- Rättning ----------
function normalize(s) {
  return s.toLowerCase().replace(/[¿¡?!.,;:…"']/g, "").replace(/\s+/g, " ").trim();
}
function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
// Returnerar "ok", "almost" (bara accent fel) eller "no"
function check(input, correct) {
  const alternatives = correct.split("/").map(normalize).concat(normalize(correct));
  const given = normalize(input);
  if (!given) return "no";
  if (alternatives.includes(given)) return "ok";
  if (alternatives.map(stripAccents).includes(stripAccents(given))) return "almost";
  return "no";
}

// ---------- Vyer ----------
const view = document.getElementById("view");
const title = document.getElementById("title");
let current = { deckId: null, mode: null };

function render(tplId) {
  view.innerHTML = "";
  view.appendChild(document.getElementById(tplId).content.cloneNode(true));
  view.scrollTop = 0;
  return view;
}
function $(sel) { return view.querySelector(sel); }
function alertMsg(text) { console.warn(text); }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Välj de ord som behöver övas mest (lägst box först)
function buildSession(deck) {
  return shuffle(deck.words)
    .sort((a, b) => getBox(deck.id, a[0]) - getBox(deck.id, b[0]))
    .slice(0, SESSION_SIZE);
}

function showHome() {
  title.textContent = "¡Hola! Spanska";
  render("tpl-home");
  const list = $("#deckList");
  for (const deck of allDecks()) {
    const { learned, total } = deckStats(deck);
    const btn = document.createElement("button");
    btn.className = "deck-btn";
    btn.innerHTML = `<b></b><span class="muted">${learned} av ${total} kan du</span>
      <div class="bar"><i style="width:${total ? (100 * learned / total) : 0}%"></i></div>`;
    btn.querySelector("b").textContent = deck.name;
    btn.onclick = () => showDeck(deck.id);
    list.appendChild(btn);
  }
  $("#btnMyWords").onclick = showMyWords;
  $("#btnReset").onclick = () => {
    if (confirm("Vill du nollställa all progress?")) { progress = {}; save(LS_PROGRESS, progress); showHome(); }
  };
}

function showDeck(deckId) {
  const deck = deckById(deckId);
  if (!deck) return showHome();
  current.deckId = deckId;
  title.textContent = deck.name.replace("✏️ ", "");
  render("tpl-deck");
  $("#deckName").textContent = deck.name;
  const { learned, total } = deckStats(deck);
  $("#deckStats").textContent = `${total} glosor · ${learned} kan du`;
  const toggle = $("#dirToggle");
  toggle.checked = load(LS_SVFIRST, false);
  toggle.onchange = () => save(LS_SVFIRST, toggle.checked);
  view.querySelectorAll(".mode").forEach(b => {
    b.onclick = () => {
      current.mode = b.dataset.mode;
      if (current.mode === "cards") runCards(deck);
      else if (current.mode === "write") runWrite(deck);
      else showList(deck);
    };
  });
}

function showDone(deck, text) {
  render("tpl-done");
  $("#doneText").textContent = text;
  $("#btnAgain").onclick = () => current.mode === "cards" ? runCards(deck) : runWrite(deck);
  $("#btnBack").onclick = () => showDeck(deck.id);
}

// Flashcards
function runCards(deck) {
  render("tpl-cards");
  const svFirst = load(LS_SVFIRST, false);
  const queue = buildSession(deck);
  const total = queue.length;
  let right = 0, word = null, flipped = false;

  const card = $("#card"), front = $("#cardFront"), back = $("#cardBack");
  function next() {
    if (!queue.length) return showDone(deck, `Du kunde ${right} av ${total} på första försöket.`);
    word = queue.shift();
    flipped = false;
    const [es, sv] = word;
    front.textContent = svFirst ? sv : es;
    back.textContent = svFirst ? es : sv;
    back.classList.add("hidden");
    $("#answerRow").classList.add("hidden");
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    if (!svFirst) speak(es);
  }
  function flip() {
    if (flipped) return;
    flipped = true;
    back.classList.remove("hidden");
    $("#answerRow").classList.remove("hidden");
    if (svFirst) speak(word[0]);
  }
  card.onclick = flip;
  card.onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
  $("#btnSpeak").onclick = () => speak(word[0]);
  $("#btnRight").onclick = () => {
    if (!word.retry) right++;
    setBox(deck.id, word[0], getBox(deck.id, word[0]) + 1);
    next();
  };
  $("#btnWrong").onclick = () => {
    setBox(deck.id, word[0], 0);
    const again = [...word]; again.retry = true;
    queue.splice(Math.min(3, queue.length), 0, again);   // kommer tillbaka snart
    next();
  };
  next();
}

// Skrivförhör
function runWrite(deck) {
  render("tpl-write");
  const queue = buildSession(deck);
  const total = queue.length;
  let right = 0, word = null, answered = false;
  const input = $("#answer"), feedback = $("#feedback"), btnNext = $("#btnNext");

  view.querySelectorAll(".accents button").forEach(b => {
    b.onclick = () => {
      const pos = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, pos) + b.dataset.ch + input.value.slice(input.selectionEnd ?? pos);
      input.focus();
      input.setSelectionRange(pos + 1, pos + 1);
    };
  });

  function next() {
    if (!queue.length) return showDone(deck, `Du hade ${right} av ${total} rätt på första försöket.`);
    word = queue.shift();
    answered = false;
    $("#prompt").textContent = word[1];
    $("#progress").textContent = `${total - queue.length} / ${total}`;
    input.value = "";
    input.disabled = false;
    feedback.className = "feedback hidden";
    btnNext.classList.add("hidden");
    input.focus();
  }

  $("#writeForm").onsubmit = e => {
    e.preventDefault();
    if (answered) return next();
    answered = true;
    const result = check(input.value, word[0]);
    input.disabled = true;
    const box = getBox(deck.id, word[0]);
    if (result === "ok" || result === "almost") {
      if (!word.retry) right++;
      setBox(deck.id, word[0], box + 1);
      feedback.className = "feedback " + result;
      feedback.textContent = result === "ok" ? `✓ Rätt! ${word[0]}` : `Nästan! Tänk på accenten: ${word[0]}`;
    } else {
      setBox(deck.id, word[0], 0);
      const again = [...word]; again.retry = true;
      queue.splice(Math.min(3, queue.length), 0, again);
      feedback.className = "feedback no";
      feedback.textContent = `Rätt svar: ${word[0]}`;
    }
    speak(word[0]);
    btnNext.classList.remove("hidden");
    btnNext.focus();
  };
  btnNext.onclick = next;
  next();
}

// Ordlista
function showList(deck) {
  render("tpl-list");
  const ul = $("#wordList");
  for (const [es, sv] of deck.words) {
    const li = document.createElement("li");
    li.innerHTML = `<button title="Lyssna">🔊</button><span class="es"></span><span class="sv"></span><span class="box"></span>`;
    li.querySelector(".es").textContent = es;
    li.querySelector(".sv").textContent = sv;
    li.querySelector(".box").textContent = "★".repeat(getBox(deck.id, es));
    li.querySelector("button").onclick = () => speak(es);
    ul.appendChild(li);
  }
}

// Mina glosor
function showMyWords() {
  title.textContent = "Mina glosor";
  render("tpl-mywords");
  const ta = $("#myText");
  ta.value = load(LS_MYWORDS, "");
  const info = () => { $("#mySaved").textContent = `${parseMyWords(ta.value).length} glosor hittade.`; };
  info();
  ta.oninput = info;
  $("#btnSaveMy").onclick = () => {
    save(LS_MYWORDS, ta.value);
    $("#mySaved").textContent = `Sparat! ${parseMyWords(ta.value).length} glosor.`;
  };
}

// ---------- Topplist-knappar ----------
document.getElementById("btnHome").onclick = () => {
  speechSynthesis?.cancel?.();
  if (current.mode && current.deckId && view.querySelector(".cards, .write, .list, .done")) {
    current.mode = null; showDeck(current.deckId);
  } else { current.deckId = null; showHome(); }
};
document.getElementById("btnFull").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
};

// ---------- PWA ----------
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service worker:", err));
}

showHome();
