import { euro } from "@/lib/formato";

export interface StepWaterfall {
  label: string;
  valore: number;
  tipo: "totale" | "giu" | "su";
}

const COLORE: Record<StepWaterfall["tipo"], string> = {
  totale: "var(--viz-neutral)",
  giu: "var(--viz-down)",
  su: "var(--viz-up)",
};

const H = 240; // altezza area di plot
const PAD_TOP = 50; // spazio per l'etichetta sopra la barra più alta (misurato: serve >40)
const GAP = 8; // gap-2 fra le colonne: il connettore lo attraversa

/**
 * Waterfall RAL → netto in puro CSS (niente librerie grafiche).
 *
 * Barre flottanti: ogni passo parte dal livello cumulato del precedente,
 * collegate da connettori orizzontali che rendono leggibile la cascata.
 * Etichette dirette su ogni barra (identità mai affidata al solo colore).
 */
export function Waterfall({ steps }: { steps: StepWaterfall[] }) {
  const scala = Math.max(...steps.map((s) => s.valore), 1);

  // livelli cumulati: i totali si ancorano a zero, gli altri fluttuano
  let livello = 0;
  const barre = steps.map((s) => {
    let da: number;
    let a: number;
    if (s.tipo === "totale") {
      da = 0;
      a = s.valore;
    } else if (s.tipo === "giu") {
      a = livello;
      da = livello - s.valore;
    } else {
      da = livello;
      a = livello + s.valore;
    }
    livello = s.tipo === "giu" ? da : a;
    return { ...s, da, a, uscita: livello };
  });

  return (
    <figure aria-label="Grafico a cascata dalla RAL al netto">
      <div
        className="relative flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--viz-surface)] p-3"
        style={{ height: H + PAD_TOP + 36, paddingTop: PAD_TOP }}
      >
        {/* griglia orizzontale recessiva */}
        {[0.25, 0.5, 0.75].map((f) => (
          <div
            key={f}
            aria-hidden
            className="absolute inset-x-3"
            style={{ bottom: 36 + H * f, borderTop: `1px solid var(--viz-grid)` }}
          />
        ))}
        {barre.map((b, i) => {
          const altezza = Math.max(((b.a - b.da) / scala) * H, 2);
          const dalBasso = (b.da / scala) * H;
          const ultima = i === barre.length - 1;
          return (
            <div key={b.label} className="flex h-full flex-1 flex-col justify-end">
              <div
                className="relative"
                style={{ height: H }}
                title={`${b.label}: ${euro(b.valore)}`}
              >
                <div
                  className="absolute inset-x-0 rounded-t-[4px]"
                  style={{
                    bottom: dalBasso,
                    height: altezza,
                    background: COLORE[b.tipo],
                  }}
                />
                {/* connettore verso il passo successivo, al livello cumulato */}
                {!ultima && (
                  <div
                    aria-hidden
                    className="absolute"
                    style={{
                      bottom: (b.uscita / scala) * H,
                      right: -GAP,
                      width: GAP,
                      borderTop: "1px solid var(--viz-baseline)",
                    }}
                  />
                )}
                <span
                  className="absolute inset-x-0 -translate-y-full pb-1 text-center text-[11px] font-semibold tabular-nums text-[var(--ink-secondary)]"
                  style={{ bottom: dalBasso + altezza }}
                >
                  {b.tipo === "giu" ? "−" : b.tipo === "su" ? "+" : ""}
                  {euro(b.valore, 0)}
                </span>
              </div>
              <div
                className="mt-2 border-t pt-1.5 text-center text-[11px] leading-tight text-[var(--ink-muted)]"
                style={{ borderColor: "var(--viz-baseline)" }}
              >
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2.5 flex flex-wrap gap-4 text-xs text-[var(--ink-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORE.giu }} />
          trattenute
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORE.su }} />
          erogazioni a favore
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: COLORE.totale }}
          />
          totali
        </span>
      </figcaption>
    </figure>
  );
}
