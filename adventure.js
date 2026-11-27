"use strict";
// =====================================================================
//  Äventyr – en stig med delar, lektioner, kistor och kontrollpunkter.
//  Man måste klara alla övningar i en lektion (fel kommer tillbaka tills
//  de sitter) innan nästa nivå låses upp.
// =====================================================================

const ADV_LESSON_SIZE = 5;
const ADV_COLORS = [
  { c: "#2fb344", d: "#23862f" }, { c: "#8b5cf6", d: "#6a3fd0" }, { c: "#1c9be6", d: "#1574ad" },
  { c: "#f0883e", d: "#c46420" }, { c: "#e0479e", d: "#b0307a" }, { c: "#14b8a6", d: "#0e8a7c" }
];
const ADV_OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];
const ADV_MASCOTS = ["🦎", "🐂", "🌵", "🦜", "🐙", "🦊"];
// Beröm och hejarop kommer från phr() i app.js – på konfigens språk, eller svenska för ämnen
const ADV_UNIT_DESC = {
  "Grundord": "Vardagsfraser, mat, pengar och vanliga verb",
  "Spanska steg 3": "Arbete, resor, samhälle, åsikter, preteritum och studier"
};

// Fler märken för äventyret
ACHIEVEMENTS.push(
  { id: "adv1", icon: "🗺️", name: "Äventyrare", desc: "Klara 5 lektioner i Äventyr", goal: 5, val: t => t.advLessons || 0 },
  { id: "adv25", icon: "🧭", name: "Upptäcktsresande", desc: "Klara 25 lektioner i Äventyr", goal: 25, val: t => t.advLessons || 0 },
  { id: "advCheck", icon: "🏰", name: "Kontrollpunkt", desc: "Klara en kontrollpunkt i Äventyr", goal: 1, val: t => t.advChecks || 0 }
);

function advState() { return load(lsKey("adv"), {}) || {}; }
function advSave(st) { save(lsKey("adv"), st); }
function advAudioOn() { return load("app.advAudio", "on") !== "off" && isLanguage() && "speechSynthesis" in window; }
function advMicOn() { return load("app.advMic", "on") !== "off" && isLanguage() && !!speechRecognitionClass(); }

// Bonus-XP (lektion klar, kistor): räknas in i dagens XP men inte som ett svar
function addBonusXP(n) {
  const days = getDays(), k = todayKey(), d = days[k] || { n: 0, xp: 0 };
  d.xp += n; addDayCfg(d, { xp: n }); days[k] = d; save("app.days", days);
  const lvl = addXP(n);
  if (lvl) {
    toast(`⭐ Ny nivå: ${lvl}!`);
    setTimeout(() => burst({ x: innerWidth / 2, y: innerHeight / 3 }, ["⭐", "🌟", "✨", "🎊"], 22), 300);
  }
  announceAch(checkAchievements());
}

// ---------- Bygg stigen ----------
function advChunks(items) {
  const out = [];
  for (let i = 0; i < items.length; i += ADV_LESSON_SIZE) out.push(items.slice(i, i + ADV_LESSON_SIZE));
  if (out.length > 1 && out[out.length - 1].length < 3) { const last = out.pop(); out[out.length - 1].push(...last); }
  return out;
}
function advUnits() {
  const units = [];
  const make = (key, title, desc, groups) => {
    const u = { key, idx: units.length, title, desc, color: ADV_COLORS[units.length % ADV_COLORS.length],
      mascot: ADV_MASCOTS[units.length % ADV_MASCOTS.length], nodes: [] };
    let lessons = 0;
    for (const g of groups) {
      u.nodes.push({ type: "label", text: g.label, words: g.items, idBase: g.idBase, catId: g.catId || null });
      if (!g.items.length) { u.nodes.push({ type: "empty", id: g.idBase + ":empty", group: g }); continue; }
      const chunks = advChunks(g.items);
      chunks.forEach((words, k) => {
        u.nodes.push({ type: "lesson", id: `${g.idBase}:L${k + 1}`, words, title: g.label, no: k + 1, of: chunks.length });
        lessons++;
        if (lessons % 3 === 0) u.nodes.push({ type: "chest", id: `${g.idBase}:C${k + 1}` });
      });
    }
    u.words = u.nodes.filter(n => n.type === "lesson").flatMap(n => n.words);
    if (u.nodes.filter(n => n.type === "lesson").length >= 2) {
      u.nodes.push({ type: "check", id: `u:${key}:check`, words: u.words, title: `Kontrollpunkt – ${title}` });
    }
    units.push(u);
  };
  if (hasBuiltinDecks()) {
    const groups = {};
    for (const d of BUILTIN_DECKS) (groups[d.group || "Grundord"] ||= []).push(d);
    for (const [g, decks] of Object.entries(groups)) {
      make("d:" + g, g, ADV_UNIT_DESC[g] || "Färdiga ord",
        decks.map(d => ({ label: d.name, items: builtinDeck(d).items, idBase: "d:" + d.id })));
    }
  }
  const ready = c => c.sv && c.es;
  const sorted = [...cards].sort((a, b) => a.created - b.created);
  for (const m of mainCats()) {
    const subs = subCats(m.id), groups = [];
    const direct = sorted.filter(c => c.cat === m.id && ready(c));
    if (direct.length || !subs.length) groups.push({ label: m.name, items: myCardsDeck(direct).items, idBase: "cat:" + m.id, catId: m.id });
    for (const sc of subs) {
      groups.push({ label: sc.name, items: myCardsDeck(sorted.filter(c => c.cat === sc.id && ready(c))).items, idBase: "cat:" + sc.id, catId: sc.id });
    }
    make("cat:" + m.id, m.name, "Dina egna kort", groups);
  }
  const loose = sorted.filter(c => ready(c) && (!c.cat || !catById(c.cat)));
  if (loose.length) make("mina", "Mina kort", "Kort utan kategori", [{ label: "Mina kort", items: myCardsDeck(loose).items, idBase: "mina" }]);
  return units;
}
// Räknar ut vilka noder som är klara, öppna och låsta
function advStatus(units) {
  const st = advState();
  let open = true, current = null;
  for (const u of units) {
    u.locked = false;
    let first = true;
    for (const n of u.nodes) {
      if (n.type === "label") continue;
      if (n.type === "empty") { n.state = "empty"; continue; }
      const done = !!st[n.id]?.done;
      n.state = done ? "done" : open ? "open" : "locked";
      if (first) { u.locked = n.state === "locked"; first = false; }
      if (n.type !== "chest" && !done) {
        if (open && !current) current = n;
        open = false;
      }
    }
  }
  return current;
}

// ---------- Stigen ----------
let advBack = null;
function showAdventure(opts = {}) {
  if (opts.back) advBack = opts.back;
  titleEl.textContent = "Äventyr";
  goBack = advBack || showHome; reopen = () => showAdventure();
  render("tpl-adv", "adv");
  document.body.classList.add("adv-bg");
  const units = advUnits(), current = advStatus(units);

  // Statusrad: streak, nivå, XP och dagens mål
  const xp = getXP(), lvl = levelFromXP(xp), lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1);
  $("#advStreak").textContent = currentStreak();
  view.querySelector(".adv-stat.streak").classList.toggle("cold", todayCount() === 0);
  $("#advLevel").textContent = lvl;
  $("#advXP").textContent = xp;
  $("#advXPBar").style.width = Math.round(100 * (xp - lo) / (hi - lo)) + "%";
  $("#advGoal").textContent = `${Math.min(todayCount(), getGoal())}/${getGoal()}`;

  const path = $("#advPath");
  if (!units.length) {
    path.append(el("p", "muted center", "Lägg till kort i Mina kort, så blir det lektioner här."));
    return;
  }
  let nodeIdx = 0;
  for (const u of units) {
    const sec = el("section", "adv-unit" + (u.locked ? " locked" : ""));
    sec.style.setProperty("--c", u.color.c); sec.style.setProperty("--cd", u.color.d);
    // Banner för delen
    const ban = el("div", "adv-banner");
    const bt = el("div", "adv-banner-text");
    bt.append(el("small", "", `DEL ${u.idx + 1}`), el("b", "", u.title), el("span", "", u.desc));
    ban.append(bt);
    if (u.locked) {
      const jump = el("button", "adv-jump", "⏩ Hoppa hit");
      jump.title = "Gör ett test på det du hoppar över";
      jump.onclick = () => runAdvLesson({ type: "jump", id: "jump:" + u.key, unit: u, units }, u);
      ban.append(jump);
    } else ban.append(el("span", "adv-banner-icon", u.mascot));
    sec.append(ban);

    const col = el("div", "adv-path-col");
    let i = 0, mascotPlaced = false;
    for (const n of u.nodes) {
      if (n.type === "label") {
        // Kapitelnamnet är också en knapp för att repetera hela kapitlet
        const st = advState();
        const started = n.words.length && u.nodes.some(x => x.type === "lesson" && x.id.startsWith(n.idBase + ":L") && st[x.id]?.done);
        const lab = el("button", "adv-label" + (started ? " can-repeat" : ""));
        lab.append(el("span", "", n.text));
        if (started) lab.append(el("span", "adv-label-rep", "🔁 Repetera"));
        lab.title = started ? `Repetera alla ${n.words.length} begrepp i ${n.text}` : "Klara minst en lektion i kapitlet för att kunna repetera det";
        lab.onclick = e => {
          e.stopPropagation();
          if (!started) { toast(n.words.length ? "🔒 Klara minst en lektion i kapitlet först" : "Inga kort i kapitlet än"); playClass(lab, "shake"); return; }
          runChapterReview(n, u);
        };
        col.append(lab);
        continue;
      }
      const wrap = el("div", "adv-node-wrap");
      const off = ADV_OFFSETS[i % ADV_OFFSETS.length];
      wrap.style.setProperty("--x", off + "px");
      wrap.style.setProperty("--i", nodeIdx++);
      const btn = el("button", `adv-node ${n.type} ${n.state}`);
      btn.dataset.id = n.id;
      const icon = n.type === "chest" ? (n.state === "done" ? "📭" : "🎁")
        : n.type === "check" ? "🏆" : n.type === "empty" ? "＋"
        : n.state === "done" ? "✓" : n.state === "locked" ? "🔒" : "★";
      btn.append(el("span", "adv-node-icon", icon));
      btn.setAttribute("aria-label", nodeLabel(n));
      if (n === current) {
        btn.classList.add("current");
        const bub = el("div", "adv-bubble", st0(n) ? "REPETERA" : "BÖRJA");
        wrap.append(bub);
      }
      btn.onclick = e => { e.stopPropagation(); openNodePop(wrap, n, u, units); };
      wrap.append(btn);
      // En figur bredvid stigen, på motsatt sida
      if (!mascotPlaced && i === 2) {
        const m = el("div", "adv-mascot" + (off >= 0 ? " left" : " right"));
        const fig = typeof mascotEl === "function"
          ? mascotEl(["wave", "happy", "love", "proud", "celebrate", "idle"][u.idx % 6], "path-fig")
          : el("span", "adv-mascot-fig", u.mascot);
        const cheers = phr("cheer");
        m.append(el("span", "adv-mascot-say", cheers[(u.idx + 2) % cheers.length]), fig);
        wrap.append(m);
        mascotPlaced = true;
      }
      col.append(wrap);
      i++;
    }
    sec.append(col);
    path.append(sec);
  }
  view.onclick = e => { if (!e.target.closest(".adv-pop")) closeNodePops(); };

  // Scrolla till där du är, och animera det du nyss klarade
  const curBtn = current && view.querySelector(`.adv-node[data-id="${CSS.escape(current.id)}"]`);
  requestAnimationFrame(() => {
    curBtn?.scrollIntoView({ block: "center", behavior: animOn() && opts.justDone ? "smooth" : "auto" });
    if (opts.justDone) {
      const doneBtn = view.querySelector(`.adv-node[data-id="${CSS.escape(opts.justDone)}"]`);
      setTimeout(() => {
        if (doneBtn) { playClass(doneBtn, "pop"); burst(doneBtn, ["⭐", "✨", "💛"], 10); }
        if (curBtn && curBtn !== doneBtn) {
          setTimeout(() => { playClass(curBtn, "unlock"); burst(curBtn, ["🔓", "✨", "⭐"], 12); toast("🔓 Ny nivå upplåst!"); }, 650);
        }
      }, 350);
    }
  });
}
function st0(n) { return !!advState()[n.id]?.done; }
function nodeLabel(n) {
  if (n.type === "chest") return "Skattkista";
  if (n.type === "check") return n.title;
  if (n.type === "empty") return `${n.group.label}: inga kort än`;
  return `${n.title}, lektion ${n.no} av ${n.of}`;
}

function closeNodePops() {
  view.querySelectorAll(".adv-pop").forEach(p => p.remove());
  view.querySelectorAll(".adv-node-wrap.popped").forEach(w => w.classList.remove("popped"));
}
function openNodePop(wrap, n, u, units) {
  closeNodePops();
  wrap.classList.add("popped");   // över noderna nedanför
  const pop = el("div", "adv-pop " + n.state);
  const add = (cls, text) => { const e = el("div", cls, text); pop.append(e); return e; };
  if (n.type === "empty") {
    add("adv-pop-title", n.group.label);
    add("adv-pop-sub", "Inga kort här än. Lägg till ord i den här kategorin så blir det lektioner.");
    const b = el("button", "adv-btn", "LÄGG TILL ORD");
    b.onclick = () => { listCat = n.group.catId || "all"; save(lsKey("listCat"), listCat); showMyCards(); };
    pop.append(b);
  } else if (n.state === "locked") {
    add("adv-pop-title", n.type === "chest" ? "Skattkista" : n.type === "check" ? n.title : `${n.title}`);
    add("adv-pop-sub", n.type === "lesson" ? `Lektion ${n.no} av ${n.of} · Klara nivåerna innan för att låsa upp` : "Klara nivåerna innan för att låsa upp");
    const b = el("button", "adv-btn locked", "🔒 LÅST"); b.disabled = true; pop.append(b);
  } else if (n.type === "chest") {
    add("adv-pop-title", n.state === "done" ? "Kistan är öppnad" : "Skattkista!");
    add("adv-pop-sub", n.state === "done" ? "Du har redan tagit skatten." : "Öppna den för att få bonus-XP.");
    if (n.state !== "done") {
      const b = el("button", "adv-btn", "ÖPPNA");
      b.onclick = e => { e.stopPropagation(); openChest(wrap, n); };
      pop.append(b);
    }
  } else {
    const done = n.state === "done";
    add("adv-pop-title", n.type === "check" ? n.title : n.title);
    add("adv-pop-sub", n.type === "check"
      ? `${Math.min(10, n.words.length)} ord från hela delen · klara alla för att ta dig vidare`
      : `Lektion ${n.no} av ${n.of} · ${n.words.length} ord: ` + n.words.map(w => isLanguage() ? w.es : w.sv).join(", "));
    const b = el("button", "adv-btn", done ? "REPETERA +XP" : n.type === "check" ? "STARTA TESTET" : "STARTA +10 XP");
    b.onclick = e => { e.stopPropagation(); runAdvLesson(n, u); };
    pop.append(b);
  }
  wrap.append(pop);
  playClass(pop, "pop-in");
}

function openChest(wrap, n) {
  const btn = wrap.querySelector(".adv-node");
  const st = advState(); st[n.id] = { done: true, ts: Date.now() }; advSave(st);
  const amount = 10 + Math.floor(Math.random() * 4) * 5;   // 10–25 XP
  closeNodePops();
  playClass(btn, "shake");
  setTimeout(() => {
    btn.querySelector(".adv-node-icon").textContent = "📭";
    btn.classList.remove("open"); btn.classList.add("done");
    playClass(btn, "pop");
    burst(btn, ["💎", "🪙", "✨", "⭐"], 16);
    const coins = typeof earnCoins === "function" ? earnCoins(amount) : 0;
    floatText(`+${amount} XP` + (coins ? `  +${coins} 🪙` : ""), btn, "big");
    addBonusXP(amount);
    toast(`🎁 Skatt! +${amount} XP` + (coins ? ` och ${coins} 🪙` : ""));
    if (typeof refreshMascotBits === "function") refreshMascotBits();
  }, animOn() ? 420 : 0);
}

// =====================================================================
//  Lektionen
// =====================================================================
function advPool() {
  const pool = [];
  for (const u of advUnits()) for (const w of u.words) pool.push({ sv: w.sv, es: w.es });
  for (const c of cards) if (c.sv && c.es) pool.push({ sv: c.sv, es: c.es });
  return pool;
}
// Övningar: först känna igen (flerval/lyssna), sen para ihop, sen själv ta fram ordet (skriv/prata/ordbank)
function advPlan(node) {
  const lang = isLanguage(), rnd = a => a[Math.floor(Math.random() * a.length)];
  const prod = w => {
    let t = lang ? rnd(["pickRev", "type", "type", "speak", "listenType", "bank"]) : rnd(["pickRev", "type"]);
    if (t === "bank" && wordCount(w.es) < 2) t = "type";
    if (lang && t === "type" && wordCount(w.es) >= 3) t = "bank";
    if (!lang && t === "type" && wordCount(w.sv) > 3) t = "pickRev";
    return t;
  };
  if (node.type === "lesson") {
    const words = node.words;
    const ex = shuffle(words).map(w => ({ t: lang ? rnd(["pick", "listen"]) : "pick", w }));
    if (words.length >= 3) ex.push({ t: "match", words: shuffle(words).slice(0, 5) });
    ex.push(...shuffle(words).map(w => ({ t: prod(w), w })));
    // undvik samma ord två gånger i rad
    for (let i = 1; i < ex.length; i++) if (ex[i].w && ex[i].w === ex[i - 1].w && i + 1 < ex.length) [ex[i], ex[i + 1]] = [ex[i + 1], ex[i]];
    return ex;
  }
  // Kontrollpunkt och hoppa-hit-test: 10 ord, ett produktionsprov per ord
  let words = node.words || [];
  if (node.type === "jump") {
    const st = advState();
    words = node.units.slice(0, node.unit.idx).flatMap(u => u.nodes.filter(n => n.type === "lesson" && !st[n.id]?.done).flatMap(n => n.words));
    if (!words.length) words = node.units.slice(0, node.unit.idx).flatMap(u => u.words);
  }
  const sample = shuffle(words).slice(0, 10);
  const ex = sample.map(w => ({ t: prod(w), w }));
  if (node.type === "check" && sample.length >= 4) ex.splice(Math.floor(ex.length / 2), 0, { t: "match", words: sample.slice(0, 5) });
  return ex;
}

function runAdvLesson(node, unit) {
  const lang = isLanguage(), L = sideLabels(), langName = lang ? langInfo().name.toLowerCase() : "";
  const plan = advPlan(node);
  if (!plan.length) { toast("Det finns inga ord att öva på här än"); return; }
  render("tpl-adv-lesson", "adv-lesson");
  document.body.classList.add("adv-lesson", "adv-bg");
  titleEl.textContent = "Äventyr";
  const quit = () => { if (confirm("Vill du avsluta? Du förlorar det du gjort i den här lektionen.")) showAdventure(); };
  goBack = quit; reopen = () => showAdventure();
  unit && view.style.setProperty("--c", unit.color.c);
  unit && view.style.setProperty("--cd", unit.color.d);

  const pool = advPool(), sess = practiceSession();
  const queue = [...plan], total = plan.length, isJump = node.type === "jump";
  let cur = null, checked = false, completed = 0, firstWrong = 0, xpEarned = 0, coinsWon = 0, hearts = 3;
  const t0 = Date.now();
  const body = $("#advBody"), checkBtn = $("#advCheck"), sheet = $("#advSheet"), bar = $("#advBar");
  let ex = null;   // aktuell övning: { ready, evaluate(), el }
  // "Jag vet inte": visar svaret och räknas som fel. Ligger uppe under förloppet, långt från skrivfältet.
  const dk = el("button", "btn dontknow adv-dontknow hidden", "🤷 Jag vet inte");
  dk.type = "button"; dk.title = "Visa svaret – räknas inte som rätt";
  dk.show = () => dk.classList.remove("hidden"); dk.hide = () => dk.classList.add("hidden");
  dk.onclick = () => { if (!checked) doCheck(true); };
  $(".adv-top").after(dk);

  $("#advQuit").onclick = quit;
  const hb = $("#advHearts");
  hb.classList.toggle("hidden", !isJump);
  const drawHearts = () => { hb.textContent = "❤️".repeat(hearts) + "🤍".repeat(3 - hearts); };
  drawHearts();

  // Av/på för ljud och mikrofon – samma fråga visas, men utan att höra eller prata
  const tAudio = $("#advAudio"), tMic = $("#advMic");
  const drawToggles = () => {
    tAudio.classList.toggle("off", !advAudioOn()); tAudio.title = advAudioOn() ? "Ljud på – tryck för att stänga av" : "Ljud av – tryck för att sätta på";
    tMic.classList.toggle("off", !advMicOn()); tMic.title = advMicOn() ? "Mikrofon på – tryck för att stänga av" : "Mikrofon av – tryck för att sätta på";
    tAudio.classList.toggle("hidden", !lang); tMic.classList.toggle("hidden", !lang);
    tMic.disabled = !speechRecognitionClass();
    if (!speechRecognitionClass()) tMic.title = "Mikrofonen stöds inte i den här webbläsaren";
  };
  const toggle = (key, onNow) => {
    save(key, onNow ? "off" : "on");
    drawToggles();
    toast(key === "app.advAudio" ? (advAudioOn() ? "🔊 Ljud på" : "🔇 Ljud av – inga lyssna-övningar") : (advMicOn() ? "🎤 Mikrofon på" : "Mikrofon av – inga prata-övningar"));
    if (!checked && cur) show();   // samma fråga, men i en form som passar
  };
  tAudio.onclick = () => toggle("app.advAudio", advAudioOn());
  tMic.onclick = () => toggle("app.advMic", advMicOn());
  drawToggles();

  // Vilken form en övning får just nu (beroende på av/på-knapparna)
  const effective = t => {
    if (t === "listen" && !advAudioOn()) return "pickRev";
    if (t === "listenType" && !advAudioOn()) return "type";
    if (t === "speak" && !advMicOn()) return "pickRev";
    return t;
  };
  const setReady = r => { checkBtn.disabled = !r; };

  function title(text) { body.append(el("h2", "adv-q-title", text)); }
  function speakBtn(text, big = false) {
    const b = el("button", big ? "adv-sound big" : "adv-sound", "🔊");
    b.type = "button"; b.title = "Lyssna";
    b.onclick = () => { speak(text); playClass(b, "pop"); };
    return b;
  }
  function options(answer, side) {
    const opts = shuffle([answer, ...pickDistractors(answer, side, pool, 3)]);
    const wrap = el("div", "adv-opts");
    let chosen = null;
    opts.forEach((o, i) => {
      const b = el("button", "adv-opt");
      b.append(el("span", "adv-opt-key", String(i + 1)), el("span", "", o));
      if (o.length > 40) b.classList.add("long");
      b.style.setProperty("--i", i);
      b.onclick = () => {
        if (checked) return;
        wrap.querySelectorAll(".adv-opt").forEach(x => x.classList.remove("sel"));
        b.classList.add("sel"); chosen = o; setReady(true);
        playClass(b, "pop");
        if (side === "es" && lang && advAudioOn()) speak(o);
      };
      wrap.append(b);
    });
    body.append(wrap);
    return { wrap, get: () => chosen };
  }
  function typeBox(langCode) {
    const form = el("form", "adv-type"); form.autocomplete = "off";
    const inp = el("input"); inp.type = "text"; inp.id = "advInput"; inp.lang = langCode;
    inp.autocapitalize = "off"; inp.spellcheck = false; inp.placeholder = "Skriv här…";
    const acc = el("div", "accents"); acc.dataset.target = "advInput";
    form.append(inp, acc);
    form.onsubmit = e => { e.preventDefault(); if (!checked && inp.value.trim()) doCheck(); else if (checked) next(); };
    inp.oninput = () => setReady(!!inp.value.trim());
    body.append(form);
    setupAccents(body);
    if (langCode === "sv") acc.classList.add("hidden");
    setTimeout(() => inp.focus(), 60);
    return inp;
  }

  // ---------- Övningstyperna ----------
  function show() {
    body.innerHTML = "";
    setReady(false);
    const t = effective(cur.t), w = cur.w;
    if (cur.retry) body.append(el("div", "adv-retry", "↻ TIDIGARE MISSTAG"));
    else if (w && t !== "match" && w.box && w.box() === 0 && node.type === "lesson" && cur.first) body.append(el("div", "adv-new", "✨ NYTT ORD"));

    if (t === "pick") {
      // Vad betyder ordet? (språk: spanska → svenska, ämne: begrepp → förklaring)
      title(lang ? "Vad betyder det här?" : `Vilken ${L.es.toLowerCase()} passar?`);
      const q = el("div", "adv-prompt");
      if (lang && advAudioOn()) q.append(speakBtn(w.es));
      q.append(el("span", "adv-prompt-text", lang ? w.es : w.sv));
      body.append(q);
      const o = options(lang ? w.sv : w.es, lang ? "sv" : "es");
      if (lang && advAudioOn()) setTimeout(() => speak(w.es), 250);
      ex = { evaluate: () => ({ ok: sameText(o.get(), lang ? w.sv : w.es), correct: lang ? w.sv : w.es }), el: o.wrap };
    } else if (t === "pickRev") {
      title(lang ? `Hur säger man det på ${langName}?` : `Vilket ${L.sv.toLowerCase()} passar?`);
      const q = el("div", "adv-prompt");
      q.append(el("span", "adv-prompt-text" + ((lang ? w.sv : w.es).length > 40 ? " long" : ""), lang ? w.sv : w.es));
      body.append(q);
      const o = options(lang ? w.es : w.sv, lang ? "es" : "sv");
      ex = { evaluate: () => ({ ok: sameText(o.get(), lang ? w.es : w.sv), correct: lang ? w.es : w.sv }), el: o.wrap };
    } else if (t === "listen") {
      title("Vad hör du?");
      const q = el("div", "adv-listen");
      const big = speakBtn(w.es, true), slow = el("button", "adv-sound slow", "🐢");
      slow.type = "button"; slow.title = "Långsamt"; slow.onclick = () => { speak(w.es, 0.5); playClass(slow, "pop"); };
      q.append(big, slow); body.append(q);
      const o = options(w.es, "es");
      body.append(cantLink("Kan inte lyssna nu", "app.advAudio"));
      setTimeout(() => speak(w.es), 250);
      ex = { evaluate: () => ({ ok: sameText(o.get(), w.es), correct: w.es }), el: o.wrap };
    } else if (t === "type") {
      // Språk: svenska → skriv på målspråket. Ämne: förklaring → skriv begreppet
      title(lang ? `Skriv på ${langName}` : `Vilket ${L.sv.toLowerCase()} förklaras?`);
      const q = el("div", "adv-prompt");
      q.append(el("span", "adv-prompt-text" + ((lang ? w.sv : w.es).length > 40 ? " long" : ""), lang ? w.sv : w.es));
      body.append(q);
      const inp = typeBox(lang ? cfg().lang : "sv");
      ex = {
        evaluate: () => {
          const r = check(inp.value, lang ? w.es : w.sv, lang ? "es" : "sv");
          inp.disabled = true;
          return { ok: r !== "no", almost: r === "almost", correct: lang ? w.es : w.sv };
        }, el: inp
      };
    } else if (t === "listenType") {
      title("Skriv det du hör");
      const q = el("div", "adv-listen");
      const big = speakBtn(w.es, true), slow = el("button", "adv-sound slow", "🐢");
      slow.type = "button"; slow.onclick = () => { speak(w.es, 0.5); playClass(slow, "pop"); };
      q.append(big, slow); body.append(q);
      const inp = typeBox(cfg().lang);
      body.append(cantLink("Kan inte lyssna nu", "app.advAudio"));
      setTimeout(() => speak(w.es), 250);
      ex = {
        evaluate: () => { const r = check(inp.value, w.es, "es"); inp.disabled = true; return { ok: r !== "no", almost: r === "almost", correct: w.es }; },
        el: inp
      };
    } else if (t === "bank") {
      // Bygg ihop svaret med ordbrickor
      title(`Översätt till ${langName}`);
      const q = el("div", "adv-prompt"); q.append(el("span", "adv-prompt-text", w.sv)); body.append(q);
      const target = w.es.replace(/[¿¡?!.,]/g, "").split("/")[0].trim();
      const words = target.split(/\s+/);
      const extra = shuffle(pool.flatMap(p => p.es.replace(/[¿¡?!.,…]/g, "").split(/\s+/)))
        .filter(x => x && !words.some(y => sameText(x, y))).filter((x, i, a) => a.findIndex(y => sameText(x, y)) === i).slice(0, 3);
      const line = el("div", "adv-bank-line"), bank = el("div", "adv-bank");
      body.append(line, bank);
      const picked = [];
      shuffle([...words, ...extra]).forEach((wd, i) => {
        const tile = el("button", "adv-tile", wd);
        tile.type = "button"; tile.style.setProperty("--i", i);
        tile.onclick = () => {
          if (checked) return;
          if (tile.parentElement === bank) { line.append(tile); picked.push(tile); }
          else { bank.append(tile); picked.splice(picked.indexOf(tile), 1); }
          playClass(tile, "pop");
          if (advAudioOn() && tile.parentElement === line) speak(wd);
          setReady(picked.length > 0);
        };
        bank.append(tile);
      });
      ex = {
        evaluate: () => {
          const given = [...line.querySelectorAll(".adv-tile")].map(x => x.textContent).join(" ");
          const ok = stripAccents(normalize(given, "es")) === stripAccents(normalize(target, "es"));
          return { ok, correct: w.es };
        }, el: line
      };
    } else if (t === "speak") {
      title("Säg det här");
      const q = el("div", "adv-prompt");
      if (advAudioOn()) q.append(speakBtn(w.es));
      q.append(el("span", "adv-prompt-text", w.es));
      body.append(q, el("div", "adv-speak-sv muted", w.sv));
      const mic = el("button", "adv-mic", "🎤"); mic.type = "button";
      const status = el("p", "adv-mic-status muted", "Tryck på mikrofonen och säg ordet");
      body.append(mic, status, cantLink("Kan inte prata nu", "app.advMic"));
      let tries = 0, result = null, rec = null;
      mic.onclick = () => {
        if (checked) return;
        const SR = speechRecognitionClass();
        rec?.abort?.();
        rec = new SR(); rec.lang = langInfo().tts; rec.interimResults = false; rec.maxAlternatives = 5;
        mic.classList.add("listening"); status.textContent = "🎙 Lyssnar…";
        rec.onresult = e => {
          const heard = [...e.results[0]].map(a => a.transcript);
          mic.classList.remove("listening");
          if (speechMatches(heard, w.es)) { result = true; status.textContent = `Jag hörde "${heard[0]}"`; doCheck(); }
          else if (++tries >= 3) { result = false; status.textContent = `Jag hörde "${heard[0]}"`; doCheck(); }
          else { status.textContent = `Jag hörde "${heard[0]}" – försök igen (${3 - tries} kvar)`; playClass(mic, "shake"); }
        };
        rec.onerror = e => {
          mic.classList.remove("listening");
          status.textContent = e.error === "not-allowed" ? "Mikrofonen är blockerad – tillåt den, eller tryck på 🎤 uppe till höger för att stänga av prata-övningar."
            : e.error === "no-speech" ? "Jag hörde inget – försök igen." : "Något gick fel (" + e.error + ").";
        };
        rec.onend = () => mic.classList.remove("listening");
        try { rec.start(); } catch { /* redan igång */ }
      };
      ex = { evaluate: () => ({ ok: !!result, correct: w.es }), el: mic, auto: true };
    } else if (t === "match") {
      title(lang ? "Para ihop orden" : `Para ihop ${L.sv.toLowerCase()} och ${L.es.toLowerCase()}`);
      const grid = el("div", "adv-match");
      const left = el("div", "adv-match-col"), right = el("div", "adv-match-col");
      grid.append(left, right); body.append(grid);
      const ws = cur.words;
      let sel = null, matched = 0;
      const mk = (w2, side, colEl, i) => {
        const b = el("button", "adv-mtile" + ((side === "es" ? w2.es : w2.sv).length > 30 ? " long" : ""), side === "es" ? w2.es : w2.sv);
        b.type = "button"; b.style.setProperty("--i", i);
        b.onclick = async () => {
          if (b.classList.contains("done")) return;
          if (side === "es" && lang && advAudioOn()) speak(w2.es);
          if (!sel || sel.side === side) {
            colEl.querySelectorAll(".adv-mtile").forEach(x => x.classList.remove("sel"));
            b.classList.add("sel"); sel = { b, side, w: w2 }; return;
          }
          const a = sel; sel = null;
          if (a.w === w2) {
            a.b.classList.remove("sel"); a.b.classList.add("done"); b.classList.add("done");
            playClass(a.b, "pop"); playClass(b, "pop");
            const res = sess.answer(w2, true, b, "adv", false, true);   // XP, men nivån ändras inte
            if (res) xpEarned += res.gained;
            if (++matched === ws.length) { result = true; setTimeout(() => doCheck(), 350); }
          } else {
            a.b.classList.remove("sel");
            a.b.classList.add("bad"); b.classList.add("bad");
            playClass(a.b, "shake"); playClass(b, "shake");
            sess.breakCombo();
            setTimeout(() => { a.b.classList.remove("bad"); b.classList.remove("bad"); }, 500);
          }
        };
        colEl.append(b);
      };
      let result = false;
      shuffle(ws).forEach((w2, i) => mk(w2, lang ? "es" : "sv", left, i));
      shuffle(ws).forEach((w2, i) => mk(w2, lang ? "sv" : "es", right, i));
      ex = { evaluate: () => ({ ok: result, correct: "" }), el: grid, auto: true, match: true };
    }
    checkBtn.classList.toggle("hidden", !!ex.auto);
    playClass(body, "adv-slide");
  }
  function cantLink(text, key) {
    const b = el("button", "adv-cant", text);
    b.type = "button";
    b.onclick = () => { save(key, "off"); drawToggles(); toast("Avstängt – du kan sätta på det igen uppe till höger"); show(); };
    return b;
  }

  // ---------- Rätta ----------
  function doCheck(giveUp = false) {
    if (checked || !ex) return;
    checked = true; dk.hide();
    const r = giveUp ? { ...ex.evaluate(), ok: false, almost: false } : ex.evaluate(), w = cur.w;
    let res = null;
    if (!ex.match) res = sess.answer(w, r.ok, ex.el, "adv", !!cur.retry);
    if (res) { xpEarned += res.gained; coinsWon += res.coins || 0; }
    sheet.className = "adv-sheet show " + (r.ok ? "ok" : "bad");
    sheet.innerHTML = "";
    const head = el("div", "adv-sheet-head");
    head.append(el("span", "adv-sheet-icon", r.ok ? "✓" : "✗"), el("b", "", r.ok ? phrPick("praise") : (giveUp ? "Här är svaret" : "Inte riktigt")));
    if (typeof mascotMini === "function") head.append(mascotMini(r.ok ? (r.almost ? "happy" : mPick(["happy", "love", "celebrate"])) : mPick(["sad", "shock"])));
    sheet.append(head);
    if (r.ok && r.almost) sheet.append(el("div", "adv-sheet-text", almostText(r.correct)));
    if (!r.ok && r.correct) {
      sheet.append(el("div", "adv-sheet-label", "Rätt svar:"), el("div", "adv-sheet-text", r.correct));
      if (w) sheet.append(el("div", "adv-sheet-sub", lang ? `${w.es} = ${w.sv}` : `${w.sv}: ${w.es}`));
    }
    if (w && w.sv && w.es) sheet.append(addCardButton(w));
    checkBtn.classList.remove("hidden");
    checkBtn.disabled = false;
    checkBtn.textContent = "FORTSÄTT";
    checkBtn.classList.toggle("bad", !r.ok);
    if (r.ok) {
      completed++;
      burst(ex.el, ["✨", "⭐", "💫"], 8);
      if (w && lang && advAudioOn()) speak(w.es);
    } else {
      if (!cur.retry) firstWrong++;
      playClass(ex.el, "shake");
      queue.push({ ...cur, retry: true });   // kommer tillbaka i slutet
      if (isJump) { hearts--; drawHearts(); playClass(hb, "shake"); }
    }
    bar.style.width = Math.round(100 * completed / total) + "%";
    if (r.ok) playClass(bar.parentElement, "pop");
  }
  function next() {
    sheet.className = "adv-sheet";
    checkBtn.textContent = "KONTROLLERA";
    checkBtn.classList.remove("bad");
    checked = false;
    if (isJump && hearts <= 0) return advFail(node);
    if (!queue.length) return advFinish();
    cur = queue.shift();
    if (cur.first === undefined) cur.first = true;
    show();
    // "Jag vet inte" finns inte på para-ihop-övningarna (där kan man inte gissa sig igenom)
    if (ex && !ex.match) dk.show(); else dk.hide();
  }
  checkBtn.onclick = () => { if (checked) next(); else doCheck(); };
  document.onkeydown = e => {
    if (e.target.closest("textarea, select")) return;
    if (e.key === "Enter" && !e.target.closest("input")) { e.preventDefault(); checkBtn.disabled || checkBtn.click(); }
    const n = Number(e.key);
    if (!checked && n >= 1 && n <= 4 && !e.target.closest("input")) body.querySelectorAll(".adv-opt")[n - 1]?.click();
  };
  next();   // starta första övningen

  function advFinish() {
    const secs = Math.round((Date.now() - t0) / 1000);
    const acc = Math.round(100 * (total - Math.min(firstWrong, total)) / total);
    let bonus = 0;
    const st = advState();
    if (node.type === "jump") {
      // Godkänt test: allt i delarna innan blir klart
      for (const u of node.units.slice(0, node.unit.idx)) for (const n of u.nodes) {
        if (n.type === "lesson" || n.type === "check") st[n.id] = { done: true, ts: Date.now(), jumped: true };
      }
      bonus = 20;
    } else {
      const was = !!st[node.id]?.done;
      st[node.id] = { done: true, ts: Date.now(), acc: Math.max(acc, st[node.id]?.acc || 0) };
      bonus = node.type === "check" ? 30 : was ? 5 : 10;
      if (firstWrong === 0) bonus += 5;
      if (!was) announceAch(addTotal(node.type === "check" ? "advChecks" : "advLessons"));
    }
    advSave(st);
    if (node.type !== "jump") {   // räknas för dagens utmaningar
      const days = getDays(), dk = todayKey(); days[dk] = days[dk] || { n: 0, xp: 0 };
      days[dk].adv = (days[dk].adv || 0) + 1; save("app.days", days);
    }
    if (typeof earnCoins === "function") coinsWon += earnCoins(Math.ceil(bonus / 2));
    addBonusXP(bonus);
    if (typeof mReconcile === "function") coinsWon += mReconcile();
    xpEarned += bonus;

    render("tpl-adv-done", "adv-done");
    document.body.classList.add("adv-lesson", "adv-bg");
    goBack = () => showAdventure(); reopen = goBack;
    const big = $("#advDoneFig");
    big.textContent = node.type === "check" || node.type === "jump" ? "🏆" : (unit?.mascot || "🦎");
    $("#advDoneTitle").textContent = node.type === "check" ? "Kontrollpunkt klar!" : node.type === "jump" ? "Du hoppade fram!" : firstWrong === 0 ? "Felfri lektion!" : "Lektion klar!";
    $("#advDoneSub").textContent = node.type === "jump" ? "Allt du hoppade över är nu markerat som klart." : `${unit ? unit.title + " · " : ""}${node.title || ""}`;
    playClass(big, "bounce-in");
    setTimeout(() => burst(big, ["🎉", "⭐", "✨", "🎊", "💛"], 22), 250);
    const tiles = [["TOTAL XP", xpEarned, "⚡", "xp"], ["TRÄFFSÄKERHET", acc + " %", "🎯", "acc"], ["TID", `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, "⏱", "time"]];
    if (coinsWon) tiles.push(["MYNT", coinsWon, "🪙", "coins"]);
    const box = $("#advDoneStats");
    tiles.forEach(([lab, val, icon, cls], i) => {
      const d = el("div", "adv-done-tile " + cls);
      d.style.setProperty("--i", i);
      const v = el("b", "", "");
      d.append(el("small", "", lab), el("span", "adv-done-icon", icon), v);
      box.append(d);
      if (typeof val === "number") countUp(v, val); else v.textContent = val;
    });
    $("#advDoneBtn").onclick = () => showAdventure({ justDone: node.type === "jump" ? null : node.id });
  }
}

function advFail(node) {
  render("tpl-adv-done", "adv-done");
  document.body.classList.add("adv-lesson", "adv-bg");
  goBack = () => showAdventure(); reopen = goBack;
  $("#advDoneFig").textContent = "💔";
  $("#advDoneTitle").textContent = "Slut på hjärtan";
  $("#advDoneSub").textContent = "Testet blev inte godkänt den här gången. Öva på delarna innan, eller försök igen.";
  playClass($("#advDoneFig"), "shake");
  $("#advDoneBtn").onclick = () => showAdventure();
}

// ---------- Spara ett ord från Äventyr som flashcard i Mina kort ----------
function addCardButton(w) {
  const b = el("button", "adv-add");
  b.type = "button";
  const draw = () => {
    const has = inMyCards(w.es);
    b.textContent = has ? "✓ Finns i Mina kort" : "＋ Lägg till i Mina kort";
    b.disabled = has;
  };
  draw();
  b.onclick = e => {
    e.stopPropagation();
    if (addToMyCards(w.sv, w.es)) {
      toast(`📒 "${w.es}" finns nu i Mina kort`);
      burst(b, ["📒", "✨"], 8);
      playClass(b, "pop");
    }
    draw();
  };
  return b;
}

// ---------- Repetera ett kapitel som flashcards ----------
// Alla begrepp i kapitlet, i flashcard-stil. Det du inte kan på första försöket
// läggs automatiskt till i Mina kort.
function runChapterReview(labelNode, unit) {
  const added = [];
  const make = () => ({
    id: "adv-review", name: `Repetera: ${labelNode.text}`, all: true, noRetry: true,   // varje kort visas bara en gång
    back: () => showAdventure(),
    restart: () => { added.length = 0; return make(); },
    doneNote: () => added.length
      ? `${added.length} ${added.length === 1 ? "ord" : "ord"} som du inte kunde lades till i Mina kort: ${added.join(", ")}.`
      : "Du kunde allt – inget behövde läggas till i Mina kort.",
    items: labelNode.words.map(w => ({
      ...w,
      record: (ok, opt) => {
        const res = w.record(ok, opt);
        if (!ok && addToMyCards(w.sv, w.es)) { added.push(w.es); toast(`📒 "${w.es}" lades till i Mina kort`); }
        return res;
      }
    }))
  });
  runCards(make());
  document.body.classList.add("adv-bg");
  titleEl.textContent = `🔁 ${labelNode.text}`;
}
