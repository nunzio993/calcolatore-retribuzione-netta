import type { LineItem, RegoleAnno } from "../types";
import { impostaPerScaglioni, round2 } from "../util";

export interface EsitoIrpef {
  voci: LineItem[];
  irpefLorda: number;
  detrazioneLavoro: number;
  ulterioreDetrazione: number;
  totaleDetrazioni: number;
  irpefNetta: number;
}

/**
 * Detrazione per redditi di lavoro dipendente — art. 13 c. 1 e c. 1.1 TUIR.
 * Assunzione: 365 giorni di lavoro nell'anno (nessun ragguaglio).
 */
export function calcolaDetrazioneLavoro(rc: number, regole: RegoleAnno): number {
  const d = regole.detrazioneLavoroDipendente;
  let detrazione: number;

  if (rc <= d.soglia1) {
    detrazione = Math.max(d.importoFascia1, d.minimoFascia1);
  } else if (rc <= d.soglia2) {
    detrazione =
      d.baseFascia2 + d.quotaVariabileFascia2 * ((d.soglia2 - rc) / (d.soglia2 - d.soglia1));
  } else if (rc <= d.soglia3) {
    detrazione = d.baseFascia2 * ((d.soglia3 - rc) / (d.soglia3 - d.soglia2));
  } else {
    detrazione = 0;
  }

  if (rc > d.correttivo.oltre && rc <= d.correttivo.finoA) {
    detrazione += d.correttivo.importo;
  }

  return round2(detrazione);
}

/**
 * Ulteriore detrazione L. 207/2024 art. 1 c. 6 — RC 20.000-40.000.
 * Alternativa (non cumulabile) alla somma integrativa, che copre RC <= 20.000.
 */
export function calcolaUlterioreDetrazione(rc: number, regole: RegoleAnno): number {
  const u = regole.ulterioreDetrazione;
  if (rc <= u.oltre || rc > u.zeroA) return 0;
  if (rc <= u.pienoFinoA) return u.importoPieno;
  return round2(u.importoPieno * ((u.zeroA - rc) / (u.zeroA - u.pienoFinoA)));
}

/**
 * IRPEF: lorda per scaglioni (art. 11 c. 1 TUIR), poi detrazioni fino a
 * concorrenza (art. 11 c. 3: floor a zero, l'eccedenza non genera credito).
 */
export function calcolaIrpef(rc: number, regole: RegoleAnno): EsitoIrpef {
  const irpefLorda = round2(impostaPerScaglioni(rc, regole.irpef.scaglioni));
  const detrazioneLavoro = calcolaDetrazioneLavoro(rc, regole);
  const ulterioreDetrazione = calcolaUlterioreDetrazione(rc, regole);
  const totaleDetrazioni = round2(detrazioneLavoro + ulterioreDetrazione);
  const irpefNetta = round2(Math.max(0, irpefLorda - totaleDetrazioni));

  const voci: LineItem[] = [
    {
      codice: "irpef-lorda",
      label: "IRPEF lorda",
      gruppo: "irpef",
      tipo: "info",
      importo: irpefLorda,
      baseImponibile: rc,
      dettaglio: "Scaglioni 2026: 23% fino a 28.000 · 33% fino a 50.000 · 43% oltre",
      fonte: "Art. 11 c. 1 TUIR mod. L. 199/2025 art. 1 c. 3",
    },
    {
      codice: "detrazione-lavoro",
      label: "Detrazione lavoro dipendente",
      gruppo: "irpef",
      tipo: "riduzione-imposta",
      importo: detrazioneLavoro,
      baseImponibile: rc,
      dettaglio:
        rc > regole.detrazioneLavoroDipendente.correttivo.oltre &&
        rc <= regole.detrazioneLavoroDipendente.correttivo.finoA
          ? "Include correttivo +65 € (art. 13 c. 1.1)"
          : undefined,
      fonte: "Art. 13 c. 1 TUIR",
    },
  ];

  if (ulterioreDetrazione > 0) {
    voci.push({
      codice: "ulteriore-detrazione",
      label: "Ulteriore detrazione (riforma cuneo)",
      gruppo: "irpef",
      tipo: "riduzione-imposta",
      importo: ulterioreDetrazione,
      baseImponibile: rc,
      fonte: "L. 207/2024 art. 1 c. 6",
    });
  }

  voci.push({
    codice: "irpef-netta",
    label: "IRPEF netta",
    gruppo: "irpef",
    tipo: "trattenuta",
    importo: irpefNetta,
    baseImponibile: rc,
    dettaglio:
      irpefLorda - totaleDetrazioni < 0
        ? "Detrazioni oltre la capienza: eccedenza persa (art. 11 c. 3 TUIR)"
        : "IRPEF lorda meno detrazioni, fino a concorrenza",
    fonte: "Art. 11 c. 3 TUIR",
  });

  return { voci, irpefLorda, detrazioneLavoro, ulterioreDetrazione, totaleDetrazioni, irpefNetta };
}
