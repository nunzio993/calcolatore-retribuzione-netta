# Sintesi — Parametri consolidati anno d'imposta 2026

> Consolidato dai report 01 (IRPEF), 02 (INPS), 03 (addizionali/MEF). Data verifica: 2026-08-07.
> Caso: impiegato T.I., settore privato industria/terziario >50 dip., Milano, iscrizione INPS post-1996, nessuna agevolazione, 365 giorni lavorati, RAL = unica fonte di reddito = imponibile previdenziale.

## Catena di calcolo con parametri

```
RAL
│
├─ (−) CONTRIBUTI DIPENDENTE                                    [research/02]
│      IVS    9,19% × min(RAL, 122.295)
│      1% agg 1,00% × max(0, min(RAL, 122.295) − 56.224)
│      CIGS   0,30% × RAL (no massimale)
│
= IMPONIBILE FISCALE (= reddito complessivo RC, unica fonte)
│
├─ IRPEF LORDA                                                  [research/01]
│      23% fino a 28.000 · 33% 28.000–50.000 · 43% oltre
│      (cumulate: 6.440 a 28k · 13.700 a 50k)
│
├─ (−) DETRAZIONE LAVORO DIPENDENTE art. 13                     [research/01]
│      ≤15k: 1.955 (min 690)
│      15–28k: 1.910 + 1.190×(28.000−RC)/13.000
│      28–50k: 1.910×(50.000−RC)/22.000
│      >50k: 0
│      +65 se 25.000 < RC ≤ 35.000
│
├─ (−) ULTERIORE DETRAZIONE L.207/2024 (solo RC 20.000–40.000)  [research/01]
│      20–32k: 1.000 · 32–40k: 1.000×(40.000−RC)/8.000
│
│  → IRPEF NETTA = max(0, lorda − detrazioni)   [floor: art. 11 c. 3 TUIR]
│
├─ (−) ADDIZIONALE REGIONALE LOMBARDIA  [solo se IRPEF netta > 0]  [research/03]
│      scaglioni su RC: 1,23% ≤15k · 1,58% 15–28k · 1,72% 28–50k · 1,73% >50k
│
├─ (−) ADDIZIONALE COMUNALE MILANO      [solo se IRPEF netta > 0]  [research/03]
│      RC ≤ 23.000 → 0 (CLIFF) · RC > 23.000 → 0,80% × RC intero
│
├─ (+) SOMMA INTEGRATIVA (solo RC ≤ 20.000, esente, erogazione)  [research/01]
│      7,1% RLD ≤8.500 · 5,3% 8.500–15.000 · 4,8% >15.000 (% su RLD intero)
│
├─ (+) TRATTAMENTO INTEGRATIVO (solo RC ≤ 15.000)                [research/01]
│      1.200 se IRPEF lorda > (detrazione art.13 c.1 − 75)
│      (fascia 15–28k con altre detrazioni: fuori scope, dichiarato)
│
= NETTO ANNUO  → mensile: ÷13 o ÷14 (toggle)
```

## Discontinuità legittime (i test di continuità devono escluderle)

| Soglia RC | Cosa scatta | Salto |
|---|---|---|
| 15.000 | perdita trattamento integrativo (−1.200) | cliff reale |
| 20.000 | somma integrativa → ulteriore detrazione (alternative) | quasi-continuo by design |
| 23.000 | addizionale Milano su RC intero | cliff ~184 € |
| 28.000 / 50.000 | cambio scaglione IRPEF + addizionale reg. | continuo (marginale) |
| 56.224 | parte l'1% aggiuntivo | continuo (marginale) |
| 122.295 | si fermano IVS e 1% (resta CIGS) | continuo (marginale) |

Golden test da piazzare attorno a: 15k, 20k, 23k, 28k, 35k, 50k, 56k, 80k, 122k, 150k.

## Correzioni emerse rispetto al piano iniziale

1. **Contributi dipendente 9,49%, non 9,19%** (CIGS 0,30% inclusa nel caso standard)
2. **Condizione trattamento integrativo**: imposta lorda > (detrazione − **75€**), non semplice confronto
3. **Soglia Milano = cliff**, non franchigia: sopra 23k si tassa tutto il RC
4. **Scaglioni addizionale regionale ≠ scaglioni statali** (facoltà prorogata al 2028)
5. Sopra il massimale contributivo la CIGS continua (IVS e 1% si fermano)

## Perle per il colloquio (tesi "dati stale" confermata sul campo)

- Pagina AdE "Aliquote IRPEF" agg. 13/01/2026: riporta ancora **35%** in tabella (il 33% è in vigore da gennaio, L. 199/2025)
- Dataset MEF 2026 ad agosto: **4.919 comuni su ~7.900 ancora `0*`** (nessuna delibera) — Milano inclusa; il valore vigente è carry-forward dell'anno precedente
- Esonero contributivo 6/7%: cessato 31/12/2024, ma il web ne è ancora pieno

## Monitoraggio (fase 6) — input validati

- URL CSV MEF comunale (2001–2026) e regionale (2015–2026): GET semplice, no auth, rigenerati ogni giorno
- Parsing: `;`, ISO-8859-1, virgola decimale comunale (`,8`) vs punto regionale (`1.23`), `ALIQUOTA_2` quando `FLAG_NUOVA=2`, `0*` = dato assente MAI zero
- File anno corrente affidabile solo dopo il 20/12; re-fetch anche anni pregressi
- Replay demo: **Lombardia 2021→2022** (5→4 scaglioni, cambio strutturale) e/o **Milano 2019→2020** (soglia 21k→23k)
