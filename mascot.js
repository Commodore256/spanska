// =====================================================================
//  Maskoten Lía (ett litet lodjur), mynt, butik, inventory och utmaningar
// =====================================================================
// Laddas sist. Allt som anropas från app.js/adventure.js/sync.js är skyddat med typeof,
// så appen fungerar även om den här filen inte finns.

const MASCOT_DEFAULT_NAME = "Lía";
const SLOTS = [
  { id: "head", name: "Huvud", icon: "🎩" },
  { id: "face", name: "Ansikte", icon: "👓" },
  { id: "body", name: "Kropp", icon: "👕" },
  { id: "hand", name: "Tillbehör", icon: "✋" }
];
const COIN_MASTER = 10, COIN_GOAL = 20, COIN_LEVEL = 30, COIN_ACH = 25, COIN_START = 50;

// ---------- Små ritverktyg ----------
function mStar(cx, cy, r, inner = 0.45) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * inner : r;
    d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1) + " ";
  }
  return d + "Z";
}
function mHeart(cx, cy, s) {
  return `M${cx} ${cy + s * 0.9} C${cx - s * 1.5} ${cy - s * 0.1} ${cx - s * 0.9} ${cy - s * 1.2} ${cx} ${cy - s * 0.35} ` +
    `C${cx + s * 0.9} ${cy - s * 1.2} ${cx + s * 1.5} ${cy - s * 0.1} ${cx} ${cy + s * 0.9} Z`;
}
function mFlower(cx, cy, r, color) {
  let s = "";
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    s += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${r * 0.85}" fill="${color}"/>`;
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="#ffd43b"/>`;
}
const SHIRT = "M58 146 Q62 128 100 128 Q138 128 142 146 L146 186 Q100 204 54 186 Z";

// ---------- Alla kläder och accessoarer ----------
// price = går att köpa i butiken. ach = låses upp av ett märke. chal = låses upp efter så många utmaningar.
const ITEMS = [
  // Huvud
  { id: "hat-cap", slot: "head", name: "Keps", price: 60,
    svg: `<path d="M60 42 Q60 0 100 0 Q140 0 140 42 Z" fill="#e03131"/><path d="M120 42 Q160 34 178 46 Q160 55 122 49 Z" fill="#c92a2a"/><path d="M58 42 Q100 34 142 42 L142 47 Q100 40 58 47 Z" fill="#a51111"/><circle cx="100" cy="1" r="4" fill="#a51111"/><text x="100" y="33" text-anchor="middle" font-size="20" font-weight="900" fill="#fff" font-family="Arial,sans-serif">Ñ</text>` },
  { id: "hat-beanie", slot: "head", name: "Mössa", price: 80,
    svg: `<path d="M58 46 Q56 -4 100 -4 Q144 -4 142 46 Z" fill="#1c7ed6"/><rect x="54" y="34" width="92" height="15" rx="7" fill="#74c0fc"/><path d="M66 36 V47 M78 36 V47 M90 36 V47 M102 36 V47 M114 36 V47 M126 36 V47 M138 36 V47" stroke="#4dabf7" stroke-width="2"/><circle cx="100" cy="-8" r="11" fill="#fff"/>` },
  { id: "hat-flower", slot: "head", name: "Flamencoblomma", price: 90,
    svg: `<path d="M58 44 Q70 40 78 30" stroke="#2f9e44" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="86" cy="42" rx="9" ry="4" transform="rotate(-25 86 42)" fill="#40c057"/>` + mFlower(68, 30, 9, "#e03131") },
  { id: "hat-party", slot: "head", name: "Partyhatt", price: 100,
    svg: `<path d="M78 40 L100 -26 L122 40 Z" fill="#7950f2"/><path d="M93 -2 H107 M86 18 H114 M82 32 H118" stroke="#ffd43b" stroke-width="5"/><circle cx="100" cy="-27" r="7" fill="#ffd43b"/>` },
  { id: "hat-chef", slot: "head", name: "Kockmössa", price: 120,
    svg: `<circle cx="78" cy="10" r="15" fill="#fff" stroke="#ced4da" stroke-width="2"/><circle cx="122" cy="10" r="15" fill="#fff" stroke="#ced4da" stroke-width="2"/><circle cx="100" cy="1" r="18" fill="#fff" stroke="#ced4da" stroke-width="2"/><rect x="70" y="14" width="60" height="30" rx="4" fill="#fff" stroke="#ced4da" stroke-width="2"/><rect x="72" y="14" width="56" height="6" fill="#fff"/>` },
  { id: "hat-headphones", slot: "head", name: "Hörlurar", price: 150,
    svg: `<path d="M42 84 Q38 8 100 8 Q162 8 158 84" stroke="#343a40" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="28" y="68" width="22" height="36" rx="10" fill="#f03e3e"/><rect x="150" y="68" width="22" height="36" rx="10" fill="#f03e3e"/><rect x="33" y="74" width="6" height="24" rx="3" fill="#ff8787"/>` },
  { id: "hat-cordobes", slot: "head", name: "Cordobés-hatt", price: 200,
    svg: `<ellipse cx="100" cy="40" rx="68" ry="10" fill="#212529"/><path d="M70 40 L72 6 Q100 1 128 6 L130 40 Z" fill="#343a40"/><rect x="71" y="27" width="58" height="8" fill="#c92a2a"/><ellipse cx="100" cy="6" rx="28" ry="4" fill="#212529"/>` },
  { id: "hat-student", slot: "head", name: "Studentmössa", ach: "m25",
    svg: `<path d="M62 40 Q60 4 100 4 Q140 4 138 40 Z" fill="#fff" stroke="#ced4da" stroke-width="2"/><path d="M58 40 Q100 52 142 40 L143 47 Q100 61 57 47 Z" fill="#111"/><circle cx="100" cy="26" r="6.5" fill="#fecc02" stroke="#006aa7" stroke-width="4"/>` },
  { id: "hat-crown", slot: "head", name: "Krona", ach: "lvl10",
    svg: `<path d="M64 42 L62 8 L80 24 L100 2 L120 24 L138 8 L136 42 Z" fill="#fcc419" stroke="#e67700" stroke-width="2.5" stroke-linejoin="round"/><circle cx="62" cy="8" r="4" fill="#fff3bf"/><circle cx="100" cy="2" r="4" fill="#fff3bf"/><circle cx="138" cy="8" r="4" fill="#fff3bf"/><circle cx="100" cy="31" r="5" fill="#e03131"/><circle cx="80" cy="33" r="3.5" fill="#1c7ed6"/><circle cx="120" cy="33" r="3.5" fill="#2f9e44"/>` },
  { id: "hat-viking", slot: "head", name: "Vikingahjälm", chal: 10,
    svg: `<path d="M60 30 Q32 26 28 -8 Q46 14 66 16 Z" fill="#fff9db" stroke="#d8c48a" stroke-width="2"/><path d="M140 30 Q168 26 172 -8 Q154 14 134 16 Z" fill="#fff9db" stroke="#d8c48a" stroke-width="2"/><path d="M60 44 Q58 0 100 0 Q142 0 140 44 Z" fill="#adb5bd" stroke="#868e96" stroke-width="2"/><path d="M100 0 V40" stroke="#868e96" stroke-width="5"/><rect x="56" y="36" width="88" height="10" rx="4" fill="#868e96"/><circle cx="68" cy="41" r="2" fill="#dee2e6"/><circle cx="84" cy="41" r="2" fill="#dee2e6"/><circle cx="116" cy="41" r="2" fill="#dee2e6"/><circle cx="132" cy="41" r="2" fill="#dee2e6"/>` },
  { id: "hat-halo", slot: "head", name: "Gloria", chal: 25,
    svg: `<g class="m-float"><ellipse cx="100" cy="-4" rx="36" ry="9" fill="none" stroke="#fff3bf" stroke-width="10" opacity=".55"/><ellipse cx="100" cy="-4" rx="36" ry="9" fill="none" stroke="#fcc419" stroke-width="5"/></g>` },

  // Ansikte
  { id: "face-round", slot: "face", name: "Runda glasögon", price: 60,
    svg: `<circle cx="78" cy="80" r="16" fill="rgba(200,230,255,.25)" stroke="#8d5524" stroke-width="3.5"/><circle cx="122" cy="80" r="16" fill="rgba(200,230,255,.25)" stroke="#8d5524" stroke-width="3.5"/><path d="M94 78 Q100 72 106 78 M62 76 L44 70 M138 76 L156 70" stroke="#8d5524" stroke-width="3.5" fill="none"/>` },
  { id: "face-sun", slot: "face", name: "Solglasögon", price: 80,
    svg: `<rect x="61" y="69" width="35" height="23" rx="9" fill="#111"/><rect x="104" y="69" width="35" height="23" rx="9" fill="#111"/><path d="M96 77 Q100 73 104 77 M62 75 L42 70 M138 75 L158 70" stroke="#111" stroke-width="4" fill="none"/><path d="M68 76 L78 73 M111 76 L121 73" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round"/>` },
  { id: "face-mustache", slot: "face", name: "Mustasch", price: 100,
    svg: `<path d="M100 104 Q90 97 80 103 Q72 109 64 102 Q68 117 84 113 Q94 110 100 107 Q106 110 116 113 Q132 117 136 102 Q128 109 120 103 Q110 97 100 104 Z" fill="#3b2a20"/>` },
  { id: "face-heart", slot: "face", name: "Hjärtglasögon", price: 120,
    svg: `<path d="${mHeart(78, 82, 15)}" fill="#ff6b9d" opacity=".9" stroke="#c2255c" stroke-width="3"/><path d="${mHeart(122, 82, 15)}" fill="#ff6b9d" opacity=".9" stroke="#c2255c" stroke-width="3"/><path d="M93 77 Q100 72 107 77" stroke="#c2255c" stroke-width="3" fill="none"/>` },
  { id: "face-3d", slot: "face", name: "3D-glasögon", price: 150,
    svg: `<rect x="60" y="68" width="80" height="25" rx="4" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/><rect x="64" y="72" width="29" height="17" rx="2" fill="#fa5252" opacity=".85"/><rect x="107" y="72" width="29" height="17" rx="2" fill="#22b8cf" opacity=".85"/><path d="M60 74 L42 70 M140 74 L158 70" stroke="#f8f9fa" stroke-width="4"/>` },
  { id: "face-monocle", slot: "face", name: "Monokel", ach: "memory",
    svg: `<circle cx="122" cy="80" r="15" fill="rgba(255,255,255,.2)" stroke="#fab005" stroke-width="4"/><path d="M128 94 Q134 116 146 126" stroke="#fab005" stroke-width="2" stroke-dasharray="3 2" fill="none"/>` },
  { id: "face-patch", slot: "face", name: "Piratlapp", ach: "night",
    svg: `<path d="M38 74 L150 40" stroke="#111" stroke-width="3"/><ellipse cx="78" cy="80" rx="16" ry="15" fill="#111"/>` },
  { id: "face-star", slot: "face", name: "Stjärnglasögon", ach: "s7",
    svg: `<path d="${mStar(78, 80, 19)}" fill="#ffd43b" opacity=".9" stroke="#f08c00" stroke-width="2.5" stroke-linejoin="round"/><path d="${mStar(122, 80, 19)}" fill="#ffd43b" opacity=".9" stroke="#f08c00" stroke-width="2.5" stroke-linejoin="round"/><path d="M95 78 Q100 74 105 78" stroke="#f08c00" stroke-width="3" fill="none"/>` },

  // Kropp
  { id: "body-bowtie", slot: "body", name: "Fluga", price: 50,
    svg: `<path d="M100 134 L80 123 L80 146 Z" fill="#e03131"/><path d="M100 134 L120 123 L120 146 Z" fill="#e03131"/><circle cx="100" cy="134" r="5.5" fill="#a51111"/>` },
  { id: "body-tie", slot: "body", name: "Slips", price: 70,
    svg: `<path d="M93 129 H107 L104 138 H96 Z" fill="#273b9b"/><path d="M96 138 H104 L109 172 L100 183 L91 172 Z" fill="#364fc7"/><path d="M95 150 L106 144 M93 162 L107 155 M93 174 L108 166" stroke="#748ffc" stroke-width="2.5"/>` },
  { id: "body-scarf", slot: "body", name: "Halsduk", price: 90,
    svg: `<path d="M62 127 Q100 144 138 127 L140 140 Q100 158 60 140 Z" fill="#1971c2"/><path d="M61 134 Q100 151 139 134" stroke="#fcc419" stroke-width="4" fill="none"/><path d="M116 141 L126 182 L111 184 L105 145 Z" fill="#1971c2"/><path d="M113 170 L125 168" stroke="#fcc419" stroke-width="4"/><path d="M112 184 V190 M116 184 V190 M120 183 V189 M124 182 V188" stroke="#1971c2" stroke-width="2"/>` },
  { id: "body-stripes", slot: "body", name: "Randig tröja", price: 120,
    svg: `<clipPath id="mclip{U}"><path d="${SHIRT}"/></clipPath><path d="${SHIRT}" fill="#fff"/><g clip-path="url(#mclip{U})" stroke="#1c3d7a" stroke-width="6"><path d="M40 142 H160 M40 155 H160 M40 168 H160 M40 181 H160 M40 194 H160"/></g>` },
  { id: "body-shawl", slot: "body", name: "Flamencosjal", price: 180,
    svg: `<path d="M58 131 Q100 141 142 131 L100 188 Z" fill="#e03131"/><circle cx="84" cy="142" r="3" fill="#fff"/><circle cx="100" cy="148" r="3" fill="#fff"/><circle cx="116" cy="142" r="3" fill="#fff"/><circle cx="92" cy="160" r="3" fill="#fff"/><circle cx="108" cy="160" r="3" fill="#fff"/><circle cx="100" cy="174" r="3" fill="#fff"/><path d="M100 188 L98 196 M100 188 L102 196 M78 159 L72 165 M122 159 L128 165" stroke="#e03131" stroke-width="2"/>` },
  { id: "body-spain", slot: "body", name: "Spanientröja", price: 200,
    svg: `<path d="${SHIRT}" fill="#c92a2a"/><path d="M86 129 L100 142 L114 129" stroke="#ffd43b" stroke-width="4" fill="none" stroke-linejoin="round"/><text x="100" y="180" font-size="26" font-weight="900" text-anchor="middle" fill="#ffd43b" font-family="Arial,sans-serif">10</text>` },
  { id: "body-cape", slot: "body", name: "Superhjältemantel", ach: "lvl5",
    back: `<path d="M66 130 Q38 178 42 212 L158 212 Q162 178 134 130 Z" fill="#c92a2a"/><path d="M66 130 Q38 178 42 212 L56 212 Q50 178 72 134 Z" fill="#a51111"/>`,
    svg: `<path d="M66 130 Q100 141 134 130" stroke="#a51111" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="100" cy="137" r="5.5" fill="#ffd43b" stroke="#e67700" stroke-width="1.5"/>` },
  { id: "body-medal", slot: "body", name: "Guldmedalj", ach: "perfect",
    svg: `<path d="M86 128 L100 158 L114 128" stroke="#1c7ed6" stroke-width="7" fill="none" stroke-linejoin="round"/><circle cx="100" cy="164" r="12" fill="#fcc419" stroke="#e67700" stroke-width="3"/><text x="100" y="169" font-size="13" font-weight="900" text-anchor="middle" fill="#e67700" font-family="Arial,sans-serif">1</text>` },
  { id: "body-chain", slot: "body", name: "Guldkedja", ach: "c25",
    svg: `<path d="M68 130 Q100 172 132 130" stroke="#fcc419" stroke-width="5" stroke-dasharray="6 3" fill="none"/><circle cx="100" cy="153" r="10" fill="#fcc419" stroke="#e67700" stroke-width="2"/><text x="100" y="158" font-size="12" font-weight="900" text-anchor="middle" fill="#e67700" font-family="Arial,sans-serif">Ñ</text>` },

  // Tillbehör (hålls i högra tassen)
  { id: "hand-icecream", slot: "hand", name: "Glass", price: 60,
    svg: `<path d="M137 170 L159 170 L148 198 Z" fill="#e8a33d"/><path d="M141 176 L154 188 M155 176 L143 188" stroke="#c07a1c" stroke-width="1.5"/><circle cx="142" cy="164" r="9" fill="#ff8fab"/><circle cx="154" cy="164" r="9" fill="#fff3bf"/><circle cx="148" cy="153" r="9" fill="#8c5a3c"/><circle cx="150" cy="144" r="3" fill="#e03131"/>` },
  { id: "hand-balloon", slot: "hand", name: "Ballong", price: 70,
    svg: `<path d="M148 184 Q166 150 178 118" stroke="#868e96" stroke-width="1.6" fill="none"/><g class="m-float"><ellipse cx="182" cy="98" rx="16" ry="20" fill="#f03e3e"/><path d="M178 117 L186 117 L182 122 Z" fill="#c92a2a"/><ellipse cx="176" cy="90" rx="4" ry="7" fill="#fff" opacity=".45"/></g>` },
  { id: "hand-maracas", slot: "hand", name: "Maracas", price: 80,
    svg: `<path d="M146 186 L160 154" stroke="#8d5524" stroke-width="5" stroke-linecap="round"/><ellipse cx="164" cy="144" rx="11" ry="14" transform="rotate(22 164 144)" fill="#f76707"/><path d="M156 140 Q164 133 173 141" stroke="#ffd43b" stroke-width="3" fill="none"/><path d="M157 149 Q164 146 170 152" stroke="#40c057" stroke-width="3" fill="none"/>` },
  { id: "hand-football", slot: "hand", name: "Fotboll", price: 90,
    svg: `<circle cx="157" cy="184" r="13" fill="#fff" stroke="#212529" stroke-width="2"/><path d="${mStar(157, 184, 6, 0.8)}" fill="#212529"/><path d="M157 178 L157 171 M151 182 L145 179 M163 182 L169 179 M153 189 L149 195 M161 189 L165 195" stroke="#212529" stroke-width="1.5"/>` },
  { id: "hand-fan", slot: "hand", name: "Solfjäder", price: 100,
    svg: `<path d="M148 184 L134 142 A45 45 0 0 1 188 160 Z" fill="#e03131"/><path d="M148 184 L134 142 M148 184 L148 139 M148 184 L162 141 M148 184 L175 147 M148 184 L184 153 M148 184 L188 160" stroke="#a51111" stroke-width="1.5"/><path d="M134 142 A45 45 0 0 1 188 160" stroke="#fff" stroke-width="3" stroke-dasharray="2 4" fill="none"/>` },
  { id: "hand-churro", slot: "hand", name: "Churro", price: 120,
    svg: `<path d="M142 190 L180 140" stroke="#d9822b" stroke-width="9" stroke-linecap="round"/><path d="M142 190 L180 140" stroke="#a85d14" stroke-width="2" stroke-dasharray="3 4"/><circle cx="160" cy="166" r="1.3" fill="#fff"/><circle cx="168" cy="155" r="1.3" fill="#fff"/><circle cx="152" cy="178" r="1.3" fill="#fff"/>` },
  { id: "hand-mic", slot: "hand", name: "Mikrofon", price: 150,
    svg: `<path d="M146 188 L160 162" stroke="#343a40" stroke-width="7" stroke-linecap="round"/><circle cx="164" cy="153" r="11" fill="#adb5bd" stroke="#495057" stroke-width="2"/><path d="M156 150 H172 M157 156 H171 M164 143 V163" stroke="#868e96" stroke-width="1.5"/>` },
  { id: "hand-guitar", slot: "hand", name: "Gitarr", price: 250,
    svg: `<g transform="rotate(-38 158 172)"><rect x="155" y="104" width="7" height="54" fill="#5c3a21"/><rect x="152" y="96" width="13" height="13" rx="3" fill="#3b2414"/><circle cx="158.5" cy="160" r="15" fill="#d9822b"/><circle cx="158.5" cy="182" r="19" fill="#d9822b"/><circle cx="158.5" cy="167" r="5.5" fill="#3b2414"/><rect x="151" y="185" width="15" height="4" fill="#3b2414"/><path d="M157 104 V187 M160 104 V187" stroke="#f1f3f5" stroke-width=".8"/></g>` },
  { id: "hand-book", slot: "hand", name: "Spanskboken", ach: "ans100",
    svg: `<g transform="rotate(-12 154 178)"><rect x="138" y="164" width="32" height="26" rx="2" fill="#1971c2"/><rect x="141" y="166" width="3" height="22" fill="#1864ab"/><text x="157" y="182" font-size="11" font-weight="900" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">ES</text></g>` },
  { id: "hand-wand", slot: "hand", name: "Trollstav", ach: "verbs",
    svg: `<path d="M146 188 L170 142" stroke="#212529" stroke-width="5" stroke-linecap="round"/><path d="M146 188 L152 176" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path class="m-twinkle" d="${mStar(172, 136, 11)}" fill="#ffd43b" stroke="#f08c00" stroke-width="1.5" stroke-linejoin="round"/>` },
  { id: "hand-flag", slot: "hand", name: "Spanska flaggan", chal: 1,
    svg: `<path d="M148 192 V108" stroke="#868e96" stroke-width="3.5" stroke-linecap="round"/><g class="m-flag"><rect x="149" y="109" width="40" height="27" fill="#c60b1e"/><rect x="149" y="116" width="40" height="13" fill="#ffc400"/></g>` },
  { id: "hand-sweflag", slot: "hand", name: "Svenska flaggan", chal: 5,
    svg: `<path d="M148 192 V108" stroke="#868e96" stroke-width="3.5" stroke-linecap="round"/><g class="m-flag"><rect x="149" y="109" width="40" height="27" fill="#006aa7"/><rect x="161" y="109" width="6" height="27" fill="#fecc02"/><rect x="149" y="119.5" width="40" height="6" fill="#fecc02"/></g>` }
];
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
// Utsnitt för små ikoner av en pryl
const SLOT_VIEW = { head: "24 -32 156 96", face: "36 52 128 70", body: "36 110 128 106", hand: "116 72 92 130" };

// ---------- Utmaningar (tre nya varje dag) ----------
const CHALLENGES = [
  { id: "ans30", g: "ans", icon: "📚", text: "Svara på 30 kort", goal: 30, val: d => d.n || 0, coins: 15 },
  { id: "ans60", g: "ans", icon: "🏃", text: "Svara på 60 kort", goal: 60, val: d => d.n || 0, coins: 30 },
  { id: "ok20", g: "ok", icon: "✅", text: "Svara rätt 20 gånger", goal: 20, val: d => d.ok || 0, coins: 15 },
  { id: "ok50", g: "ok", icon: "💪", text: "Svara rätt 50 gånger", goal: 50, val: d => d.ok || 0, coins: 30 },
  { id: "xp100", g: "xp", icon: "⚡", text: "Samla 100 XP", goal: 100, val: d => d.xp || 0, coins: 20 },
  { id: "cb8", g: "cb", icon: "🔥", text: "Få 8 rätt i rad", goal: 8, val: d => d.cb || 0, coins: 20 },
  { id: "cb15", g: "cb", icon: "🚀", text: "Få 15 rätt i rad", goal: 15, val: d => d.cb || 0, coins: 30 },
  { id: "adv1", g: "adv", icon: "🗺️", text: "Klara en lektion i Äventyr", goal: 1, val: d => d.adv || 0, coins: 15 },
  { id: "adv3", g: "adv", icon: "🧭", text: "Klara 3 lektioner i Äventyr", goal: 3, val: d => d.adv || 0, coins: 30 },
  { id: "goal", g: "goal", icon: "🎯", text: "Nå ditt dagsmål", goal: 1, val: d => d.goalHit ? 1 : 0, coins: 20 },
  { id: "ms1", g: "ms", icon: "🏆", text: "Lär dig ett kort fullt ut", goal: 1, val: d => d.ms || 0, coins: 25 },
  { id: "mc10", g: "mode", icon: "🔘", text: "10 rätt i Flerval", goal: 10, val: d => d.m_mc || 0, coins: 20 },
  { id: "wr10", g: "mode", icon: "✍️", text: "10 rätt i Skriv svaret", goal: 10, val: d => d.m_write || 0, coins: 20 },
  { id: "li5", g: "mode", icon: "🎧", text: "5 rätt i Lyssna och skriv", goal: 5, val: d => d.m_listen || 0, coins: 20 }
];
function todaysChallenges(day = todayKey()) {
  // Samma tre utmaningar på alla enheter samma dag (slumpas med datumet som frö)
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return h / 4294967296; };
  const pool = [...CHALLENGES], out = [], groups = new Set();
  while (out.length < 3 && pool.length) {
    const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (groups.has(c.g)) continue;
    groups.add(c.g); out.push(c);
  }
  return out;
}

// ---------- Sparat (synkas med kontot via app.*) ----------
function getWardrobe() {
  const w = load("app.wardrobe", null) || {};
  return { owned: w.owned || {}, equip: { head: "", face: "", body: "", hand: "", ...(w.equip || {}) }, name: w.name || MASCOT_DEFAULT_NAME };
}
function saveWardrobe(w) { save("app.wardrobe", w); }
function mascotName() { return getWardrobe().name; }
function getRew() { const r = load("app.mrew", null); return r && typeof r === "object" ? { ach: {}, chal: {}, ...r } : null; }
function saveRew(r) { save("app.mrew", r); }
// Saldo = allt du har tjänat – det du har betalat för dina prylar
function coinsEarned() { return Number(load("app.coins", 0)) || 0; }
function getCoins() {
  const spent = Object.values(getWardrobe().owned).reduce((n, o) => n + (Number(o?.paid) || 0), 0);
  return Math.max(0, coinsEarned() - spent);
}
function earnCoins(n) { n = Math.round(n || 0); if (n > 0) save("app.coins", coinsEarned() + n); return n; }
function owns(id) { return !!getWardrobe().owned[id]; }
function challengesDone() { return Object.keys(getRew()?.chal || {}).length; }
function unlockText(it) {
  if (it.ach) { const a = ACHIEVEMENTS.find(x => x.id === it.ach); return a ? `märket ${a.icon} ${a.name} (${a.desc.toLowerCase()})` : "ett märke"; }
  if (it.chal) return `klara ${it.chal} ${it.chal === 1 ? "utmaning" : "utmaningar"}`;
  return `${it.price} 🪙`;
}

// Första gången: startmynt, och märken man redan har ger sina prylar direkt (utan popup-regn)
function mascotFirstRun() {
  if (getRew()) return false;
  const un = unlockedAch(), r = { lvl: levelFromXP(getXP()), ach: {}, chal: {} };
  for (const id of Object.keys(un)) r.ach[id] = 1;
  saveRew(r);
  earnCoins(COIN_START + Math.min(450, Math.floor(getXP() / 25)) + Object.keys(un).length * 10);
  grantUnlocks();
  return true;
}
// Ger prylar som låses upp av märken och utmaningar. Returnerar de nya.
function grantUnlocks() {
  const w = getWardrobe(), un = unlockedAch(), nChal = challengesDone(), fresh = [];
  for (const it of ITEMS) {
    if (w.owned[it.id]) continue;
    if ((it.ach && un[it.ach]) || (it.chal && nChal >= it.chal)) { w.owned[it.id] = { ts: Date.now(), paid: 0 }; fresh.push(it); }
  }
  if (fresh.length) saveWardrobe(w);
  return fresh;
}

// Delar ut mynt för nivåer, märken och utmaningar som inte belönats än. Idempotent.
function mReconcile() {
  const r = getRew();
  if (!r) return 0;
  let coins = 0;
  const lvl = levelFromXP(getXP());
  if (typeof r.lvl !== "number") r.lvl = lvl;
  while (r.lvl < lvl) {
    r.lvl++; coins += COIN_LEVEL;
    mascotEvent({ mood: "celebrate", title: `⭐ Nivå ${r.lvl}!`, text: mPick(["Du blir bättre för varje dag! ¡Increíble!", "Ny nivå! Jag är så stolt över dig 🥹", "¡Olé! Vi klättrar uppåt!"]), coins: COIN_LEVEL, big: true });
  }
  const un = unlockedAch();
  for (const a of ACHIEVEMENTS) {
    if (un[a.id] && !r.ach[a.id]) {
      r.ach[a.id] = 1; coins += COIN_ACH;
      mascotEvent({ mood: "love", title: `${a.icon} Nytt märke: ${a.name}`, text: a.desc, coins: COIN_ACH });
    }
  }
  const day = todayKey(), d = getDays()[day] || {};
  for (const ch of todaysChallenges(day)) {
    const k = day + ":" + ch.id;
    if (!r.chal[k] && ch.val(d) >= ch.goal) {
      r.chal[k] = Date.now(); coins += ch.coins;
      mascotEvent({ mood: "happy", title: "🎯 Utmaning klar!", text: `${ch.icon} ${ch.text}`, coins: ch.coins });
    }
  }
  saveRew(r);
  earnCoins(coins);
  for (const it of grantUnlocks()) mascotEvent({ mood: "love", title: "🎁 Ny pryl upplåst!", text: `${it.name} – för ${unlockText(it)}`, item: it });
  return coins;
}

// Anropas av awardPractice() i app.js för varje svar
function mascotAward({ ok, mult = 1, mastered, goalReached, firstToday }) {
  if (!getRew()) mascotFirstRun();
  let c = ok ? mult : 0;
  if (mastered) c += COIN_MASTER;
  if (firstToday) {
    const s = currentStreak(), b = 5 + Math.min(s, 10);
    c += b;
    mascotEvent(s >= 2
      ? { mood: "proud", title: `🔥 ${s} dagar i rad!`, text: mPick(["Streaken lever! Fortsätt så här!", "Du är ostoppbar! Vi ses imorgon också 😼", "¡Fuego! Det här är vanan som gör dig grym på spanska."]), coins: b, big: true }
      : { mood: "happy", title: "🔥 Dagens första svar!", text: "Streaken är igång. Kom tillbaka imorgon så växer den!", coins: b });
  }
  if (goalReached) {
    c += COIN_GOAL;
    mascotEvent({ mood: "celebrate", title: "🎯 Dagsmålet nått!", text: `${getGoal()} kort idag. ¡Qué bien!`, coins: COIN_GOAL, big: true });
  }
  earnCoins(c);
  return { coins: c + mReconcile() };
}
function mPick(a) { return a[Math.floor(Math.random() * a.length)]; }

// ---------- Ritar maskoten ----------
const MOODS = {
  idle: { eyes: "open", mouth: "smile" },
  happy: { eyes: "happy", mouth: "big" },
  celebrate: { eyes: "star", mouth: "big", fx: "sparkle" },
  sad: { eyes: "sad", mouth: "sad", brows: "sad", fx: "tear" },
  wave: { eyes: "happy", mouth: "smile" },
  proud: { eyes: "happy", mouth: "smirk", brows: "proud", fx: "fire" },
  sleepy: { eyes: "closed", mouth: "o", fx: "zzz" },
  love: { eyes: "heart", mouth: "big", fx: "hearts" },
  think: { eyes: "open", mouth: "flat", brows: "think", fx: "think" },
  shock: { eyes: "shock", mouth: "o", fx: "sweat" }
};
const INK = "#2a1d15", FUR = "#f0b066", FUR2 = "#e39b4f", CREAM = "#fff4e2", SPOT = "#c98242";
const EYES = {
  open: `<g class="m-blink"><ellipse cx="78" cy="80" rx="11" ry="13" fill="#fff"/><ellipse cx="122" cy="80" rx="11" ry="13" fill="#fff"/><g class="m-pupils"><circle cx="79" cy="82" r="7" fill="${INK}"/><circle cx="121" cy="82" r="7" fill="${INK}"/><circle cx="81.5" cy="79" r="2.4" fill="#fff"/><circle cx="123.5" cy="79" r="2.4" fill="#fff"/></g></g>`,
  happy: `<path d="M67 84 Q78 70 89 84 M111 84 Q122 70 133 84" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
  closed: `<path d="M67 81 Q78 88 89 81 M111 81 Q122 88 133 81" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  sad: `<ellipse cx="78" cy="82" rx="10" ry="11" fill="#fff"/><ellipse cx="122" cy="82" rx="10" ry="11" fill="#fff"/><circle cx="78" cy="86" r="6" fill="${INK}"/><circle cx="122" cy="86" r="6" fill="${INK}"/><circle cx="80" cy="84" r="2" fill="#fff"/><circle cx="124" cy="84" r="2" fill="#fff"/>`,
  star: `<path d="${mStar(78, 80, 13)}" fill="#ffd43b" stroke="#e8a200" stroke-width="2" stroke-linejoin="round"/><path d="${mStar(122, 80, 13)}" fill="#ffd43b" stroke="#e8a200" stroke-width="2" stroke-linejoin="round"/>`,
  heart: `<path d="${mHeart(78, 82, 11)}" fill="#ff4d6d"/><path d="${mHeart(122, 82, 11)}" fill="#ff4d6d"/>`,
  shock: `<circle cx="78" cy="80" r="13" fill="#fff" stroke="${INK}" stroke-width="1.5"/><circle cx="122" cy="80" r="13" fill="#fff" stroke="${INK}" stroke-width="1.5"/><circle cx="78" cy="80" r="4" fill="${INK}"/><circle cx="122" cy="80" r="4" fill="${INK}"/>`
};
const BROWS = {
  sad: `<path d="M67 70 L87 63 M133 70 L113 63" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  proud: `<path d="M67 63 L88 66 M112 66 L133 63" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  think: `<path d="M67 62 Q78 55 89 62 M112 66 L132 66" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`
};
const NOSE_LINE = `<path d="M100 101 V108" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
const MOUTHS = {
  smile: NOSE_LINE + `<path d="M88 108 Q94 115 100 108 Q106 115 112 108" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  big: NOSE_LINE + `<path d="M85 108 H115 Q113 127 100 127 Q87 127 85 108 Z" fill="#7a2b2b"/><path d="M91 121 Q100 114 109 121 Q105 127 100 127 Q95 127 91 121 Z" fill="#ff8a8a"/>`,
  sad: NOSE_LINE + `<path d="M88 118 Q100 107 112 118" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  o: NOSE_LINE + `<ellipse cx="100" cy="115" rx="6" ry="7" fill="#7a2b2b"/>`,
  flat: NOSE_LINE + `<path d="M91 112 H109" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  smirk: NOSE_LINE + `<path d="M89 110 Q102 117 114 105" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`
};
const FX = {
  tear: `<path class="m-tear" d="M86 92 Q81 101 86 105 Q91 101 86 92 Z" fill="#74c0fc"/>`,
  zzz: `<g class="m-zzz" font-family="Arial,sans-serif" font-weight="900" fill="#74c0fc"><text x="150" y="16" font-size="16">z</text><text x="162" y="2" font-size="20">z</text><text x="176" y="-14" font-size="25">Z</text></g>`,
  sparkle: `<g class="m-sparkle"><path d="${mStar(30, 40, 9, 0.35)}" fill="#ffd43b"/><path d="${mStar(172, 30, 11, 0.35)}" fill="#ffd43b"/><path d="${mStar(178, 120, 7, 0.35)}" fill="#ff6b9d"/><path d="${mStar(22, 130, 7, 0.35)}" fill="#74c0fc"/></g>`,
  hearts: `<g class="m-hearts"><path d="${mHeart(30, 40, 8)}" fill="#ff4d6d"/><path d="${mHeart(172, 26, 10)}" fill="#ff6b9d"/><path d="${mHeart(180, 110, 6)}" fill="#ff4d6d"/></g>`,
  fire: `<text class="m-fire" x="170" y="34" font-size="30" text-anchor="middle">🔥</text>`,
  think: `<g class="m-think" font-family="Arial,sans-serif" font-weight="900"><circle cx="160" cy="34" r="4" fill="#dee2e6"/><circle cx="170" cy="20" r="6" fill="#dee2e6"/><text x="182" y="6" font-size="28" fill="#748ffc" text-anchor="middle">?</text></g>`,
  sweat: `<path class="m-sweat" d="M158 46 Q152 56 158 60 Q164 56 158 46 Z" fill="#74c0fc"/>`
};
let mascotUid = 0;
function mascotSVG(mood = "idle", equip = getWardrobe().equip) {
  const m = MOODS[mood] || MOODS.idle, u = ++mascotUid;
  const part = slot => ITEM_BY_ID[equip?.[slot]];
  const svg = it => it ? it.svg.replaceAll("{U}", u) : "";
  const body = part("body");
  return `<svg viewBox="0 -34 200 252" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<ellipse class="m-shadow" cx="100" cy="212" rx="50" ry="7" fill="rgba(0,0,0,.16)"/>
<g class="m-all">
  ${body?.back || ""}
  <g class="m-tail"><path d="M134 188 Q180 186 172 142 Q170 130 160 133" stroke="${FUR2}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M169 148 Q170 134 160 133" stroke="#3b2a20" stroke-width="13" fill="none" stroke-linecap="round"/></g>
  <ellipse cx="80" cy="204" rx="17" ry="9" fill="${FUR2}"/><ellipse cx="120" cy="204" rx="17" ry="9" fill="${FUR2}"/>
  <path d="M74 206 V211 M80 207 V212 M86 206 V211 M114 206 V211 M120 207 V212 M126 206 V211" stroke="${SPOT}" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="100" cy="166" rx="44" ry="40" fill="${FUR}"/>
  <ellipse cx="100" cy="174" rx="27" ry="27" fill="${CREAM}"/>
  <circle cx="70" cy="158" r="3.5" fill="${SPOT}"/><circle cx="76" cy="180" r="3" fill="${SPOT}"/><circle cx="130" cy="156" r="3.5" fill="${SPOT}"/><circle cx="124" cy="182" r="3" fill="${SPOT}"/>
  ${svg(body)}
  <g class="m-arm m-arm-l"><ellipse cx="60" cy="166" rx="11" ry="20" transform="rotate(18 60 166)" fill="${FUR}"/></g>
  <g class="m-arm m-arm-r"><ellipse cx="140" cy="166" rx="11" ry="20" transform="rotate(-18 140 166)" fill="${FUR}"/>${svg(part("hand"))}</g>
  <g class="m-head">
    <g class="m-ear m-ear-l"><path d="M50 58 L60 6 L92 36 Z" fill="${FUR}" stroke="${FUR}" stroke-width="6" stroke-linejoin="round"/><path d="M59 47 L63 21 L81 38 Z" fill="#f6c3b5"/><path d="M60 6 L56 -11" stroke="#3b2a20" stroke-width="5" stroke-linecap="round"/></g>
    <g class="m-ear m-ear-r"><path d="M150 58 L140 6 L108 36 Z" fill="${FUR}" stroke="${FUR}" stroke-width="6" stroke-linejoin="round"/><path d="M141 47 L137 21 L119 38 Z" fill="#f6c3b5"/><path d="M140 6 L144 -11" stroke="#3b2a20" stroke-width="5" stroke-linecap="round"/></g>
    <path d="M46 82 L24 116 L52 108 L44 128 L72 112 Z" fill="${FUR}"/><path d="M154 82 L176 116 L148 108 L156 128 L128 112 Z" fill="${FUR}"/>
    <ellipse cx="100" cy="80" rx="60" ry="52" fill="${FUR}"/>
    <path d="M92 34 L94 46 M100 32 V46 M108 34 L106 46 M44 74 L56 76 M44 86 L56 84 M156 74 L144 76 M156 86 L144 84" stroke="${SPOT}" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="100" cy="105" rx="27" ry="18" fill="${CREAM}"/>
    <circle cx="62" cy="100" r="9" fill="#ff8f8f" opacity=".45"/><circle cx="138" cy="100" r="9" fill="#ff8f8f" opacity=".45"/>
    ${EYES[m.eyes]}${BROWS[m.brows] || ""}
    <path d="M93 95 Q100 91 107 95 Q100 104 93 95 Z" fill="#4a2f25"/>
    ${MOUTHS[m.mouth]}
    ${svg(part("face"))}${svg(part("head"))}
    ${m.fx === "tear" || m.fx === "sweat" ? FX[m.fx] : ""}
  </g>
</g>
${m.fx && m.fx !== "tear" && m.fx !== "sweat" ? FX[m.fx] : ""}
</svg>`;
}
// Ett element med maskoten. cls: t.ex. "mini", "big"
function mascotEl(mood = "idle", cls = "", equip) {
  const d = el("div", "mascot " + cls);
  d.dataset.mood = mood;
  d.innerHTML = mascotSVG(mood, equip);
  return d;
}
function setMood(elem, mood, equip) {
  if (!elem) return;
  elem.dataset.mood = mood;
  elem.innerHTML = mascotSVG(mood, equip);
}
function mascotMini(mood) { return mascotEl(mood, "mini"); }
function itemIcon(it) {
  const d = el("span", "item-icon");
  d.innerHTML = `<svg viewBox="${SLOT_VIEW[it.slot]}" aria-hidden="true">${it.back || ""}${it.svg.replaceAll("{U}", "i" + (++mascotUid))}</svg>`;
  return d;
}

// ---------- Popup-händelser (visas när du inte är mitt i en övning) ----------
const MASCOT_CALM = new Set(["home", "adv", "adv-done", "done", "swipe-done", "ach", "mascot", "mycards", "deck", "list", "settings", "cats"]);
let mQueue = [], mShowing = false;
function mascotEvent(ev) {
  if (mQueue.length >= 6) mQueue.splice(1, 1);   // inget popup-regn
  mQueue.push(ev);
  setTimeout(pumpMascot, 350);
}
function pumpMascot() {
  if (mShowing || !mQueue.length) return;
  if (!MASCOT_CALM.has(currentView) || document.body.classList.contains("login-mode")) return;
  showMascotPop(mQueue.shift());
}
function showMascotPop(ev) {
  mShowing = true;
  const bg = el("div", "mpop-bg"), card = el("div", "mpop" + (ev.big ? " big" : ""));
  const fig = mascotEl(ev.mood || "happy", "pop-fig");
  card.append(fig, el("h3", "", ev.title || ""));
  if (ev.text) card.append(el("p", "", ev.text));
  if (ev.item) {
    const tile = el("div", "mpop-item");
    tile.append(itemIcon(ev.item), el("b", "", ev.item.name));
    card.append(tile);
  }
  if (ev.coins) card.append(el("div", "mpop-coins", `+${ev.coins} 🪙`));
  const row = el("div", "mpop-row");
  if (ev.item && owns(ev.item.id)) {
    const wear = el("button", "btn good", "Ta på");
    wear.onclick = e => { e.stopPropagation(); equipItem(ev.item.id, true); close(); };
    row.append(wear);
  }
  const ok = el("button", "btn" + (ev.item ? " secondary" : " good"), ev.button || "Fortsätt");
  row.append(ok);
  card.append(row);
  bg.append(card);
  document.body.append(bg);
  requestAnimationFrame(() => bg.classList.add("show"));
  if (ev.mood === "celebrate" || ev.mood === "love") setTimeout(() => burst(fig, ev.mood === "love" ? ["💖", "✨", "💛", "⭐"] : ["🎉", "⭐", "✨", "🎊", "🪙"], 20), 250);
  let closed = false;
  const timer = ev.item ? null : setTimeout(close, ev.big ? 6000 : 4200);
  function close() {
    if (closed) return;
    closed = true; clearTimeout(timer);
    bg.classList.remove("show");
    setTimeout(() => { bg.remove(); mShowing = false; refreshMascotBits(); setTimeout(pumpMascot, 200); }, 220);
  }
  ok.onclick = e => { e.stopPropagation(); close(); };
  bg.onclick = e => { if (e.target === bg) close(); };
  ok.focus();
}

// ---------- Utrusta ----------
function equipItem(id, on = true) {
  const it = ITEM_BY_ID[id], w = getWardrobe();
  if (!it || !w.owned[id]) return;
  w.equip[it.slot] = on ? id : (w.equip[it.slot] === id ? "" : w.equip[it.slot]);
  saveWardrobe(w);
  refreshMascotBits();
}
function buyItem(id) {
  const it = ITEM_BY_ID[id];
  if (!it || !it.price || owns(id)) return false;
  if (getCoins() < it.price) return false;
  const w = getWardrobe();
  w.owned[id] = { ts: Date.now(), paid: it.price };
  w.equip[it.slot] = id;
  saveWardrobe(w);
  return true;
}

// ---------- Vad Lía säger på startsidan ----------
function homeMood() {
  const h = new Date().getHours(), today = todayCount(), st = currentStreak(), goal = getGoal();
  const name = mascotName();
  if (h >= 23 || h < 5) return ["sleepy", today ? "Zzz… bra jobbat idag. Dags att sova? 😴" : "Zzz… det är sent. Ett par kort och sen sängen?"];
  if (!today && h >= 17 && st > 0) return ["sad", `Vi har inte övat idag än 🥺 Din streak på ${st} ${st === 1 ? "dag" : "dagar"} vill inte brinna ut!`];
  if (!today) return ["wave", mPick([`¡Hola! Jag är ${name}. Ska vi köra en runda?`, "¡Buenos días! Redo för lite spanska?", "Hej igen! Dina kort längtar efter dig 📚"])];
  if (today >= goal) return ["proud", mPick(["Dagsmålet är klart! 🎯 Du är grym.", "¡Perfecto! Allt du gör nu är bonus 😼"])];
  return ["happy", `${today}/${goal} kort idag – ${goal - today} kvar till dagsmålet!`];
}
const TAP_LINES = ["¡Hola!", "¡Vamos!", "¡Qué guay!", "Miau… menar jag, ¡olé!", "Pssst… butiken har nya grejer 👀", "¿Qué tal?", "Jag är ett iberiskt lodjur, världens coolaste katt 😼", "¡Ánimo!"];

// Kortet överst på startsidan
function renderHomeMascot() {
  const box = view.querySelector("#homeMascot");
  if (!box) return;
  box.innerHTML = "";
  const [mood, text] = homeMood();
  const fig = mascotEl(mood, "home-fig");
  const figBtn = el("button", "hm-fig");
  figBtn.title = `Klappa ${mascotName()}`;
  figBtn.append(fig);
  const side = el("div", "hm-side");
  const bubble = el("div", "hm-bubble", text);
  const row = el("div", "hm-row");
  const coins = el("span", "coin-chip", "");
  coins.append(el("span", "", "🪙"), el("b", "", String(getCoins())));
  coins.title = "Dina mynt";
  const chs = todaysChallenges(), d = getDays()[todayKey()] || {}, done = chs.filter(c => c.val(d) >= c.goal).length;
  const chal = el("button", "hm-chal", `🎯 ${done}/3 utmaningar`);
  chal.onclick = () => showMascot("chal");
  const open = el("button", "btn-small hm-open", "👕 Garderob & butik");
  open.onclick = () => showMascot("inv");
  row.append(coins, chal, open);
  side.append(bubble, row);
  box.append(figBtn, side);
  figBtn.onclick = () => {
    const m = mPick(["happy", "love", "wave", "celebrate", "shock", "think"]);
    setMood(fig, m);
    bubble.textContent = TAP_LINES[Math.floor(Math.random() * TAP_LINES.length)];
    playClass(bubble, "pop");
    if (m === "love") burst(figBtn, ["💖", "✨"], 8);
    clearTimeout(figBtn._t);
    figBtn._t = setTimeout(() => { if (alive(fig)) { const [m0] = homeMood(); setMood(fig, m0); } }, 2600);
  };
  playClass(fig, "bounce-in");
}
function refreshMascotBits() {
  if (currentView === "home") renderHomeMascot();
  if (currentView === "mascot" && typeof mvRefresh === "function") mvRefresh();
  const c = view.querySelector("#advCoins");
  if (c) c.textContent = getCoins();
}

// ---------- Vyn: inventory, butik och utmaningar ----------
let mvRefresh = null;
function showMascot(tab = "inv") {
  titleEl.textContent = `${mascotName()} 🐾`;
  goBack = showHome; reopen = () => showMascot(tab);
  render("tpl-mascot", "mascot");
  let filter = "all", tryOn = null;      // tryOn = pryl du provar i butiken
  const fig = $("#mvFig"), body = $("#mvBody");
  const stageMood = () => tryOn ? "happy" : "idle";
  function equipWith() { const e = { ...getWardrobe().equip }; if (tryOn) e[tryOn.slot] = tryOn.id; return e; }
  function drawStage() {
    setMood(fig, fig.dataset.mood === "love" ? "love" : stageMood(), equipWith());
    $("#mvCoins").textContent = getCoins();
    $("#mvName").textContent = mascotName() + " ✏️";
    const slots = $("#mvSlots"); slots.innerHTML = "";
    const eq = getWardrobe().equip;
    for (const s of SLOTS) {
      const it = ITEM_BY_ID[eq[s.id]];
      const b = el("button", "inv-slot" + (it ? " filled" : ""));
      b.title = it ? `${s.name}: ${it.name} – tryck för att ta av` : `${s.name}: tomt`;
      if (it) b.append(itemIcon(it)); else b.append(el("span", "slot-ghost", s.icon));
      b.append(el("small", "", s.name));
      b.onclick = () => { if (it) { equipItem(it.id, false); playClass(b, "pop"); } else { tab = "inv"; filter = s.id; drawTabs(); } };
      slots.append(b);
    }
  }
  function filterChips() {
    const row = el("div", "chips inv-filter");
    for (const [id, name] of [["all", "Alla"], ...SLOTS.map(s => [s.id, s.icon + " " + s.name])]) {
      const c = el("button", "chip" + (filter === id ? " active" : ""), name);
      c.onclick = () => { filter = id; drawTabs(); };
      row.append(c);
    }
    return row;
  }
  function drawInv() {
    const w = getWardrobe(), mine = ITEMS.filter(it => w.owned[it.id] && (filter === "all" || it.slot === filter));
    const total = ITEMS.filter(it => filter === "all" || it.slot === filter).length;
    body.append(filterChips(), el("p", "muted small", `Du har ${mine.length} av ${total} prylar. Tryck för att ta på eller av – en per plats, precis som rustningen i Minecraft.`));
    const grid = el("div", "inv-grid");
    for (const it of mine) {
      const on = w.equip[it.slot] === it.id;
      const b = el("button", "inv-cell" + (on ? " on" : ""));
      b.title = `${it.name} (${SLOTS.find(s => s.id === it.slot).name})` + (on ? " – på" : "");
      b.append(itemIcon(it), el("small", "", it.name));
      b.onclick = () => { equipItem(it.id, !on); setMood(fig, on ? "think" : "happy", equipWith()); playClass(fig, "pop"); };
      grid.append(b);
    }
    // Tomma rutor så att det ser ut som ett riktigt inventory
    const pad = Math.max(12, Math.ceil((mine.length + 1) / 6) * 6) - mine.length;
    for (let i = 0; i < pad; i++) grid.append(el("div", "inv-cell empty"));
    body.append(grid);
    if (!mine.length) body.append(el("p", "muted", "Tomt än så länge – köp något i 🛒 Butiken eller lås upp prylar med märken och utmaningar."));
  }
  function drawShop() {
    const w = getWardrobe();
    body.append(filterChips());
    const forSale = ITEMS.filter(it => it.price && !w.owned[it.id] && (filter === "all" || it.slot === filter)).sort((a, b) => a.price - b.price);
    body.append(el("h3", "shop-h", "🛒 Till salu"));
    if (!forSale.length) body.append(el("p", "muted", "Du har köpt allt här! 🎉"));
    const grid = el("div", "shop-grid");
    for (const it of forSale) {
      const b = el("button", "shop-cell" + (tryOn?.id === it.id ? " trying" : "") + (getCoins() < it.price ? " poor" : ""));
      b.append(itemIcon(it), el("b", "", it.name), el("span", "price", `🪙 ${it.price}`));
      b.onclick = () => { tryOn = tryOn?.id === it.id ? null : it; drawTabs(); playClass(fig, "pop"); };
      grid.append(b);
    }
    body.append(grid);
    const locked = ITEMS.filter(it => !it.price && !w.owned[it.id] && (filter === "all" || it.slot === filter));
    if (locked.length) {
      body.append(el("h3", "shop-h", "🔒 Belöningar"), el("p", "muted small", "De här går inte att köpa – de låses upp med märken och utmaningar."));
      const g2 = el("div", "shop-grid");
      for (const it of locked) {
        const b = el("button", "shop-cell locked" + (tryOn?.id === it.id ? " trying" : ""));
        b.append(itemIcon(it), el("b", "", it.name), el("span", "price", "🔒 " + unlockText(it)));
        b.onclick = () => { tryOn = tryOn?.id === it.id ? null : it; drawTabs(); };
        g2.append(b);
      }
      body.append(g2);
    }
  }
  function drawBuyBar() {
    const bar = $("#mvBuy");
    bar.innerHTML = "";
    bar.classList.toggle("hidden", !tryOn);
    if (!tryOn) return;
    const it = tryOn;
    bar.append(itemIcon(it));
    const info = el("div", "buy-info");
    info.append(el("b", "", it.name), el("small", "muted", it.price ? "Du provar den nu" : "Lås upp: " + unlockText(it)));
    bar.append(info);
    if (it.price) {
      const lack = it.price - getCoins();
      const buy = el("button", "btn good", lack > 0 ? `${lack} 🪙 till` : `Köp för ${it.price} 🪙`);
      buy.disabled = lack > 0;
      buy.onclick = () => {
        if (!buyItem(it.id)) return;
        tryOn = null;
        burst(buy, ["🪙", "✨", "🎉", "💛"], 16);
        toast(`🛍️ Du köpte ${it.name}!`);
        setMood(fig, "love", equipWith());
        fig.dataset.mood = "love";
        setTimeout(() => { if (alive(fig)) { fig.dataset.mood = "idle"; drawStage(); } }, 2200);
        drawTabs();
      };
      bar.append(buy);
    }
    const x = el("button", "btn-small", "✕");
    x.title = "Sluta prova";
    x.onclick = () => { tryOn = null; drawTabs(); };
    bar.append(x);
  }
  function drawChal() {
    const day = todayKey(), d = getDays()[day] || {}, r = getRew() || { chal: {} };
    body.append(el("h3", "shop-h", "🎯 Dagens utmaningar"), el("p", "muted small", "Tre nya varje dag. Klara dem för mynt – och lås upp specialprylar."));
    const list = el("div", "chal-list");
    for (const ch of todaysChallenges(day)) {
      const v = Math.min(ch.val(d), ch.goal), done = !!r.chal[day + ":" + ch.id] || v >= ch.goal;
      const row = el("div", "chal-row" + (done ? " done" : ""));
      const bar = el("div", "chal-bar"); const fill = el("i"); fill.style.width = Math.round(100 * v / ch.goal) + "%"; bar.append(fill);
      const txt = el("div", "chal-txt");
      txt.append(el("b", "", `${ch.icon} ${ch.text}`), bar, el("small", "muted", `${v} / ${ch.goal}`));
      row.append(txt, el("span", "chal-rew", done ? "✓" : `🪙 ${ch.coins}`));
      list.append(row);
    }
    body.append(list);
    const n = challengesDone();
    body.append(el("h3", "shop-h", "🏆 Utmaningsbelöningar"), el("p", "muted small", `Du har klarat ${n} ${n === 1 ? "utmaning" : "utmaningar"} totalt.`));
    const g = el("div", "chal-unlocks");
    for (const it of ITEMS.filter(i => i.chal).sort((a, b) => a.chal - b.chal)) {
      const got = owns(it.id);
      const row = el("div", "chal-unlock" + (got ? " got" : ""));
      row.append(itemIcon(it), el("b", "", it.name), el("small", "muted", got ? "✓ Upplåst" : `${Math.min(n, it.chal)} / ${it.chal}`));
      g.append(row);
    }
    body.append(g);
  }
  function drawTabs() {
    view.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    if (tab !== "shop") tryOn = null;
    body.innerHTML = "";
    reopen = () => showMascot(tab);
    if (tab === "inv") drawInv(); else if (tab === "shop") drawShop(); else drawChal();
    drawStage(); drawBuyBar();
  }
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; drawTabs(); });
  $("#mvName").onclick = () => {
    const n = prompt("Vad ska din maskot heta?", mascotName());
    if (n === null) return;
    const w = getWardrobe(); w.name = n.trim().slice(0, 20) || MASCOT_DEFAULT_NAME; saveWardrobe(w);
    titleEl.textContent = `${w.name} 🐾`; drawStage();
  };
  fig.onclick = () => { setMood(fig, mPick(["happy", "love", "wave", "celebrate"]), equipWith()); setTimeout(() => alive(fig) && setMood(fig, stageMood(), equipWith()), 1800); };
  mvRefresh = drawTabs;
  drawTabs();
}

// ---------- Kopplingar till resten av appen ----------
// Anropas av render() i app.js varje gång vyn byts
function mascotViewChange(name) {
  setTimeout(() => {
    if (currentView !== name) return;
    if (name === "home") renderHomeMascot();
    if (name === "adv") {
      const c = view.querySelector("#advCoins");
      if (c) c.textContent = getCoins();
    }
    if (name === "done") {
      // Klart-skärmen efter en övning: Lía i stället för en emoji
      const big = view.querySelector(".done .big");
      if (big && !big.querySelector(".mascot")) {
        const e = big.textContent.trim(), mood = e === "🎉" ? "celebrate" : e === "💪" ? "happy" : "think";
        big.textContent = ""; big.classList.add("has-mascot"); big.append(mascotEl(mood, "done-fig"));
      }
    }
    if (name === "adv-done") {
      const fig = view.querySelector("#advDoneFig");
      if (fig && !fig.querySelector(".mascot")) {
        const e = fig.textContent.trim(), mood = e === "💔" ? "sad" : e === "🏆" ? "proud" : "celebrate";
        fig.textContent = ""; fig.classList.add("has-mascot"); fig.append(mascotEl(mood, "done-fig"));
      }
    }
    setTimeout(pumpMascot, 500);
  }, 0);
}
// Hälsning när du loggar in, och första gången du öppnar appen varje dag
let mascotIntroShown = false;
function mascotGreet(afterLogin = false) {
  const today = todayKey();
  if (mascotIntroShown) return;   // presentationen har just visats
  if (!afterLogin && load("app.mGreet", "") === today) return;
  save("app.mGreet", today);
  const name = mascotName(), st = currentStreak();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const days = getDays(), lost = !days[todayKey(yest)]?.n && !days[today]?.n && getTotals().bestStreak >= 2 && Object.keys(days).length > 1;
  if (lost && !afterLogin) {
    mascotEvent({ mood: "sad", title: "Streaken brann ut 😢", text: `Ingen fara – vi startar en ny idag! Svara på ett kort så tänder vi elden igen.` });
    return;
  }
  const h = new Date().getHours(), hi = h < 10 ? "¡Buenos días!" : h < 18 ? "¡Hola!" : "¡Buenas noches!";
  mascotEvent({ mood: "wave", title: `${hi} 👋`, text: afterLogin
    ? `Jag är ${name}, din spanska kompis. Kul att du är här – nu kör vi!`
    : st ? `Du har ${st} ${st === 1 ? "dag" : "dagar"} i rad. Ska vi göra det ${st + 1}? 🔥` : `Jag har saknat dig! Ska vi plugga lite?` });
}

// Start
(function mascotInit() {
  const first = mascotFirstRun();
  if (first) {
    mascotEvent({ mood: "wave", big: true, title: `¡Hola! Jag är ${MASCOT_DEFAULT_NAME} 🐾`,
      text: "Ett litet iberiskt lodjur som pluggar spanska med dig. Du tjänar 🪙 mynt när du övar – köp kläder till mig i butiken och lås upp specialprylar med märken och utmaningar!",
      coins: coinsEarned(), button: "¡Vamos!" });
    mascotIntroShown = true;
    save("app.mGreet", todayKey());
  } else {
    mReconcile();
    const loggedIn = !(typeof syncOn === "function" && syncOn()) || (typeof syncToken === "function" && syncToken());
    if (loggedIn) mascotGreet(false);
  }
  if (currentView === "home") renderHomeMascot();
  setTimeout(pumpMascot, 900);
})();
