// =====================================================================
//  Kalender och "Plugga inför": lägg in prov och vilka kortlekar du ska kunna
// =====================================================================
// Proven sparas i "app.exams" (synkas med kontot):
//   { id, date: "YYYY-MM-DD", title, cfg, decks: [kortleks-id], all: bool, created }

const MONTHS_FULL = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const DAYS_FULL = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

function examsLoad() { return load("app.exams", []) || []; }
function examsSave(list) { save("app.exams", list); }
function dayKey(d) { return todayKey(d); }
function keyToDate(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12); }
function daysUntil(k) { const t = new Date(); t.setHours(12, 0, 0, 0); return Math.round((keyToDate(k) - t) / 86400000); }
function dayLabel(k, withYear = false) {
  const d = keyToDate(k);
  return `${DAYS_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FULL[d.getMonth()]}` + (withYear ? " " + d.getFullYear() : "");
}
function untilText(n) { return n === 0 ? "idag!" : n === 1 ? "imorgon" : n < 0 ? `för ${-n} ${-n === 1 ? "dag" : "dagar"} sedan` : `om ${n} dagar`; }

// Kortlekar i en viss konfig (även om du inte är i den just nu)
function decksOf(cfgId) { return load(keyFor(cfgId, "kldecks"), []) || []; }
function examDeckIds(ex) {
  const all = decksOf(ex.cfg), ids = new Set();
  for (const id of ex.decks || []) { ids.add(id); all.filter(d => d.parent === id).forEach(d => ids.add(d.id)); }
  return ids;
}
// Alla kort provet gäller
function examCards(ex) {
  const ids = examDeckIds(ex);
  const list = (load(keyFor(ex.cfg, "klcards"), []) || []).filter(c => ids.has(c.deck) && c.sv && c.es);
  if (ex.all) list.push(...(load(keyFor(ex.cfg, "cards"), []) || []).filter(c => c.sv && c.es));
  return list;
}
// Hur långt du har kommit, och hur mycket du behöver öva per dag för att hinna
function examProgress(ex) {
  const list = examCards(ex), n = list.length;
  const known = list.filter(c => (c.box || 0) >= KNOWN_BOX).length;
  const steps = list.reduce((t, c) => t + Math.max(0, KNOWN_BOX - (c.box || 0)), 0);
  const left = Math.max(1, daysUntil(ex.date));
  const perDay = steps ? Math.max(5, Math.ceil(steps / left)) : 0;
  return { n, known, pct: n ? Math.round(100 * known / n) : 0, perDay, done: n > 0 && known === n };
}
function upcomingExams() { return examsLoad().filter(e => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)); }
function examCfg(ex) { return configs.find(c => c.id === ex.cfg) || cfg(); }
function examDeckNames(ex) {
  const all = decksOf(ex.cfg);
  const names = (ex.decks || []).map(id => all.find(d => d.id === id)?.name).filter(Boolean);
  if (ex.all) names.push("Alla kort i Mina kort");
  return names;
}

// Öva inför ett prov: korten i lekarna (och ev. Mina kort), svagaste först
function practiceExam(ex) {
  if (ex.cfg !== activeId && configs.some(c => c.id === ex.cfg)) switchConfig(ex.cfg);
  const kinds = new Set((ex.decks || []).map(id => klDeck(id)?.kind || "mixed"));
  const make = () => {
    const deck = klPracticeDeckIds(examDeckIds(ex), {
      id: "exam:" + ex.id, name: ex.title || "Prov", kind: kinds.size === 1 ? [...kinds][0] : "mixed",
      back: () => showPlan(), refresh: make
    });
    if (ex.all) deck.items.push(...myCardsDeck(cards.filter(c => c.sv && c.es)).items);
    return deck;
  };
  const deck = make();
  if (!deck.items.length) { toast("Inga kort att öva – lägg in kortlekar till provet"); return showCalendar(ex.date); }
  showPracticeMenu(deck);
}

// ---------- Ett prov som ett kort ----------
function examCard(ex, big = false) {
  const c = examCfg(ex), p = examProgress(ex), n = daysUntil(ex.date);
  const card = el("div", "ex-card" + (big ? " big" : "") + (n <= 2 ? " soon" : ""));
  if (typeof klPaint === "function") klPaint(card, cfgColor(c));
  const count = el("div", "ex-count");
  count.append(el("b", "", n === 0 ? "🍀" : String(n)), el("small", "", n === 0 ? "idag" : n === 1 ? "dag kvar" : "dagar kvar"));
  const info = el("div", "ex-info");
  info.append(el("small", "ex-kicker", "PLUGGA INFÖR"), el("b", "ex-title", ex.title || "Prov"),
    el("span", "ex-when", `${c.icon || ""} ${c.name} · till ${dayLabel(ex.date)} (${untilText(n)})`));
  const decks = examDeckNames(ex);
  if (decks.length) info.append(el("small", "ex-decks", "🗂️ " + decks.join(", ")));
  const bar = el("div", "ex-bar"), fill = el("i"); fill.style.width = p.pct + "%"; bar.append(fill);
  info.append(bar, el("small", "ex-goal", !p.n ? "Inga kort i provet än – lägg till kortlekar"
    : p.done ? `✓ Du kan alla ${p.n} kort – repetera gärna ändå!` : `${p.pct} % klart · Idag: öva ca ${p.perDay} kort`));
  const go = el("button", "ex-go"); go.type = "button";
  go.innerHTML = `<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>`;
  go.title = "Plugga nu"; go.onclick = e => { e.stopPropagation(); practiceExam(ex); };
  card.append(count, info, go);
  card.onclick = () => showCalendar(ex.date);
  return card;
}

// ---------- Vy: Plugga inför ----------
function showPlan() {
  titleEl.textContent = "Plugga inför";
  goBack = showHome; reopen = showPlan;
  render("tpl-plan", "plan");
  if (typeof klFillIcons === "function") klFillIcons();
  $("#plCal").onclick = () => showCalendar();
  const up = upcomingExams(), list = $("#plList");
  $("#plHeroSub").textContent = up.length
    ? `${up.length} ${up.length === 1 ? "prov" : "prov"} framför dig. Närmast: ${up[0].title || "prov"} ${untilText(daysUntil(up[0].date))}.`
    : "Inga prov inlagda. Öppna kalendern och tryck på en dag för att lägga in ett prov.";
  up.forEach((ex, i) => { const cd = examCard(ex, true); cd.style.setProperty("--i", i); list.append(cd); });
  if (!up.length) {
    const e = el("div", "kl-empty");
    if (typeof mascotEl === "function") e.append(mascotEl("think", "kl-empty-fig"));
    e.append(el("p", "", "När du lägger in ett prov räknar jag ut hur många kort du behöver öva varje dag för att hinna!"));
    list.append(e);
  }
  const past = examsLoad().filter(e => daysUntil(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (past.length) {
    const det = el("details", "pl-past"), sum = el("summary", "", `Tidigare prov (${past.length})`);
    det.append(sum);
    past.forEach(ex => det.append(examCard(ex)));
    list.append(det);
  }
}

// ---------- Vy: Kalender ----------
let calMonth = null;   // första dagen i månaden som visas
function showCalendar(selectKey) {
  titleEl.textContent = "Kalender";
  goBack = showPlan; reopen = () => showCalendar(selected);
  render("tpl-cal", "cal");
  let selected = selectKey || todayKey();
  if (selectKey || !calMonth) { const d = keyToDate(selected); calMonth = new Date(d.getFullYear(), d.getMonth(), 1, 12); }
  if (typeof klPaint === "function") klPaint($("#calHero"), cfgColor(cfg()));

  function drawMonth(dir = 0) {
    $("#calMonth").textContent = `${MONTHS_FULL[calMonth.getMonth()]} ${calMonth.getFullYear()}`;
    const grid = $("#calGrid");
    grid.innerHTML = "";
    ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].forEach(d => grid.append(el("span", "cal-wd", d)));
    const first = new Date(calMonth), start = (first.getDay() + 6) % 7;   // måndag först
    const day = new Date(first); day.setDate(1 - start);
    const exams = examsLoad(), today = todayKey();
    for (let i = 0; i < 42; i++) {
      const k = dayKey(day), inMonth = day.getMonth() === calMonth.getMonth();
      const b = el("button", "cal-day" + (inMonth ? "" : " out") + (k === today ? " today" : "") + (k === selected ? " sel" : "") + (k < today ? " past" : ""));
      b.type = "button";
      b.append(el("span", "cal-num", String(day.getDate())));
      const dots = el("span", "cal-dots");
      for (const ex of exams.filter(e => e.date === k).slice(0, 3)) { const dt = el("i"); dt.style.background = cfgColor(examCfg(ex)); dots.append(dt); }
      if (dots.childElementCount) b.classList.add("has-exam");
      b.append(dots);
      b.onclick = () => { selected = k; if (!inMonth) calMonth = new Date(day.getFullYear(), day.getMonth(), 1, 12); drawMonth(); drawDay(true); };
      grid.append(b);
      day.setDate(day.getDate() + 1);
      if (i >= 34 && day.getMonth() !== calMonth.getMonth() && day.getDay() === 1) break;
    }
    if (dir) playClass(grid, dir < 0 ? "rv-from-left" : "rv-from-right");
  }
  $("#calPrev").onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); drawMonth(-1); };
  $("#calNext").onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); drawMonth(1); };
  $("#calToday").onclick = () => { selected = todayKey(); calMonth = new Date(); calMonth.setDate(1); drawMonth(); drawDay(true); };

  // Dagen du tryckt på: proven den dagen, och ett formulär för att lägga till ett nytt
  function drawDay(scroll = false, editId = null) {
    const box = $("#calDay");
    box.innerHTML = "";
    const n = daysUntil(selected);
    box.append(el("h3", "cal-day-h", `${dayLabel(selected, true)}`), el("small", "muted", n >= 0 ? untilText(n) : untilText(n)));
    const exams = examsLoad().filter(e => e.date === selected);
    exams.forEach(ex => {
      if (ex.id === editId) return;
      const row = examCard(ex);
      const tools = el("div", "ex-tools");
      const ed = el("button", "btn-small", "✏️ Ändra"); ed.onclick = e => { e.stopPropagation(); drawDay(false, ex.id); };
      const del = el("button", "btn-small bad", "🗑"); del.title = "Ta bort provet";
      del.onclick = async e => {
        e.stopPropagation();
        if (!await confirmDialog({ title: `Ta bort ${ex.title || "provet"}?`, icon: "🗑️", danger: true, ok: "Ta bort", cancel: "Behåll", text: "Bara provet i kalendern tas bort – kortlekarna finns kvar." })) return;
        examsSave(examsLoad().filter(x => x.id !== ex.id)); drawMonth(); drawDay();
      };
      tools.append(ed, del);
      row.onclick = null;
      row.append(tools);
      box.append(row);
    });
    if (n >= 0 || editId) box.append(examForm(editId ? examsLoad().find(e => e.id === editId) : null));
    if (scroll) setTimeout(() => box.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function examForm(ex) {
    const f = el("div", "ex-form");
    const draft = ex ? { ...ex, decks: [...(ex.decks || [])] } : { title: "", cfg: activeId, decks: [], all: false };
    f.append(el("b", "ex-form-h", ex ? "✏️ Ändra provet" : "＋ Lägg in ett prov den här dagen"));
    const title = el("input"); title.type = "text"; title.maxLength = 60; title.value = draft.title;
    title.placeholder = "Vad har du för prov? T.ex. Spanska prov kapitel 3";
    title.oninput = () => { draft.title = title.value; };
    const tl = el("label", "field"); tl.append(el("span", "", "Prov"), title); f.append(tl);
    // Konfig
    f.append(el("span", "ex-lbl", "Ämne"));
    const cfgRow = el("div", "ex-cfgs");
    const drawCfgs = () => {
      cfgRow.innerHTML = "";
      for (const c of configs) {
        const b = el("button", "ex-cfg" + (draft.cfg === c.id ? " on" : ""), `${c.icon || ""} ${c.name}`); b.type = "button";
        b.style.setProperty("--cc", cfgColor(c));
        b.onclick = () => { if (draft.cfg !== c.id) { draft.cfg = c.id; draft.decks = []; draft.all = false; } drawCfgs(); drawDecks(); };
        cfgRow.append(b);
      }
    };
    f.append(cfgRow);
    // Kortlekar och underkortlekar
    f.append(el("span", "ex-lbl", "Vad ska du kunna till provet?"));
    const deckBox = el("div", "ex-decks-pick");
    const drawDecks = () => {
      deckBox.innerHTML = "";
      const all = decksOf(draft.cfg), tops = all.filter(d => !d.parent);
      const chip = (label, on, color, onclick, sub = false) => {
        const b = el("button", "ex-deck" + (on ? " on" : "") + (sub ? " sub" : ""), label); b.type = "button";
        if (color) b.style.setProperty("--cc", color);
        b.onclick = onclick; return b;
      };
      for (const t of tops) {
        const group = el("div", "ex-deck-group");
        const toggle = id => { const i = draft.decks.indexOf(id); if (i >= 0) draft.decks.splice(i, 1); else draft.decks.push(id); drawDecks(); };
        group.append(chip(`🗂️ ${t.name}`, draft.decks.includes(t.id), t.color, () => toggle(t.id)));
        for (const s of all.filter(d => d.parent === t.id)) {
          const inherited = draft.decks.includes(t.id);
          const b = chip(`↳ ${s.name}`, inherited || draft.decks.includes(s.id), s.color || t.color, () => { if (!inherited) toggle(s.id); }, true);
          if (inherited) { b.disabled = true; b.title = "Ingår redan eftersom hela kortleken är vald"; }
          group.append(b);
        }
        deckBox.append(group);
      }
      deckBox.append(chip("📒 Alla kort i Mina kort", draft.all, null, () => { draft.all = !draft.all; drawDecks(); }));
      if (!tops.length) deckBox.append(el("small", "muted ex-hint", "Den här konfigen har inga kortlekar än – välj Mina kort, eller skapa kortlekar under Kortlekar."));
    };
    drawCfgs(); drawDecks();
    f.append(deckBox);
    const row = el("div", "ex-form-row");
    const saveBtn = el("button", "kd-btn play ex-save");
    saveBtn.innerHTML = `<span class="kd-btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span><span class="kd-btn-text"><b>${ex ? "Spara" : "Lägg in provet"}</b><small>${dayLabel(selected)}</small></span>`;
    saveBtn.onclick = () => {
      const t = draft.title.trim();
      if (!t) { title.focus(); playClass(title, "shake"); toast("Skriv vad det är för prov"); return; }
      if (!draft.decks.length && !draft.all) { playClass(deckBox, "shake"); toast("Välj minst en kortlek (eller Mina kort)"); return; }
      const list = examsLoad();
      if (ex) Object.assign(list.find(x => x.id === ex.id) || {}, { title: t, cfg: draft.cfg, decks: draft.decks, all: draft.all });
      else list.push({ id: "ex" + Date.now().toString(36), date: selected, title: t, cfg: draft.cfg, decks: draft.decks, all: draft.all, created: Date.now() });
      examsSave(list);
      toast(ex ? "Sparat" : `📅 ${t} – ${dayLabel(selected)}`);
      burst(saveBtn, ["📅", "✨", "📚"], 10);
      drawMonth(); drawDay();
    };
    row.append(saveBtn);
    if (ex) { const cancel = el("button", "btn secondary", "Avbryt"); cancel.onclick = () => drawDay(); row.append(cancel); }
    f.append(row);
    return f;
  }
  drawMonth(); drawDay();
}

// ---------- Startsidan: närmaste provet + knapp till kalendern ----------
function renderHomePlan() {
  const anchor = view.querySelector(".home-practice");
  if (!anchor || view.querySelector(".home-plan")) return;
  const box = el("div", "home-plan");
  const up = upcomingExams();
  if (up.length) {
    box.append(examCard(up[0]));
    if (up.length > 1) {
      const more = el("button", "home-plan-more", `+ ${up.length - 1} prov till – visa alla`); more.type = "button";
      more.onclick = showPlan; box.append(more);
    }
  }
  const btn = el("button", "kd-btn plan-btn"); btn.type = "button";
  btn.innerHTML = `<span class="kd-btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4"/></svg></span><span class="kd-btn-text"><b>${up.length ? "Plugga inför" : "Kalender & prov"}</b><small>${up.length ? "Alla prov och kalendern" : "Lägg in prov och vad du ska kunna"}</small></span><span class="kd-btn-go kl-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14 M13 5l7 7-7 7"/></svg></span>`;
  btn.onclick = showPlan;
  box.append(btn);
  anchor.after(box);
}
(function planInit() {
  const prev = typeof klViewChange === "function" ? klViewChange : null;
  window.klViewChange = function (name) {
    if (prev) prev(name);
    if (name === "home") setTimeout(() => currentView === "home" && renderHomePlan(), 0);
    if (name === "mycards") setTimeout(() => { const b = document.getElementById("btnPhoto"); if (b) b.onclick = showPhoto; }, 0);
  };
  if (currentView === "home") renderHomePlan();
})();
