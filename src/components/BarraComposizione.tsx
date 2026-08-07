import { euro } from "@/lib/formato";

export interface SegmentoComposizione {
  label: string;
  valore: number;
  colore: string;
  /** Colore del testo leggibile sopra il segmento. */
  inchiostro: string;
}

/**
 * Barra di composizione orizzontale: la RAL divisa nelle sue parti.
 *
 * Forma scelta per il lavoro dei dati (part-to-whole → stacked bar orizzontale,
 * cfr. metodo dataviz): un waterfall verticale della stessa serie produce metà
 * area vuota, perché la domanda vera non è "come scende" ma "dove finisce".
 *
 * Il netto è l'ancora in dark brand; le trattenute sono una rampa ordinale a
 * una tinta — sono la stessa categoria, ordinate per peso.
 */
export function BarraComposizione({
  segmenti,
  totale,
}: {
  segmenti: SegmentoComposizione[];
  totale: number;
}) {
  const quota = (v: number) => (v / totale) * 100;

  return (
    <figure aria-label="Composizione della RAL fra netto e trattenute">
      <div className="flex h-14 w-full gap-[2px] overflow-hidden rounded-lg">
        {segmenti.map((s) => {
          const pct = quota(s.valore);
          return (
            <div
              key={s.label}
              className="flex items-center justify-center overflow-hidden"
              style={{ width: `${pct}%`, background: s.colore }}
              title={`${s.label}: ${euro(s.valore)} (${pct.toFixed(1)}%)`}
            >
              {/* etichetta diretta dentro il segmento solo se c'è spazio reale */}
              {pct >= 12 && (
                <span
                  className="px-2 text-[13px] font-semibold tabular-nums"
                  style={{ color: s.inchiostro }}
                >
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {segmenti.map((s) => (
          <span key={s.label} className="flex items-baseline gap-2 text-sm">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-sm"
              style={{ background: s.colore }}
            />
            <span className="text-[var(--ink-secondary)]">{s.label}</span>
            <span className="font-semibold tabular-nums">{euro(s.valore, 0)}</span>
            <span className="text-xs tabular-nums text-[var(--ink-muted)]">
              {quota(s.valore).toFixed(1)}%
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
