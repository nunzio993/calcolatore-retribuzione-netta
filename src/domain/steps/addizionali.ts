import { euro } from "@/lib/formato";
import type { LineItem, RegoleAnno } from "../types";
import { impostaPerScaglioni, round2 } from "../util";

export interface EsitoAddizionali {
  voci: LineItem[];
  regionale: number;
  comunale: number;
  totale: number;
}

/**
 * Addizionali regionale e comunale, calcolate per competenza.
 *
 * - Base: reddito complessivo al netto degli oneri deducibili (qui: RC dopo
 *   contributi). Le detrazioni d'imposta NON riducono la base
 *   (art. 50 c. 2 D.Lgs. 446/1997; art. 1 c. 4 D.Lgs. 360/1998).
 * - Gate: dovute solo se l'IRPEF netta dell'anno è > 0 (stesse norme).
 * - Comunale Milano: soglia di esenzione a CLIFF — sopra 23.000 € si applica
 *   all'intero imponibile (art. 1 c. 11 D.L. 138/2011).
 */
export function calcolaAddizionali(
  rc: number,
  irpefNetta: number,
  regole: RegoleAnno,
): EsitoAddizionali {
  if (irpefNetta <= 0) {
    return {
      voci: [
        {
          codice: "addizionali-esenti",
          label: "Addizionali regionale e comunale",
          gruppo: "addizionali",
          tipo: "info",
          importo: 0,
          baseImponibile: rc,
          dettaglio: "Non dovute: IRPEF netta pari a zero",
          fonte: "Art. 50 c. 2 D.Lgs. 446/1997; art. 1 c. 4 D.Lgs. 360/1998",
        },
      ],
      regionale: 0,
      comunale: 0,
      totale: 0,
    };
  }

  const reg = regole.addizionaleRegionale;
  const com = regole.addizionaleComunale;

  const regionale = round2(impostaPerScaglioni(rc, reg.scaglioni));
  const esenteComunale = rc <= com.sogliaEsenzione;
  const comunale = esenteComunale ? 0 : round2(rc * com.aliquota);

  const voci: LineItem[] = [
    {
      codice: "addizionale-regionale",
      label: `Addizionale regionale (${reg.regione})`,
      gruppo: "addizionali",
      tipo: "trattenuta",
      importo: regionale,
      baseImponibile: rc,
      dettaglio: "Per scaglioni: 1,23% · 1,58% · 1,72% · 1,73%",
      fonte: reg.fonte.split(";")[0],
    },
    {
      codice: "addizionale-comunale",
      label: `Addizionale comunale (${com.comune})`,
      gruppo: "addizionali",
      tipo: esenteComunale ? "info" : "trattenuta",
      importo: comunale,
      baseImponibile: rc,
      aliquota: esenteComunale ? undefined : com.aliquota * 100,
      dettaglio: esenteComunale
        ? `Esente: imponibile entro la soglia di ${euro(com.sogliaEsenzione, 0)}`
        : `Sopra la soglia di esenzione l'aliquota si applica all'intero imponibile`,
      fonte: "Delibere C.C. Milano 36/2013 e 46/2020; art. 1 c. 11 D.L. 138/2011",
    },
  ];

  return { voci, regionale, comunale, totale: round2(regionale + comunale) };
}
