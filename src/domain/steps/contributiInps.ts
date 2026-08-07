import { euro } from "@/lib/formato";
import type { LineItem, RegoleAnno } from "../types";
import { round2 } from "../util";

export interface EsitoContributi {
  voci: LineItem[];
  totale: number;
}

/**
 * Contributi previdenziali a carico del dipendente.
 *
 * Assunzioni: imponibile previdenziale = RAL; iscrizione INPS post-1995
 * (massimale applicabile); industria/terziario >50 dip. (CIGS dovuta).
 *
 * - IVS 9,19% fino al massimale contributivo.
 * - 1% aggiuntivo sulla quota tra prima fascia pensionabile e massimale.
 * - CIGS 0,30% su tutta la RAL (contribuzione minore: non soggetta al massimale).
 */
export function calcolaContributi(ral: number, regole: RegoleAnno): EsitoContributi {
  const c = regole.contributi;
  const imponibileIvs = Math.min(ral, c.massimaleContributivo);
  const baseAggiuntiva = Math.max(0, imponibileIvs - c.primaFasciaPensionabile);

  const ivs = round2(imponibileIvs * c.aliquotaIvs);
  const aggiuntivo = round2(baseAggiuntiva * c.aliquotaAggiuntiva);
  const cigs = round2(ral * c.aliquotaCigs);

  const voci: LineItem[] = [
    {
      codice: "contributi-ivs",
      label: "Contributi IVS (quota dipendente)",
      gruppo: "contributi",
      tipo: "trattenuta",
      importo: ivs,
      baseImponibile: imponibileIvs,
      aliquota: c.aliquotaIvs * 100,
      dettaglio:
        ral > c.massimaleContributivo
          ? `Imponibile limitato al massimale contributivo (${euro(c.massimaleContributivo, 0)}, iscritti post-1995)`
          : undefined,
      fonte: "INPS circ. 11/2024 §3; circ. 6/2026 §6",
    },
  ];

  if (aggiuntivo > 0) {
    voci.push({
      codice: "contributi-1pc",
      label: "Aliquota aggiuntiva 1%",
      gruppo: "contributi",
      tipo: "trattenuta",
      importo: aggiuntivo,
      baseImponibile: baseAggiuntiva,
      aliquota: c.aliquotaAggiuntiva * 100,
      dettaglio: `Sulla quota oltre la prima fascia pensionabile (${euro(c.primaFasciaPensionabile, 0)})`,
      fonte: "Art. 3-ter D.L. 384/1992; INPS circ. 6/2026 §5",
    });
  }

  voci.push({
    codice: "contributi-cigs",
    label: "Contributo CIGS (quota dipendente)",
    gruppo: "contributi",
    tipo: "trattenuta",
    importo: cigs,
    baseImponibile: ral,
    aliquota: c.aliquotaCigs * 100,
    dettaglio: "Contribuzione minore: dovuta anche oltre il massimale",
    fonte: "D.Lgs. 148/2015 art. 23; INPS circ. 76/2022",
  });

  return { voci, totale: round2(ivs + aggiuntivo + cigs) };
}
