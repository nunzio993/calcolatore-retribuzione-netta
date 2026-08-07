import { CATALOGO_CLAIM, claimPerId, type ClaimDef } from "./claims";
import type { RegoleAnno } from "./types";

export const SCHEMA_REPORT = "verifica-regole/v1";

/** Esito dichiarato dalla ricerca per un singolo parametro. */
export type EsitoClaim = "confermato" | "cambiato" | "incerto";

export interface ClaimReport {
  id: string;
  esito: EsitoClaim;
  /** Cosa dice la fonte oggi, in forma leggibile. */
  valore: string;
  riferimento: string;
  url: string;
  /** Citazione testuale dalla fonte: senza, il claim non è approvabile. */
  citazione: string;
  note?: string;
}

export interface ReportVerifica {
  schema: string;
  dataRicerca: string;
  annoImposta: number;
  strumento?: string;
  claims: ClaimReport[];
}

/**
 * Stato di sorveglianza di un parametro: unisce il valore vivo nel tool con
 * l'ultimo riscontro disponibile, quale che ne sia l'origine.
 */
export type StatoClaim =
  /** La fonte conferma il valore in vigore. */
  | "confermato"
  /** La fonte dice altro: serve una decisione. */
  | "cambiato"
  /** La ricerca non è arrivata a una conclusione. */
  | "incerto"
  /** Il report dice "confermato" ma riporta un valore diverso da quello vivo. */
  | "incoerente"
  /** Nessun riscontro: il parametro non è mai stato riverificato. */
  | "non-verificato";

export interface RigaSorveglianza {
  claim: ClaimDef;
  stato: StatoClaim;
  valoreVivo: string;
  /** Valore secondo l'ultimo riscontro (assente se mai verificato). */
  valoreTrovato?: string;
  riferimento?: string;
  url?: string;
  citazione?: string;
  note?: string;
  /** Da dove arriva il riscontro: ricerca manuale o watchdog automatico. */
  origine?: string;
  dataRiscontro?: string;
}

// ---------------------------------------------------------------- validazione

export interface EsitoValidazione {
  ok: boolean;
  errori: string[];
}

/**
 * Il report è un'interfaccia fra una chat qualunque e la pagina: se il formato
 * non è quello atteso va rifiutato con un errore preciso, non interpretato a
 * indovinare. Un diff su dati malformati è peggio di nessun diff.
 */
export function validaReport(dato: unknown, nomeFile: string): EsitoValidazione {
  const errori: string[] = [];
  const e = (msg: string) => errori.push(`${nomeFile}: ${msg}`);

  if (typeof dato !== "object" || dato === null) {
    return { ok: false, errori: [`${nomeFile}: il contenuto non è un oggetto JSON`] };
  }
  const r = dato as Partial<ReportVerifica>;

  if (r.schema !== SCHEMA_REPORT) {
    e(`schema "${r.schema ?? "(assente)"}" non riconosciuto, atteso "${SCHEMA_REPORT}"`);
  }
  if (typeof r.dataRicerca !== "string" || Number.isNaN(Date.parse(r.dataRicerca))) {
    e(`dataRicerca mancante o non è una data ISO`);
  }
  if (typeof r.annoImposta !== "number") {
    e(`annoImposta mancante o non numerico`);
  }
  if (!Array.isArray(r.claims) || r.claims.length === 0) {
    e(`claims mancante o vuoto`);
    return { ok: false, errori };
  }

  const visti = new Set<string>();
  r.claims.forEach((c, i) => {
    const dove = `claim[${i}]${c?.id ? ` (${c.id})` : ""}`;
    if (!c || typeof c !== "object") return e(`${dove}: non è un oggetto`);
    if (!claimPerId(c.id)) {
      return e(`${dove}: id sconosciuto — usare uno degli id del catalogo`);
    }
    if (visti.has(c.id)) e(`${dove}: id duplicato nello stesso report`);
    visti.add(c.id);
    if (!["confermato", "cambiato", "incerto"].includes(c.esito)) {
      e(`${dove}: esito "${c.esito}" non valido`);
    }
    if (typeof c.valore !== "string" || !c.valore.trim()) e(`${dove}: valore mancante`);
    if (typeof c.url !== "string" || !/^https?:\/\//.test(c.url)) {
      e(`${dove}: url mancante o non è un link`);
    }
    // La citazione è la prova: un claim senza prova non è approvabile.
    if (c.esito !== "incerto" && (typeof c.citazione !== "string" || c.citazione.trim().length < 10)) {
      e(`${dove}: citazione testuale mancante — senza prova il claim non è approvabile`);
    }
  });

  return { ok: errori.length === 0, errori };
}

// ---------------------------------------------------------- costruzione griglia

export interface RiscontroEsterno {
  claimId: string;
  esito: EsitoClaim;
  valore: string;
  origine: string;
  data: string;
  riferimento?: string;
  url?: string;
  citazione?: string;
  note?: string;
}

/**
 * Costruisce la griglia di sorveglianza: una riga per parametro del catalogo,
 * con l'ultimo riscontro disponibile fra tutte le origini (report manuali e
 * segnali automatici del watchdog).
 */
export function costruisciSorveglianza(
  regole: RegoleAnno,
  riscontri: RiscontroEsterno[],
): RigaSorveglianza[] {
  // per ogni claim tengo il riscontro più recente
  const ultimo = new Map<string, RiscontroEsterno>();
  for (const r of riscontri) {
    const precedente = ultimo.get(r.claimId);
    if (!precedente || Date.parse(r.data) >= Date.parse(precedente.data)) {
      ultimo.set(r.claimId, r);
    }
  }

  return CATALOGO_CLAIM.map((claim) => {
    const valoreVivo = claim.valore(regole);
    const r = ultimo.get(claim.id);
    if (!r) {
      return { claim, stato: "non-verificato" as const, valoreVivo };
    }

    // Difesa contro un report sciatto: dichiara "confermato" ma riporta altro.
    // Il valore vuoto è legittimo per i segnali automatici, che confermano
    // l'assenza di differenze senza rileggere il parametro.
    const stato: StatoClaim =
      r.esito === "confermato" && r.valore.trim() && normalizza(r.valore) !== normalizza(valoreVivo)
        ? "incoerente"
        : r.esito;

    return {
      claim,
      stato,
      valoreVivo,
      valoreTrovato: r.valore,
      riferimento: r.riferimento,
      url: r.url,
      citazione: r.citazione,
      note: r.note,
      origine: r.origine,
      dataRiscontro: r.data,
    };
  });
}

/** Confronto tollerante a spaziature e maiuscole: il resto è differenza vera. */
function normalizza(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function contaPerStato(righe: RigaSorveglianza[]): Record<StatoClaim, number> {
  const conta: Record<StatoClaim, number> = {
    cambiato: 0,
    incoerente: 0,
    incerto: 0,
    confermato: 0,
    "non-verificato": 0,
  };
  for (const r of righe) conta[r.stato]++;
  return conta;
}

/** Ordine di lettura: prima ciò che richiede una decisione. */
const PRIORITA: Record<StatoClaim, number> = {
  cambiato: 0,
  incoerente: 1,
  incerto: 2,
  "non-verificato": 3,
  confermato: 4,
};

export function ordinaPerUrgenza(righe: RigaSorveglianza[]): RigaSorveglianza[] {
  return [...righe].sort((a, b) => PRIORITA[a.stato] - PRIORITA[b.stato]);
}
