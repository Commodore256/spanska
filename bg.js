// =====================================================================
//  Bakgrund: en färg, två färger som tonar, egen bild, frostad effekt
// =====================================================================
// Inställningarna gäller alla konfiger ("app.bg"), eller bara en konfig (lsKey("bg") med on: true).
// Bilder sparas bara på den här enheten ("app.bgimg.<id>") – de är för stora för att synkas.

const BG_COLORS = ["#ff6b6b", "#f76707", "#fcc419", "#51cf66", "#20c997", "#22b8cf", "#339af0", "#5c7cfa", "#845ef7", "#cc5de8", "#f06595", "#212529",
  "#ffe3e3", "#fff3bf", "#d3f9d8", "#c5f6fa", "#d0ebff", "#e5dbff", "#ffdeeb", "#f1f3f5"];
const BG_TYPES = [
  { id: "none", name: "Standard", desc: "Appens vanliga bakgrund" },
  { id: "solid", name: "En färg", desc: "Välj valfri färg" },
  { id: "gradient", name: "Två färger", desc: "Färgerna tonar i varandra" },
  { id: "image", name: "Egen bild", desc: "Lägg in en PNG eller JPG" }
];
const BG_STYLES = [
  { id: "diag", name: "Diagonal" }, { id: "down", name: "Uppifrån" }, { id: "side", name: "Från sidan" },
  { id: "radial", name: "Cirkel" }, { id: "spot", name: "Spotlight" }, { id: "blobs", name: "Bubblor" },
  { id: "conic", name: "Virvel" }, { id: "flow", name: "Rörlig" }
];
// Färdiga bakgrunder som alla kan välja. Rörliga bakgrunder är korta videor i mappen bakgrunder/
// som spelas utan ljud och går runt i en loop.
const BG_PRESETS = [
  { id: "rain", name: "Regn", video: "bakgrunder/regn.mp4", poster: "bakgrunder/regn.jpg", frost: false, tag: "Rörlig" },
  { id: "sunset", name: "Solnedgång", grad: ["#ff8787", "#5f3dc4"], style: "down" },
  { id: "ocean", name: "Hav", grad: ["#22b8cf", "#1864ab"], style: "flow", tag: "Rörlig" },
  { id: "forest", name: "Skog", grad: ["#8ce99a", "#2b8a3e"], style: "blobs" },
  { id: "candy", name: "Godis", grad: ["#f783ac", "#74c0fc"], style: "conic" },
  { id: "night", name: "Natthimmel", grad: ["#5f3dc4", "#0b1023"], style: "spot" },
  { id: "spain", name: "España", grad: ["#ffd43b", "#e03131"], style: "radial" }
];
const BG_DEFAULT = { type: "none", c1: "#845ef7", c2: "#22b8cf", style: "diag", frost: false, img: null, clearTop: false, original: false };

function bgCss(s) {
  const a = s.c1 || BG_DEFAULT.c1, b = s.c2 || BG_DEFAULT.c2;
  if (s.type === "solid") return a;
  if (s.type === "image") {
    const data = s.img ? load("app.bgimg." + s.img, null) : null;
    return data ? `center / cover no-repeat url("${data}")` : "var(--bg)";
  }
  if (s.type === "preset") {
    const p = BG_PRESETS.find(x => x.id === s.preset);
    if (!p) return "";
    if (p.video) return `center / cover no-repeat url("${p.poster}"), #10141c`;
    return bgCss({ type: "gradient", c1: p.grad[0], c2: p.grad[1], style: p.style });
  }
  if (s.type !== "gradient") return "";
  return {
    diag: `linear-gradient(135deg, ${a}, ${b})`,
    down: `linear-gradient(180deg, ${a}, ${b})`,
    side: `linear-gradient(90deg, ${a}, ${b})`,
    radial: `radial-gradient(circle at 50% 40%, ${a}, ${b} 75%)`,
    spot: `radial-gradient(circle at 18% 12%, ${a} 0%, transparent 62%), ${b}`,
    blobs: `radial-gradient(circle at 20% 22%, ${a} 0 18%, transparent 46%), radial-gradient(circle at 82% 68%, ${a} 0 12%, transparent 40%), radial-gradient(circle at 60% 10%, ${a} 0 6%, transparent 26%), ${b}`,
    conic: `conic-gradient(from 210deg at 50% 45%, ${a}, ${b}, ${a})`,
    flow: `linear-gradient(120deg, ${a}, ${b}, ${a}, ${b})`
  }[s.style] || `linear-gradient(135deg, ${a}, ${b})`;
}

// Vilka inställningar som gäller just nu
function bgPerConfig() { const p = load(lsKey("bg"), null); return p && p.on ? p : null; }
function bgSettings() { return { ...BG_DEFAULT, ...(bgPerConfig() || load("app.bg", null) || {}) }; }
function bgSave(s) {
  if (bgPerConfig()) save(lsKey("bg"), { ...s, on: true });
  else save("app.bg", s);
  applyBg();
}

// Ritar bakgrunden i ett eget lager bakom allt innehåll
function applyBg() {
  let layer = document.getElementById("bgLayer");
  if (!layer) {
    layer = document.createElement("div"); layer.id = "bgLayer"; layer.setAttribute("aria-hidden", "true");
    layer.append(document.createElement("i"));
    document.body.prepend(layer);
  }
  const s = bgSettings(), css = bgCss(s);
  // "Original bakgrund" på = visa appens vanliga bakgrund, men behåll dina val till nästa gång
  const on = !s.original && s.type !== "none" && !!css;
  document.body.classList.toggle("has-bg", on);
  // Genomskinlig topplist: bakgrunden syns över hela skärmen
  document.querySelector(".topbar")?.classList.toggle("clear", on && !!s.clearTop);
  layer.classList.toggle("frost", on && !!s.frost);
  const preset = s.type === "preset" ? BG_PRESETS.find(x => x.id === s.preset) : null;
  layer.classList.toggle("flow", on && ((s.type === "gradient" && s.style === "flow") || (preset && !preset.video && preset.style === "flow")));
  layer.style.background = on ? css : "";
  // Rörlig bakgrund: en video utan ljud som går runt i en loop
  let vid = layer.querySelector("video");
  if (on && preset?.video) {
    if (!vid) {
      vid = document.createElement("video");
      Object.assign(vid, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto" });
      vid.setAttribute("muted", ""); vid.setAttribute("playsinline", "");
      vid.onerror = () => { vid.remove(); };
      layer.prepend(vid);
    }
    if (!vid.src.endsWith(preset.video)) { vid.poster = preset.poster; vid.src = preset.video; }
    bgVideoPlayState();
  } else if (vid) vid.remove();
}
// Videon spelas bara när appen syns och animationer är på (sparar batteri)
function bgVideoPlayState() {
  const vid = document.querySelector("#bgLayer video");
  if (!vid) return;
  const play = !document.hidden && animOn() && !document.body.classList.contains("adv-bg");
  if (play) vid.play().catch(() => {}); else vid.pause();
}
document.addEventListener("visibilitychange", bgVideoPlayState);

// Bild från datorn/telefonen → mindre JPEG, så att den får plats i webbläsarens minne
function bgReadImage(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) return reject(new Error("Välj en PNG- eller JPG-bild"));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const max = 1920, k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const g = cv.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);    // genomskinliga delar blir vita
      g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = 0.85, data = cv.toDataURL("image/jpeg", q);
      while (data.length > 1_400_000 && q > 0.4) { q -= 0.1; data = cv.toDataURL("image/jpeg", q); }
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kunde inte läsa bilden")); };
    img.src = url;
  });
}

// ---------- Vyn: Bakgrund ----------
function showBg() {
  titleEl.textContent = "Bakgrund";
  // ⌂ går tillbaka till Inställningar, och därifrån till där du var innan (t.ex. startsidan) –
  // inte i en loop mellan Bakgrund och Inställningar
  const settingsBack = goBack && goBack !== showBg ? goBack : showHome;
  goBack = () => { reopen = settingsBack; showSettings(); };
  reopen = showBg;
  render("tpl-bg", "bg");
  const c = cfg();
  const prev = $("#bgPreview");

  function draw() {
    const s = bgSettings();
    // Förhandsvisning
    const css = bgCss(s);
    const fill = prev.querySelector(".bgp-fill");
    fill.style.background = s.type !== "none" && css ? css : "";
    const pp = s.type === "preset" ? BG_PRESETS.find(x => x.id === s.preset) : null;
    let pv = fill.querySelector("video");
    if (pp?.video) {
      if (!pv) { pv = document.createElement("video"); Object.assign(pv, { muted: true, loop: true, playsInline: true, autoplay: animOn() }); pv.setAttribute("muted", ""); pv.setAttribute("playsinline", ""); fill.append(pv); }
      if (!pv.src.endsWith(pp.video)) { pv.src = pp.video; pv.poster = pp.poster; }
    } else if (pv) pv.remove();
    prev.classList.toggle("frost", s.type !== "none" && !!s.frost);
    prev.classList.toggle("flow", s.type === "gradient" && s.style === "flow");
    // Bara den här konfigen
    $("#bgScope").checked = !!bgPerConfig();
    $("#bgScopeText").textContent = bgPerConfig() ? `Gäller bara ${c.name}. Andra konfiger har sin egen bakgrund.` : "Gäller alla konfiger. Slå på för att ge den här konfigen en egen bakgrund.";
    // Typ
    view.querySelectorAll(".bg-type").forEach(b => b.classList.toggle("on", b.dataset.type === s.type));
    view.querySelectorAll(".bg-preset").forEach(b => b.classList.toggle("on", s.type === "preset" && b.dataset.preset === s.preset));
    $("#bgSolid").classList.toggle("hidden", s.type !== "solid");
    $("#bgGrad").classList.toggle("hidden", s.type !== "gradient");
    $("#bgImage").classList.toggle("hidden", s.type !== "image");
    $("#bgFrostRow").classList.toggle("hidden", s.type === "none");
    $("#bgFrost").checked = !!s.frost;
    $("#bgClearRow").classList.toggle("hidden", s.type === "none");
    $("#bgClear").checked = !!s.clearTop;
    $("#bgOriginal").checked = !!s.original;
    view.querySelector(".bgv").classList.toggle("is-original", !!s.original);
    prev.classList.toggle("clear-top", !!s.clearTop && s.type !== "none");
    prev.classList.toggle("original", !!s.original);
    // Färger
    view.querySelectorAll(".bg-sw[data-slot]").forEach(b => b.classList.toggle("on", b.dataset.c.toLowerCase() === (s[b.dataset.slot] || "").toLowerCase()));
    view.querySelectorAll("input[type=color][data-slot]").forEach(i => { i.value = s[i.dataset.slot] || "#000000"; });
    view.querySelectorAll(".bg-style").forEach(b => {
      b.classList.toggle("on", b.dataset.style === s.style);
      b.querySelector(".bg-style-swatch").style.background = bgCss({ ...s, type: "gradient", style: b.dataset.style });
    });
    // Mini-bilder i typvalet
    const tSolid = view.querySelector('.bg-type[data-type="solid"] .bg-type-swatch'); if (tSolid) tSolid.style.background = s.c1;
    const tGrad = view.querySelector('.bg-type[data-type="gradient"] .bg-type-swatch'); if (tGrad) tGrad.style.background = bgCss({ ...s, type: "gradient", style: s.style || "diag" });
    const imgData = s.img ? load("app.bgimg." + s.img, null) : null;
    const tImg = view.querySelector('.bg-type[data-type="image"] .bg-type-swatch');
    if (tImg) tImg.style.background = imgData ? `center / cover url("${imgData}")` : "";
    $("#bgImgThumb").style.background = imgData ? `center / cover url("${imgData}")` : "";
    $("#bgImgThumb").classList.toggle("empty", !imgData);
    $("#bgImgRemove").classList.toggle("hidden", !imgData);
  }
  const update = patch => { bgSave({ ...bgSettings(), ...patch }); draw(); };

  // Färdiga bakgrunder
  const presets = $("#bgPresets");
  BG_PRESETS.forEach((p, i) => {
    const b = el("button", "bg-preset"); b.type = "button"; b.dataset.preset = p.id; b.style.setProperty("--i", i);
    const sw = el("span", "bg-preset-swatch");
    if (p.video) {
      sw.style.background = `center / cover url("${p.poster}"), #10141c`;
      const v = document.createElement("video");
      Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: animOn(), preload: "metadata" });
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.src = p.video; v.poster = p.poster;
      v.onerror = () => { b.classList.add("missing"); b.title = "Videon saknas i appen än"; };
      sw.append(v);
    } else sw.style.background = bgCss({ type: "gradient", c1: p.grad[0], c2: p.grad[1], style: p.style });
    if (!p.video && p.style === "flow") sw.classList.add("flow");
    b.append(sw, el("b", "", p.name));
    if (p.tag) b.append(el("span", "bg-preset-tag", "▶ " + p.tag));
    b.onclick = () => {
      if (b.classList.contains("missing")) { toast("Den rörliga bakgrunden finns inte i appen än"); return; }
      update({ type: "preset", preset: p.id, frost: p.frost ?? bgSettings().frost });
      playClass(b, "pop");
    };
    presets.append(b);
  });

  // Typer
  const types = $("#bgTypes");
  BG_TYPES.forEach((t, i) => {
    const b = el("button", "bg-type"); b.type = "button"; b.dataset.type = t.id; b.style.setProperty("--i", i);
    b.append(el("span", "bg-type-swatch t-" + t.id), el("b", "", t.name), el("small", "", t.desc));
    b.onclick = () => { update({ type: t.id }); playClass(b, "pop"); if (t.id === "image" && !bgSettings().img) $("#bgFile").click(); };
    types.append(b);
  });
  // Färgrutor
  function swatches(boxId, slot) {
    const box = $(boxId);
    for (const col of BG_COLORS) {
      const b = el("button", "bg-sw"); b.type = "button"; b.dataset.c = col; b.dataset.slot = slot; b.style.background = col; b.title = col;
      b.onclick = () => update({ [slot]: col });
      box.append(b);
    }
    const pick = el("input"); pick.type = "color"; pick.dataset.slot = slot; pick.title = "Egen färg"; pick.className = "bg-pick";
    pick.oninput = () => update({ [slot]: pick.value });
    box.append(pick);
  }
  swatches("#bgSolidColors", "c1");
  swatches("#bgC1", "c1");
  swatches("#bgC2", "c2");
  $("#bgSwap").onclick = () => { const s = bgSettings(); update({ c1: s.c2, c2: s.c1 }); playClass($("#bgSwap"), "pop"); };
  // Hur färgerna tonar
  const styles = $("#bgStyles");
  BG_STYLES.forEach(st => {
    const b = el("button", "bg-style"); b.type = "button"; b.dataset.style = st.id;
    b.append(el("span", "bg-style-swatch" + (st.id === "flow" ? " flow" : "")), el("small", "", st.name));
    b.onclick = () => update({ style: st.id });
    styles.append(b);
  });
  // Egen bild
  $("#bgPickImg").onclick = () => $("#bgFile").click();
  $("#bgImgThumb").onclick = () => $("#bgFile").click();
  $("#bgFile").onchange = async e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const btn = $("#bgPickImg"); btn.disabled = true; btn.querySelector("b").textContent = "Läser in bilden…";
    try {
      const data = await bgReadImage(file);
      const old = bgSettings().img, id = Date.now().toString(36);
      try { localStorage.setItem("app.bgimg." + id, JSON.stringify(data)); }
      catch { throw new Error("Bilden är för stor för webbläsarens minne – prova en mindre bild"); }
      update({ type: "image", img: id });
      // Ta bort den gamla bilden om ingen annan konfig använder den
      if (old && !bgImageInUse(old)) localStorage.removeItem("app.bgimg." + old);
      toast("🖼️ Bakgrundsbilden är inlagd");
    } catch (err) { toast("⚠ " + (err.message || err)); }
    if (alive(btn)) { btn.disabled = false; btn.querySelector("b").textContent = "Välj en bild"; }
  };
  $("#bgImgRemove").onclick = () => {
    const old = bgSettings().img;
    update({ img: null, type: "none" });
    if (old && !bgImageInUse(old)) localStorage.removeItem("app.bgimg." + old);
  };
  // Frost och omfattning
  $("#bgFrost").onchange = e => update({ frost: e.target.checked });
  $("#bgClear").onchange = e => update({ clearTop: e.target.checked });
  $("#bgOriginal").onchange = e => { update({ original: e.target.checked }); toast(e.target.checked ? "Original bakgrund – dina val sparas till nästa gång" : "🎨 Din bakgrund är på igen"); };
  $("#bgScope").onchange = e => {
    if (e.target.checked) save(lsKey("bg"), { ...bgSettings(), on: true });
    else save(lsKey("bg"), null);
    applyBg(); draw();
    toast(e.target.checked ? `🎨 ${c.name} har nu en egen bakgrund` : "🎨 Bakgrunden gäller alla konfiger");
  };
  $("#bgReset").onclick = () => update({ ...BG_DEFAULT });
  if (typeof klFillIcons === "function") klFillIcons();
  draw();
}
// Används bilden fortfarande av någon konfig, eller av inställningen för alla?
function bgImageInUse(id) {
  return [load("app.bg", null), ...configs.map(c => load(keyFor(c.id, "bg"), null))].some(s => s && s.img === id);
}

// ---------- Kopplingar ----------
(function bgInit() {
  // Byter du konfig byts bakgrunden också
  const prevApply = applyConfigUI;
  window.applyConfigUI = function () { prevApply(); applyBg(); };
  applyBg();
  // Knappen i Inställningar (fylls i varje gång inställningarna visas)
  const prevView = typeof klViewChange === "function" ? klViewChange : null;
  window.klViewChange = function (name) {
    if (prevView) prevView(name);
    if (name === "settings") setTimeout(() => { const b = document.getElementById("btnBg"); if (b) b.onclick = showBg; }, 0);
  };
})();
