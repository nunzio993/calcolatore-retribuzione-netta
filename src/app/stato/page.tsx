import fs from "node:fs";
import path from "node:path";
import { regole2026 } from "@/domain/rules/2026";
import { anniDisponibili } from "@/domain/rules";
import { ETICHETTA_GRUPPO } from "@/domain/claims";
import { costruisciSorveglianza, ordinaPerUrgenza } from "@/domain/reportVerifica";
import { caricaSorveglianza } from "@/lib/caricaSorveglianza";
import { dataEstesa } from "@/lib/formato";
import { GrigliaSorveglianza, type RigaVista } from "@/components/GrigliaSorveglianza";

// status.json è scritto dal job di monitoraggio a runtime: niente prerender.
export const dynamic = "force-dynamic";

interface StatusMonitor {
  ultimoCheck: string;
  esito: "ok" | "cambiamento-rilevato" | "errore";
  fonti: { nome: string; stato: string; ultimoCambio?: string; dettaglio?: string }[];
  scadenze: { nome: string; attesaEntro: string; stato: "ricevuta" | "in-attesa" | "mancata" }[];
}

/** Legge lo status scritto dal job di monitoraggio (fase 6). Assente = degrado dichiarato. */
function leggiStatus(): StatusMonitor | null {
  try {
    const p = path.join(process.cwd(), "monitoraggio", "status.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")) as StatusMonitor;
  } catch {
    return null;
  }
}

function estraiUrl(fonte: string): string | null {
  const m = fonte.match(/https:\/\/\S+/);
  return m ? m[0] : null;
}

/** ISO → "7 agosto 2026, 11:05" (l'ISO grezzo non è leggibile in pagina). */
function dataLeggibile(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PARAMETRI: { nome: string; valore: string; fonte: string }[] = [
  {
    nome: "Scaglioni IRPEF",
    valore: "23% ≤28.000 · 33% 28–50.000 · 43% oltre",
    fonte: regole2026.irpef.fonte,
  },
  {
    nome: "Contributi dipendente",
    valore: "IVS 9,19% + CIGS 0,30% · 1% oltre 56.224 € · massimale 122.295 €",
    fonte: regole2026.contributi.fonte,
  },
  {
    nome: "Detrazione lavoro dipendente",
    valore: "art. 13 TUIR, con correttivo +65 € (25–35k)",
    fonte: regole2026.detrazioneLavoroDipendente.fonte,
  },
  {
    nome: "Somma integrativa (cuneo)",
    valore: "7,1% / 5,3% / 4,8% per RC ≤ 20.000 €",
    fonte: regole2026.sommaIntegrativa.fonte,
  },
  {
    nome: "Ulteriore detrazione (cuneo)",
    valore: "1.000 € (20–32k), décalage fino a 40k",
    fonte: regole2026.ulterioreDetrazione.fonte,
  },
  {
    nome: "Trattamento integrativo",
    valore: "1.200 € per RC ≤ 15.000 € (con capienza)",
    fonte: regole2026.trattamentoIntegrativo.fonte,
  },
  {
    nome: "Addizionale regionale Lombardia",
    valore: "1,23% / 1,58% / 1,72% / 1,73% per scaglioni",
    fonte: regole2026.addizionaleRegionale.fonte,
  },
  {
    nome: "Addizionale comunale Milano",
    valore: "0,80% unica · esenzione ≤ 23.000 € (cliff)",
    fonte: regole2026.addizionaleComunale.fonte,
  },
];

const CALENDARIO = [
  {
    quando: "~30 dicembre",
    cosa: "Legge di Bilancio in Gazzetta Ufficiale",
    tocca: "scaglioni IRPEF, detrazioni, misure cuneo",
  },
  {
    quando: "fine gennaio",
    cosa: "Circolare INPS minimali/massimali",
    tocca: "prima fascia pensionabile, massimale contributivo",
  },
  {
    quando: "in corso d'anno",
    cosa: "Delibere addizionali su database MEF",
    tocca: "aliquote Lombardia e Milano (dato consolidato solo dopo il 20/12)",
  },
  {
    quando: "imprevedibile",
    cosa: "Decreti legge fiscali/lavoro",
    tocca: "potenzialmente tutto — richiede rassegna GU",
  },
];

export default function PaginaStato() {
  const status = leggiStatus();
  const { riscontri, reportMalformati, reportValidi } = caricaSorveglianza();

  // Il catalogo contiene funzioni: appiattito qui prima di passarlo al client.
  const righe: RigaVista[] = ordinaPerUrgenza(
    costruisciSorveglianza(regole2026, riscontri),
  ).map((r) => ({
    id: r.claim.id,
    label: r.claim.label,
    gruppo: ETICHETTA_GRUPPO[r.claim.gruppo],
    percorso: r.claim.percorso,
    stato: r.stato,
    valoreVivo: r.valoreVivo,
    valoreTrovato: r.valoreTrovato,
    riferimento: r.riferimento,
    url: r.url,
    citazione: r.citazione,
    note: r.note,
    origine: r.origine,
    dataRiscontro: r.dataRiscontro,
  }));

  const dataUltimoReport = reportValidi
    .map((r) => r.dataRicerca)
    .sort()
    .at(-1);

  return (
    <div className="space-y-12">
      <section>
        <p className="text-sm font-medium text-[var(--ink-secondary)]">Manutenzione</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Stato delle regole</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-secondary)]">
          Un calcolatore fiscale non &quot;funziona&quot;: funziona <em>a una certa data</em>. Ogni
          parametro qui sotto è tracciato alla fonte primaria; fuori dagli anni censiti il motore
          restituisce errore, mai un&apos;estrapolazione.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
          <div>
            <dt className="text-sm font-medium text-[var(--ink-secondary)]">Anni disponibili</dt>
            <dd className="mt-1 text-2xl font-bold leading-none tabular-nums">
              {anniDisponibili().join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[var(--ink-secondary)]">
              Ultima verifica fonti
            </dt>
            <dd className="mt-1 text-2xl font-bold leading-none">
              {dataEstesa(regole2026.verifiedOn)}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Parametri e fonti — anno {regole2026.anno}</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b border-[var(--border)] bg-[var(--surface-alt)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
              >
                <th className="px-4 py-2.5 font-semibold">Parametro</th>
                <th className="py-2.5 pr-3 font-semibold">Valore 2026</th>
                <th className="py-2.5 pr-4 font-semibold">Fonte primaria</th>
              </tr>
            </thead>
            <tbody>
              {PARAMETRI.map((p) => {
                const url = estraiUrl(p.fonte);
                const riferimento = p.fonte.split("https://")[0].replace(/;\s*$/, "");
                return (
                  <tr
                    key={p.nome}
                    className="border-b border-[var(--border)] align-top last:border-b-0"
                  >
                    <td className="px-4 py-3 font-semibold">{p.nome}</td>
                    <td className="py-3 pr-3 tabular-nums">{p.valore}</td>
                    <td className="py-3 pr-4 text-xs text-[var(--ink-secondary)]">
                      {riferimento}
                      {url && (
                        <>
                          {" "}
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted underline-offset-2"
                          >
                            apri fonte
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">Sorveglianza dei parametri</h2>
        <p className="mb-5 mt-1 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-secondary)]">
          Un indicatore per parametro. I riscontri arrivano nella stessa griglia da tre origini,
          tutte deterministiche: il diff notturno sui dataset MEF, l&apos;hash settimanale dei
          testi vigenti su Normattiva (10 parametri su 14 coperti in automatico, senza alcun
          modello AI), e i report di ricerca lanciati a mano con i{" "}
          <a
            href="https://github.com"
            className="underline decoration-[var(--border-dark)] underline-offset-4"
          >
            prompt versionati
          </a>{" "}
          in <code className="text-[13px]">research/prompts/</code>. Questa pagina{" "}
          <strong>legge soltanto</strong>: non riceve input e non modifica nulla.
        </p>

        <GrigliaSorveglianza righe={righe} dataUltimoReport={dataUltimoReport} />

        {reportMalformati.length > 0 && (
          <div className="mt-5 rounded-xl border border-[var(--viz-down)] bg-[color-mix(in_srgb,var(--viz-down)_6%,transparent)] p-4">
            <h3 className="text-[15px] font-bold text-[var(--viz-down)]">
              Report scartati: formato non conforme
            </h3>
            <p className="mt-1 text-[13px] text-[var(--ink-secondary)]">
              Un report che non rispetta il contratto viene rifiutato invece di essere
              interpretato: un confronto su dati malformati è peggio di nessun confronto.
            </p>
            <ul className="mt-2 space-y-1 text-[13px] text-[var(--ink-secondary)]">
              {reportMalformati.flatMap((r) =>
                r.errori.map((e) => (
                  <li key={`${r.file}-${e}`}>
                    <code className="text-xs">{e}</code>
                  </li>
                )),
              )}
            </ul>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-[15px] font-bold">Origini dei riscontri</h3>
            <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--ink-secondary)]">
              <li>
                <strong className="text-[var(--ink-primary)]">Watchdog MEF</strong> —{" "}
                {status
                  ? `ultimo controllo ${dataLeggibile(status.ultimoCheck)}, esito ${status.esito}`
                  : "non ancora eseguito"}
              </li>
              {reportValidi.length === 0 ? (
                <li>
                  <strong className="text-[var(--ink-primary)]">Report di ricerca</strong> — nessuno
                  depositato in <code className="text-xs">monitoraggio/reports/</code>
                </li>
              ) : (
                reportValidi.map((r) => (
                  <li key={r.file}>
                    <strong className="text-[var(--ink-primary)]">{r.file}</strong> —{" "}
                    {r.claims} parametri, {dataEstesa(r.dataRicerca)}
                    {r.strumento ? ` · ${r.strumento}` : ""}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-[15px] font-bold">Scadenze attese (dead-man switch)</h3>
            {status ? (
              <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--ink-secondary)]">
                {status.scadenze.map((s) => (
                  <li key={s.nome}>
                    <span aria-hidden>
                      {s.stato === "ricevuta" ? "✓" : s.stato === "mancata" ? "✗" : "…"}
                    </span>{" "}
                    {s.nome} — entro {s.attesaEntro} ({s.stato})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--ink-secondary)]">
                Il job non ha ancora scritto <code className="text-xs">status.json</code>.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
              L&apos;allarme scatta anche sull&apos;<em>assenza</em> di un aggiornamento atteso, non
              solo sui cambiamenti: un watchdog che tace non è per forza un watchdog sano.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Calendario di manutenzione</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b border-[var(--border)] bg-[var(--surface-alt)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
              >
                <th className="px-4 py-2.5 font-semibold">Quando</th>
                <th className="py-2.5 pr-3 font-semibold">Cosa esce</th>
                <th className="py-2.5 pr-4 font-semibold">Cosa tocca nel calcolatore</th>
              </tr>
            </thead>
            <tbody>
              {CALENDARIO.map((c) => (
                <tr
                  key={c.cosa}
                  className="border-b border-[var(--border)] align-top last:border-b-0"
                >
                  <td className="whitespace-nowrap px-4 py-3">{c.quando}</td>
                  <td className="py-3 pr-3">{c.cosa}</td>
                  <td className="py-3 pr-4 text-xs text-[var(--ink-secondary)]">{c.tocca}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-2xl text-xs text-[var(--ink-muted)]">
          Le regole hanno un ritmo annuale ma non una garanzia annuale: decreti infra-annuali
          esistono (contributi 2023) e alcune fonti ufficiali arrivano settimane dopo il 1°
          gennaio. Il modello assume regole uniformi sull&apos;anno; un cambio infra-annuale
          richiederebbe regole per periodo — il registry è pronto a passare da chiave-anno a
          chiave-periodo senza toccare il motore.
        </p>
      </section>
    </div>
  );
}
