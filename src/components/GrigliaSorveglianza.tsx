"use client";

import { useMemo, useState } from "react";
import type { StatoClaim } from "@/domain/reportVerifica";

/** Riga serializzabile: la pagina server appiattisce il catalogo prima di passarlo. */
export interface RigaVista {
  id: string;
  label: string;
  gruppo: string;
  percorso: string;
  stato: StatoClaim;
  valoreVivo: string;
  valoreTrovato?: string;
  riferimento?: string;
  url?: string;
  citazione?: string;
  note?: string;
  origine?: string;
  dataRiscontro?: string;
}

const STILE: Record<
  StatoClaim,
  { pallino: string; chip: string; etichetta: string; descrizione: string }
> = {
  cambiato: {
    pallino: "bg-[var(--viz-down)]",
    chip: "bg-[color-mix(in_srgb,var(--viz-down)_12%,transparent)] text-[var(--viz-down)]",
    etichetta: "Cambiato",
    descrizione: "La fonte riporta un valore diverso da quello in vigore nel tool",
  },
  incoerente: {
    pallino: "bg-[var(--viz-down)]",
    chip: "bg-[color-mix(in_srgb,var(--viz-down)_12%,transparent)] text-[var(--viz-down)]",
    etichetta: "Incoerente",
    descrizione: "Il report dichiara «confermato» ma riporta un valore diverso: da rileggere",
  },
  incerto: {
    pallino: "bg-[#b06a00]",
    chip: "bg-[color-mix(in_srgb,#b06a00_12%,transparent)] text-[#8a5200]",
    etichetta: "Incerto",
    descrizione: "La ricerca non è arrivata a una conclusione",
  },
  "non-verificato": {
    pallino: "bg-[var(--border-dark)]",
    chip: "bg-[var(--fill)] text-[var(--ink-secondary)]",
    etichetta: "Mai verificato",
    descrizione: "Nessun riscontro dopo la fotografia iniziale",
  },
  confermato: {
    pallino: "bg-[#1f7a3d]",
    chip: "bg-[color-mix(in_srgb,#1f7a3d_12%,transparent)] text-[#186331]",
    etichetta: "Confermato",
    descrizione: "La fonte conferma il valore in vigore",
  },
};

function dataBreve(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export function GrigliaSorveglianza({
  righe,
  dataUltimoReport,
}: {
  righe: RigaVista[];
  dataUltimoReport?: string;
}) {
  const [accettati, setAccettati] = useState<Set<string>>(new Set());
  const [copiato, setCopiato] = useState(false);

  const daDecidere = righe.filter((r) => r.stato === "cambiato" || r.stato === "incoerente");

  const conteggi = useMemo(() => {
    const c: Record<StatoClaim, number> = {
      cambiato: 0,
      incoerente: 0,
      incerto: 0,
      "non-verificato": 0,
      confermato: 0,
    };
    for (const r of righe) c[r.stato]++;
    return c;
  }, [righe]);

  function alterna(id: string) {
    setAccettati((prec) => {
      const nuovo = new Set(prec);
      if (nuovo.has(id)) nuovo.delete(id);
      else nuovo.add(id);
      return nuovo;
    });
    setCopiato(false);
  }

  const modifica = useMemo(() => {
    const scelti = daDecidere.filter((r) => accettati.has(r.id));
    if (scelti.length === 0) return "";
    const righeTesto = scelti.map((r) =>
      [
        `### ${r.label}`,
        `percorso:  ${r.percorso}`,
        `attuale:   ${r.valoreVivo}`,
        `nuovo:     ${r.valoreTrovato ?? "(da leggere nella fonte)"}`,
        `fonte:     ${r.riferimento ?? "—"}`,
        `link:      ${r.url ?? "—"}`,
        r.citazione ? `prova:     «${r.citazione}»` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return [
      `# Aggiornamento regole — ${scelti.length} parametro/i`,
      "",
      "File: `src/domain/rules/2026.ts`",
      "",
      ...righeTesto,
      "",
      `Dopo la modifica aggiornare \`verifiedOn\` a ${dataUltimoReport?.slice(0, 10) ?? "AAAA-MM-GG"}.`,
      "La CI deve restare verde: typecheck + 17 test (golden, proprietà, guardrail).",
    ].join("\n");
  }, [accettati, daDecidere, dataUltimoReport]);

  async function copia() {
    await navigator.clipboard.writeText(modifica);
    setCopiato(true);
  }

  return (
    <div className="space-y-5">
      {/* Riepilogo: prima ciò che richiede una decisione */}
      <div className="flex flex-wrap gap-2">
        {(
          ["cambiato", "incoerente", "incerto", "non-verificato", "confermato"] as StatoClaim[]
        ).map((s) =>
          conteggi[s] > 0 ? (
            <span
              key={s}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${STILE[s].chip}`}
            >
              <span className={`h-2 w-2 rounded-full ${STILE[s].pallino}`} aria-hidden />
              {conteggi[s]} {STILE[s].etichetta.toLowerCase()}
            </span>
          ) : null,
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        {righe.map((r) => {
          const stile = STILE[r.stato];
          const evidenzia = r.stato === "cambiato" || r.stato === "incoerente";
          return (
            <div
              key={r.id}
              className={`border-b border-[var(--border)] px-5 py-4 last:border-b-0 ${
                evidenzia ? "bg-[color-mix(in_srgb,var(--viz-down)_4%,transparent)]" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-full ${stile.pallino}`}
                    aria-hidden
                  />
                  <span className="text-[15px] font-semibold">{r.label}</span>
                  <span className="text-xs text-[var(--ink-muted)]">{r.gruppo}</span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stile.chip}`}>
                  {stile.etichetta}
                </span>
              </div>

              {evidenzia ? (
                <div className="mt-3 space-y-2 text-[15px]">
                  <div className="flex flex-wrap gap-x-3">
                    <span className="w-40 shrink-0 text-[13px] text-[var(--ink-secondary)]">
                      In vigore nel tool
                    </span>
                    <span className="tabular-nums line-through decoration-[var(--border-dark)]">
                      {r.valoreVivo}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3">
                    <span className="w-40 shrink-0 text-[13px] text-[var(--ink-secondary)]">
                      Secondo la fonte
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--viz-down)]">
                      {r.valoreTrovato || "differenza rilevata — leggere la fonte"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[15px] tabular-nums text-[var(--ink-secondary)]">
                  {r.valoreVivo}
                </p>
              )}

              {r.citazione && (
                <blockquote className="mt-3 border-l-2 border-[var(--border-dark)] pl-3 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
                  «{r.citazione}»
                </blockquote>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
                {r.riferimento && <span>{r.riferimento}</span>}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-dotted underline-offset-2 hover:text-[var(--ink-primary)]"
                  >
                    apri fonte
                  </a>
                )}
                {r.origine && (
                  <span>
                    {r.origine}
                    {r.dataRiscontro ? ` · ${dataBreve(r.dataRiscontro)}` : ""}
                  </span>
                )}
                {!r.origine && <span>{stile.descrizione}</span>}
              </div>

              {evidenzia && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={accettati.has(r.id)}
                    onChange={() => alterna(r.id)}
                    className="h-4 w-4 accent-[var(--ink-primary)]"
                  />
                  Includi nella modifica da applicare
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Generatore della modifica: la pagina prepara, il commit approva */}
      {daDecidere.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-5">
          <h3 className="text-[15px] font-bold">Modifica da applicare</h3>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-secondary)]">
            Seleziona i cambiamenti che hai verificato aprendo le fonti. La pagina prepara il
            testo; l&apos;approvazione è il commit su <code>src/domain/rules/2026.ts</code>, che
            passa dalla CI e resta nella storia del repository.
          </p>
          {modifica ? (
            <>
              <pre className="mt-4 max-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-white p-4 text-xs leading-relaxed">
                {modifica}
              </pre>
              <button
                type="button"
                onClick={copia}
                className="mt-3 rounded-lg bg-[var(--ink-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {copiato ? "Copiato" : "Copia"}
              </button>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-[var(--ink-muted)]">
              Nessun cambiamento selezionato.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
