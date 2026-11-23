// Inbyggda testglosor. Lägg till fler lekar här, eller använd "Mina glosor" i appen.
// Format: [spanska, svenska]
const BUILTIN_DECKS = [
  {
    id: "vardag",
    name: "Vardag & fraser",
    words: [
      ["¿Qué tal?", "Hur är läget?"],
      ["¿Cómo se dice…?", "Hur säger man…?"],
      ["No entiendo", "Jag förstår inte"],
      ["¿Puedes repetir?", "Kan du upprepa?"],
      ["más despacio, por favor", "långsammare, tack"],
      ["de nada", "varsågod / ingen orsak"],
      ["a veces", "ibland"],
      ["siempre", "alltid"],
      ["nunca", "aldrig"],
      ["todavía", "fortfarande / ännu"],
      ["ya", "redan"],
      ["después", "efteråt / sedan"],
      ["antes", "innan / förut"],
      ["mañana", "i morgon"],
      ["ayer", "i går"]
    ]
  },
  {
    id: "mat",
    name: "Mat & restaurang",
    words: [
      ["la cuenta", "notan"],
      ["el camarero", "servitören"],
      ["la carta", "menyn"],
      ["el plato", "rätten / tallriken"],
      ["la bebida", "drycken"],
      ["el agua", "vattnet"],
      ["el pollo", "kycklingen"],
      ["el pescado", "fisken"],
      ["las verduras", "grönsakerna"],
      ["el postre", "efterrätten"],
      ["tener hambre", "vara hungrig"],
      ["tener sed", "vara törstig"],
      ["Quisiera…", "Jag skulle vilja ha…"],
      ["¿Qué me recomienda?", "Vad rekommenderar ni?"],
      ["rico", "god / gott"]
    ]
  },
  {
    id: "ekonomi",
    name: "Pengar & arbete",
    words: [
      ["el dinero", "pengarna"],
      ["el precio", "priset"],
      ["caro", "dyr"],
      ["barato", "billig"],
      ["pagar", "betala"],
      ["ahorrar", "spara (pengar)"],
      ["gastar", "spendera / göra av med"],
      ["el trabajo", "arbetet / jobbet"],
      ["la empresa", "företaget"],
      ["el sueldo", "lönen"],
      ["el jefe / la jefa", "chefen"],
      ["la tienda", "affären"],
      ["vender", "sälja"],
      ["comprar", "köpa"],
      ["¿Cuánto cuesta?", "Vad kostar det?"]
    ]
  },
  {
    id: "verb",
    name: "Vanliga verb",
    words: [
      ["ser", "vara (egenskap)"],
      ["estar", "vara (tillstånd, plats)"],
      ["tener", "ha"],
      ["hacer", "göra"],
      ["ir", "gå / åka"],
      ["poder", "kunna"],
      ["querer", "vilja / älska"],
      ["saber", "veta / kunna (fakta)"],
      ["conocer", "känna (någon) / känna till"],
      ["decir", "säga"],
      ["salir", "gå ut / gå (ifrån)"],
      ["venir", "komma"],
      ["ver", "se"],
      ["dar", "ge"],
      ["empezar", "börja"]
    ]
  },

  // ---------------------------------------------------------------
  //  Spanska steg 3 – egna ord på typiska steg 3-teman.
  //  (Inte bokens ordlistor – de lägger du in själv under Mina kort › Caminando 3.)
  // ---------------------------------------------------------------
  {
    id: "s3-arbete", group: "Spanska steg 3", name: "Arbete & ekonomi",
    words: [
      ["buscar trabajo", "att söka jobb"],
      ["solicitar un puesto", "att söka en tjänst"],
      ["la entrevista de trabajo", "anställningsintervjun"],
      ["el currículum", "CV:t"],
      ["contratar", "att anställa"],
      ["despedir", "att avskeda"],
      ["el desempleo", "arbetslösheten"],
      ["el contrato", "kontraktet / avtalet"],
      ["el horario", "schemat / arbetstiderna"],
      ["ganar dinero", "att tjäna pengar"],
      ["el negocio", "affären / verksamheten"],
      ["el beneficio", "vinsten"],
      ["la competencia", "konkurrensen"],
      ["invertir", "att investera"],
      ["los impuestos", "skatterna"],
      ["el presupuesto", "budgeten"],
      ["la oferta y la demanda", "utbud och efterfrågan"],
      ["el consumidor", "konsumenten"],
      ["la publicidad", "reklamen"],
      ["exportar", "att exportera"]
    ]
  },
  {
    id: "s3-resor", group: "Spanska steg 3", name: "Resor & transport",
    words: [
      ["viajar", "att resa"],
      ["el billete de ida y vuelta", "tur och retur-biljetten"],
      ["reservar", "att boka"],
      ["el alojamiento", "boendet"],
      ["el albergue", "vandrarhemmet"],
      ["la maleta", "resväskan"],
      ["hacer la maleta", "att packa väskan"],
      ["el vuelo", "flyget / flygningen"],
      ["perder el tren", "att missa tåget"],
      ["el retraso", "förseningen"],
      ["la llegada", "ankomsten"],
      ["la salida", "avgången / utgången"],
      ["en el extranjero", "utomlands"],
      ["el pasaporte", "passet"],
      ["la frontera", "gränsen"],
      ["alquilar un coche", "att hyra en bil"],
      ["el destino", "resmålet"],
      ["el paisaje", "landskapet"],
      ["recomendar", "att rekommendera"],
      ["valer la pena", "att vara värt det"]
    ]
  },
  {
    id: "s3-samhalle", group: "Spanska steg 3", name: "Miljö & samhälle",
    words: [
      ["el medio ambiente", "miljön"],
      ["la contaminación", "föroreningarna"],
      ["el cambio climático", "klimatförändringarna"],
      ["reciclar", "att återvinna"],
      ["la basura", "soporna"],
      ["ahorrar energía", "att spara energi"],
      ["la energía renovable", "den förnybara energin"],
      ["proteger", "att skydda"],
      ["la sociedad", "samhället"],
      ["la pobreza", "fattigdomen"],
      ["la desigualdad", "ojämlikheten"],
      ["los derechos humanos", "de mänskliga rättigheterna"],
      ["la inmigración", "invandringen"],
      ["el gobierno", "regeringen"],
      ["las elecciones", "valet"],
      ["votar", "att rösta"],
      ["la ley", "lagen"],
      ["el ciudadano", "medborgaren"],
      ["la igualdad", "jämlikheten / jämställdheten"],
      ["el desarrollo sostenible", "den hållbara utvecklingen"]
    ]
  },
  {
    id: "s3-asikter", group: "Spanska steg 3", name: "Åsikter & känslor",
    words: [
      ["creo que…", "jag tror att…"],
      ["en mi opinión", "enligt min åsikt"],
      ["estoy de acuerdo", "jag håller med"],
      ["no estoy de acuerdo", "jag håller inte med"],
      ["me parece que…", "jag tycker att… / det verkar som att…"],
      ["por un lado… por otro lado", "å ena sidan… å andra sidan"],
      ["sin embargo", "dock / emellertid"],
      ["además", "dessutom"],
      ["por eso", "därför"],
      ["estar contento", "att vara glad / nöjd"],
      ["estar enfadado", "att vara arg"],
      ["estar preocupado", "att vara orolig"],
      ["estar harto de", "att vara trött på / ha fått nog av"],
      ["tener miedo de", "att vara rädd för"],
      ["echar de menos", "att sakna"],
      ["sentirse", "att känna sig"],
      ["enamorarse de", "att bli kär i"],
      ["odiar", "att hata"],
      ["me molesta que…", "det stör mig att…"],
      ["¡Qué pena!", "Vad synd!"]
    ]
  },
  {
    id: "s3-preteritum", group: "Spanska steg 3", name: "Preteritum – jag-form",
    words: [
      ["fui", "jag var / jag gick (ser, ir)"],
      ["hice", "jag gjorde"],
      ["tuve", "jag hade / jag fick"],
      ["estuve", "jag var (befann mig)"],
      ["pude", "jag kunde"],
      ["quise", "jag ville"],
      ["dije", "jag sa"],
      ["vine", "jag kom"],
      ["puse", "jag satte / jag ställde"],
      ["supe", "jag fick veta"],
      ["di", "jag gav"],
      ["vi", "jag såg"],
      ["hablé", "jag pratade"],
      ["comí", "jag åt"],
      ["viví", "jag bodde"],
      ["llegué", "jag kom fram"],
      ["empecé", "jag började"],
      ["busqué", "jag letade"],
      ["pagué", "jag betalade"],
      ["leí", "jag läste"]
    ]
  },
  {
    id: "s3-studier", group: "Spanska steg 3", name: "Studier & framtid",
    words: [
      ["el instituto", "gymnasiet"],
      ["la asignatura", "ämnet (i skolan)"],
      ["la nota", "betyget"],
      ["aprobar", "att klara (ett prov)"],
      ["suspender", "att bli underkänd"],
      ["el examen", "provet"],
      ["estudiar una carrera", "att läsa en utbildning (på universitet)"],
      ["la universidad", "universitetet"],
      ["en el futuro", "i framtiden"],
      ["dentro de cinco años", "om fem år"],
      ["tener ganas de", "att ha lust att / se fram emot"],
      ["soñar con", "att drömma om"],
      ["el sueño", "drömmen"],
      ["conseguir", "att lyckas få / att uppnå"],
      ["independizarse", "att flytta hemifrån / bli självständig"],
      ["el año sabático", "sabbatsåret"],
      ["hacer prácticas", "att göra praktik"],
      ["la experiencia laboral", "arbetslivserfarenheten"],
      ["el idioma", "språket"],
      ["mejorar", "att förbättra / bli bättre"]
    ]
  }
];
