// =====================================================================
//  Notes: ett eget anteckningsdokument för varje konfig, kortlek och underkortlek
// =====================================================================
// Sparas i lsKey("notes") = { cfg: {html, at}, <kortleks-id>: {html, at} } och synkas med kontot.
// Markera text (eller använd hela dokumentet) så föreslår AI:n kort att lägga till.

function notesAll() { return load(lsKey("notes"), {}) || {}; }
function notesGet(scope) { return notesAll()[scope]?.html || ""; }
function notesSet(scope, html) { const all = notesAll(); all[scope] = { html, at: Date.now() }; save(lsKey("notes"), all); }
function notesText(html) { const d = document.createElement("div"); d.innerHTML = notesClean(html); return d.textContent.replace(/\s+/g, " ").trim(); }
function notesPreview(scope) {
  const t = notesText(notesGet(scope));
  return t ? "“" + (t.length > 46 ? t.slice(0, 46) + "…" : t) + "”" : "";
}

// Bara enkel formatering får finnas kvar (även när man klistrar in från en webbsida eller Word)
const NOTES_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "P", "DIV", "BR", "UL", "OL", "LI", "H2", "H3", "MARK", "BLOCKQUOTE"]);
function notesClean(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html || "";
  const walk = node => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) continue;
      if (ch.nodeType !== 1 || /^(SCRIPT|STYLE|TITLE|META|LINK|IFRAME|OBJECT|SVG|IMG|VIDEO|AUDIO|TEMPLATE|NOSCRIPT)$/i.test(ch.tagName)) { ch.remove(); continue; }
      walk(ch);
      let tag = ch.tagName;
      // Färgmarkering från webbläsaren (span med bakgrundsfärg) blir <mark>
      if ((tag === "SPAN" || tag === "FONT") && /background/i.test(ch.getAttribute("style") || "")) {
        const m = document.createElement("mark"); m.append(...ch.childNodes); ch.replaceWith(m); continue;
      }
      if (tag === "H1") tag = "H2";
      if (/^H[4-6]$/.test(tag)) tag = "H3";
      if (!NOTES_TAGS.has(tag)) { ch.replaceWith(...ch.childNodes); continue; }
      if (tag !== ch.tagName) { const n = document.createElement(tag); n.append(...ch.childNodes); ch.replaceWith(n); continue; }
      for (const a of [...ch.attributes]) ch.removeAttribute(a.name);
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

function showNotes(scope = "cfg") {
  const c = cfg(), deck = scope !== "cfg" && typeof klDeck === "function" ? klDeck(scope) : null;
  if (scope !== "cfg" && !deck) scope = "cfg";
  const name = deck ? deck.name : c.name;
  titleEl.textContent = "Notes";
  goBack = deck ? () => showKortlek(deck.id) : showHome;
  reopen = () => showNotes(scope);
  render("tpl-notes", "notes");
  if (typeof klPaint === "function") klPaint($("#ntHero"), deck ? deck.color : cfgColor(c));
  $("#ntTitle").textContent = name;
  $("#ntSub").textContent = deck ? `Anteckningar för ${deck.parent ? "underkortleken" : "kortleken"} – bara här` : `Anteckningar för ${c.name} – varje kortlek har sina egna`;
  if (typeof klFillIcons === "function") klFillIcons();

  const ed = $("#ntEditor"), stat = $("#ntStatus"), count = $("#ntCount");
  ed.innerHTML = notesClean(notesGet(scope));
  let saveT = null;
  const updateCount = () => {
    const words = (ed.innerText.trim().match(/\S+/g) || []).length;
    count.textContent = words ? `${words} ${words === 1 ? "ord" : "ord"}` : "";
    ed.classList.toggle("empty", !ed.innerText.trim());
  };
  const saveNow = () => { notesSet(scope, notesClean(ed.innerHTML)); stat.textContent = "✓ Sparat"; stat.classList.add("ok"); };
  ed.addEventListener("input", () => {
    stat.textContent = "Sparar…"; stat.classList.remove("ok");
    clearTimeout(saveT); saveT = setTimeout(saveNow, 600);
    updateCount();
  });
  ed.addEventListener("blur", () => { clearTimeout(saveT); saveNow(); });
  // Klistra in: behåll fetstil, listor och liknande – men inga konstiga stilar och färger
  ed.addEventListener("paste", e => {
    const html = e.clipboardData?.getData("text/html"), text = e.clipboardData?.getData("text/plain");
    if (!html && !text) return;
    e.preventDefault();
    if (html) document.execCommand("insertHTML", false, notesClean(html));
    else document.execCommand("insertText", false, text);
  });
  // Tangentbordet styr inte övningar bakom, och Ctrl+B/I/U fungerar som vanligt
  ed.addEventListener("keydown", e => e.stopPropagation());
  updateCount();

  // Verktygsfältet
  const cmd = (c, v = null) => { ed.focus(); document.execCommand(c, false, v); ed.dispatchEvent(new Event("input")); drawState(); };
  const tools = [
    ["bold", "B", "Fetstil (Ctrl+B)", () => cmd("bold")],
    ["italic", "I", "Kursiv (Ctrl+I)", () => cmd("italic")],
    ["underline", "U", "Understruken (Ctrl+U)", () => cmd("underline")],
    ["h", "Rubrik", "Rubrik", () => { const inH = document.queryCommandValue("formatBlock").toLowerCase() === "h3"; cmd("formatBlock", inH ? "div" : "h3"); }],
    ["mark", "Markera", "Överstrykningspenna", () => cmd("hiliteColor", "#ffe066")],
    ["ul", "• Lista", "Punktlista", () => cmd("insertUnorderedList")],
    ["ol", "1. Lista", "Numrerad lista", () => cmd("insertOrderedList")],
    ["clear", "⌫ Stil", "Ta bort formatering", () => { cmd("removeFormat"); cmd("formatBlock", "div"); }],
    ["undo", "↶", "Ångra", () => cmd("undo")],
    ["redo", "↷", "Gör om", () => cmd("redo")]
  ];
  const bar = $("#ntTools");
  for (const [id, label, title, fn] of tools) {
    const b = el("button", "nt-tool t-" + id, label); b.type = "button"; b.title = title; b.dataset.t = id;
    b.onmousedown = e => e.preventDefault();   // behåll markeringen i texten
    b.onclick = fn;
    bar.append(b);
  }
  function drawState() {
    for (const [id, q] of [["bold", "bold"], ["italic", "italic"], ["underline", "underline"], ["ul", "insertUnorderedList"], ["ol", "insertOrderedList"]]) {
      bar.querySelector(".t-" + id)?.classList.toggle("on", document.queryCommandState(q));
    }
  }
  // Markerad text → en liten knapp som föreslår kort
  const pop = $("#ntPop");
  const selText = () => { const s = getSelection(); return s && !s.isCollapsed && ed.contains(s.anchorNode) ? s.toString().trim() : ""; };
  const onSel = () => {
    if (!alive(ed)) return document.removeEventListener("selectionchange", onSel);
    drawState();
    const t = selText();
    if (t.length < 3) { pop.classList.add("hidden"); return; }
    const r = getSelection().getRangeAt(0).getBoundingClientRect(), box = ed.parentElement.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(box.width - 190, r.left - box.left + r.width / 2 - 95)) + "px";
    pop.style.top = (r.bottom - box.top + 8) + "px";
    pop.classList.remove("hidden");
  };
  document.addEventListener("selectionchange", onSel);

  // AI: föreslå kort av markeringen, eller av hela dokumentet
  const suggest = () => {
    const t = selText() || ed.innerText.trim();
    if (t.length < 10) { toast("Skriv eller markera lite mer text först"); return; }
    saveNow();
    if (typeof klImportTarget !== "undefined") klImportTarget = deck ? deck.id : null;
    save(lsKey("importDraft"), t.slice(0, MAX_IMPORT_CHARS));
    showImport();
    titleEl.textContent = deck ? `Kort till ${deck.name}` : "Kort från Notes";
    setTimeout(() => $("#btnSubmitText")?.click(), 150);
  };
  pop.onmousedown = e => e.preventDefault();
  pop.onclick = suggest;
  $("#ntSuggest").onclick = suggest;
  $("#ntSuggest").querySelector("small").textContent = deck
    ? `Markera text – korten hamnar i Mina kort och i ${deck.name}`
    : "Markera text (eller ta allt) – AI:n plockar ut begreppen";
  $("#ntCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(ed.innerText); toast("📋 Hela texten är kopierad"); } catch { toast("Kunde inte kopiera"); }
  };
  if (!ed.innerText.trim()) setTimeout(() => ed.focus(), 200);
}

// Knappen på startsidan
(function notesInit() {
  const prev = typeof klViewChange === "function" ? klViewChange : null;
  window.klViewChange = function (name) {
    if (prev) prev(name);
    if (name === "home") setTimeout(() => {
      const b = document.getElementById("btnHomeNotes");
      if (!b) return;
      b.onclick = () => showNotes("cfg");
      const p = notesPreview("cfg");
      if (p) $("#homeNotesSub").textContent = p;
    }, 0);
  };
  if (currentView === "home") window.klViewChange("home");
})();
