import type { RegoleAnno } from "../types";
import { regole2026 } from "./2026";

/**
 * Registry delle regole per anno d'imposta.
 *
 * Fuori dagli anni presenti il calcolatore fallisce esplicitamente:
 * mai estrapolare regole di un anno a un altro (il costo di un numero
 * sbagliato ma plausibile è più alto di un errore dichiarato).
 */
const registry: ReadonlyMap<number, RegoleAnno> = new Map([[2026, regole2026]]);

export function anniDisponibili(): number[] {
  return [...registry.keys()].sort();
}

export function regolePerAnno(anno: number): RegoleAnno {
  const regole = registry.get(anno);
  if (!regole) {
    throw new Error(
      `Nessuna regola per l'anno d'imposta ${anno}. Anni disponibili: ${anniDisponibili().join(", ")}. ` +
        "Aggiungere src/domain/rules/<anno>.ts con parametri verificati su fonte primaria.",
    );
  }
  return regole;
}
