# Spanska – glosövning (steg 1, testversion)

En PWA (installerbar webbapp) för att öva spanska glosor.

## Testa på din PC
1. Dubbelklicka på `starta.bat`. Ett fönster öppnas och appen visas i webbläsaren på `http://localhost:8080/`.
2. Vill du testa installationen: klicka på installera-ikonen i adressfältet i Chrome/Edge.
3. Stäng det svarta fönstret för att stoppa servern.

Att dubbelklicka direkt på `index.html` fungerar också för att öva, men då går appen inte att installera eller köra offline.

## Funktioner
- **Flashcards**: vänd kortet, säg om du kunde eller inte. Ord du inte kan kommer tillbaka snart.
- **Skrivförhör**: se svenska, skriv spanska. Accentknappar (á é í ó ú ñ ¿ ¡). Fel accent räknas som "nästan".
- **Ordlista**: alla ord med uppläsning och stjärnor för hur bra du kan dem.
- **Mina glosor**: skriv in egna glosor, en per rad: `el perro = hunden`.
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
| `sw.js` | Offline-stöd. Höj `CACHE`-versionen när du ändrar filer |
| `starta.bat` / `server.ps1` | Lokal testserver för Windows |

## Nästa steg
- Steg 2: lägg upp på GitHub Pages så den kan installeras på Chromebook och Android.
- Steg 3: Cloudflare Worker + "fråga om ett ord" med AI.
- Senare: glosor efter kapitlen i Caminando 3.
