// =====================================================================
//  Kortlekar och underkortlekar inom en konfig
// =====================================================================
// Mina kort är fortfarande listan med alla begrepp du någonsin lagt in.
// En kortlek innehåller KOPIOR av kort därifrån (med egen nivå och statistik),
// och har en typ som anpassar övningen: grammatik, begrepp, frågor eller blandat.
// Laddas efter app.js. Allt som app.js anropar här är skyddat med typeof.

const KL_KINDS = {
  mixed:     { name: "Blandat",   icon: "shuffle", c1: "#12b886", c2: "#0b7285", desc: "Inga ändringar – övningen är som vanligt.", tips: ["Alla övningar som vanligt"] },
  grammar:   { name: "Grammatik", icon: "type", c1: "#7950f2", c2: "#d6336c", desc: "Formen måste sitta: exakt rättning och fler skrivfrågor.", tips: ["Exakt rättning", "Fler skrivfrågor i Svårt läge", "★ Skrivförhör och Svårt läge"] },
  terms:     { name: "Begrepp",   icon: "bookopen", c1: "#1c7ed6", c2: "#15aabf", desc: "Förstå innebörden – små stavfel räknas inte.", tips: ["Små stavfel är okej", "Årtal måste vara rätt", "★ Flerval och Flashcards"] },
  questions: { name: "Frågor",    icon: "help", c1: "#f76707", c2: "#e64980", desc: "Fråga → svar, alltid åt det hållet. AI:n rättar långa svar.", tips: ["Alltid fråga → svar", "AI:n rättar långa svar", "★ Svårt läge och Flashcards"] }
};
const KL_COLORS = ["#f03e3e", "#f76707", "#f59f00", "#40c057", "#12b886", "#15aabf", "#228be6", "#4c6ef5", "#7950f2", "#be4bdb", "#e64980", "#495057"];
// Ikoner ritade som linjer (SVG), så att de ser likadana ut på alla enheter och sitter mitt i sina rutor
const KL_SVG = {
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  bookopen: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z",
  pen: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
  bulb: "M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  scale: "M12 3v18 M7 21h10 M4 7h16 M7 7l-3 7a3 3 0 0 0 6 0z M17 7l-3 7a3 3 0 0 0 6 0z",
  landmark: "M3 21h18 M5 21V11 M19 21V11 M9.5 21V11 M14.5 21V11 M2 9l10-6 10 6z",
  briefcase: "M3 7h18v13H3z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18",
  chart: "M3 3v18h18 M7 15l4-4 3 3 6-7",
  coins: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z M15 8.6c-.5-1-1.6-1.6-3-1.6-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3-1.6 M12 5v2 M12 17v2",
  globe: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20",
  speech: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5",
  type: "M4 7V4h16v3 M9 20h6 M12 4v16",
  flask: "M9 3h6 M10 3v6l-5.5 10a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3 M7 15h10",
  target: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z",
  star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.5 2.8 2.5 2.8z",
  rocket: "M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z M12 15l-3-3a22 22 0 0 1 2-4A13 13 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0 M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5",
  palette: "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.7 1.7 0 0 1 12 22z M7.5 11h.01 M10.5 7h.01 M15.5 7.5h.01",
  music: "M9 18V5l12-2v13 M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0z M21 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0z",
  calendar: "M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4",
  layers: "M12 2l10 5-10 5L2 7z M2 12l10 5 10-5 M2 17l10 5 10-5",
  graduation: "M22 10L12 5 2 10l10 5z M6 12v5c3 2 9 2 12 0v-5 M22 10v6",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z",
  code: "M16 18l6-6-6-6 M8 6l-6 6 6 6",
  clock: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z M12 6v6l4 2",
  // knappar och typer
  shuffle: "M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5",
  help: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01",
  play: "M7 4.5v15l12-7.5z",
  download: "M12 3v12 M7 10l5 5 5-5 M4 21h16",
  plus: "M12 5v14 M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  arrow: "M5 12h14 M13 5l7 7-7 7",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2 M5.5 5h13L22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7z"
};
const KL_ICONS = ["book", "bookopen", "pen", "bulb", "scale", "landmark", "briefcase", "chart", "coins", "globe", "speech", "type",
  "flask", "target", "star", "flame", "rocket", "palette", "music", "calendar", "layers", "graduation", "map", "heart", "code"];
// Gamla lekar sparade en emoji – de får motsvarande linjeikon
const KL_EMOJI = { "📚": "book", "📘": "book", "📕": "book", "📗": "bookopen", "📙": "bookopen", "📝": "pen", "🧠": "bulb", "⚖️": "scale", "🏛️": "landmark",
  "💼": "briefcase", "📊": "chart", "💰": "coins", "🌍": "globe", "🗣️": "speech", "🔤": "type", "🧪": "flask", "🔬": "flask", "🎯": "target",
  "⭐": "star", "🔥": "flame", "🚀": "rocket", "🎨": "palette", "🎵": "music", "⚽": "target" };
function klSvg(name, filled = false) {
  const d = KL_SVG[name] || KL_SVG.book;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
// Ett element med ikonen (namn från KL_SVG, eller en gammal emoji)
function klIconEl(icon, cls = "") {
  const s = el("span", "kl-ic " + cls);
  const name = KL_SVG[icon] ? icon : KL_EMOJI[icon];
  if (name) s.innerHTML = klSvg(name, name === "play");
  else { s.classList.add("emoji"); s.textContent = icon || ""; if (!icon) s.innerHTML = klSvg("book"); }
  return s;
}
// Fyller i alla [data-ic] i vyn
function klFillIcons(root = view) { root.querySelectorAll("[data-ic]").forEach(x => { x.innerHTML = klSvg(x.dataset.ic, x.dataset.ic === "play"); x.classList.add("kl-ic"); }); }

// ---------- Data ----------
function klDecks() { return load(lsKey("kldecks"), []) || []; }
function saveKlDecks(d) { save(lsKey("kldecks"), d); }
function klCards() { return load(lsKey("klcards"), []) || []; }
function saveKlCards(c) { save(lsKey("klcards"), c); }
function klDeck(id) { return klDecks().find(d => d.id === id); }
function klChildren(id) { return klDecks().filter(d => d.parent === id); }
function klIds(id) { return [id, ...klChildren(id).map(d => d.id)]; }
// Korten i en lek (med underlekarnas kort om deep)
function klDeckCards(id, deep = true, all = klCards()) {
  const ids = new Set(deep ? klIds(id) : [id]);
  return all.filter(c => ids.has(c.deck));
}
function klStats(id, deep = true) {
  const list = klDeckCards(id, deep), n = list.length;
  const mastered = list.filter(c => (c.box || 0) >= MAX_BOX).length, known = list.filter(c => (c.box || 0) >= KNOWN_BOX).length;
  return { n, mastered, known, pct: n ? Math.round(100 * mastered / n) : 0 };
}
function klNewId() { return "kl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ---------- Färger ----------
function klHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [200, 70, 50];
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
// Sätter --k1, --k2 (gradient) och --k3 (skugga) på ett element utifrån lekens färg
function klPaint(elem, color) {
  const [h, s, l] = klHsl(color);
  elem.style.setProperty("--k1", `hsl(${h} ${s}% ${l}%)`);
  elem.style.setProperty("--k2", `hsl(${(h + 14) % 360} ${Math.min(95, s + 6)}% ${Math.min(64, l + 7)}%)`);
  elem.style.setProperty("--k3", `hsl(${h} ${s}% ${Math.max(18, l - 18)}%)`);
  elem.style.setProperty("--k4", `hsl(${h} ${s}% ${Math.min(96, l + 40)}%)`);
  return elem;
}
function klRing(pct, cls = "") {
  const d = el("div", "kl-ring " + cls);
  const C = 2 * Math.PI * 18;
  d.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" class="kl-ring-bg"/>` +
    `<circle cx="22" cy="22" r="18" class="kl-ring-fg" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 22 22)"/></svg>`;
  d.append(el("b", "", pct + "%"));
  d.title = `${pct} % fullt inlärda`;
  return d;
}
function klKindChip(kind) {
  const k = KL_KINDS[kind] || KL_KINDS.mixed, c = el("span", "kl-kind kind-" + (KL_KINDS[kind] ? kind : "mixed"));
  c.append(klIconEl(k.icon, "kl-kind-ic"), el("span", "", k.name));
  return c;
}

// ---------- Kortlek som en ruta ----------
function klTile(d, i = 0, small = false) {
  const st = klStats(d.id), subs = klChildren(d.id).length;
  const t = klPaint(el("button", "kl-tile" + (small ? " small" : "")), d.color);
  t.append(el("span", "kl-tile-bg"));
  t.style.setProperty("--i", i);
  const top = el("div", "kl-tile-top");
  top.append(klIconEl(d.icon, "kl-tile-icon"), klRing(st.pct));
  t.append(top, el("b", "kl-tile-name", d.name), klKindChip(d.kind));
  t.append(el("small", "kl-tile-meta", `${st.n} kort` + (subs ? ` · ${subs} ${subs === 1 ? "underlek" : "underlekar"}` : "") + (st.n ? ` · ${st.mastered} fullt inlärda` : "")));
  const bar = el("div", "kl-tile-bar"), fill = el("i"); fill.style.width = st.pct + "%"; bar.append(fill); t.append(bar);
  t.onclick = () => showKortlek(d.id);
  return t;
}

// ---------- Vy: alla kortlekar ----------
let klBack = null;   // vart ⌂ leder från kortleks-listan
function showKortlekar(back) {
  if (back) klBack = back;
  const c = cfg();
  titleEl.textContent = "Kortlekar";
  goBack = klBack || showHome; reopen = () => showKortlekar();
  render("tpl-kl", "kl");
  const hero = klPaint($("#klHero"), cfgColor(c));
  const tops = klDecks().filter(d => !d.parent), all = klCards();
  const mastered = all.filter(x => (x.box || 0) >= MAX_BOX).length;
  $("#klHeroIcon").replaceChildren(klIconEl("layers"));
  $("#klHeroTitle").textContent = `Kortlekar i ${c.name}`;
  $("#klHeroSub").textContent = tops.length
    ? `${tops.length} ${tops.length === 1 ? "kortlek" : "kortlekar"} · ${all.length} kort · ${all.length ? Math.round(100 * mastered / all.length) : 0} % fullt inlärda`
    : "Dela upp korten i lekar och underlekar – och välj vad varje lek innehåller.";
  playClass(hero, "pop-in");
  const grid = $("#klGrid");
  const add = el("button", "kl-tile kl-new");
  const plus = el("span", "kl-new-plus"); plus.innerHTML = klSvg("plus");
  add.append(plus, el("b", "", "Ny kortlek"), el("small", "", "Grammatik, begrepp, frågor eller blandat"));
  add.onclick = () => showKlEdit(null, null);
  grid.append(add);
  tops.forEach((d, i) => grid.append(klTile(d, i + 1)));
  if (!tops.length) {
    const empty = el("div", "kl-empty");
    if (typeof mascotEl === "function") empty.append(mascotEl("think", "kl-empty-fig"));
    empty.append(el("p", "", "Inga kortlekar än! Skapa en lek, t.ex. ett kapitel i boken, och importera kort till den från Mina kort."));
    grid.after(empty);
  }
}

// ---------- Vy: en kortlek ----------
function showKortlek(id) {
  const d = klDeck(id);
  if (!d) return showKortlekar();
  const parent = d.parent ? klDeck(d.parent) : null;
  titleEl.textContent = d.name;
  goBack = parent ? () => showKortlek(parent.id) : () => showKortlekar();
  reopen = () => showKortlek(id);
  render("tpl-kl-deck", "kl-deck");
  const st = klStats(id), k = KL_KINDS[d.kind] || KL_KINDS.mixed;
  const hero = klPaint($("#kdHero"), d.color);
  const crumbs = $("#kdCrumbs");
  const toAll = el("button", ""); toAll.append(klIconEl("layers", "crumb-ic"), el("span", "", "Kortlekar")); toAll.onclick = () => showKortlekar(); crumbs.append(toAll);
  if (parent) { crumbs.append(el("span", "", "›")); const p = el("button", "", parent.name); p.onclick = () => showKortlek(parent.id); crumbs.append(p); }
  $("#kdIcon").replaceChildren(klIconEl(d.icon));
  klFillIcons();
  $("#kdName").textContent = d.name;
  $("#kdKind").replaceWith(Object.assign(klKindChip(d.kind), { id: "kdKind" }));
  $("#kdDesc").textContent = k.desc;
  $("#kdRing").replaceWith(Object.assign(klRing(st.pct, "big"), { id: "kdRing" }));
  const nums = $("#kdNums");
  for (const [v, label] of [[st.n, "kort"], [st.known, "kan du"], [st.mastered, "fullt inlärda"]]) {
    const b = el("div", "kd-num"); b.append(el("b", "", String(v)), el("small", "", label)); nums.append(b);
  }
  playClass(hero, "pop-in");

  // Knappar
  $("#kdPractice").onclick = () => {
    const deck = klPracticeDeck(id);
    if (!deck.items.length) { toast("Lägg in kort i leken först – tryck Importera"); playClass($("#kdImport"), "shake"); return; }
    showPracticeMenu(deck);
  };
  $("#kdPractice").querySelector("small").textContent = st.n ? `${st.n} kort${klChildren(id).length ? " inkl. underlekar" : ""}` : "Inga kort än";
  $("#kdImport").onclick = () => klStartPick(id);
  $("#kdEdit").onclick = () => showKlEdit(id, d.parent || null);
  const subBtn = $("#kdNewSub");
  subBtn.classList.toggle("hidden", !!d.parent);
  subBtn.onclick = () => showKlEdit(null, id);

  // Underlekar
  const subs = klChildren(id), subWrap = $("#kdSubs");
  $("#kdSubsHead").classList.toggle("hidden", !!d.parent);
  if (!d.parent) {
    subs.forEach((s, i) => subWrap.append(klTile(s, i, true)));
    if (!subs.length) subWrap.append(el("p", "muted small kd-hint", "Inga underlekar än. En underlek kan t.ex. vara ett avsnitt i kapitlet – med egen typ."));
  }

  // Korten
  drawKlCardList(id);
}
function drawKlCardList(id) {
  const ul = $("#kdCards");
  if (!ul) return;
  const own = klDeckCards(id, false);
  $("#kdCardsHead").textContent = `Kort i leken (${own.length})`;
  ul.innerHTML = "";
  if (!own.length) {
    const li = el("li", "kd-empty");
    li.append(klIconEl("inbox", "kd-empty-ic"), el("span", "", "Inga kort här än. Tryck ”Importera kort från Mina kort” och sedan plus vid korten du vill ha med."));
    ul.append(li);
    return;
  }
  own.sort((a, b) => (b.added || 0) - (a.added || 0)).forEach((c, i) => {
    const li = el("li", "kd-card");
    li.style.setProperty("--i", Math.min(i, 20));
    const txt = el("div", "kd-card-text");
    txt.append(el("b", "", c.sv || "—"), el("span", "", c.es || "—"));
    const lvl = el("div", "kd-lvl");
    lvl.title = `Nivå ${c.box || 0} av ${MAX_BOX}`;
    for (let b = 1; b <= MAX_BOX; b++) lvl.append(el("i", (c.box || 0) >= b ? "on" : ""));
    const del = el("button", "kd-del", "✕");
    del.title = "Ta bort ur leken (kortet finns kvar i Mina kort)";
    del.onclick = () => {
      saveKlCards(klCards().filter(x => x.id !== c.id));
      li.classList.add("gone");
      setTimeout(() => { if (currentView === "kl-deck") { drawKlCardList(id); refreshKlHero(id); } }, 220);
    };
    li.append(txt, lvl, del);
    if (c.yellow) li.classList.add("yellow");
    ul.append(li);
  });
}
function refreshKlHero(id) {
  const st = klStats(id), r = $("#kdRing");
  if (r) r.replaceWith(Object.assign(klRing(st.pct, "big"), { id: "kdRing" }));
  const nums = view.querySelectorAll(".kd-num b");
  if (nums.length === 3) { nums[0].textContent = st.n; nums[1].textContent = st.known; nums[2].textContent = st.mastered; }
}

// ---------- Vy: skapa / ändra kortlek ----------
function showKlEdit(id, parentId) {
  const existing = id ? klDeck(id) : null, parent = parentId ? klDeck(parentId) : null;
  titleEl.textContent = existing ? "Ändra kortlek" : parent ? "Ny underkortlek" : "Ny kortlek";
  goBack = existing ? () => showKortlek(id) : parent ? () => showKortlek(parent.id) : () => showKortlekar();
  reopen = () => showKlEdit(id, parentId);
  render("tpl-kl-edit", "kl-edit");
  const used = klDecks().map(d => d.color);
  const draft = existing ? { ...existing } : {
    name: "", kind: parent?.kind || "mixed", icon: parent ? "pen" : "book",
    color: parent?.color || KL_COLORS.find(c => !used.includes(c)) || KL_COLORS[0]
  };
  $("#keHead").textContent = existing ? `Ändra ${existing.name}` : parent ? `Ny underkortlek i ${parent.name}` : "Ny kortlek";
  const name = $("#keName");
  name.value = draft.name;
  name.placeholder = parent ? "t.ex. Avsnitt 1.2 eller Verbböjning" : "t.ex. Kapitel 3 eller Avtalsrätt";

  const preview = $("#kePreview");
  function drawPreview() {
    preview.innerHTML = "";
    const k = KL_KINDS[draft.kind];
    const t = klPaint(el("div", "kl-tile preview"), draft.color);
    t.append(el("span", "kl-tile-bg"));
    const top = el("div", "kl-tile-top");
    top.append(klIconEl(draft.icon, "kl-tile-icon"), klRing(0));
    t.append(top, el("b", "kl-tile-name", draft.name || (parent ? "Ny underkortlek" : "Ny kortlek")), klKindChip(draft.kind), el("small", "kl-tile-meta", k.desc));
    preview.append(t);
  }
  name.oninput = () => { draft.name = name.value; drawPreview(); };

  // Typ
  const kinds = $("#keKinds");
  for (const [key, k] of Object.entries(KL_KINDS)) {
    const b = el("button", "ke-kind kind-" + key + (draft.kind === key ? " on" : ""));
    b.type = "button";
    b.append(klIconEl(k.icon, "ke-kind-icon"), el("b", "", k.name), el("small", "", k.desc));
    const ul = el("ul", "ke-kind-tips");
    for (const tip of k.tips) ul.append(el("li", "", tip));
    b.append(ul);
    b.onclick = () => { draft.kind = key; kinds.querySelectorAll(".ke-kind").forEach(x => x.classList.toggle("on", x === b)); playClass(b, "pop"); drawPreview(); };
    kinds.append(b);
  }
  // Färg
  const colors = $("#keColors");
  for (const col of KL_COLORS) {
    const b = el("button", "ke-color" + (draft.color === col ? " on" : ""));
    b.type = "button"; b.style.background = col; b.title = col;
    b.onclick = () => { draft.color = col; colors.querySelectorAll(".ke-color").forEach(x => x.classList.toggle("on", x === b)); drawPreview(); };
    colors.append(b);
  }
  // Ikon
  const icons = $("#keIcons");
  if (!KL_SVG[draft.icon]) draft.icon = KL_EMOJI[draft.icon] || "book";
  for (const ic of KL_ICONS) {
    const b = el("button", "ke-icon" + (draft.icon === ic ? " on" : ""));
    b.type = "button"; b.title = ic;
    b.append(klIconEl(ic));
    b.onclick = () => { draft.icon = ic; icons.querySelectorAll(".ke-icon").forEach(x => x.classList.toggle("on", x === b)); drawPreview(); };
    icons.append(b);
  }
  klFillIcons();
  drawPreview();

  $("#keSave").onclick = () => {
    const n = name.value.trim();
    if (!n) { name.focus(); playClass(name, "shake"); toast("Ge kortleken ett namn"); return; }
    const decks = klDecks();
    if (existing) {
      const d = decks.find(x => x.id === id);
      Object.assign(d, { name: n, kind: draft.kind, color: draft.color, icon: draft.icon });
      saveKlDecks(decks);
      toast("Sparat");
      showKortlek(id);
    } else {
      const d = { id: klNewId(), name: n, kind: draft.kind, color: draft.color, icon: draft.icon, parent: parent?.id || null, created: Date.now() };
      decks.push(d); saveKlDecks(decks);
      toast(`${d.name} skapad`);
      showKortlek(d.id);
      setTimeout(() => burst($("#kdHero") || document.body, ["✨", "🃏", "⭐", "🎉"], 16), 250);
    }
  };
  const del = $("#keDelete");
  del.classList.toggle("hidden", !existing);
  del.onclick = async () => {
    const subs = klChildren(id), n = klDeckCards(id).length;
    const yes = await confirmDialog({
      title: `Ta bort ${existing.name}?`, icon: "🗑️", danger: true, ok: "Ta bort", cancel: "Behåll",
      text: `Leken${subs.length ? ` och dess ${subs.length} ${subs.length === 1 ? "underlek" : "underlekar"}` : ""} tas bort, med ${n} kort-kopior. Korten i Mina kort finns kvar.`
    });
    if (!yes) return;
    const ids = new Set(klIds(id));
    saveKlDecks(klDecks().filter(d => !ids.has(d.id)));
    saveKlCards(klCards().filter(c => !ids.has(c.deck)));
    toast("🗑 Kortleken är borttagen");
    if (existing.parent) showKortlek(existing.parent); else showKortlekar();
  };
}

// ---------- Importera från Mina kort ----------
let klPick = null, klPickAdded = 0;
// När kort skapas från en kortleks anteckningar läggs en kopia i kortleken (se runSwipe i app.js)
let klImportTarget = null;
function klAddFromImport(c) {
  if (!klImportTarget || !klDeck(klImportTarget) || !c.sv || !c.es) return null;
  const list = klCards(), id = klNewId();
  list.push({ id, src: c.id, deck: klImportTarget, sv: c.sv, es: c.es, added: Date.now(), box: 0, seen: 0, right: 0, wrong: 0, lastSeen: 0 });
  saveKlCards(list);
  return id;
}
function klStartPick(deckId) {
  klPick = deckId; klPickAdded = 0;
  showMyCards();
}
function klInDeck(deckId, srcId) { return klCards().some(c => c.deck === deckId && c.src === srcId); }
function klPickButton(c) {
  if (!klPick || currentView !== "mycards") return null;
  const b = el("button", "kl-pick");
  const done = klInDeck(klPick, c.id);
  const draw = on => { b.classList.toggle("added", on); b.innerHTML = klSvg(on ? "check" : "plus"); b.title = on ? "Finns i kortleken" : "Lägg en kopia i kortleken"; };
  draw(done);
  if (!c.sv || !c.es) { b.disabled = true; b.title = "Kortet saknar en sida"; }
  b.onclick = e => {
    e.stopPropagation();
    if (klInDeck(klPick, c.id)) { toast("Kortet finns redan i leken"); playClass(b, "shake"); return; }
    const list = klCards();
    list.push({ id: klNewId(), src: c.id, deck: klPick, sv: c.sv, es: c.es, added: Date.now(), box: 0, seen: 0, right: 0, wrong: 0, lastSeen: 0 });
    saveKlCards(list);
    klPickAdded++;
    draw(true);
    playClass(b, "pop");
    burst(b, ["✨", "⭐"], 6);
    floatText("+1", b);
    klUpdatePickBanner();
  };
  return b;
}
function klUpdatePickBanner() {
  const n = view.querySelector("#klPickCount"), d = klDeck(klPick);
  if (n && d) {
    const tot = klDeckCards(klPick, false).length;
    n.textContent = klPickAdded ? `${klPickAdded} tillagda nu · ${tot} kort i leken` : `${tot} kort i leken`;
    playClass(n, "pop");
  }
}
function klPickBanner() {
  const d = klDeck(klPick);
  if (!d) { klPick = null; return; }
  const sec = view.querySelector(".mycards");
  if (!sec || sec.querySelector(".kl-pickbar")) return;
  const bar = klPaint(el("div", "kl-pickbar"), d.color);
  const txt = el("div", "kl-pickbar-text");
  txt.append(el("small", "", "IMPORTERAR TILL"), el("b", "", d.name), el("span", "", "Tryck på plus vid ett kort för att lägga en kopia i leken."), el("small", "kl-pick-count", ""));
  txt.lastChild.id = "klPickCount";
  const done = el("button", "kl-pickbar-done"); done.append(klIconEl("check"), el("span", "", "Klar"));
  done.onclick = () => { const id = klPick; klPick = null; showKortlek(id); };
  bar.append(klIconEl(d.icon, "kl-pickbar-icon"), txt, done);
  sec.prepend(bar);
  sec.classList.add("picking");
  view.querySelector("#btnToKortlekar")?.classList.add("hidden");
  klUpdatePickBanner();
  goBack = () => { const id = klPick; klPick = null; showKortlek(id); };
  titleEl.textContent = "Importera kort";
}

// ---------- Öva en kortlek ----------
function klPracticeDeck(id) {
  const d = klDeck(id);
  return klPracticeDeckIds(new Set(klIds(id)), {
    id: "kl:" + id, klId: id, name: d?.name || "Kortlek", kind: d?.kind || "mixed", color: d?.color,
    back: () => showKortlek(id),
    refresh: () => klPracticeDeck(id)
  });
}
// Övning med korten i flera lekar (används även av provplaneringen)
function klPracticeDeckIds(ids, meta) {
  const list = klCards();
  const save2 = () => saveKlCards(list);
  const mine = list.filter(c => ids.has(c.deck) && c.sv && c.es);
  return {
    ...meta,
    items: mine.map(c => ({
      id: c.id, sv: c.sv, es: c.es,
      isYellow: () => !!c.yellow,
      toggleYellow: () => { c.yellow = !c.yellow; save2(); return c.yellow; },
      yellowText: on => on ? "🟡 Gulmarkerad i kortleken" : "Gulmarkeringen borttagen",
      remove: () => { const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); save2(); },
      box: () => c.box || 0,
      key: "k:" + c.id,
      due: () => stats.due?.["k:" + c.id] || 0,
      record: (ok, opt = {}) => {
        c.seen = (c.seen || 0) + 1; c.lastSeen = Date.now();
        if (ok) { c.right = (c.right || 0) + 1; c.box = clampBox((c.box || 0) + 1); } else { c.wrong = (c.wrong || 0) + 1; c.box = 0; }
        save2();
        return awardPractice("k:" + c.id, ok, c.box, opt);
      },
      touch: (ok, opt = {}) => awardPractice("k:" + c.id, ok, c.box || 0, { ...opt, noBox: true })
    }))
  };
}
// Färgad ruta överst i Öva-menyn som berättar hur övningen anpassas
function klPracticeBanner(deck) {
  if (!deck.klId) return;
  const k = KL_KINDS[deck.kind] || KL_KINDS.mixed;
  const b = klPaint(el("div", "kl-pmbanner kind-" + deck.kind), deck.color);
  const t = el("div", "");
  t.append(el("b", "", `${k.name}-lek: ${deck.name}`), el("small", "", k.tips.join(" · ")));
  b.append(klIconEl(k.icon, "kl-pm-ic"), t);
  const info = view.querySelector("#pmInfo");
  if (info) info.after(b);
}

// ---------- Kopplingar ----------
function klViewChange(name) {
  if (name !== "mycards") klPick = null;
  if (!["import", "swipe", "swipe-done"].includes(name)) klImportTarget = null;
  setTimeout(() => {
    if (currentView !== name) return;
    const tops = klDecks().filter(d => !d.parent), n = klCards().length;
    const info = tops.length ? `${tops.length} ${tops.length === 1 ? "kortlek" : "kortlekar"} · ${n} kort` : null;
    klFillIcons();
    if (name === "home") {
      const b = view.querySelector("#btnKortlekar");
      if (b) { klPaint(b, cfgColor(cfg())); b.onclick = () => showKortlekar(showHome); if (info) $("#klHomeInfo").textContent = info; }
    }
    if (name === "mycards") {
      const b = view.querySelector("#btnToKortlekar");
      if (b) {
        klPaint(b, cfgColor(cfg()));
        b.onclick = () => showKortlekar(showMyCards);
        if (info) $("#klMyInfo").textContent = info;
        b.classList.toggle("hidden", !!klPick);
      }
      if (klPick) klPickBanner();
    }
  }, 0);
}

// Första vyn ritades innan den här filen laddades – fyll i ikonerna nu
klViewChange(currentView);
