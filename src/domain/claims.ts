import { euro, percento } from "@/lib/formato";
import type { RegoleAnno } from "./types";

/**
 * Catalogo dei claim verificabili.
 *
 * Ogni riga di `rules/<anno>.ts` è un'affermazione: "il parametro X vale Y
 * secondo la fonte Z". Questo catalogo la rende indirizzabile: dà a ciascuna
 * un identificatore stabile, il percorso nel file regole, e come si legge il
 * valore vivo. È il vocabolario condiviso fra il prompt di ricerca (che
 * compila un modulo usando questi id) e la pagina /stato (che confronta).
 *
 * Aggiungendo un parametro alle regole va aggiunto anche qui, altrimenti
 * nessuno lo sorveglierà: `claimNonCoperti()` lo segnala.
 */

// Formatter condivisi, mai riscritti in locale: un secondo formatter diverge in
// silenzio (è già successo — "1955 €" contro "1.955 €" produceva falsi positivi
// di incoerenza). Vedi la nota su `useGrouping` in lib/formato.ts.
const pct = (n: number) => percento(n * 100);
const eur = (n: number) => euro(n, 0);

export type GruppoClaim = "irpef" | "cuneo" | "contributi" | "addizionali";

export interface ClaimDef {
  id: string;
  label: string;
  gruppo: GruppoClaim;
  /** Percorso nel file regole, per generare la modifica da applicare. */
  percorso: string;
  /** Valore attualmente in vigore nel tool, formattato per il confronto umano. */
  valore: (r: RegoleAnno) => string;
  /** Fonte citata nel file regole. */
  fonte: (r: RegoleAnno) => string;
}

export const CATALOGO_CLAIM: ClaimDef[] = [
  {
    id: "irpef.scaglioni",
    label: "Scaglioni e aliquote IRPEF",
    gruppo: "irpef",
    percorso: "irpef.scaglioni",
    valore: (r) =>
      r.irpef.scaglioni
        .map((s) => (s.fino ? `${pct(s.aliquota)} fino a ${eur(s.fino)}` : `${pct(s.aliquota)} oltre`))
        .join(" · "),
    fonte: (r) => r.irpef.fonte,
  },
  {
    id: "detrazione.fascia1",
    label: "Detrazione lavoro dipendente — fascia base",
    gruppo: "irpef",
    percorso: "detrazioneLavoroDipendente.importoFascia1",
    valore: (r) =>
      `${eur(r.detrazioneLavoroDipendente.importoFascia1)} fino a ${eur(r.detrazioneLavoroDipendente.soglia1)} (minimo ${eur(r.detrazioneLavoroDipendente.minimoFascia1)})`,
    fonte: (r) => r.detrazioneLavoroDipendente.fonte,
  },
  {
    id: "detrazione.correttivo",
    label: "Detrazione — correttivo art. 13 c. 1.1",
    gruppo: "irpef",
    percorso: "detrazioneLavoroDipendente.correttivo",
    valore: (r) =>
      `+${eur(r.detrazioneLavoroDipendente.correttivo.importo)} se reddito fra ${eur(r.detrazioneLavoroDipendente.correttivo.oltre)} e ${eur(r.detrazioneLavoroDipendente.correttivo.finoA)}`,
    fonte: (r) => r.detrazioneLavoroDipendente.fonte,
  },
  {
    id: "cuneo.sommaIntegrativa",
    label: "Somma integrativa (cuneo)",
    gruppo: "cuneo",
    percorso: "sommaIntegrativa",
    valore: (r) =>
      `${r.sommaIntegrativa.fasce.map((f) => pct(f.percentuale)).join(" / ")} per redditi entro ${eur(r.sommaIntegrativa.sogliaRedditoComplessivo)}`,
    fonte: (r) => r.sommaIntegrativa.fonte,
  },
  {
    id: "cuneo.ulterioreDetrazione",
    label: "Ulteriore detrazione (cuneo)",
    gruppo: "cuneo",
    percorso: "ulterioreDetrazione",
    valore: (r) =>
      `${eur(r.ulterioreDetrazione.importoPieno)} fra ${eur(r.ulterioreDetrazione.oltre)} e ${eur(r.ulterioreDetrazione.pienoFinoA)}, décalage fino a ${eur(r.ulterioreDetrazione.zeroA)}`,
    fonte: (r) => r.ulterioreDetrazione.fonte,
  },
  {
    id: "cuneo.trattamentoIntegrativo",
    label: "Trattamento integrativo — importo e soglia",
    gruppo: "cuneo",
    percorso: "trattamentoIntegrativo.importo",
    valore: (r) =>
      `${eur(r.trattamentoIntegrativo.importo)} per redditi entro ${eur(r.trattamentoIntegrativo.sogliaRedditoComplessivo)}`,
    fonte: (r) => r.trattamentoIntegrativo.fonte,
  },
  {
    id: "cuneo.capienzaTrattamento",
    label: "Trattamento integrativo — franchigia di capienza",
    gruppo: "cuneo",
    percorso: "trattamentoIntegrativo.franchigiaCapienza",
    valore: (r) =>
      `imposta lorda > detrazione art. 13 meno ${eur(r.trattamentoIntegrativo.franchigiaCapienza)}`,
    fonte: (r) => r.trattamentoIntegrativo.fonte,
  },
  {
    id: "contributi.ivs",
    label: "Aliquota IVS quota dipendente",
    gruppo: "contributi",
    percorso: "contributi.aliquotaIvs",
    valore: (r) => pct(r.contributi.aliquotaIvs),
    fonte: (r) => r.contributi.fonte,
  },
  {
    id: "contributi.cigs",
    label: "Aliquota CIGS quota dipendente",
    gruppo: "contributi",
    percorso: "contributi.aliquotaCigs",
    valore: (r) => pct(r.contributi.aliquotaCigs),
    fonte: (r) => r.contributi.fonte,
  },
  {
    id: "contributi.primaFascia",
    label: "Prima fascia di retribuzione pensionabile",
    gruppo: "contributi",
    percorso: "contributi.primaFasciaPensionabile",
    valore: (r) =>
      `${eur(r.contributi.primaFasciaPensionabile)} (oltre: +${pct(r.contributi.aliquotaAggiuntiva)})`,
    fonte: (r) => r.contributi.fonte,
  },
  {
    id: "contributi.massimale",
    label: "Massimale contributivo post-1995",
    gruppo: "contributi",
    percorso: "contributi.massimaleContributivo",
    valore: (r) => eur(r.contributi.massimaleContributivo),
    fonte: (r) => r.contributi.fonte,
  },
  {
    id: "addizionali.regionale",
    label: "Addizionale regionale Lombardia",
    gruppo: "addizionali",
    percorso: "addizionaleRegionale.scaglioni",
    valore: (r) => r.addizionaleRegionale.scaglioni.map((s) => pct(s.aliquota)).join(" / "),
    fonte: (r) => r.addizionaleRegionale.fonte,
  },
  {
    id: "addizionali.comunaleAliquota",
    label: "Addizionale comunale Milano — aliquota",
    gruppo: "addizionali",
    percorso: "addizionaleComunale.aliquota",
    valore: (r) => pct(r.addizionaleComunale.aliquota),
    fonte: (r) => r.addizionaleComunale.fonte,
  },
  {
    id: "addizionali.comunaleEsenzione",
    label: "Addizionale comunale Milano — soglia di esenzione",
    gruppo: "addizionali",
    percorso: "addizionaleComunale.sogliaEsenzione",
    valore: (r) => `${eur(r.addizionaleComunale.sogliaEsenzione)} (cliff)`,
    fonte: (r) => r.addizionaleComunale.fonte,
  },
];

export const ETICHETTA_GRUPPO: Record<GruppoClaim, string> = {
  irpef: "IRPEF",
  cuneo: "Riforma del cuneo",
  contributi: "Contributi INPS",
  addizionali: "Addizionali locali",
};

export function claimPerId(id: string): ClaimDef | undefined {
  return CATALOGO_CLAIM.find((c) => c.id === id);
}
