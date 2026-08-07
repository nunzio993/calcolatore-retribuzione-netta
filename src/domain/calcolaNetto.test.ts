import { describe, expect, it } from "vitest";
import { calcolaNetto } from "./calcolaNetto";

const calcola = (ral: number) => calcolaNetto({ ral, anno: 2026, mensilita: 13 });
const netto = (ral: number) => calcola(ral).totali.nettoAnnuo;
const voce = (ral: number, codice: string) =>
  calcola(ral).voci.find((v) => v.codice === codice);

/**
 * Golden test: valori attesi calcolati A MANO dai parametri di research/,
 * indipendentemente dal codice del motore. Tolleranza: centesimi
 * (aritmetica in virgola mobile con arrotondamento per voce).
 */
describe("golden test — casi di discontinuità", () => {
  it("RAL 15.000 — zona somma integrativa + trattamento integrativo", () => {
    const r = calcola(15000);
    // contributi: 15.000 × 9,49% = 1.423,50 → RC 13.576,50
    expect(r.totali.contributiDipendente).toBeCloseTo(1423.5, 1);
    expect(r.totali.imponibileFiscale).toBeCloseTo(13576.5, 1);
    // IRPEF lorda 23% = 3.122,60; detrazione 1.955 → netta 1.167,60
    expect(r.totali.irpefNetta).toBeCloseTo(1167.6, 1);
    // addizionale regionale 1,23% = 166,99; comunale esente (RC <= 23.000)
    expect(voce(15000, "addizionale-regionale")!.importo).toBeCloseTo(166.99, 1);
    expect(voce(15000, "addizionale-comunale")!.importo).toBe(0);
    // somma integrativa 5,3% × RC = 719,55; trattamento integrativo 1.200
    // (capienza: 3.122,60 > 1.955 − 75 = 1.880)
    expect(voce(15000, "somma-integrativa")!.importo).toBeCloseTo(719.55, 1);
    expect(voce(15000, "trattamento-integrativo")!.importo).toBe(1200);
    // netto = 15.000 − 1.423,50 − 1.167,60 − 166,99 + 719,55 + 1.200
    expect(r.totali.nettoAnnuo).toBeCloseTo(14161.46, 1);
  });

  it("RAL 35.000 — correttivo +65, ulteriore detrazione piena, tutte le addizionali", () => {
    const r = calcola(35000);
    // contributi 3.321,50 → RC 31.678,50
    expect(r.totali.imponibileFiscale).toBeCloseTo(31678.5, 1);
    // IRPEF lorda = 6.440 + 33% × 3.678,50 = 7.653,90
    expect(r.totali.irpefLorda).toBeCloseTo(7653.9, 1);
    // detrazione = 1.910 × (50.000 − RC)/22.000 + 65 = 1.655,64; ulteriore = 1.000
    expect(voce(35000, "detrazione-lavoro")!.importo).toBeCloseTo(1655.64, 1);
    expect(voce(35000, "ulteriore-detrazione")!.importo).toBe(1000);
    expect(r.totali.irpefNetta).toBeCloseTo(4998.26, 1);
    // addizionali: regionale 453,17 (scaglioni), comunale 253,43 (0,8% su tutto il RC)
    expect(voce(35000, "addizionale-regionale")!.importo).toBeCloseTo(453.17, 1);
    expect(voce(35000, "addizionale-comunale")!.importo).toBeCloseTo(253.43, 1);
    // nessuna erogazione sopra RC 20.000
    expect(r.totali.erogazioni).toBe(0);
    expect(r.totali.nettoAnnuo).toBeCloseTo(25973.64, 1);
  });

  it("RAL 80.000 — 1% aggiuntivo attivo, detrazioni a zero", () => {
    const r = calcola(80000);
    // IVS 7.352 + 1% × (80.000 − 56.224) = 237,76 + CIGS 240 = 7.829,76
    expect(r.totali.contributiDipendente).toBeCloseTo(7829.76, 1);
    expect(voce(80000, "contributi-1pc")!.importo).toBeCloseTo(237.76, 1);
    // RC 72.170,24 → lorda = 13.700 + 43% × 22.170,24 = 23.233,20; detrazioni 0
    expect(r.totali.irpefNetta).toBeCloseTo(23233.2, 1);
    expect(r.totali.detrazioni).toBe(0);
    expect(r.totali.nettoAnnuo).toBeCloseTo(47207.83, 1);
  });

  it("RAL 150.000 — sopra il massimale: IVS e 1% si fermano, CIGS no", () => {
    const r = calcola(150000);
    // IVS su 122.295 = 11.238,91; 1% su (122.295 − 56.224) = 660,71; CIGS su 150.000 = 450
    expect(voce(150000, "contributi-ivs")!.importo).toBeCloseTo(11238.91, 1);
    expect(voce(150000, "contributi-1pc")!.importo).toBeCloseTo(660.71, 1);
    expect(voce(150000, "contributi-cigs")!.importo).toBeCloseTo(450, 1);
    expect(r.totali.nettoAnnuo).toBeCloseTo(82874.87, 1);
  });

  it("RAL 25.000 — comunale esente per il cliff (RC 22.627,50 < 23.000)", () => {
    const r = calcola(25000);
    // contributi: IVS 9,19% × 25.000 = 2.297,50 · CIGS 0,30% × 25.000 = 75,00
    //             1% aggiuntivo: 25.000 < 56.224 → non dovuto
    //             totale = 2.372,50 → RC = 25.000 − 2.372,50 = 22.627,50
    expect(r.totali.contributiDipendente).toBeCloseTo(2372.5, 1);
    expect(r.totali.imponibileFiscale).toBeCloseTo(22627.5, 1);
    // IRPEF lorda: RC sotto 28.000 → 23% × 22.627,50 = 5.204,33
    expect(r.totali.irpefLorda).toBeCloseTo(5204.33, 1);
    // detrazione art. 13 fascia 15–28k: 1.910 + 1.190 × (28.000 − 22.627,50)/13.000
    //                                 = 1.910 + 1.190 × 0,413269 = 2.401,79
    // correttivo +65: non spetta, RC non supera 25.000
    expect(voce(25000, "detrazione-lavoro")!.importo).toBeCloseTo(2401.79, 1);
    // ulteriore detrazione: 20.000 < RC ≤ 32.000 → 1.000 pieni
    expect(voce(25000, "ulteriore-detrazione")!.importo).toBe(1000);
    // IRPEF netta = 5.204,33 − (2.401,79 + 1.000) = 1.802,54
    expect(r.totali.irpefNetta).toBeCloseTo(1802.54, 1);
    // regionale: 15.000 × 1,23% = 184,50 · 7.627,50 × 1,58% = 120,51 → 305,01
    expect(voce(25000, "addizionale-regionale")!.importo).toBeCloseTo(305.01, 1);
    // comunale: RC 22.627,50 ≤ 23.000 → esente (cliff, non franchigia)
    expect(voce(25000, "addizionale-comunale")!.importo).toBe(0);
    // erogazioni: RC oltre 20.000 → né somma né trattamento integrativo
    expect(r.totali.erogazioni).toBe(0);
    // netto = 25.000 − 2.372,50 − 1.802,54 − 305,01 = 20.519,95
    expect(r.totali.nettoAnnuo).toBeCloseTo(20519.95, 1);
  });

  it("RAL 50.000 — ulteriore detrazione a zero (RC > 40.000), detrazione in décalage", () => {
    const r = calcola(50000);
    // contributi: IVS 4.595 + CIGS 150 = 4.745 (1% non dovuto: 50.000 < 56.224)
    //             RC = 50.000 − 4.745 = 45.255
    expect(r.totali.contributiDipendente).toBeCloseTo(4745, 1);
    expect(r.totali.imponibileFiscale).toBeCloseTo(45255, 1);
    // IRPEF lorda = 6.440 (cumulata a 28.000) + 33% × 17.255 = 6.440 + 5.694,15 = 12.134,15
    expect(r.totali.irpefLorda).toBeCloseTo(12134.15, 1);
    // detrazione fascia 28–50k: 1.910 × (50.000 − 45.255)/22.000 = 1.910 × 0,215682 = 411,95
    // correttivo +65: non spetta, RC oltre 35.000
    expect(voce(50000, "detrazione-lavoro")!.importo).toBeCloseTo(411.95, 1);
    // ulteriore detrazione: RC oltre 40.000 → azzerata
    expect(voce(50000, "ulteriore-detrazione")).toBeUndefined();
    // IRPEF netta = 12.134,15 − 411,95 = 11.722,20
    expect(r.totali.irpefNetta).toBeCloseTo(11722.2, 1);
    // regionale: 184,50 + (13.000 × 1,58% = 205,40) + (17.255 × 1,72% = 296,79) = 686,69
    expect(voce(50000, "addizionale-regionale")!.importo).toBeCloseTo(686.69, 1);
    // comunale: RC oltre soglia → 0,8% sull'intero imponibile = 362,04
    expect(voce(50000, "addizionale-comunale")!.importo).toBeCloseTo(362.04, 1);
    // netto = 50.000 − 4.745 − 11.722,20 − (686,69 + 362,04) = 32.484,07
    expect(r.totali.nettoAnnuo).toBeCloseTo(32484.07, 1);
  });

  it("RAL 9.000 — IRPEF incapiente: addizionali non dovute, niente trattamento integrativo", () => {
    const r = calcola(9000);
    // RC 8.145,90 → lorda 1.873,56 < detrazione 1.955 → netta 0
    expect(r.totali.irpefNetta).toBe(0);
    // gate addizionali: non dovute con IRPEF netta zero
    expect(r.totali.addizionali).toBe(0);
    expect(voce(9000, "addizionali-esenti")).toBeDefined();
    // trattamento integrativo: 1.873,56 < 1.955 − 75 = 1.880 → NON spetta
    expect(voce(9000, "trattamento-integrativo")!.importo).toBe(0);
    // somma integrativa: RC <= 8.500 → 7,1% = 578,36
    expect(voce(9000, "somma-integrativa")!.importo).toBeCloseTo(578.36, 1);
  });
});

describe("discontinuità legittime (cliff normativi, non bug)", () => {
  it("soglia comunale Milano: 0 sotto 23.000 di RC, tutto l'imponibile sopra", () => {
    // RC = RAL × (1 − 0,0949): RAL 25.411 → RC 22.999,50 (esente); RAL 25.420 → RC 23.007,64
    expect(voce(25411, "addizionale-comunale")!.importo).toBe(0);
    const sopra = voce(25420, "addizionale-comunale")!;
    // cliff: si applica all'intero RC, non all'eccedenza → ~184 €, non centesimi
    expect(sopra.importo).toBeGreaterThan(180);
  });

  it("soglia RC 15.000: perdita del trattamento integrativo quasi compensata by design", () => {
    // RAL 16.570 → RC 14.997,5 (TI spetta); RAL 16.580 → RC 15.006,6 (TI non spetta).
    // La perdita del TI (−1.200) è quasi compensata dal salto della detrazione
    // art. 13 (1.955 → ~3.100 alla soglia) e in parte erosa dal cambio fascia
    // della somma integrativa (5,3% → 4,8%): perdita netta reale ~123 €.
    // Misura di quanto il legislatore abbia cucito le due misure.
    const sotto = netto(16570);
    const sopra = netto(16580);
    expect(sotto - sopra).toBeGreaterThan(50);
    expect(sotto - sopra).toBeLessThan(400);
  });

  it("attivazione trattamento integrativo (~RC 8.174): salto in su di 1.200 €", () => {
    // Condizione di capienza: imposta lorda > detrazione − 75 → 0,23 × RC > 1.880
    // → RC > 8.173,9 → RAL ≈ 9.031. Sotto: TI 0; sopra: TI 1.200.
    const primaVoce = voce(9000, "trattamento-integrativo")!;
    const dopoVoce = voce(9100, "trattamento-integrativo")!;
    expect(primaVoce.importo).toBe(0);
    expect(dopoVoce.importo).toBe(1200);
  });
});

describe("proprietà del sistema", () => {
  const STEP = 250;
  // Discontinuità normative legittime sul reddito complessivo:
  // 8.500  → fascia somma integrativa 7,1% → 5,3% (percentuale sull'intero reddito)
  // 15.000 → perdita trattamento integrativo + fascia somma 5,3% → 4,8%
  // 23.000 → esenzione addizionale comunale Milano (cliff sull'intero imponibile)
  const CLIFF_RC = [8500, 15000, 23000];

  it("monotonia: il netto cresce con la RAL, salvo i cliff normativi", () => {
    let precedente = calcola(5000);
    for (let ral = 5000 + STEP; ral <= 200000; ral += STEP) {
      const corrente = calcola(ral);
      const attraversaCliff = CLIFF_RC.some(
        (soglia) =>
          precedente.totali.imponibileFiscale <= soglia &&
          corrente.totali.imponibileFiscale > soglia,
      );
      if (!attraversaCliff) {
        expect(
          corrente.totali.nettoAnnuo,
          `netto non monotono a RAL ${ral}`,
        ).toBeGreaterThanOrEqual(precedente.totali.nettoAnnuo);
      }
      precedente = corrente;
    }
  });

  it("aliquota marginale < 100%: +250 € di RAL non aumentano il netto di più di ~250 €", () => {
    // Vale ovunque tranne dove il cambio di stato di una misura crea un salto
    // normativo legittimo: attivazione del trattamento integrativo (+1.200 alla
    // capienza), salto detrazione art. 13 a RC 15.000, cambio fascia somma
    // integrativa, RC 20.000 (somma max 960 → ulteriore detrazione 1.000: +~40,
    // coperto dalla tolleranza).
    for (let ral = 5000; ral < 200000; ral += STEP) {
      const a = calcola(ral);
      const b = calcola(ral + STEP);
      const tiA = a.voci.find((v) => v.codice === "trattamento-integrativo")?.importo ?? 0;
      const tiB = b.voci.find((v) => v.codice === "trattamento-integrativo")?.importo ?? 0;
      const attraversaSoglia =
        tiA !== tiB ||
        CLIFF_RC.some(
          (s) => a.totali.imponibileFiscale <= s && b.totali.imponibileFiscale > s,
        );
      if (attraversaSoglia) continue;
      const delta = b.totali.nettoAnnuo - a.totali.nettoAnnuo;
      expect(delta, `salto anomalo a RAL ${ral}`).toBeLessThanOrEqual(STEP + 45);
    }
  });

  it("continuità ai punti di scaglione (28k, 50k RC; 56.224, 122.295 RAL)", () => {
    // ai cambi di scaglione/soglia contributiva il netto è continuo (cambia solo la marginale)
    const punti = [28000 / 0.9051, 50000 / 0.9051, 56224, 122295];
    for (const p of punti) {
      const salto = Math.abs(netto(Math.ceil(p) + 1) - netto(Math.floor(p) - 1));
      expect(salto, `discontinuità a ~RAL ${Math.round(p)}`).toBeLessThan(5);
    }
  });

  it("coerenza interna: netto = RAL − trattenute + erogazioni; somma voci = totali", () => {
    for (const ral of [12000, 22000, 30000, 47000, 60000, 100000, 130000]) {
      const r = calcola(ral);
      const trattenuteDaVoci = r.voci
        .filter((v) => v.tipo === "trattenuta")
        .reduce((s, v) => s + v.importo, 0);
      const erogazioniDaVoci = r.voci
        .filter((v) => v.tipo === "erogazione")
        .reduce((s, v) => s + v.importo, 0);
      expect(trattenuteDaVoci).toBeCloseTo(r.totali.totaleTrattenute, 1);
      expect(erogazioniDaVoci).toBeCloseTo(r.totali.erogazioni, 1);
      expect(r.totali.nettoAnnuo).toBeCloseTo(
        ral - trattenuteDaVoci + erogazioniDaVoci,
        1,
      );
    }
  });

  it("mensilità: cambia solo il divisore, mai il netto annuo", () => {
    const perMensilita = ([12, 13, 14] as const).map((m) =>
      calcolaNetto({ ral: 35000, anno: 2026, mensilita: m }),
    );
    const annui = new Set(perMensilita.map((r) => r.totali.nettoAnnuo));
    expect(annui.size, "il netto annuo non deve dipendere dalle mensilità").toBe(1);
    for (const r of perMensilita) {
      expect(r.totali.nettoMensile).toBeCloseTo(r.totali.nettoAnnuo / r.input.mensilita, 2);
    }
  });
});

describe("guardrail", () => {
  it("anno senza regole: errore esplicito, mai estrapolazione", () => {
    expect(() => calcolaNetto({ ral: 30000, anno: 2027, mensilita: 13 })).toThrow(/2027/);
  });

  it("RAL non valida: errore", () => {
    expect(() => calcolaNetto({ ral: -1, anno: 2026, mensilita: 13 })).toThrow();
    expect(() => calcolaNetto({ ral: NaN, anno: 2026, mensilita: 13 })).toThrow();
  });
});
