import type { RegoleAnno } from "../types";

/**
 * Parametri normativi — anno d'imposta 2026.
 *
 * Ogni valore è tracciato alla fonte primaria in research/ (report 01-03).
 * Nessun valore proviene da aggregatori o calcolatori online.
 *
 * Verifica: 2026-08-07.
 */
export const regole2026: RegoleAnno = {
  anno: 2026,
  verifiedOn: "2026-08-07",

  contributi: {
    // IVS FPLD quota lavoratore: 9,19% — INPS circ. 11/2024 §3 (strutturale, invariata).
    aliquotaIvs: 0.0919,
    // CIGS quota lavoratore: 0,30% — D.Lgs. 148/2015 art. 23; INPS circ. 76/2022.
    // Vale per industria >15 dip. e terziario >50 dip.: il nostro caso standard.
    aliquotaCigs: 0.003,
    // Aliquota aggiuntiva 1% oltre la prima fascia — art. 3-ter D.L. 384/1992.
    aliquotaAggiuntiva: 0.01,
    // Prima fascia di retribuzione pensionabile 2026 — INPS circ. 6/2026 §5.
    primaFasciaPensionabile: 56224,
    // Massimale contributivo post-1996 — INPS circ. 6/2026 §6 (122.295,40 arrotondato).
    // Oltre il massimale si fermano IVS e 1%; la CIGS resta dovuta (contribuzione minore).
    massimaleContributivo: 122295,
    fonte:
      "INPS circ. 6/2026 §5-6; circ. 11/2024 §3; D.Lgs. 148/2015 art. 23; https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html",
  },

  irpef: {
    // Art. 11 c. 1 TUIR, secondo scaglione 35% -> 33% dal 2026 (L. 199/2025 art. 1 c. 3).
    scaglioni: [
      { fino: 28000, aliquota: 0.23 },
      { fino: 50000, aliquota: 0.33 },
      { fino: null, aliquota: 0.43 },
    ],
    fonte:
      "Art. 11 c. 1 TUIR mod. L. 199/2025 art. 1 c. 3 (GU n. 301 del 30/12/2025); https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025-12-30;199",
  },

  detrazioneLavoroDipendente: {
    // Art. 13 c. 1 TUIR (testo vigente 2026).
    soglia1: 15000,
    importoFascia1: 1955,
    minimoFascia1: 690, // 1.380 per tempo determinato: fuori dal caso standard.
    soglia2: 28000,
    baseFascia2: 1910,
    quotaVariabileFascia2: 1190,
    soglia3: 50000,
    // Art. 13 c. 1.1 TUIR: +65 € se 25.000 < RC <= 35.000 (per intero, non ragguagliato).
    correttivo: { importo: 65, oltre: 25000, finoA: 35000 },
    fonte:
      "Art. 13 c. 1 e c. 1.1 TUIR; https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917~art13!vig=",
  },

  ulterioreDetrazione: {
    // L. 207/2024 art. 1 c. 6: 1.000 € per RC 20.000-32.000, décalage lineare fino a 40.000.
    importoPieno: 1000,
    oltre: 20000,
    pienoFinoA: 32000,
    zeroA: 40000,
    fonte:
      "L. 207/2024 art. 1 c. 6; https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024-12-30;207~art1!vig=",
  },

  sommaIntegrativa: {
    // L. 207/2024 art. 1 cc. 4-5: erogazione esente per RC <= 20.000,
    // percentuale sul reddito di lavoro dipendente (intero, non sull'eccedenza).
    sogliaRedditoComplessivo: 20000,
    fasce: [
      { finoARedditoLavoro: 8500, percentuale: 0.071 },
      { finoARedditoLavoro: 15000, percentuale: 0.053 },
      { finoARedditoLavoro: null, percentuale: 0.048 },
    ],
    fonte:
      "L. 207/2024 art. 1 cc. 4-5; Circ. AdE 4/E del 16/05/2025; https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024-12-30;207~art1!vig=",
  },

  trattamentoIntegrativo: {
    // D.L. 3/2020 art. 1 c. 1: 1.200 € se RC <= 15.000 e
    // imposta lorda > (detrazione art. 13 c. 1 - 75 €).
    importo: 1200,
    sogliaRedditoComplessivo: 15000,
    franchigiaCapienza: 75,
    fonte:
      "D.L. 3/2020 art. 1 (conv. L. 21/2020); https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2020-02-05;3~art1!vig=",
  },

  addizionaleRegionale: {
    regione: "Lombardia",
    // Art. 72 c. 1 L.R. Lombardia 10/2003; provvedimento MEF 2179, pubbl. 28/01/2026.
    // Scaglioni regionali propri (facoltà prorogata al 2028: L. 207/2024 cc. 726-728 mod. L. 199/2025).
    scaglioni: [
      { fino: 15000, aliquota: 0.0123 },
      { fino: 28000, aliquota: 0.0158 },
      { fino: 50000, aliquota: 0.0172 },
      { fino: null, aliquota: 0.0173 },
    ],
    fonte:
      "Art. 72 c. 1 L.R. Lombardia 10/2003; MEF provv. 2179/2026; https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=10",
  },

  addizionaleComunale: {
    comune: "Milano",
    // Delibera C.C. 36/2013 (aliquota) + C.C. 46/2020 (soglia); invariate per il 2026
    // (parere Organo di Revisione bilancio 2026-2028, n. 98 del 09/12/2025, pag. 69).
    aliquota: 0.008,
    // CLIFF, non franchigia: sopra 23.000 si applica all'intero imponibile
    // (art. 1 c. 11 D.L. 138/2011, conv. L. 148/2011).
    sogliaEsenzione: 23000,
    fonte:
      "Delibere C.C. Milano 36/2013 e 46/2020; art. 1 c. 11 D.L. 138/2011; https://www.comune.milano.it/argomenti/tributi/addizionale-comunale-irpef",
  },
};
