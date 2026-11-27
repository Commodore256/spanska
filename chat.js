// =====================================================================
//  Chatta med Lía – AI-hjälp med skolarbetet, alltid nere till höger
// =====================================================================
// Varje konfig har sin egen chatthistorik (sparas och synkas med kontot via lsKey("chat")).
// Laddas sist. Behöver aiConfig/aiHeaders/aiCfgPayload/fetchJson från app.js.

const CHAT_MAX = 80;   // så många meddelanden sparas per konfig
const CHAT_SUGGEST = [
  { icon: "📝", title: "Sammanfatta", text: "Sammanfatta den här texten i en kort punktlista:\n\n" },
  { icon: "💡", title: "Förklara ett begrepp", text: "Förklara begreppet " },
  { icon: "🪄", title: "Skriv enklare", text: "Skriv om det här med enklare ord:\n\n" },
  { icon: "🎯", title: "Förhör mig", text: "Förhör mig med 3 frågor om " }
];

function chatLoad() { return load(lsKey("chat"), []) || []; }
function chatSave(list) { save(lsKey("chat"), list.slice(-CHAT_MAX)); }
function chatId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Ugglans huvud (med hatt och glasögon om hon har på sig sådana) – till knappen och chattens rubrik
function owlHead(mood = "idle", cls = "") {
  const d = el("span", "owl-head " + cls);
  d.dataset.mood = mood;
  d.classList.add("mascot");
  const svg = typeof mascotSVG === "function" ? mascotSVG(mood) : "";
  d.innerHTML = svg.replace('viewBox="0 -34 200 252"', 'viewBox="28 -16 144 144"');
  return d;
}

// Enkel och säker markdown: **fet**, *kursiv*, `kod`, punktlistor och numrerade listor
function chatMarkdown(text) {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = [];
  let list = null;
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) { if (list) out.push(`</${list.type}>`); list = { type }; out.push(`<${type}>`); }
      out.push(`<li>${inline(ul ? ul[1] : ol[2])}</li>`);
      continue;
    }
    if (list) { out.push(`</${list.type}>`); list = null; }
    if (!line.trim()) { out.push('<div class="md-gap"></div>'); continue; }
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    out.push(h ? `<p><b>${inline(h[1])}</b></p>` : `<p>${inline(line)}</p>`);
  }
  if (list) out.push(`</${list.type}>`);
  return out.join("");
}

async function aiChat(messages, c = cfg()) {
  const ai = aiConfig();
  return fetchJson(ai.url.replace(/\/+$/, ""), {
    method: "POST", headers: aiHeaders(ai),
    body: JSON.stringify({ mode: "chat", messages, cfg: aiCfgPayload(c) })
  }, 60000);
}

// ---------- Knappen och rutan ----------
const chatUI = (() => {
  const fab = el("button", "chat-fab");
  fab.type = "button";
  fab.title = "Fråga Lía – AI-hjälp med skolarbetet";
  fab.setAttribute("aria-label", "Öppna chatten med Lía");
  const bubble = el("span", "chat-fab-bubble");
  bubble.append(owlHead("idle", "fab-owl"));
  fab.append(el("span", "chat-fab-ring"), bubble, el("span", "chat-fab-dots", "•••"));

  const panel = el("div", "chat-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chatt med Lía");
  panel.innerHTML = `
    <div class="chat-head">
      <span class="chat-head-blob b1"></span><span class="chat-head-blob b2"></span>
      <span class="chat-avatar"></span>
      <div class="chat-head-text"><b>Fråga Lía</b><small class="chat-sub"></small></div>
      <button class="chat-hbtn chat-clear" type="button" title="Rensa chatten för den här konfigen" aria-label="Rensa chatten">
        <svg viewBox="0 0 24 24"><path d="M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14 M10 10v7 M14 10v7"/></svg></button>
      <button class="chat-hbtn chat-close" type="button" title="Stäng" aria-label="Stäng chatten">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12 M18 6L6 18"/></svg></button>
    </div>
    <div class="chat-msgs" aria-live="polite"></div>
    <div class="chat-chips"></div>
    <form class="chat-form" autocomplete="off">
      <textarea class="chat-input" rows="1" placeholder="Skriv till Lía…" aria-label="Meddelande"></textarea>
      <button class="chat-send" type="submit" title="Skicka" aria-label="Skicka">
        <svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-2.5-6.5z M11.5 13.5L20 4"/></svg></button>
    </form>`;
  document.body.append(fab, panel);

  const msgsEl = panel.querySelector(".chat-msgs"), input = panel.querySelector(".chat-input");
  const form = panel.querySelector(".chat-form"), sendBtn = panel.querySelector(".chat-send");
  const chips = panel.querySelector(".chat-chips"), sub = panel.querySelector(".chat-sub"), avatar = panel.querySelector(".chat-avatar");
  let open = false, busy = false, shownFor = null;

  // Tangenttryck i chatten ska inte styra övningen bakom (t.ex. mellanslag som vänder ett flashcard)
  panel.addEventListener("keydown", e => e.stopPropagation());

  function setAvatar(mood) { avatar.replaceChildren(owlHead(mood, "head-owl")); }

  function bubbleEl(m) {
    const row = el("div", "chat-row " + (m.role === "user" ? "me" : "ai") + (m.error ? " err" : ""));
    if (m.role !== "user") row.append(owlHead(m.error ? "sad" : "happy", "msg-owl"));
    const b = el("div", "chat-bubble");
    if (m.role === "user") b.textContent = m.text;
    else b.innerHTML = chatMarkdown(m.text);
    row.append(b);
    if (m.role !== "user" && !m.error) {
      const copy = el("button", "chat-copy", "Kopiera");
      copy.type = "button";
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(m.text); copy.textContent = "✓ Kopierat"; setTimeout(() => copy.textContent = "Kopiera", 1500); }
        catch { toast("Kunde inte kopiera"); }
      };
      b.append(copy);
    }
    if (m.error) {
      const retry = el("button", "chat-retry", "↻ Försök igen");
      retry.type = "button";
      retry.onclick = () => { const list = chatLoad().filter(x => x.id !== m.id); chatSave(list); draw(); ask(); };
      b.append(retry);
    }
    return row;
  }
  function welcome() {
    const c = cfg(), w = el("div", "chat-welcome");
    w.append(owlHead("wave", "welcome-owl"));
    w.append(el("b", "", `Hej! Jag är ${typeof mascotName === "function" ? mascotName() : "Lía"} 🦉`));
    w.append(el("p", "", `Fråga mig vad som helst om skolarbetet. Den här chatten hör till ${c.name} – varje konfig har sin egen.`));
    const grid = el("div", "chat-suggest");
    CHAT_SUGGEST.forEach((s, i) => {
      const b = el("button", "chat-sug");
      b.type = "button"; b.style.setProperty("--i", i);
      b.append(el("span", "chat-sug-ic", s.icon), el("b", "", s.title));
      b.onclick = () => { input.value = s.text; autosize(); input.focus(); input.setSelectionRange(input.value.length, input.value.length); };
      grid.append(b);
    });
    w.append(grid);
    return w;
  }
  function drawChips(list) {
    chips.innerHTML = "";
    chips.classList.toggle("hidden", !list.length);
    for (const s of CHAT_SUGGEST) {
      const b = el("button", "chat-chip"); b.type = "button";
      b.textContent = `${s.icon} ${s.title}`;
      b.onclick = () => { input.value = s.text; autosize(); input.focus(); };
      chips.append(b);
    }
  }
  function draw() {
    const c = cfg(), list = chatLoad();
    shownFor = activeId;
    sub.textContent = `${c.icon || ""} ${c.name} · egen chatt per konfig`;
    if (typeof klPaint === "function") klPaint(panel, cfgColor(c));
    msgsEl.innerHTML = "";
    if (!aiEnabled()) {
      const w = el("div", "chat-welcome");
      w.append(owlHead("sad", "welcome-owl"), el("b", "", "AI:n är inte kopplad"), el("p", "", "Logga in, eller fyll i AI-koppling under ⚙ Inställningar, så kan du chatta med mig."));
      msgsEl.append(w);
    } else if (!list.length) msgsEl.append(welcome());
    else list.forEach(m => msgsEl.append(bubbleEl(m)));
    if (busy) msgsEl.append(typingEl());
    drawChips(list);
    panel.querySelector(".chat-clear").disabled = !list.length;
    scrollDown();
  }
  function typingEl() {
    const row = el("div", "chat-row ai typing");
    row.append(owlHead("think", "msg-owl"));
    const b = el("div", "chat-bubble");
    b.append(el("i"), el("i"), el("i"));
    row.append(b);
    return row;
  }
  function scrollDown() { requestAnimationFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }); }
  function autosize() { input.style.height = "auto"; input.style.height = Math.min(140, input.scrollHeight) + "px"; }

  async function ask() {
    const list = chatLoad();
    if (!list.length || busy) return;
    busy = true; sendBtn.disabled = true;
    setAvatar("think");
    fab.classList.add("thinking");
    draw();
    const forId = activeId;
    let reply;
    try {
      const r = await aiChat(list.filter(m => !m.error).slice(-20).map(m => ({ role: m.role, content: m.text })));
      reply = { id: chatId(), role: "assistant", text: r.text + (r.cut ? "\n\n*(Svaret blev långt och klipptes av – skriv “fortsätt” så skriver jag mer.)*" : ""), at: Date.now() };
    } catch (e) {
      reply = { id: chatId(), role: "assistant", error: true, text: `Hoppsan, jag kunde inte svara just nu: ${e.message || e}`, at: Date.now() };
    }
    // Svaret sparas i konfigen frågan ställdes i, även om du hunnit byta
    const key = keyFor(forId, "chat"), saved = (load(key, []) || []);
    saved.push(reply); save(key, saved.slice(-CHAT_MAX));
    busy = false; sendBtn.disabled = false;
    fab.classList.remove("thinking");
    setAvatar(reply.error ? "sad" : "happy");
    setTimeout(() => setAvatar("idle"), 2500);
    if (!open) fab.classList.add("unread");
    if (open && activeId === forId) {
      draw();
      const last = msgsEl.lastElementChild;
      if (last) playClass(last, "chat-pop");
    }
  }

  form.onsubmit = e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    if (!aiEnabled()) { toast("AI:n är inte kopplad – logga in eller fyll i AI-koppling under ⚙"); return; }
    const list = chatLoad();
    list.push({ id: chatId(), role: "user", text, at: Date.now() });
    chatSave(list);
    input.value = ""; autosize();
    ask();
    const rows = msgsEl.querySelectorAll(".chat-row.me");
    if (rows.length) playClass(rows[rows.length - 1], "chat-pop");
  };
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    if (e.key === "Escape") close();
  });

  function show() {
    open = true;
    fab.classList.remove("unread");
    document.body.classList.add("chat-open");
    panel.classList.add("open");
    fab.classList.add("active");
    setAvatar("wave");
    setTimeout(() => setAvatar(busy ? "think" : "idle"), 1800);
    draw();
    if (!matchMedia("(pointer: coarse)").matches) setTimeout(() => input.focus(), 250);
  }
  function close() {
    open = false;
    panel.classList.remove("open");
    fab.classList.remove("active");
    document.body.classList.remove("chat-open");
  }
  fab.onclick = () => open ? close() : show();
  panel.querySelector(".chat-close").onclick = close;
  panel.querySelector(".chat-clear").onclick = async () => {
    const yes = await confirmDialog({ title: `Rensa chatten för ${cfg().name}?`, icon: "🗑️", danger: true, ok: "Rensa", cancel: "Behåll",
      text: "Alla meddelanden i den här konfigens chatt tas bort. Andra konfigers chattar påverkas inte." });
    if (!yes) return;
    chatSave([]); draw();
  };
  // Lía blinkar ibland med ögonen på knappen
  setInterval(() => {
    if (open || busy || document.hidden) return;
    const b = fab.querySelector(".chat-fab-bubble");
    b.replaceChildren(owlHead(Math.random() < 0.5 ? "happy" : "idle", "fab-owl"));
    playClass(fab, "chat-wiggle");
  }, 18000);

  return {
    show, close, draw,
    // Byter du konfig medan chatten är öppen visas den konfigens historik
    onView() { if (open && shownFor !== activeId) draw(); fab.querySelector(".chat-fab-bubble").replaceChildren(owlHead("idle", "fab-owl")); }
  };
})();

// Anropas när vyn byts (se render i app.js) – via mascotViewChange-kedjan nedan
(function hookChatView() {
  const prev = typeof klViewChange === "function" ? klViewChange : null;
  window.klViewChange = function (name) { if (prev) prev(name); chatUI.onView(name); };
})();
