import fs from "node:fs";
import path from "node:path";
import {
  validaReport,
  type ReportVerifica,
  type RiscontroEsterno,
} from "@/domain/reportVerifica";

/**
 * Raccolta dei riscontri da tutte le origini. La pagina /stato legge soltanto:
 * non riceve input da nessuno, non scrive niente. I file entrano nel repository
 * (commit dell'agente di ricerca o deposito manuale) e il deploy li pubblica.
 */

const DIR_MONITORAGGIO = path.join(process.cwd(), "monitoraggio");
const DIR_REPORT = path.join(DIR_MONITORAGGIO, "reports");

export interface EsitoCaricamento {
  riscontri: RiscontroEsterno[];
  /** Report presenti ma scartati perché non rispettano il contratto. */
  reportMalformati: { file: string; errori: string[] }[];
  reportValidi: { file: string; dataRicerca: string; strumento?: string; claims: number }[];
  watchdog: { ultimoCheck: string; esito: string } | null;
}

export function caricaSorveglianza(): EsitoCaricamento {
  const esito: EsitoCaricamento = {
    riscontri: [],
    reportMalformati: [],
    reportValidi: [],
    watchdog: null,
  };

  esito.riscontri.push(...daiReportManuali(esito));
  esito.riscontri.push(...dalWatchdog(esito));
  return esito;
}

// ------------------------------------------------------- report di ricerca

function daiReportManuali(esito: EsitoCaricamento): RiscontroEsterno[] {
  let file: string[];
  try {
    file = fs.readdirSync(DIR_REPORT).filter((f) => f.endsWith(".json"));
  } catch {
    return []; // cartella assente: nessuna ricerca ancora depositata
  }

  const riscontri: RiscontroEsterno[] = [];
  for (const nome of file.sort()) {
    let dato: unknown;
    try {
      dato = JSON.parse(fs.readFileSync(path.join(DIR_REPORT, nome), "utf-8"));
    } catch (err) {
      esito.reportMalformati.push({ file: nome, errori: [`JSON non valido: ${String(err)}`] });
      continue;
    }

    const validazione = validaReport(dato, nome);
    if (!validazione.ok) {
      esito.reportMalformati.push({ file: nome, errori: validazione.errori });
      continue;
    }

    const report = dato as ReportVerifica;
    esito.reportValidi.push({
      file: nome,
      dataRicerca: report.dataRicerca,
      strumento: report.strumento,
      claims: report.claims.length,
    });

    for (const c of report.claims) {
      riscontri.push({
        claimId: c.id,
        esito: c.esito,
        valore: c.valore,
        origine: report.strumento ? `ricerca · ${report.strumento}` : "ricerca manuale",
        data: report.dataRicerca,
        riferimento: c.riferimento,
        url: c.url,
        citazione: c.citazione,
        note: c.note,
      });
    }
  }
  return riscontri;
}

// --------------------------------------------------------- watchdog MEF

interface StatusWatchdog {
  ultimoCheck: string;
  esito: string;
  fonti: {
    nome: string;
    stato: string;
    ultimoCambio?: string;
    dettaglio?: string;
    url?: string;
    /** Quando la fonte è stata davvero riletta (Normattiva è settimanale). */
    controllatoIl?: string;
  }[];
  scadenze: { nome: string; attesaEntro: string; stato: string }[];
}

/**
 * I segnali automatici entrano nella stessa griglia dei report manuali: un
 * parametro sorvegliato dal diff MEF non deve vivere in un elenco separato.
 */
const CLAIM_DA_FONTE_WATCHDOG: Record<string, string[]> = {
  "MEF — addizionale comunale (Milano, F205)": [
    "addizionali.comunaleAliquota",
    "addizionali.comunaleEsenzione",
  ],
  "MEF — addizionale regionale (Lombardia)": ["addizionali.regionale"],
  "Normattiva — art. 11 TUIR (scaglioni IRPEF)": ["irpef.scaglioni"],
  "Normattiva — art. 13 TUIR (detrazioni lavoro dipendente)": [
    "detrazione.fascia1",
    "detrazione.correttivo",
  ],
  "Normattiva — D.L. 3/2020 art. 1 (trattamento integrativo)": [
    "cuneo.trattamentoIntegrativo",
    "cuneo.capienzaTrattamento",
  ],
  "Normattiva — L. 207/2024 art. 1 (somma integrativa e ulteriore detrazione)": [
    "cuneo.sommaIntegrativa",
    "cuneo.ulterioreDetrazione",
  ],
};

function dalWatchdog(esito: EsitoCaricamento): RiscontroEsterno[] {
  let status: StatusWatchdog;
  try {
    status = JSON.parse(fs.readFileSync(path.join(DIR_MONITORAGGIO, "status.json"), "utf-8"));
  } catch {
    return [];
  }
  esito.watchdog = { ultimoCheck: status.ultimoCheck, esito: status.esito };

  const riscontri: RiscontroEsterno[] = [];
  for (const fonte of status.fonti ?? []) {
    const claims = CLAIM_DA_FONTE_WATCHDOG[fonte.nome];
    if (!claims) continue;

    // Il watchdog rileva la differenza sul dataset, non la interpreta: se ha
    // visto un cambiamento marca "cambiato" e lascia il dettaglio all'umano.
    const esitoClaim =
      fonte.stato === "cambiamento-rilevato"
        ? ("cambiato" as const)
        : fonte.stato === "ok"
          ? ("confermato" as const)
          : ("incerto" as const);

    const normattiva = fonte.nome.startsWith("Normattiva");
    for (const claimId of claims) {
      riscontri.push({
        claimId,
        esito: esitoClaim,
        // su "ok" la fonte conferma il valore vivo: non c'è un valore diverso da mostrare
        valore: esitoClaim === "cambiato" ? (fonte.dettaglio ?? "differenza rilevata") : "",
        origine: normattiva ? "watchdog · testo vigente Normattiva" : "watchdog · dataset MEF",
        // la data del singolo controllo, non del run: Normattiva è settimanale e
        // un esito vecchio non deve vincere su un report di ricerca più recente
        data: fonte.controllatoIl ?? status.ultimoCheck,
        riferimento: fonte.nome,
        url:
          fonte.url ??
          "https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/",
        // niente citazione: il watchdog non interpreta, confronta —
        // il dettaglio è già il valore, ripeterlo sarebbe rumore
        note: normattiva
          ? "Rilevamento sull'hash del testo vigente: leggere l'articolo per capire cosa è cambiato."
          : "Differenza rilevata sul dataset: leggere la delibera per la formulazione esatta.",
      });
    }
  }
  return riscontri;
}
