/** Arrotondamento monetario al centesimo (mai binario puro: evita 0.1+0.2). */
export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

import type { Scaglione } from "./types";

/**
 * Imposta progressiva per scaglioni: somma di (quota di base nello scaglione x aliquota).
 * L'ultimo scaglione ha `fino: null` (nessun tetto).
 */
export function impostaPerScaglioni(base: number, scaglioni: Scaglione[]): number {
  let imposta = 0;
  let precedente = 0;
  for (const s of scaglioni) {
    const tetto = s.fino ?? Infinity;
    if (base <= precedente) break;
    const quota = Math.min(base, tetto) - precedente;
    imposta += quota * s.aliquota;
    precedente = tetto;
  }
  return imposta;
}
