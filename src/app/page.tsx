"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calcolaNetto } from "@/domain/calcolaNetto";
import type { RisultatoCalcolo } from "@/domain/types";
import { dataEstesa, euro, percento } from "@/lib/formato";
import { BarraComposizione, type SegmentoComposizione } from "@/components/BarraComposizione";
import { ProspettoVoci } from "@/components/ProspettoVoci";

const ANNO = 2026;

function costruisciSegmenti(r: RisultatoCalcolo): SegmentoComposizione[] {
  const segmenti: SegmentoComposizione[] = [
    {
      label: "Netto dalla RAL",
      valore: r.totali.nettoAnnuo - r.totali.erogazioni,
      colore: "var(--viz-netto)",
      inchiostro: "#ffffff",
    },
    {
      label: "IRPEF netta",
      valore: r.totali.irpefNetta,
      colore: "var(--viz-tratt-1)",
      inchiostro: "#ffffff",
    },
    {
      label: "Contributi INPS",
      valore: r.totali.contributiDipendente,
      colore: "var(--viz-tratt-2)",
      inchiostro: "#ffffff",
    },
  ];
  if (r.totali.addizionali > 0) {
    segmenti.push({
      label: "Addizionali",
      valore: r.totali.addizionali,
      colore: "var(--viz-tratt-3)",
      inchiostro: "#11150a",
    });
  }
  return segmenti;
}

export default function PaginaCalcolatore() {
  const [ralInput, setRalInput] = useState("35000");
  const [mensilita, setMensilita] = useState<12 | 13 | 14>(13);
  /**
   * Input confermati con "Calcola". Separati da quelli in digitazione: il
   * risultato non insegue i tasti, cambia solo quando l'utente lo chiede.
   */
  const [confermato, setConfermato] = useState<{
    ral: number;
    mensilita: 12 | 13 | 14;
  } | null>(null);

  const ral = Number(ralInput.replace(/[^\d]/g, ""));
  const ralValida = Number.isFinite(ral) && ral > 0 && ral <= 10_000_000;

  const risultato = useMemo(() => {
    if (!confermato) return null;
    return calcolaNetto({ ral: confermato.ral, anno: ANNO, mensilita: confermato.mensilita });
  }, [confermato]);

  // Gli input sono cambiati dopo l'ultimo calcolo: il risultato a schermo è vecchio.
  const daRicalcolare =
    confermato !== null && (confermato.ral !== ral || confermato.mensilita !== mensilita);

  function calcola(e: React.FormEvent) {
    e.preventDefault();
    if (ralValida) setConfermato({ ral, mensilita });
  }

  const pressione = risultato
    ? ((risultato.totali.totaleTrattenute - risultato.totali.erogazioni) / risultato.input.ral) * 100
    : 0;

  return (
    <div className="space-y-12">
      <section>
        <p className="text-sm font-medium text-[var(--ink-secondary)]">
          Anno d&apos;imposta {ANNO} · Milano
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Dalla RAL al netto</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--ink-secondary)]">
          Impiegato a tempo indeterminato, nessuna agevolazione particolare.{" "}
          <Link
            href="/stato"
            className="underline decoration-[var(--border-dark)] underline-offset-4 hover:decoration-[var(--ink-primary)]"
          >
            Regole verificate al {dataEstesa(risultato?.regole.verifiedOn ?? "2026-08-07")}
          </Link>
        </p>
      </section>

      {/* Input: è il controllo principale dell'app, non un campo di contorno */}
      <form onSubmit={calcola} className="flex flex-wrap items-end gap-x-10 gap-y-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Retribuzione Annua Lorda</span>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={ralInput}
              onChange={(e) => setRalInput(e.target.value)}
              className="w-56 rounded-xl border-2 border-[var(--border-dark)] bg-white py-3.5 pl-4 pr-10 text-2xl font-bold tabular-nums outline-none transition-colors focus:border-[var(--ink-primary)]"
              aria-label="RAL in euro"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-medium text-[var(--ink-muted)]">
              €
            </span>
          </div>
        </label>

        <fieldset>
          <legend className="mb-2 block text-sm font-semibold">Mensilità</legend>
          <div className="flex overflow-hidden rounded-xl border-2 border-[var(--border-dark)] bg-white">
            {([12, 13, 14] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMensilita(m)}
                aria-pressed={mensilita === m}
                className={`px-5 py-3.5 text-lg font-bold tabular-nums transition-colors ${
                  mensilita === m
                    ? "bg-[var(--ink-primary)] text-white"
                    : "text-[var(--ink-muted)] hover:bg-[var(--fill)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={!ralValida}
          className="rounded-xl bg-[var(--ink-primary)] px-8 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Calcola
        </button>

        {daRicalcolare && (
          <p
            role="status"
            className="w-full text-sm font-medium text-[var(--viz-down)]"
          >
            Gli input sono cambiati: premi <strong>Calcola</strong> per aggiornare il risultato.
          </p>
        )}
      </form>

      {!risultato ? (
        <section className="rounded-2xl border-2 border-dashed border-[var(--border-dark)] px-6 py-16 text-center">
          <p className="text-lg font-semibold">
            {ralValida
              ? "Premi Calcola per vedere la proiezione"
              : "Inserisci una RAL valida per procedere"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[var(--ink-secondary)]">
            Otterrai il netto annuale e mensile, la composizione della RAL e il prospetto completo
            delle voci trattenute, ognuna con la sua base imponibile e il riferimento normativo.
          </p>
        </section>
      ) : (
        <>
          {/* La risposta: è il prodotto, quindi è la cosa più grande della pagina */}
          <section className="rounded-2xl bg-[var(--ink-primary)] p-8 text-white sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
              <div>
                <p className="text-sm font-medium text-white/60">
                  {/* dallo stato confermato, non da quello in digitazione:
                      altrimenti l'etichetta descrive input diversi dal risultato */}
                  Netto mensile · {risultato.input.mensilita} mensilità
                </p>
                <p className="mt-1.5 text-6xl font-bold leading-none tracking-tight text-[var(--accent)]">
                  {euro(risultato.totali.nettoMensile, 0)}
                </p>
              </div>
              <dl className="flex gap-10">
                <div>
                  <dt className="text-sm font-medium text-white/60">Netto annuo</dt>
                  <dd className="mt-1.5 text-3xl font-bold leading-none tabular-nums">
                    {euro(risultato.totali.nettoAnnuo, 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-white/60">Trattenute</dt>
                  <dd className="mt-1.5 text-3xl font-bold leading-none tabular-nums">
                    − {euro(risultato.totali.totaleTrattenute, 0)}
                  </dd>
                </div>
                {risultato.totali.erogazioni > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-white/60">Integrazioni</dt>
                    <dd className="mt-1.5 text-3xl font-bold leading-none tabular-nums">
                      + {euro(risultato.totali.erogazioni, 0)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-white/60">Prelievo effettivo</dt>
                  <dd className="mt-1.5 text-3xl font-bold leading-none tabular-nums">
                    {percento(pressione, 1)}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="mt-8 border-t border-white/15 pt-4 text-sm text-white/60">
              Media annua: la busta reale varia per le rate delle addizionali e il conguaglio di
              dicembre.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold">Dove finisce la RAL</h2>
            <p className="mb-5 mt-1 text-sm text-[var(--ink-secondary)]">
              {euro(risultato.input.ral, 0)} lordi, divisi fra quanto arriva in busta e quanto
              viene trattenuto.
            </p>
            <BarraComposizione
              segmenti={costruisciSegmenti(risultato)}
              totale={risultato.input.ral}
            />
            {risultato.totali.erogazioni > 0 && (
              <p className="mt-4 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink-secondary)]">
                A questi si aggiungono{" "}
                <strong className="font-semibold text-[var(--ink-primary)]">
                  {euro(risultato.totali.erogazioni, 0)}
                </strong>{" "}
                di integrazioni esenti (riforma del cuneo): non sono parte della RAL, si sommano al
                netto.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-bold">Il calcolo, passo per passo</h2>
            <p className="mb-5 mt-1 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-secondary)]">
              Ogni blocco dichiara in testa la propria base imponibile: i contributi si calcolano
              sulla RAL, IRPEF e addizionali sull&apos;imponibile fiscale. Le detrazioni riducono
              l&apos;imposta, non la base.
            </p>
            <ProspettoVoci risultato={risultato} />
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-secondary)]">
              Il TFR (~6,91% della RAL) è accantonato dal datore di lavoro: non è una trattenuta e
              non transita dal netto in busta.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
