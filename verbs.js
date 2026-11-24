// Verbböjning för spanska (används av övningssättet "Verbböjning").
// Regelbundna former räknas ut. Oregelbundna former står uttryckligen nedan.
// Personer i ordning: yo, tú, él/ella/usted, nosotros, vosotros, ellos/ellas/ustedes

const VERB_PERSONS = [
  { es: "yo", sv: "jag" },
  { es: "tú", sv: "du" },
  { es: "él / ella / usted", sv: "han / hon / ni (artigt)" },
  { es: "nosotros", sv: "vi" },
  { es: "vosotros", sv: "ni" },
  { es: "ellos / ellas / ustedes", sv: "de / ni (artigt)" }
];

const VERB_TENSES = {
  pres: { name: "Presens", sv: "nu, t.ex. jag pratar" },
  pret: { name: "Preteritum", sv: "en avslutad händelse, t.ex. jag pratade (igår)" },
  imp: { name: "Imperfekt", sv: "pågick / brukade, t.ex. jag pratade (förr)" },
  fut: { name: "Futurum", sv: "kommer att, t.ex. jag ska prata" }
};

const VERB_ENDINGS = {
  pres: { ar: ["o", "as", "a", "amos", "áis", "an"], er: ["o", "es", "e", "emos", "éis", "en"], ir: ["o", "es", "e", "imos", "ís", "en"] },
  pret: { ar: ["é", "aste", "ó", "amos", "asteis", "aron"], er: ["í", "iste", "ió", "imos", "isteis", "ieron"], ir: ["í", "iste", "ió", "imos", "isteis", "ieron"] },
  imp: { ar: ["aba", "abas", "aba", "ábamos", "abais", "aban"], er: ["ía", "ías", "ía", "íamos", "íais", "ían"], ir: ["ía", "ías", "ía", "íamos", "íais", "ían"] },
  fut: ["é", "ás", "á", "emos", "éis", "án"]   // läggs till efter infinitiven (eller oregelbunden stam)
};

// [infinitiv, svenska, oregelbundna former]
// futStem = oregelbunden stam i futurum. Saknas en tid används regelbunden böjning.
const VERBS = [
  // Regelbundna
  ["hablar", "att prata", {}],
  ["trabajar", "att arbeta", {}],
  ["estudiar", "att studera", {}],
  ["comprar", "att köpa", {}],
  ["viajar", "att resa", {}],
  ["ayudar", "att hjälpa", {}],
  ["escuchar", "att lyssna", {}],
  ["comer", "att äta", {}],
  ["beber", "att dricka", {}],
  ["aprender", "att lära sig", {}],
  ["vender", "att sälja", {}],
  ["vivir", "att bo / att leva", {}],
  ["escribir", "att skriva", {}],
  ["abrir", "att öppna", {}],
  ["decidir", "att bestämma", {}],
  // Oregelbundna
  ["ser", "att vara (egenskap)", {
    pres: ["soy", "eres", "es", "somos", "sois", "son"],
    pret: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    imp: ["era", "eras", "era", "éramos", "erais", "eran"] }],
  ["estar", "att vara (tillstånd, plats)", {
    pres: ["estoy", "estás", "está", "estamos", "estáis", "están"],
    pret: ["estuve", "estuviste", "estuvo", "estuvimos", "estuvisteis", "estuvieron"] }],
  ["tener", "att ha", {
    pres: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
    pret: ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"], futStem: "tendr" }],
  ["ir", "att gå / att åka", {
    pres: ["voy", "vas", "va", "vamos", "vais", "van"],
    pret: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    imp: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"] }],
  ["hacer", "att göra", {
    pres: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
    pret: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"], futStem: "har" }],
  ["poder", "att kunna", {
    pres: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"],
    pret: ["pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron"], futStem: "podr" }],
  ["querer", "att vilja", {
    pres: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
    pret: ["quise", "quisiste", "quiso", "quisimos", "quisisteis", "quisieron"], futStem: "querr" }],
  ["decir", "att säga", {
    pres: ["digo", "dices", "dice", "decimos", "decís", "dicen"],
    pret: ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"], futStem: "dir" }],
  ["venir", "att komma", {
    pres: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
    pret: ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"], futStem: "vendr" }],
  ["poner", "att sätta / att ställa", {
    pres: ["pongo", "pones", "pone", "ponemos", "ponéis", "ponen"],
    pret: ["puse", "pusiste", "puso", "pusimos", "pusisteis", "pusieron"], futStem: "pondr" }],
  ["salir", "att gå ut", {
    pres: ["salgo", "sales", "sale", "salimos", "salís", "salen"], futStem: "saldr" }],
  ["saber", "att veta", {
    pres: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
    pret: ["supe", "supiste", "supo", "supimos", "supisteis", "supieron"], futStem: "sabr" }],
  ["dar", "att ge", {
    pres: ["doy", "das", "da", "damos", "dais", "dan"],
    pret: ["di", "diste", "dio", "dimos", "disteis", "dieron"] }],
  ["ver", "att se", {
    pres: ["veo", "ves", "ve", "vemos", "veis", "ven"],
    pret: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
    imp: ["veía", "veías", "veía", "veíamos", "veíais", "veían"] }],
  ["conocer", "att känna (någon) / att känna till", {
    pres: ["conozco", "conoces", "conoce", "conocemos", "conocéis", "conocen"] }],
  ["empezar", "att börja", {
    pres: ["empiezo", "empiezas", "empieza", "empezamos", "empezáis", "empiezan"],
    pret: ["empecé", "empezaste", "empezó", "empezamos", "empezasteis", "empezaron"] }],
  ["pensar", "att tänka", {
    pres: ["pienso", "piensas", "piensa", "pensamos", "pensáis", "piensan"] }],
  ["dormir", "att sova", {
    pres: ["duermo", "duermes", "duerme", "dormimos", "dormís", "duermen"],
    pret: ["dormí", "dormiste", "durmió", "dormimos", "dormisteis", "durmieron"] }],
  ["pedir", "att be om / att beställa", {
    pres: ["pido", "pides", "pide", "pedimos", "pedís", "piden"],
    pret: ["pedí", "pediste", "pidió", "pedimos", "pedisteis", "pidieron"] }],
  ["jugar", "att spela / att leka", {
    pres: ["juego", "juegas", "juega", "jugamos", "jugáis", "juegan"],
    pret: ["jugué", "jugaste", "jugó", "jugamos", "jugasteis", "jugaron"] }],
  ["volver", "att komma tillbaka", {
    pres: ["vuelvo", "vuelves", "vuelve", "volvemos", "volvéis", "vuelven"] }],
  ["leer", "att läsa", {
    pret: ["leí", "leíste", "leyó", "leímos", "leísteis", "leyeron"] }],
  ["buscar", "att leta efter", {
    pret: ["busqué", "buscaste", "buscó", "buscamos", "buscasteis", "buscaron"] }],
  ["llegar", "att komma fram", {
    pret: ["llegué", "llegaste", "llegó", "llegamos", "llegasteis", "llegaron"] }]
];

// Böj ett verb: conjugate("tener", "fut", 0) → "tendré"
function conjugate(inf, tense, person) {
  const v = VERBS.find(x => x[0] === inf);
  const irr = v ? v[2] : {};
  if (irr[tense]) return irr[tense][person];
  if (tense === "fut") return (irr.futStem || inf) + VERB_ENDINGS.fut[person];
  const type = inf.slice(-2), stem = inf.slice(0, -2);
  return stem + VERB_ENDINGS[tense][type][person];
}
