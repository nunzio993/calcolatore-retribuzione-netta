import { describe, expect, it } from "vitest";
import { dataEstesa, euro, percento } from "./formato";

/**
 * Guard sui formatter condivisi.
 *
 * Nasce da un difetto reale: il default `useGrouping: "auto"` di Intl sopprime
 * il separatore delle migliaia sotto le 5 cifre. Il bug è comparso due volte —
 * la seconda in un formatter riscritto in locale invece di importato — e in una
 * colonna di importi incolonnati produce righe come "7653,91 €" accanto a
 * "35.000,00 €". Questi test bloccano la regressione a monte.
 */
describe("euro", () => {
  it("raggruppa le migliaia anche sotto le 5 cifre", () => {
    expect(euro(7653.91)).toContain("7.653");
    expect(euro(1955, 0)).toContain("1.955");
    expect(euro(1200, 0)).toContain("1.200");
  });

  it("mantiene il raggruppamento sopra le 5 cifre", () => {
    expect(euro(122295, 0)).toContain("122.295");
    expect(euro(35000)).toContain("35.000");
  });

  it("rispetta i decimali richiesti", () => {
    expect(euro(1234.567, 2)).toContain(",57");
    expect(euro(1234.567, 0)).not.toContain(",");
  });

  it("usa la virgola come separatore decimale (it-IT)", () => {
    expect(euro(0.5)).toContain("0,50");
  });
});

describe("percento", () => {
  it("formatta con la virgola decimale", () => {
    expect(percento(9.19)).toBe("9,19%");
    expect(percento(0.3)).toBe("0,3%");
  });

  it("accetta un massimo di decimali configurabile", () => {
    expect(percento(25.789, 1)).toBe("25,8%");
    expect(percento(25.789)).toBe("25,79%");
  });
});

describe("dataEstesa", () => {
  it("rende leggibile una data ISO", () => {
    expect(dataEstesa("2026-08-07")).toBe("7 agosto 2026");
  });

  it("restituisce l'input se non è una data valida", () => {
    expect(dataEstesa("non-una-data")).toBe("non-una-data");
  });
});
