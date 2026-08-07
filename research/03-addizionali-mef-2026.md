# Ricerca — Addizionali IRPEF (Lombardia/Milano) 2026 + dataset MEF + cambio storico

> Fonte: agente di ricerca su fonti primarie (MEF/Dipartimento Finanze, Normattiva, atti Comune di Milano).
> Data verifica: 2026-08-07.

## A1. Addizionale regionale Lombardia — anno d'imposta 2026

| Scaglione | Aliquota |
|---|---|
| fino a 15.000,00 € | **1,23%** |
| 15.000,01 – 28.000,00 € | **1,58%** |
| 28.000,01 – 50.000,00 € | **1,72%** |
| oltre 50.000,00 € | **1,73%** |

- Norma: Art. 72, c. 1, L.R. Lombardia 14/07/2003 n. 10 · Provvedimento MEF n. 2179, pubbl. 28-GEN-2026
- Fonte: https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=10
- Confidenza: alta (HTML + CSV MEF, doppio riscontro). Progressiva **per scaglioni**, invariata 2022→2026.
- Nota: scaglioni regionali ≠ scaglioni IRPEF statali — legittimo, facoltà prorogata fino al **2028** (L. 207/2024 cc. 726-728, mod. L. 199/2025). Senza intervento regionale entro il 31/12 valgono aliquote anno precedente.

## A2. Addizionale comunale Milano — anno d'imposta 2026

| Campo | Valore |
|---|---|
| Aliquota | **0,80%** unica |
| Soglia esenzione | **23.000,00 €** di reddito imponibile |
| Delibera soglia | C.C. Milano n. 46 del 28/09/2020 |
| Delibera aliquota | C.C. Milano n. 36 del 21/10/2013 |
| Delibera 2026 | **nessuna** — invariato per proroga |

Prova 2026: Parere Organo di Revisione bilancio 2026-2028 (n. 98 del 09/12/2025), pag. 69: *"L'aliquota unica e la soglia di esenzione per il triennio 2026-2028 non vengono modificate."* (allegato a DELC 115/2025).
La proposta 0,9% (dic. 2024) NON attuata — era atto di indirizzo, non delibera tariffaria.

## A3. Base imponibile — confermata

Reddito complessivo IRPEF **al netto dei soli oneri deducibili** (quindi dopo contributi). Le detrazioni d'imposta NON riducono la base.

- Regionale: art. 50 c. 2 D.Lgs. 446/1997
- Comunale: art. 1 c. 4 D.Lgs. 360/1998 (formulazione identica)

## A4. Esenzione se IRPEF netta = 0 — confermata

- Regionale: art. 50 c. 2, 2° periodo, D.Lgs. 446/1997: *"L'addizionale regionale è dovuta se per lo stesso anno l'imposta sul reddito delle persone fisiche, al netto delle detrazioni per essa riconosciute…, risulta dovuta."*
- Comunale: art. 1 c. 4 D.Lgs. 360/1998, analoga.

**Motore**: calcolare IRPEF netta prima delle addizionali. Se = 0 → entrambe azzerate anche con base positiva.

## A5. ⚠️ La soglia comunale è un CLIFF, non una franchigia

Art. 1 c. 11 D.L. 138/2011 (conv. L. 148/2011), mod. D.L. 201/2011: sotto la soglia non è dovuta; **superata la soglia si applica all'intero reddito**.

Milano: imponibile 23.000 € → 0 €. Imponibile 23.001 € → 0,8% × 23.001 = **184,01 €**. Discontinuità reale di ~184 € — NON è un bug del motore, è la norma. Test di continuità deve escludere questa soglia (discontinuità legittima).

## A6. Acconto/saldo (documentazione della semplificazione per competenza)

| Aspetto | Comunale | Regionale |
|---|---|---|
| Acconto | 30% su imponibile **anno precedente**, con aliquote/soglia **anno precedente** | nessuno |
| Rate acconto | max 9 mensili da marzo | — |
| Rate saldo | max 11 dal post-conguaglio | max 11 |
| Competenza territoriale | domicilio fiscale al 1° gennaio | idem |

Il calcolo per competenza resta corretto: acconto+saldo sommano al dovuto dell'anno. Divergenza solo di cassa/timing.

---

## B. Dataset MEF per monitoraggio automatico — VALIDATO

### URL (testati, HTTP 200, GET semplice, no auth, no rate-limit)

Comunale (per comune), anni 2001–2026:
```
https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno={ANNO}
```
→ `Add_comunale_irpef{ANNO}.csv`

Regionale, anni 2015–2026:
```
https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/download.php?tipo=reg&anno={ANNO}
```
→ `addreg{ANNO}.csv`

(Snapshot XLSX sul portale principale: point-in-time, URL instabile — NON usarlo per il monitor.)

### Struttura e gotcha di parsing

**Comunale**: separatore `;`, encoding **ISO-8859-1**, ~7.900 righe, 34 colonne dal 2021.
Riga Milano (reale):
```
F205;MILANO;MI;46;28/09/2020;20/12/2025;CONFERMA;SI;0;Esenzione per redditi imponibili fino a euro 23.000,00;,8;Aliquota unica;…;2;23000
```
- Aliquote con **virgola decimale e zero omesso**: `,8` = 0,8%
- Con `FLAG_NUOVA=2` la colonna `ALIQUOTA` contiene `0` (riga esenzione): **l'aliquota vera è in `ALIQUOTA_2`**
- `FLAG_NUOVA`: 1=unica, 2=unica+esenzione (Milano), 3=scaglioni, 4=scaglioni+esenzione, 5/6=esenzioni specifiche, 0=non normalizzato
- Layout 2014-2020: 22 colonne, flag in colonna U

**Regionale**: 9 colonne, una riga per scaglione, aliquota col **punto** decimale (`1.23`), data `DD-MMM-YY` con mesi italiani (`GEN`, `MAG`, `DIC`).

### 🚨 Trappola `0*` — regole obbligatorie per il monitor

Legenda MEF: se il comune non ha ancora deliberato per l'anno in corso → `0*`. Dopo il **20 dicembre** `0*` resta solo per chi non ha istituito l'addizionale; per gli altri subentra il valore dell'anno precedente (carry-forward, art. 1 c. 169 L. 296/2006).

Copertura misurata: file 2026 (snapshot 07/08/2026): 2.978 comuni valorizzati, **4.919 con `0*`** — inclusi Milano, Roma, Torino, Bologna, Napoli. File 2025 consolidato: 6.989 vs 907.

Regole:
1. `0*` ≡ dato assente, **mai** aliquota zero
2. Su `0*` → fallback anno precedente (carry-forward normativo)
3. File anno corrente affidabile solo **dopo il 20 dicembre**
4. Anche i file anni pregressi mutano (Palermo 2026 pubblicata 22/07/2026) → re-fetch periodico

Rigenerazione giornaliera del prospetto MEF.

---

## C. Cambio storico per demo replay — due candidati verificati

### C1. Milano: soglia esenzione 21.000 → 23.000 € (anno 2020)

| | 2019 | 2020 |
|---|---|---|
| Soglia | 21.000 € | 23.000 € |
| Aliquota | 0,8% | 0,8% |
| Delibera | C.C. 36/2013 | C.C. 46 del 28/09/2020 |
| Pubbl. MEF | 20/12/2019 (CONFERMA) | 14/10/2020 (MODIFICA) |

Righe CSV grezze disponibili per entrambi gli anni. Delibera C.C. 46/2020 verificata sul testo integrale (PDF comune.milano.it).

### C2. Lombardia: da 5 a 4 scaglioni (2021 → 2022) — candidato migliore

| Scaglione | 2021 | 2022 |
|---|---|---|
| 1 | 1,23% fino a 15.000 | 1,23% fino a 15.000 |
| 2 | 1,58% 15–28k | 1,58% 15–28k |
| 3 | 1,72% 28–**55k** | 1,72% 28–**50k** |
| 4 | 1,73% 55–75k | **1,73% oltre 50k** |
| 5 | **1,74% oltre 75k** | — soppresso |

Causa: L. 234/2021 riduce scaglioni statali 5→4, obbligo riallineamento regionale. Provvedimenti MEF 1148 (13-GEN-2021) e 1429 (05-MAG-2022). Cambio di **struttura**, non solo di numero: esercita meglio diff e motore. Impatto: su 80k imponibile, 1.287,50 € → 1.278,10 €.

---

## Non verificabile

1. Testo integrale DCC 36/2013 (PDF scansione senza testo; contenuto confermato indirettamente da DCC 46/2020 e parere revisori)
2. Estremi o.d.g. dic. 2024 su 0,9% (solo stampa, non indicizzato) — non considerato dato
3. Regolamento comunale Milano coordinato (link rotto; art. 6 c. 2 riportato verbatim nella DCC 46/2020)
4. Assenza assoluta delibere Milano gen–lug 2026 (ricerche archivio negative; rischio residuo basso)

## Correzioni alle ipotesi di partenza

1. **Soglia comunale = cliff**, non franchigia (impatto massimo sul motore)
2. Acconto comunale usa aliquote/soglia **anno precedente**; 9 rate acconto, 11 saldo
3. Cambio Milano 21k→23k è del **2020**, non recente; per il 2026 Milano non ha deliberato (proroga)
