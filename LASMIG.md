# Spanska – glosövning (steg 1, testversion)

En PWA (installerbar webbapp) för att öva spanska glosor.

## Testa på din PC
1. Dubbelklicka på `starta.bat`. Ett fönster öppnas och appen visas i webbläsaren på `http://localhost:8080/`.
2. Vill du testa installationen: klicka på installera-ikonen i adressfältet i Chrome/Edge.
3. Stäng det svarta fönstret för att stoppa servern.

Att dubbelklicka direkt på `index.html` fungerar också för att öva, men då går appen inte att installera eller köra offline.

## Ladda upp en ny version
Dubbelklicka på `publicera.bat`. Den räknar upp versionsnumret i `version.js` (v1 → v2 …),
gör en commit och pushar till GitHub. Versionen syns uppe i appens titelrad.
Stäng och öppna appen på enheterna för att få den nya versionen.

## Funktioner
- **👥 Delat konto** (`sync.js`, `config.js`): när `WORKER_URL` i `config.js` är ifylld frågar appen efter lösenord,
  och alla som loggar in delar samma kort, XP, streak och märken. Ändringar från olika enheter slås ihop.
  ☁️ vid versionsnumret = synkat. ⚙ → Konto: Synka nu / Logga ut. Se `ai-worker/AI-INSTALLATION.md`.
- **🗺️ Äventyr** (startsidan och Öva-menyn, logik i `adventure.js`): en stig med delar (Grundord, Spanska steg 3,
  dina kategorier), lektioner om 5 ord, skattkistor och en kontrollpunkt 🏆 per del. Nästa nivå låses upp först när
  alla övningar i lektionen är rätt – fel kommer tillbaka på slutet. Övningar: flerval, lyssna, skriv, ordbank,
  prata och para ihop. 🔊/🎤 uppe i lektionen stänger av ljud/prat – samma fråga kommer då utan att höra/prata.
  "⏩ Hoppa hit" på en låst del ger ett test med 3 hjärtan.
- **▶ Öva** öppnar en meny med sätt att öva: Flashcards, Flerval (felsvaren liknar det rätta), Skrivförhör, Memory,
  Lyssna och skriv, Uttal (mikrofon, Chrome) och Verbböjning (spanska, 39 verb i presens/preteritum/imperfekt/futurum
  – finns i `verbs.js`). Nya sätt läggs till i listan `MODES` i `app.js`.
- **🔥 Streak** (dagar i rad) och **🎯 dagsmål** (tryck på ringen eller ändra under ⚙) på startsidan.
- **Combo**: 5 rätt i rad ger ×2 XP, 10 rätt i rad ×3 XP.
- **🏅 Märken & statistik**: 24 märken och XP-kursen (XP per dag som en aktiekurs, 7/30/90 dagar/allt).
- **📅 Smart repetition** (⚙, på som standard): korten kommer tillbaka efter 1, 3, 7, 14 och 30 dagar.
- **XP och nivåer** (överst på startsidan): +3 XP för rätt svar, +1 XP för fel (du övade ändå), +50 XP första
  gången ett kort blir fullt inlärt (5 rätt i rad). Nivå 2 vid 100 XP, 3 vid 300, 4 vid 600 … XP gäller alla konfigar.
  Räknarna **kort övade** och **fullt inlärda** gäller aktiv konfig.
- **☰ Konfigar** (bredvid hemknappen): varje konfig är ett språk (spanska, engelska, tyska, franska,
  italienska, portugisiska) eller ett ämne (t.ex. Företagsekonomi: begrepp ↔ förklaring) med egna kort,
  egen progress och egna inställningar. "＋ Skapa ny konfig" och ✏️ för att ändra eller ta bort.
  Spanska har kvar sina gamla data och de färdiga övningslekarna.
- **Flashcards**: vänd kortet, säg om du kunde eller inte. Ord du inte kan kommer tillbaka snart.
- **Skrivförhör**: se svenska, skriv spanska. Accentknappar (á é í ó ú ñ ¿ ¡). Fel accent räknas som "nästan".
- **Ordlista**: alla ord med uppläsning och stjärnor för hur bra du kan dem.
- **Kategorier** (📁 överst i Mina kort): huvudkategorier med underkategorier, t.ex. Caminando 3 › Kapitel 1.
  Nya och importerade kort hamnar i vald kategori, och övningarna använder bara korten i den. "Hantera kategorier"
  för att lägga till, byta namn och ta bort. Flytta ett kort med ✏️.
- **Spanska steg 3** (startsidan): sex färdiga lekar med egna ord på steg 3-teman – inte bokens ordlistor.
- **Mina kort**: två rutor (svenska | español). Skriv i en eller båda – tom ruta fylls i av AI:n.
  Stavfel markeras gult med "Menar du …?" och en Använd-knapp. Filter (🟡 att rätta, 🟢 kan, ⚪ aldrig övade,
  🔴 svåra, ⏳ ej kontrollerade), sortering och statistik per kort (övad / ✓ kunde / ✗ kunde inte).
  Övningarna använder korten som syns i listan, och frågar åt båda hållen.
- **Importera flashcards från text 📋** (i Mina kort): klistra in en text → AI:n plockar ut viktiga begrepp →
  svep höger (♥ / →) för att lägga till, vänster (✗ / ←) för att hoppa över, ↶ ångrar. Utan AI görs ett enklare urval.
- **AI**: se `..\ai-worker\AI-INSTALLATION.md`. Kopplas in under ⚙ på varje enhet.
- **Uttal**: 🔊 läser upp på spanska med webbläsarens röst.
- **Helskärm**: knappen ⛶ uppe till höger.

Progress sparas i webbläsaren på varje enhet (localStorage).

## Filer
| Fil | Vad den gör |
|---|---|
| `index.html` | Sidans struktur |
| `style.css` | Utseende |
| `app.js` | All logik |
| `words.js` | De inbyggda glosorna – lägg till fler lekar här |
| `manifest.json` | Gör den installerbar, helskärm, ikon |
| `sw.js` | Offline-stöd (cachen följer versionsnumret) |
| `version.js` | Versionsnumret – räknas upp av `publicera.bat` |
| `publicera.bat` / `publicera.ps1` | Räknar upp versionen och laddar upp till GitHub |
| `starta.bat` / `server.ps1` | Lokal testserver för Windows |

## Nästa steg
- Steg 2: lägg upp på GitHub Pages så den kan installeras på Chromebook och Android.
- Senare: glosor efter kapitlen i Caminando 3.
