/**
 * Tipi del dominio: calcolo della retribuzione netta annuale da RAL.
 *
 * Principio: il motore non restituisce "un numero", restituisce un tracciato
 * di voci (LineItem[]) in cui ogni riga espone la propria base imponibile,
 * l'aliquota applicata e il riferimento normativo. Il netto è la conseguenza.
 */

/** Natura della voce: determina il segno con cui concorre al netto. */
export type TipoVoce =
  /** Riduce il netto (contributi, imposte). */
  | "trattenuta"
  /** Riduce l'IRPEF lorda, con floor a zero (art. 11 c. 3 TUIR). Non è denaro erogato. */
  | "riduzione-imposta"
  /** Somma erogata in busta, esente: aumenta il netto (somma integrativa, trattamento integrativo). */
  | "erogazione"
  /** Riga informativa: non concorre al netto. */
  | "info";

/**
 * Blocco logico del calcolo. Serve a leggere il prospetto come lo leggerebbe
 * un consulente: base dichiarata una volta, voci, subtotale.
 */
export type GruppoVoce = "contributi" | "irpef" | "addizionali" | "erogazioni";

export interface LineItem {
  /** Identificatore stabile della voce (per test e UI). */
  codice: string;
  label: string;
  gruppo: GruppoVoce;
  tipo: TipoVoce;
  /** Importo sempre >= 0; il segno è determinato da `tipo`. */
  importo: number;
  /** Base su cui la voce è calcolata (RAL, imponibile fiscale, ...). */
  baseImponibile?: number;
  /** Aliquota percentuale applicata, se la voce è proporzionale (es. 9.19). */
  aliquota?: number;
  /** Spiegazione breve della formula o della condizione applicata. */
  dettaglio?: string;
  /** Riferimento normativo (legge/articolo/circolare). */
  fonte: string;
}

export interface InputCalcolo {
  /** Retribuzione Annua Lorda in euro. */
  ral: number;
  /** Anno d'imposta: deve esistere nel registry delle regole. */
  anno: number;
  /** Mensilità del CCNL: cambia solo il divisore del netto mensile, mai il netto annuo. */
  mensilita: 12 | 13 | 14;
}

export interface TotaliCalcolo {
  contributiDipendente: number;
  imponibileFiscale: number;
  irpefLorda: number;
  detrazioni: number;
  irpefNetta: number;
  addizionali: number;
  erogazioni: number;
  /** contributi + IRPEF netta + addizionali (le erogazioni non sono trattenute). */
  totaleTrattenute: number;
  nettoAnnuo: number;
  nettoMensile: number;
}

export interface RisultatoCalcolo {
  input: InputCalcolo;
  voci: LineItem[];
  totali: TotaliCalcolo;
  /** Metadati delle regole applicate: anno e data di ultima verifica delle fonti. */
  regole: { anno: number; verifiedOn: string };
}

/** Scaglione progressivo: `fino` null = ultimo scaglione (nessun tetto). */
export interface Scaglione {
  fino: number | null;
  /** Aliquota in frazione (0.23 = 23%). */
  aliquota: number;
}

/** Fascia della somma integrativa: percentuale sul reddito da lavoro dipendente. */
export interface FasciaSommaIntegrativa {
  finoARedditoLavoro: number | null;
  percentuale: number;
}

/**
 * Parametri normativi di un anno d'imposta. Solo dati, nessuna logica:
 * l'engine implementa le formule, questo file dichiara i numeri.
 * Ogni blocco porta il proprio riferimento normativo.
 */
export interface RegoleAnno {
  anno: number;
  /** Data (ISO) dell'ultima verifica dei parametri sulle fonti primarie. */
  verifiedOn: string;

  contributi: {
    /** IVS FPLD quota lavoratore, in frazione. */
    aliquotaIvs: number;
    /** CIGS quota lavoratore (industria >15 dip. / terziario >50 dip.), in frazione. */
    aliquotaCigs: number;
    /** Aliquota aggiuntiva oltre la prima fascia pensionabile, in frazione. */
    aliquotaAggiuntiva: number;
    /** Prima fascia di retribuzione pensionabile, € annui. */
    primaFasciaPensionabile: number;
    /** Massimale contributivo iscritti post-1996, € annui. IVS e 1% si fermano qui; la CIGS no. */
    massimaleContributivo: number;
    fonte: string;
  };

  irpef: {
    scaglioni: Scaglione[];
    fonte: string;
  };

  detrazioneLavoroDipendente: {
    /** Fascia RC <= soglia1: importo fisso (con minimo). */
    soglia1: number;
    importoFascia1: number;
    minimoFascia1: number;
    /** Fascia soglia1 < RC <= soglia2: base + quota * (soglia2 - RC) / (soglia2 - soglia1). */
    soglia2: number;
    baseFascia2: number;
    quotaVariabileFascia2: number;
    /** Fascia soglia2 < RC <= soglia3: base * (soglia3 - RC) / (soglia3 - soglia2). */
    soglia3: number;
    /** Correttivo aggiuntivo (art. 13 c. 1.1 TUIR): +importo se minCorrettivo < RC <= maxCorrettivo. */
    correttivo: { importo: number; oltre: number; finoA: number };
    fonte: string;
  };

  /** Ulteriore detrazione L. 207/2024 art. 1 c. 6 (RC 20.000-40.000), alternativa alla somma integrativa. */
  ulterioreDetrazione: {
    importoPieno: number;
    /** Spetta per RC > oltre. */
    oltre: number;
    /** Importo pieno fino a questa soglia RC. */
    pienoFinoA: number;
    /** Décalage lineare fino a questa soglia RC, poi zero. */
    zeroA: number;
    fonte: string;
  };

  /** Somma integrativa L. 207/2024 art. 1 cc. 4-5 (RC <= soglia): erogazione esente, % sul reddito da lavoro. */
  sommaIntegrativa: {
    sogliaRedditoComplessivo: number;
    fasce: FasciaSommaIntegrativa[];
    fonte: string;
  };

  /** Trattamento integrativo D.L. 3/2020 (RC <= soglia): erogazione esente. */
  trattamentoIntegrativo: {
    importo: number;
    sogliaRedditoComplessivo: number;
    /** La condizione di capienza confronta l'imposta lorda con (detrazione art. 13 c. 1 - franchigia). */
    franchigiaCapienza: number;
    fonte: string;
  };

  addizionaleRegionale: {
    regione: string;
    scaglioni: Scaglione[];
    fonte: string;
  };

  addizionaleComunale: {
    comune: string;
    aliquota: number;
    /**
     * Soglia di esenzione a CLIFF (art. 1 c. 11 D.L. 138/2011): sotto o uguale
     * alla soglia non è dovuta; sopra, si applica all'INTERO imponibile.
     */
    sogliaEsenzione: number;
    fonte: string;
  };
}
