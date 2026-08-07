/**
 * Formattazione monetaria it-IT.
 *
 * `useGrouping: "always"` è necessario: il default "auto" sopprime il separatore
 * delle migliaia sotto le 5 cifre ("7653,91" invece di "7.653,91"), e in un
 * prospetto di importi incolonnati l'incoerenza si vede.
 */
export function euro(n: number, decimali: 0 | 2 = 2): string {
  return n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
    useGrouping: "always",
  });
}

export function percento(n: number, decimaliMax = 2): string {
  return `${n.toLocaleString("it-IT", { maximumFractionDigits: decimaliMax })}%`;
}

/** "2026-08-07" → "7 agosto 2026". */
export function dataEstesa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}
