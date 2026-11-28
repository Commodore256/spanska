// =====================================================================
//  Från bild: fota boken eller anteckningarna – Lía läser av texten,
//  och sen gör du kort av den, sammanfattar eller får frågorna besvarade
// =====================================================================

// Gör bilden mindre (max 1800 px) så att den går snabbt att skicka
function photoShrink(file, max = 1800) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("Det där var ingen bild"));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      let q = 0.85, data = cv.toDataURL("image/jpeg", q);
      while (data.length > 3_500_000 && q > 0.45) { q -= 0.1; data = cv.toDataURL("image/jpeg", q); }
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kunde inte läsa bilden")); };
    img.src = url;
  });
}
// Skickar bilderna till AI:n, som vet vilken konfig (ämne/språk) du är i
async function photoOcr(files) {
  if (!aiEnabled()) throw new Error("AI:n är inte kopplad – logga in eller fyll i AI-koppling under ⚙");
  const images = [];
  for (const f of files) images.push(typeof f === "string" ? f : await photoShrink(f));
  const ai = aiConfig();
  const r = await fetchJson(ai.url.replace(/\/+$/, ""), {
    method: "POST", headers: aiHeaders(ai),
    body: JSON.stringify({ mode: "ocr", images, cfg: aiCfgPayload() })
  }, 120000);
  if (!r.text) throw new Error("AI:n hittade ingen text i bilden");
  return r.text.trim();
}

function showPhoto() {
  titleEl.textContent = "Från bild";
  goBack = showMyCards; reopen = showPhoto;
  render("tpl-photo", "photo");
  const c = cfg();
  if (typeof klPaint === "function") klPaint($("#phHero"), cfgColor(c));
  $("#phHeroSub").textContent = isLanguage()
    ? `Lía vet att du pluggar ${c.name.toLowerCase()} och läser av ord och accenter därefter.`
    : `Lía vet att du pluggar ${c.name} och känner igen begreppen i ämnet.`;
  if (typeof klFillIcons === "function") klFillIcons();
  let shots = [];   // bilder som dataURL
  const thumbs = $("#phThumbs"), read = $("#phRead"), result = $("#phResult"), ta = $("#phText"), status = $("#phStatus");
  ta.value = load(lsKey("photoDraft"), "");
  result.classList.toggle("hidden", !ta.value);
  ta.oninput = () => save(lsKey("photoDraft"), ta.value);

  function drawThumbs() {
    thumbs.innerHTML = "";
    shots.forEach((d, i) => {
      const t = el("div", "ph-thumb");
      t.style.backgroundImage = `url("${d}")`;
      t.style.setProperty("--i", i);
      const x = el("button", "ph-thumb-x", "✕"); x.type = "button"; x.title = "Ta bort bilden";
      x.onclick = () => { shots.splice(i, 1); drawThumbs(); };
      t.append(x, el("span", "ph-thumb-no", String(i + 1)));
      thumbs.append(t);
    });
    thumbs.classList.toggle("hidden", !shots.length);
    read.classList.toggle("hidden", !shots.length);
    read.querySelector("small").textContent = shots.length === 1 ? "1 bild" : `${shots.length} bilder – läses i ordning`;
  }
  async function addFiles(files) {
    for (const f of [...files].slice(0, 4 - shots.length)) {
      try { shots.push(await photoShrink(f)); } catch (e) { toast("⚠ " + e.message); }
    }
    if (files.length > 4) toast("Max 4 bilder åt gången");
    drawThumbs();
  }
  $("#phCamera").onclick = () => $("#phFileCam").click();
  $("#phPick").onclick = () => $("#phFile").click();
  $("#phFileCam").onchange = e => { addFiles(e.target.files); e.target.value = ""; };
  $("#phFile").onchange = e => { addFiles(e.target.files); e.target.value = ""; };

  read.onclick = async () => {
    if (!shots.length) return;
    read.disabled = true;
    thumbs.classList.add("scanning");
    status.textContent = "";
    status.append(typeof owlHead === "function" ? owlHead("think", "ph-owl") : "", el("span", "", "Lía läser av texten… det kan ta en halv minut."));
    status.classList.remove("hidden");
    try {
      const text = await photoOcr(shots);
      if (!alive(ta)) return;
      ta.value = text; save(lsKey("photoDraft"), text);
      result.classList.remove("hidden");
      playClass(result, "pop-in");
      status.classList.add("hidden");
      setTimeout(() => result.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      if (!alive(status)) return;
      status.textContent = "⚠ " + (e.message || e);
    } finally {
      if (alive(read)) { read.disabled = false; thumbs.classList.remove("scanning"); }
    }
  };

  const text = () => ta.value.trim();
  const need = () => { if (!text()) { toast("Läs av en bild först (eller skriv in text)"); return false; } return true; };
  // Gör kort: samma väg som "Importera från text" – AI:n plockar ut begreppen och du sveper
  $("#phCards").onclick = () => {
    if (!need()) return;
    save(lsKey("importDraft"), text());
    showImport();
    setTimeout(() => $("#btnSubmitText")?.click(), 150);
  };
  $("#phSummary").onclick = () => { if (need() && typeof chatUI !== "undefined") chatUI.send(`Sammanfatta den här texten från en bild. Ta med de viktigaste begreppen:\n\n${text()}`); };
  $("#phAnswer").onclick = () => { if (need() && typeof chatUI !== "undefined") chatUI.send(`Svara på frågorna i den här texten från en bild. Skriv frågan kort och sedan svaret:\n\n${text()}`); };
  $("#phAsk").onclick = () => { if (need() && typeof chatUI !== "undefined") chatUI.context(text()); };
  $("#phClear").onclick = () => { ta.value = ""; save(lsKey("photoDraft"), ""); result.classList.add("hidden"); shots = []; drawThumbs(); };
  drawThumbs();
}
