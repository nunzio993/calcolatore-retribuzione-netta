import type { Metadata } from "next";
import { Wix_Madefor_Display } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const wixMadefor = Wix_Madefor_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Calcolatore retribuzione netta",
  description:
    "Dalla RAL al netto annuale e mensile: contributi, IRPEF, addizionali, con fonti normative per ogni voce. Anno d'imposta 2026, caso standard Milano.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${wixMadefor.className} min-h-screen antialiased`}>
        <header className="border-b border-[var(--border)] bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="text-[17px] font-bold tracking-tight">
              RAL <span aria-hidden>→</span> Netto
            </Link>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 hover:bg-[var(--fill)]"
              >
                Calcolatore
              </Link>
              <Link
                href="/stato"
                className="rounded-lg bg-[var(--ink-primary)] px-3 py-1.5 text-white hover:opacity-90"
              >
                Stato regole
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
        <footer className="border-t border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="mx-auto max-w-6xl px-6 py-6 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
            Prototipo dimostrativo: stima per un caso semplice e standard, non sostituisce un
            cedolino né una consulenza. Assunzioni e limiti documentati nella pagina Stato regole.
          </div>
        </footer>
      </body>
    </html>
  );
}
