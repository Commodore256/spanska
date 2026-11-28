// =====================================================================
//  Notes: en bubbla ovanför AI-bubblan med ett eget dokument för varje
//  konfig, kortlek och underkortlek. Följer med där du är i appen.
// =====================================================================
// Sparas i lsKey("notes") = { cfg: {html, at}, <kortleks-id>: {html, at} } och synkas med kontot.

function notesAll() { return load(lsKey("notes"), {}) || {}; }
function notesGet(scope) { return notesAll()[scope]?.html || ""; }
function notesSet(scope, html) {
  const all = notesAll();
  if (!html.replace(/<[^>]*>|&nbsp;|\s/g, "")) { if (!all[scope]) return; html = ""; }
  all[scope] = { html, at: Date.now() }; save(lsKey("notes"), all);
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

// Vilken kortlek är du i just nu? Sätts när du öppnar en kortlek och följer med när du övar på den.
let notesDeck = null;
const NOTES_DECK_VIEWS = new Set(["kl-deck", "kl-edit", "deck", "practice", "cards", "mc", "write", "listen", "speak", "memory", "hard", "done", "import", "swipe", "swipe-done", "settings"]);
(function trackDeck() {
  const sk = showKortlek, se = showKlEdit;
  showKortlek = function (id, ...rest) { notesDeck = id; return sk(id, ...rest); };
  showKlEdit = function (id, parentId, ...rest) { notesDeck = id || parentId || null; return se(id, parentId, ...rest); };
})();
function notesScope() {
  const d = notesDeck && typeof klDeck === "function" ? klDeck(notesDeck) : null;
  return d ? { id: d.id, deck: d, name: d.name, color: d.color, what: d.parent ? "Underkortlek" : "Kortlek" }
           : { id: "cfg", deck: null, name: cfg().name, color: cfgColor(cfg()), what: "Konfig" };
}

const notesUI = (function () {
  const ICON = `<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z M15 3v4h4 M9 11h7 M9 14.5h7 M9 18h4"/></svg>`;
  const fab = el("button", "notes-fab");
  fab.type = "button";
  fab.title = "Notes – anteckningar för där du är just nu";
  fab.setAttribute("aria-label", "Öppna anteckningar");
  fab.innerHTML = `<span class="notes-fab-bubble">${ICON}</span><span class="notes-fab-dot"></span>`;

  const panel = el("div", "notes-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Anteckningar");
  panel.innerHTML = `
    <div class="notes-head">
      <span class="chat-head-blob b1"></span><span class="chat-head-blob b2"></span>
      <span class="notes-avatar">${ICON}</span>
      <div class="chat-head-text"><b class="notes-name"></b><small class="chat-sub notes-sub"></small></div>
      <button class="chat-hbtn notes-big" type="button" title="Större / mindre" aria-label="Ändra storlek">
        <svg viewBox="0 0 24 24"><path d="M14 4h6v6 M20 4l-7 7 M10 20H4v-6 M4 20l7-7"/></svg></button>
      <button class="chat-hbtn chat-close notes-close" type="button" title="Stäng" aria-label="Stäng anteckningarna">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12 M18 6L6 18"/></svg></button>
    </div>
    <div class="nt-tools" role="toolbar" aria-label="Formatering"></div>
    <div class="nt-wrap">
      <div class="nt-editor" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true"
        data-placeholder="Skriv dina anteckningar här… Markera text så kan AI:n föreslå kort."></div>
      <button class="nt-pop hidden" type="button">✨ Föreslå kort av markeringen</button>
    </div>
    <div class="nt-foot">
      <button class="nt-suggest" type="button">✨ Föreslå kort</button>
      <span class="nt-count"></span><span class="nt-status ok">✓ Sparat</span>
    </div>`;
  document.body.append(panel, fab);

  const ed = panel.querySelector(".nt-editor"), stat = panel.querySelector(".nt-status"), count = panel.querySelector(".nt-count");
  const bar = panel.querySelector(".nt-tools"), pop = panel.querySelector(".nt-pop");
  let open = false, scope = null, storeKey = null, saveT = null;
  panel.addEventListener("keydown", e => e.stopPropagation());

  function saveNow() {
    clearTimeout(saveT);
    if (!scope || storeKey !== lsKey("notes") + "|" + scope.id) return;
    notesSet(scope.id, notesClean(ed.innerHTML));
    stat.textContent = "✓ Sparat"; stat.classList.add("ok");
    drawDot();
  }
  function updateCount() {
    const words = (ed.innerText.trim().match(/\S+/g) || []).length;
    count.textContent = words ? `${words} ord` : "";
    ed.classList.toggle("empty", !ed.innerText.trim());
  }
  // Byt dokument när du byter konfig/kortlek – det du skrev sparas först där det hör hemma
  function bind(force) {
    const s = notesScope(), key = lsKey("notes") + "|" + s.id;
    if (!force && key === storeKey) return;
    if (storeKey) saveNow();
    scope = s; storeKey = key;
    ed.innerHTML = notesClean(notesGet(s.id));
    panel.querySelector(".notes-name").textContent = s.name;
    panel.querySelector(".notes-sub").textContent = s.deck ? `${s.what} · bara här` : `Hela ${s.name} · varje kortlek har egna`;
    panel.querySelector(".nt-suggest").title = s.deck ? `Korten hamnar i Mina kort och i ${s.name}` : "Korten hamnar i Mina kort";
    if (typeof klPaint === "function") klPaint(panel, s.color);
    pop.classList.add("hidden");
    updateCount();
  }
  function drawDot() {
    const s = notesScope();
    fab.classList.toggle("has", !!notesGet(s.id).replace(/<[^>]*>|&nbsp;|\s/g, ""));
    if (typeof klPaint === "function") klPaint(fab, s.color);
  }

  ed.addEventListener("input", () => {
    stat.textContent = "Sparar…"; stat.classList.remove("ok");
    clearTimeout(saveT); saveT = setTimeout(saveNow, 600);
    updateCount();
  });
  ed.addEventListener("blur", saveNow);
  addEventListener("pagehide", saveNow);
  ed.addEventListener("paste", e => {
    const html = e.clipboardData?.getData("text/html"), text = e.clipboardData?.getData("text/plain");
    if (!html && !text) return;
    e.preventDefault();
    if (html) document.execCommand("insertHTML", false, notesClean(html));
    else document.execCommand("insertText", false, text);
  });

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
    ["clear", "Rensa stil", "Ta bort formatering", () => { cmd("removeFormat"); cmd("formatBlock", "div"); }],
    ["undo", "↶", "Ångra", () => cmd("undo")],
    ["redo", "↷", "Gör om", () => cmd("redo")]
  ];
  for (const [id, label, title, fn] of tools) {
    const b = el("button", "nt-tool t-" + id, label); b.type = "button"; b.title = title;
    b.onmousedown = e => e.preventDefault();   // behåll markeringen i texten
    b.onclick = fn;
    bar.append(b);
  }
  function drawState() {
    for (const [id, q] of [["bold", "bold"], ["italic", "italic"], ["underline", "underline"], ["ul", "insertUnorderedList"], ["ol", "insertOrderedList"]])
      bar.querySelector(".t-" + id)?.classList.toggle("on", document.queryCommandState(q));
  }

  // Markerad text → en liten knapp som föreslår kort
  const selText = () => { const s = getSelection(); return s && !s.isCollapsed && ed.contains(s.anchorNode) ? s.toString().trim() : ""; };
  document.addEventListener("selectionchange", () => {
    if (!open) return;
    drawState();
    const t = selText();
    if (t.length < 3) { pop.classList.add("hidden"); return; }
    const r = getSelection().getRangeAt(0).getBoundingClientRect(), box = pop.parentElement.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(box.width - 198, r.left - box.left + r.width / 2 - 95)) + "px";
    pop.style.top = Math.min(box.height - 44, Math.max(4, r.bottom - box.top + 8)) + "px";
    pop.classList.remove("hidden");
  });

  // AI: föreslå kort av markeringen, eller av hela dokumentet
  function suggest() {
    const t = selText() || ed.innerText.trim();
    if (t.length < 10) { toast("Skriv eller markera lite mer text först"); return; }
    saveNow();
    const deck = scope.deck, target = deck ? deck.id : null;
    save(lsKey("importDraft"), t.slice(0, MAX_IMPORT_CHARS));
    close();
    showImport();
    klImportTarget = target;   // showImport byter vy – behåll målet
    titleEl.textContent = deck ? `Kort till ${deck.name}` : "Kort från Notes";
    setTimeout(() => $("#btnSubmitText")?.click(), 150);
  }
  pop.onmousedown = e => e.preventDefault();
  pop.onclick = suggest;
  panel.querySelector(".nt-suggest").onclick = suggest;

  function show() {
    open = true; bind(true);
    panel.classList.add("open"); fab.classList.add("active");
    document.body.classList.add("notes-open");
    if (!matchMedia("(pointer: coarse)").matches) setTimeout(() => { ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); }, 250);
  }
  function close() {
    saveNow(); open = false;
    panel.classList.remove("open"); fab.classList.remove("active");
    document.body.classList.remove("notes-open");
    pop.classList.add("hidden");
  }
  fab.onclick = () => open ? close() : show();
  panel.querySelector(".notes-close").onclick = close;
  panel.querySelector(".notes-big").onclick = () => {
    panel.classList.toggle("big");
    try { localStorage.setItem("app.notesBig", panel.classList.contains("big") ? "1" : ""); } catch {}
  };
  try { if (localStorage.getItem("app.notesBig")) panel.classList.add("big"); } catch {}

  // Var panelen hamnar: bredvid Lía-chatten på stor skärm, ovanför den på mobilen
  const chatPanel = document.querySelector(".chat-panel");
  function place() {
    const both = document.body.classList.contains("chat-open") && chatPanel;
    panel.style.right = ""; panel.style.maxWidth = "";
    if (both && innerWidth >= 900) {
      const left = chatPanel.offsetLeft;
      panel.style.right = (innerWidth - left + 14) + "px";
      panel.style.maxWidth = Math.max(280, left - 26) + "px";
    }
  }
  new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  addEventListener("resize", place);
  if (chatPanel) new ResizeObserver(place).observe(chatPanel);

  return {
    show, close,
    onView(name) {
      if (!NOTES_DECK_VIEWS.has(name)) notesDeck = null;
      if (open) bind(); else { scope = null; storeKey = null; }
      drawDot();
    }
  };
})();

// Gammal ingång (t.ex. från andra vyer): öppna bubblan
function showNotes() { notesUI.show(); }

(function hookNotesView() {
  const prev = typeof klViewChange === "function" ? klViewChange : null;
  window.klViewChange = function (name) { if (prev) prev(name); notesUI.onView(name); };
  notesUI.onView(currentView);
})();
