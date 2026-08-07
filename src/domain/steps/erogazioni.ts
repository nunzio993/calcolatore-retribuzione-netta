import type { LineItem, RegoleAnno } from "../types";
import { round2 } from "../util";

export interface EsitoErogazioni {
  voci: LineItem[];
  sommaIntegrativa: number;
  trattamentoIntegrativo: number;
  totale: number;
}

/**
 * Erogazioni esenti che aumentano il netto senza transitare dall'IRPEF:
 * non sono detrazioni, quindi non subiscono il floor a zero dell'imposta.
 *
 * Assunzione: reddito complessivo = reddito da lavoro dipendente (unica fonte).
 *
 * - Somma integrativa (L. 207/2024 cc. 4-5): RC <= 20.000, % sull'INTERO
 *   reddito da lavoro, esente da IRPEF e contributi.
 * - Trattamento integrativo (D.L. 3/2020): RC <= 15.000, 1.200 € se
 *   imposta lorda > (detrazione art. 13 c. 1 - 75 €).
 *   La fascia 15.000-28.000 (condizionata ad altre detrazioni: mutui,
 *   ristrutturazioni pre-2022...) è fuori dal caso standard: dichiarata
 *   come semplificazione, non implementata.
 */
export function calcolaErogazioni(
  rc: number,
  irpefLorda: number,
  detrazioneLavoro: number,
  regole: RegoleAnno,
): EsitoErogazioni {
  const voci: LineItem[] = [];

  // Somma integrativa
  const si = regole.sommaIntegrativa;
  let sommaIntegrativa = 0;
  if (rc <= si.sogliaRedditoComplessivo) {
    const fascia = si.fasce.find(
      (f) => f.finoARedditoLavoro === null || rc <= f.finoARedditoLavoro,
    );
    if (fascia) {
      sommaIntegrativa = round2(rc * fascia.percentuale);
      voci.push({
        codice: "somma-integrativa",
        label: "Somma integrativa (riforma cuneo)",
        gruppo: "erogazioni",
        tipo: "erogazione",
        importo: sommaIntegrativa,
        baseImponibile: rc,
        aliquota: fascia.percentuale * 100,
        dettaglio: "Erogazione esente: non concorre al reddito, si somma al netto",
        fonte: "L. 207/2024 art. 1 cc. 4-5",
      });
    }
  }

  // Trattamento integrativo
  const ti = regole.trattamentoIntegrativo;
  let trattamentoIntegrativo = 0;
  if (rc <= ti.sogliaRedditoComplessivo) {
    const capiente = irpefLorda > detrazioneLavoro - ti.franchigiaCapienza;
    if (capiente) {
      trattamentoIntegrativo = ti.importo;
      voci.push({
        codice: "trattamento-integrativo",
        label: "Trattamento integrativo",
        gruppo: "erogazioni",
        tipo: "erogazione",
        importo: trattamentoIntegrativo,
        baseImponibile: rc,
        dettaglio: `Spetta: imposta lorda superiore a detrazione lavoro meno ${ti.franchigiaCapienza} €`,
        fonte: ti.fonte.split(";")[0],
      });
    } else {
      voci.push({
        codice: "trattamento-integrativo",
        label: "Trattamento integrativo",
        gruppo: "erogazioni",
        tipo: "info",
        importo: 0,
        baseImponibile: rc,
        dettaglio: "Non spetta: condizione di capienza non soddisfatta (D.L. 3/2020 art. 1 c. 1)",
        fonte: ti.fonte.split(";")[0],
      });
    }
  }

  return {
    voci,
    sommaIntegrativa,
    trattamentoIntegrativo,
    totale: round2(sommaIntegrativa + trattamentoIntegrativo),
  };
}
