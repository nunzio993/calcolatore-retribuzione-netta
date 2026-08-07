#!/usr/bin/env node
/**
 * Watchdog normativo, interamente deterministico (nessun LLM):
 *
 * 1. Dataset MEF (addizionali Lombardia/Milano): diff strutturale sui CSV.
 *    `0*` = "delibera non ancora adottata", MAI aliquota zero: carry-forward
 *    all'anno precedente (art. 1 c. 169 L. 296/2006). Il file dell'anno in
 *    corso è consolidato solo dopo il 20 dicembre.
 * 2. Testi di legge su Normattiva: gli URL con suffisso `!vig=` servono sempre
 *    il testo VIGENTE. Hash sul testo estratto e normalizzato: se cambia, i
 *    parametri che citano quell'articolo diventano rossi su /stato. Verificato
 *    (2026-08-07): GET semplice, nessun JS, hash stabile fra fetch ripetuti.
 * 3. Dead-man switch: l'allarme scatta anche sull'ASSENZA di aggiornamenti
 *    attesi, non solo sui cambiamenti.
 *
 * L'hash rileva CHE il testo è cambiato, non COSA significa: la lettura della
 * norma e la decisione restano all'umano (pagina /stato → commit).
 *
 * Uso:
 *   node monitoraggio/check.mjs                  # MEF sempre; Normattiva se
 *                                                # lunedì o baseline assente
 *   node monitoraggio/check.mjs --normattiva     # forza anche il check Normattiva
 *   node monitoraggio/check.mjs --seed-replay    # snapshot MEF da anni storici
 *                                                # (Milano 2019, Lombardia 2021):
 *                                                # il run dopo rileva cambi veri
 *
 * Formati MEF (research/03-addizionali-mef-2026.md §B):
 * - comunale: ';', ISO-8859-1, virgola decimale (",8" = 0,8%), con FLAG_NUOVA=2
 *   l'aliquota sta in ALIQUOTA_2 e la colonna ALIQUOTA vale 0.
 * - regionale: ';', punto decimale ("1.23"), una riga per scaglione.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = path.join(DIR, "snapshots");
const STATUS_PATH = path.join(DIR, "status.json");
const DIFF_PATH = path.join(DIR, "diff-rilevato.md");

const URL_COMUNALE = (anno) =>
  `https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno=${anno}`;
const URL_REGIONALE = (anno) =>
  `https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/download.php?tipo=reg&anno=${anno}`;

/**
 * Testi di legge sorvegliati. I marker sono STRUTTURALI (rubriche, titoli),
 * mai valori numerici: servono a distinguere "pagina rotta/di cortesia" da
 * "testo cambiato" — un marker sul valore si romperebbe proprio al cambio
 * che vogliamo rilevare.
 */
const FONTI_NORMATTIVA = [
  {
    chiave: "art11-tuir",
    nome: "Normattiva — art. 11 TUIR (scaglioni IRPEF)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917~art11!vig=",
    marker: "determinazione dell'imposta",
  },
  {
    chiave: "art13-tuir",
    nome: "Normattiva — art. 13 TUIR (detrazioni lavoro dipendente)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917~art13!vig=",
    marker: "altre detrazioni",
  },
  {
    chiave: "dl3-2020-art1",
    nome: "Normattiva — D.L. 3/2020 art. 1 (trattamento integrativo)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2020-02-05;3~art1!vig=",
    marker: "trattamento integrativo",
  },
  {
    chiave: "l207-2024-art1",
    nome: "Normattiva — L. 207/2024 art. 1 (somma integrativa e ulteriore detrazione)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024-12-30;207~art1!vig=",
    marker: "bilancio di previsione dello stato",
  },
];

// ---------------------------------------------------------------- fetch+parse

async function scaricaCsv(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("latin1").decode(buf);
}

/** ",8" -> 0.8 · "1.23" -> 1.23 · "0*" -> null (dato assente, MAI zero). */
export function parseAliquota(raw) {
  const s = (raw ?? "").trim();
  if (s === "" || s.includes("*")) return null;
  const normalizzato = s.replace(",", ".");
  const n = Number(normalizzato.startsWith(".") ? "0" + normalizzato : normalizzato);
  return Number.isFinite(n) ? n : null;
}

/**
 * Estrae la riga di un comune dal CSV comunale.
 * Ritorna null se il comune per quell'anno è `0*` (delibera non adottata).
 */
export function estraiComune(csv, codiceCatastale) {
  const riga = csv
    .split(/\r?\n/)
    .find((r) => r.startsWith(codiceCatastale + ";"));
  if (!riga) return null;
  const c = riga.split(";");
  const flag = c[c.length - 2]?.trim();
  const aliquotaBase = parseAliquota(c[8]);
  // FLAG_NUOVA=2 (aliquota unica con esenzione): ALIQUOTA vale 0, la vera aliquota è in ALIQUOTA_2
  const aliquota = flag === "2" ? parseAliquota(c[10]) : aliquotaBase;
  if (aliquota === null) return null; // 0* → dato assente → carry-forward a monte
  const importoEsente = Number(c[c.length - 1]?.trim() || "0");
  return {
    comune: c[1],
    delibera: `${c[3]} del ${c[4]}`,
    pubblicazione: c[5],
    aliquota,
    sogliaEsenzione: importoEsente || null,
  };
}

/** Estrae gli scaglioni di una regione dal CSV regionale. Null se assente. */
export function estraiRegione(csv, nomeRegione) {
  const righe = csv
    .split(/\r?\n/)
    .filter((r) => r.toUpperCase().includes(nomeRegione.toUpperCase()));
  if (righe.length === 0) return null;
  const scaglioni = righe
    .map((r) => {
      const c = r.split(";");
      return { aliquota: parseAliquota(c[7]), fascia: (c[8] ?? "").trim() };
    })
    .filter((s) => s.aliquota !== null);
  if (scaglioni.length === 0) return null;
  const c0 = righe[0].split(";");
  return { regione: nomeRegione, provvedimento: c0[2], pubblicazione: c0[3], scaglioni };
}

/** Carry-forward: prova l'anno richiesto, poi indietro fino a maxIndietro anni. */
async function conCarryForward(anno, maxIndietro, fetchEstrai) {
  for (let a = anno; a >= anno - maxIndietro; a--) {
    const dati = await fetchEstrai(a);
    if (dati) return { annoEffettivo: a, carryForward: a !== anno, dati };
  }
  return null;
}

// ----------------------------------------------------------- testi Normattiva

/** HTML → solo testo, spazi normalizzati: robusto ai ritocchi di layout. */
export function estraiTesto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashTesto(testo) {
  return crypto.createHash("sha256").update(testo).digest("hex");
}

/**
 * Confronta il testo vigente di ogni fonte con l'hash in snapshot.
 * `forza` = rilegge tutto; altrimenti solo lunedì (le leggi non cambiano ogni
 * notte e 4 fetch/settimana bastano) o quando manca la baseline.
 * Le fonti non rilette ripropongono l'ultimo esito salvato, con la sua data:
 * la pagina /stato non deve perdere informazione nei giorni intermedi.
 */
async function controllaNormattiva(oggi, forza) {
  const snap = leggiSnapshot("normattiva.json") ?? { fonti: {} };
  const lunedi = oggi.getUTCDay() === 1;
  const fonti = [];
  const differenze = [];

  for (const f of FONTI_NORMATTIVA) {
    const salvata = snap.fonti[f.chiave];
    const daLeggere = forza || lunedi || !salvata;

    if (!daLeggere) {
      fonti.push({
        nome: f.nome,
        stato: salvata.stato,
        dettaglio: salvata.dettaglio,
        url: f.url,
        controllatoIl: salvata.controllatoIl,
      });
      continue;
    }

    let esito;
    try {
      const res = await fetch(f.url, {
        redirect: "follow",
        headers: { "User-Agent": "calcolatore-retribuzione-netta/watchdog", Accept: "text/html" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const testo = estraiTesto(await res.text());

      if (!testo.toLowerCase().includes(f.marker)) {
        // pagina servita ma senza la norma: errore di fonte, non un cambiamento
        esito = { stato: "errore", dettaglio: `Pagina senza il marker atteso ("${f.marker}")` };
      } else {
        const hash = hashTesto(testo);
        if (!salvata?.hash) {
          esito = { stato: "ok", dettaglio: `Baseline salvata (${testo.length} caratteri)`, hash };
        } else if (salvata.hash === hash) {
          esito = { stato: "ok", dettaglio: "Testo vigente invariato", hash };
        } else {
          esito = {
            stato: "cambiamento-rilevato",
            dettaglio:
              "Il testo vigente è cambiato rispetto all'ultima lettura: rileggere l'articolo e verificare i parametri che lo citano",
            hash,
          };
          differenze.push({
            fonte: f.nome,
            differenze: [
              `hash del testo vigente: ${salvata.hash.slice(0, 16)}… → ${hash.slice(0, 16)}…`,
              `URL: ${f.url}`,
            ],
          });
        }
      }
    } catch (err) {
      esito = { stato: "errore", dettaglio: String(err) };
    }

    snap.fonti[f.chiave] = {
      stato: esito.stato,
      dettaglio: esito.dettaglio,
      hash: esito.hash ?? salvata?.hash,
      controllatoIl: oggi.toISOString(),
    };
    fonti.push({
      nome: f.nome,
      stato: esito.stato,
      dettaglio: esito.dettaglio,
      url: f.url,
      controllatoIl: oggi.toISOString(),
    });

    await new Promise((r) => setTimeout(r, 1000)); // un fetch al secondo: cortesia
  }

  scriviSnapshot("normattiva.json", snap);
  return { fonti, differenze };
}

// ------------------------------------------------------------------ snapshots

function leggiSnapshot(nome) {
  const percorso = path.join(SNAPSHOT_DIR, nome);
  if (!fs.existsSync(percorso)) return null; // mai visto: baseline legittima
  // File presente ma illeggibile: FERMARSI. Trattarlo come assente
  // azzererebbe la baseline in silenzio e il prossimo cambiamento vero
  // passerebbe inosservato. (Il BOM di un editor basta a causarlo.)
  const grezzo = fs.readFileSync(percorso, "utf-8").replace(/^﻿/, "");
  try {
    return JSON.parse(grezzo);
  } catch (err) {
    throw new Error(`Snapshot ${nome} presente ma non parsabile: ${err}. Ripristinarlo da git.`);
  }
}

function scriviSnapshot(nome, contenuto) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SNAPSHOT_DIR, nome), JSON.stringify(contenuto, null, 2) + "\n");
}

/** Diff strutturale semplice: restituisce descrizioni testuali delle differenze. */
export function diffOggetti(prima, dopo, prefisso = "") {
  const differenze = [];
  const chiavi = new Set([...Object.keys(prima ?? {}), ...Object.keys(dopo ?? {})]);
  for (const k of chiavi) {
    const a = prima?.[k];
    const b = dopo?.[k];
    const percorso = prefisso ? `${prefisso}.${k}` : k;
    if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
      differenze.push(...diffOggetti(a, b, percorso));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      differenze.push(`${percorso}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
  }
  return differenze;
}

// ------------------------------------------------------------------ dead-man

function verificaScadenze(oggi) {
  const anno = oggi.getFullYear();
  const scadenze = [];

  // Regole dell'anno corrente presenti nel registry (LdB recepita)
  const fileRegole = path.join(DIR, "..", "src", "domain", "rules", `${anno}.ts`);
  const regolePresenti = fs.existsSync(fileRegole);
  const dopoScadenzaLdB = oggi >= new Date(anno, 0, 15); // 15 gennaio: margine sulla LdB del 30/12
  scadenze.push({
    nome: `Regole ${anno} nel registry (LdB ${anno} recepita)`,
    attesaEntro: `15/01/${anno}`,
    stato: regolePresenti ? "ricevuta" : dopoScadenzaLdB ? "mancata" : "in-attesa",
  });

  // Freschezza della verifica fonti
  let verifiedOn = null;
  try {
    const contenuto = fs.readFileSync(fileRegole, "utf-8");
    verifiedOn = contenuto.match(/verifiedOn:\s*"([^"]+)"/)?.[1] ?? null;
  } catch {
    /* file assente: già segnalato sopra */
  }
  if (verifiedOn) {
    const giorni = Math.floor((oggi - new Date(verifiedOn)) / 86_400_000);
    scadenze.push({
      nome: `Verifica fonti recente (ultima: ${verifiedOn}, ${giorni} gg fa)`,
      attesaEntro: "180 giorni",
      stato: giorni <= 180 ? "ricevuta" : "mancata",
    });
  }

  return scadenze;
}

// ----------------------------------------------------------------------- main

const MONITORATI = [
  {
    nome: "MEF — addizionale comunale (Milano, F205)",
    snapshot: "milano.json",
    annoStorico: 2019, // seed replay: soglia esenzione 21.000 → 23.000 nel 2020
    carica: (anno) =>
      conCarryForward(anno, 3, async (a) => estraiComune(await scaricaCsv(URL_COMUNALE(a)), "F205")),
    caricaStorico: async (anno) => estraiComune(await scaricaCsv(URL_COMUNALE(anno)), "F205"),
  },
  {
    nome: "MEF — addizionale regionale (Lombardia)",
    snapshot: "lombardia.json",
    annoStorico: 2021, // seed replay: da 5 a 4 scaglioni nel 2022
    carica: (anno) =>
      conCarryForward(anno, 3, async (a) =>
        estraiRegione(await scaricaCsv(URL_REGIONALE(a)), "REGIONE LOMBARDIA"),
      ),
    caricaStorico: async (anno) =>
      estraiRegione(await scaricaCsv(URL_REGIONALE(anno)), "REGIONE LOMBARDIA"),
  },
];

async function main() {
  const oggi = new Date();
  const annoCorrente = oggi.getFullYear();
  const seedReplay = process.argv.includes("--seed-replay");
  const forzaNormattiva = process.argv.includes("--normattiva");

  if (seedReplay) {
    for (const m of MONITORATI) {
      const dati = await m.caricaStorico(m.annoStorico);
      if (!dati) throw new Error(`Seed replay fallito per ${m.nome} (anno ${m.annoStorico})`);
      scriviSnapshot(m.snapshot, {
        fonte: m.nome,
        anno: m.annoStorico,
        seedReplay: true,
        dati,
        aggiornatoIl: oggi.toISOString(),
      });
      console.log(`Seed ${m.snapshot} dall'anno ${m.annoStorico}: ok`);
    }
    return;
  }

  const fonti = [];
  const tutteLeDifferenze = [];

  for (const m of MONITORATI) {
    try {
      const esito = await m.carica(annoCorrente);
      if (!esito) {
        fonti.push({ nome: m.nome, stato: "errore", dettaglio: "Nessun dato negli ultimi 4 anni" });
        continue;
      }
      const precedente = leggiSnapshot(m.snapshot);
      const differenze = precedente ? diffOggetti(precedente.dati, esito.dati) : [];
      const notaCarry = esito.carryForward
        ? ` (carry-forward dall'anno ${esito.annoEffettivo}: nessuna delibera ${annoCorrente} — normale prima del 20/12)`
        : "";

      if (differenze.length > 0) {
        fonti.push({
          nome: m.nome,
          stato: "cambiamento-rilevato",
          ultimoCambio: oggi.toISOString().slice(0, 10),
          dettaglio: differenze.join(" · ") + notaCarry,
          controllatoIl: oggi.toISOString(),
        });
        tutteLeDifferenze.push({ fonte: m.nome, precedente, differenze });
        scriviSnapshot(m.snapshot, {
          fonte: m.nome,
          anno: esito.annoEffettivo,
          dati: esito.dati,
          aggiornatoIl: oggi.toISOString(),
        });
      } else {
        fonti.push({
          nome: m.nome,
          stato: "ok",
          dettaglio: `Invariato${notaCarry}`,
          controllatoIl: oggi.toISOString(),
        });
        if (!precedente) {
          scriviSnapshot(m.snapshot, {
            fonte: m.nome,
            anno: esito.annoEffettivo,
            dati: esito.dati,
            aggiornatoIl: oggi.toISOString(),
          });
        }
      }
    } catch (err) {
      fonti.push({ nome: m.nome, stato: "errore", dettaglio: String(err) });
    }
  }

  const normattiva = await controllaNormattiva(oggi, forzaNormattiva);
  fonti.push(...normattiva.fonti);
  tutteLeDifferenze.push(...normattiva.differenze);

  const scadenze = verificaScadenze(oggi);
  const problemi =
    fonti.some((f) => f.stato !== "ok") || scadenze.some((s) => s.stato === "mancata");

  const status = {
    ultimoCheck: oggi.toISOString(),
    esito: tutteLeDifferenze.length > 0 || fonti.some((f) => f.stato === "cambiamento-rilevato")
      ? "cambiamento-rilevato"
      : fonti.some((f) => f.stato === "errore")
        ? "errore"
        : "ok",
    fonti,
    scadenze,
  };
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2) + "\n");
  console.log(JSON.stringify(status, null, 2));

  // Report per l'issue GitHub (il workflow lo pubblica se esiste)
  if (tutteLeDifferenze.length > 0 || scadenze.some((s) => s.stato === "mancata")) {
    const righe = ["# Cambiamento normativo rilevato / scadenza mancata", ""];
    for (const d of tutteLeDifferenze) {
      righe.push(`## ${d.fonte}`, "");
      if (d.precedente?.seedReplay) {
        righe.push(
          `_Replay demo: snapshot seminato dall'anno ${d.precedente.anno} — le differenze sotto sono cambi normativi realmente avvenuti._`,
          "",
        );
      }
      for (const diff of d.differenze) righe.push(`- ${diff}`);
      righe.push("");
    }
    for (const s of scadenze.filter((x) => x.stato === "mancata")) {
      righe.push(`- ⚠️ Scadenza mancata: ${s.nome} (attesa entro ${s.attesaEntro})`);
    }
    righe.push("", "Aggiornare `src/domain/rules/` e la data `verifiedOn` dopo verifica sulle fonti primarie.");
    fs.writeFileSync(DIFF_PATH, righe.join("\n") + "\n");
    console.error("\nDifferenze o scadenze mancate: vedi monitoraggio/diff-rilevato.md");
    process.exitCode = problemi ? 2 : 0;
  } else if (fs.existsSync(DIFF_PATH)) {
    fs.unlinkSync(DIFF_PATH);
  }
}

const invocatoDirettamente =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invocatoDirettamente) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
