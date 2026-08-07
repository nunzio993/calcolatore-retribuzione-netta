import type { InputCalcolo, RisultatoCalcolo } from "./types";
import { regolePerAnno } from "./rules";
import { round2 } from "./util";
import { calcolaContributi } from "./steps/contributiInps";
import { calcolaIrpef } from "./steps/irpef";
import { calcolaAddizionali } from "./steps/addizionali";
import { calcolaErogazioni } from "./steps/erogazioni";

/**
 * Catena di calcolo RAL -> netto annuo (funzione pura).
 *
 * RAL
 *  -> contributi dipendente (IVS + 1% + CIGS)     [base: RAL, con massimale]
 *  -> imponibile fiscale = RC                     [RAL - contributi]
 *  -> IRPEF lorda - detrazioni, floor a zero      [base: RC]
 *  -> addizionali, solo se IRPEF netta > 0        [base: RC, non godono di detrazioni]
 *  -> + erogazioni esenti (somma int. / tratt. int.)
 *  = netto annuo -> / mensilita = netto mensile
 *
 * Il calcolo è per competenza: rappresenta il carico dell'anno d'imposta,
 * non il flusso di cassa mensile (acconti/saldi delle addizionali e
 * conguagli sono documentati come semplificazione).
 */
export function calcolaNetto(input: InputCalcolo): RisultatoCalcolo {
  if (!Number.isFinite(input.ral) || input.ral < 0) {
    throw new Error(`RAL non valida: ${input.ral}`);
  }
  const regole = regolePerAnno(input.anno);

  // 1. Contributi previdenziali (assunzione: imponibile previdenziale = RAL)
  const contributi = calcolaContributi(input.ral, regole);

  // 2. Imponibile fiscale = reddito complessivo (assunzione: unica fonte di reddito)
  const rc = round2(input.ral - contributi.totale);

  // 3. IRPEF
  const irpef = calcolaIrpef(rc, regole);

  // 4. Addizionali (gate: IRPEF netta > 0)
  const addizionali = calcolaAddizionali(rc, irpef.irpefNetta, regole);

  // 5. Erogazioni esenti
  const erogazioni = calcolaErogazioni(rc, irpef.irpefLorda, irpef.detrazioneLavoro, regole);

  const totaleTrattenute = round2(contributi.totale + irpef.irpefNetta + addizionali.totale);
  const nettoAnnuo = round2(input.ral - totaleTrattenute + erogazioni.totale);
  const nettoMensile = round2(nettoAnnuo / input.mensilita);

  return {
    input,
    voci: [...contributi.voci, ...irpef.voci, ...addizionali.voci, ...erogazioni.voci],
    totali: {
      contributiDipendente: contributi.totale,
      imponibileFiscale: rc,
      irpefLorda: irpef.irpefLorda,
      detrazioni: irpef.totaleDetrazioni,
      irpefNetta: irpef.irpefNetta,
      addizionali: addizionali.totale,
      erogazioni: erogazioni.totale,
      totaleTrattenute,
      nettoAnnuo,
      nettoMensile,
    },
    regole: { anno: regole.anno, verifiedOn: regole.verifiedOn },
  };
}
