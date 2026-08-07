import type { GruppoVoce, LineItem, RisultatoCalcolo } from "@/domain/types";
import { euro, percento } from "@/lib/formato";

interface DefinizioneGruppo {
  chiave: GruppoVoce;
  numero: string;
  titolo: string;
  /** Base su cui il gruppo è calcolato: dichiarata una volta, non ripetuta riga per riga. */
  base: (r: RisultatoCalcolo) => number;
  etichettaBase: string;
  subtotale: (r: RisultatoCalcolo) => { label: string; valore: number; segno: "−" | "+" };
  /** Riga di raccordo verso il blocco successivo (l'output di questo gruppo). */
  raccordo?: (r: RisultatoCalcolo) => { label: string; valore: number };
}

const GRUPPI: DefinizioneGruppo[] = [
  {
    chiave: "contributi",
    numero: "1",
    titolo: "Contributi previdenziali",
    base: (r) => r.input.ral,
    etichettaBase: "Retribuzione annua lorda",
    subtotale: (r) => ({
      label: "Totale contributi a carico del dipendente",
      valore: r.totali.contributiDipendente,
      segno: "−",
    }),
    raccordo: (r) => ({ label: "Imponibile fiscale", valore: r.totali.imponibileFiscale }),
  },
  {
    chiave: "irpef",
    numero: "2",
    titolo: "IRPEF",
    base: (r) => r.totali.imponibileFiscale,
    etichettaBase: "Imponibile fiscale",
    subtotale: (r) => ({ label: "IRPEF netta dovuta", valore: r.totali.irpefNetta, segno: "−" }),
  },
  {
    chiave: "addizionali",
    numero: "3",
    titolo: "Addizionali locali",
    base: (r) => r.totali.imponibileFiscale,
    etichettaBase: "Imponibile fiscale (senza detrazioni)",
    subtotale: (r) => ({ label: "Totale addizionali", valore: r.totali.addizionali, segno: "−" }),
  },
  {
    chiave: "erogazioni",
    numero: "4",
    titolo: "Integrazioni esenti",
    base: (r) => r.totali.imponibileFiscale,
    etichettaBase: "Reddito di lavoro dipendente",
    subtotale: (r) => ({ label: "Totale integrazioni", valore: r.totali.erogazioni, segno: "+" }),
  },
];

/** "INPS circ. 11/2024 §3; circ. 6/2026 §6" → "INPS circ. 11/2024 §3" */
function riferimentoBreve(fonte: string): string {
  return fonte.split("https://")[0].split(";")[0].trim();
}

function segnoDi(v: LineItem): string {
  if (v.tipo === "erogazione") return "+";
  if (v.tipo === "info") return "";
  return "−";
}

/**
 * Prospetto del calcolo, letto come lo leggerebbe un consulente del lavoro:
 * blocchi numerati, base imponibile dichiarata una volta in testa al blocco,
 * subtotale in coda, raccordo esplicito verso il blocco successivo.
 *
 * Sostituisce l'elenco piatto: righe che mescolavano trattenute, imposta lorda
 * e detrazioni senza mostrare la catena che le lega.
 */
export function ProspettoVoci({ risultato }: { risultato: RisultatoCalcolo }) {
  // `irpef-netta` è già il subtotale del blocco IRPEF: mostrarla anche come riga
  // la stamperebbe due volte di fila con lo stesso importo.
  const gruppiAttivi = GRUPPI.map((g) => ({
    def: g,
    voci: risultato.voci.filter((v) => v.gruppo === g.chiave && v.codice !== "irpef-netta"),
  })).filter((g) => g.voci.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      {/* Punto di partenza */}
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
        <span className="text-[15px] font-semibold">Retribuzione Annua Lorda</span>
        <span className="text-xl font-bold tabular-nums">{euro(risultato.input.ral)}</span>
      </div>

      {gruppiAttivi.map(({ def, voci }) => {
        const base = def.base(risultato);
        const sub = def.subtotale(risultato);
        const raccordo = def.raccordo?.(risultato);
        return (
          <section key={def.chiave}>
            {/* Intestazione del blocco: la base si dichiara qui, non su ogni riga */}
            <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-[var(--fill)] px-6 py-3">
              <h3 className="flex items-baseline gap-2.5 text-[15px] font-bold">
                <span className="text-[var(--ink-muted)]">{def.numero}</span>
                {def.titolo}
              </h3>
              <p className="text-[13px] text-[var(--ink-secondary)]">
                {def.etichettaBase}:{" "}
                <span className="font-semibold tabular-nums text-[var(--ink-primary)]">
                  {euro(base)}
                </span>
              </p>
            </header>

            <table className="w-full">
              <caption className="sr-only">{def.titolo}</caption>
              <tbody>
                {voci.map((v) => {
                  const baseDiversa =
                    v.baseImponibile !== undefined && Math.abs(v.baseImponibile - base) > 1;
                  const smorzata = v.tipo === "info" || v.tipo === "riduzione-imposta";
                  return (
                    <tr key={v.codice} className="border-b border-[var(--border)] align-baseline">
                      <th
                        scope="row"
                        className="w-full px-6 py-3.5 text-left font-normal"
                      >
                        <span
                          className={`text-[15px] ${
                            smorzata
                              ? "font-medium text-[var(--ink-secondary)]"
                              : "font-semibold text-[var(--ink-primary)]"
                          }`}
                        >
                          {v.label}
                        </span>
                        {v.dettaglio && (
                          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--ink-secondary)]">
                            {v.dettaglio}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          {riferimentoBreve(v.fonte)}
                          {baseDiversa && (
                            <> · calcolata su {euro(v.baseImponibile as number, 0)}</>
                          )}
                        </p>
                      </th>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-[15px] tabular-nums text-[var(--ink-secondary)]">
                        {v.aliquota !== undefined ? percento(v.aliquota) : ""}
                      </td>
                      <td
                        className={`w-40 whitespace-nowrap px-6 py-3.5 text-right text-[15px] tabular-nums ${
                          smorzata
                            ? "text-[var(--ink-secondary)]"
                            : "font-semibold text-[var(--ink-primary)]"
                        }`}
                      >
                        {v.tipo === "info" && v.importo === 0
                          ? "—"
                          : `${segnoDi(v)} ${euro(v.importo)}`}
                      </td>
                    </tr>
                  );
                })}

                {/* Subtotale del blocco */}
                <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                  <th scope="row" className="px-6 py-3 text-left text-[15px] font-semibold">
                    {sub.label}
                  </th>
                  <td />
                  <td className="whitespace-nowrap px-6 py-3 text-right text-[15px] font-bold tabular-nums">
                    {sub.segno} {euro(sub.valore)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Raccordo verso il blocco successivo */}
            {raccordo && (
              <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-6 py-3.5">
                <span className="flex items-baseline gap-2 text-[15px] font-semibold">
                  <span aria-hidden className="text-[var(--ink-muted)]">
                    =
                  </span>
                  {raccordo.label}
                </span>
                <span className="text-[15px] font-bold tabular-nums">
                  {euro(raccordo.valore)}
                </span>
              </div>
            )}
          </section>
        );
      })}

      {/* Risultato */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 bg-[var(--ink-primary)] px-6 py-5 text-white">
        <span className="text-[15px] font-semibold">Netto annuo</span>
        <span className="text-2xl font-bold tabular-nums text-[var(--accent)]">
          {euro(risultato.totali.nettoAnnuo)}
        </span>
      </div>
    </div>
  );
}
