# Assunzioni e semplificazioni — ordinate per materialità

> Ogni riga: cosa assumiamo, quanto sposta il numero, perché è legittimo nel caso standard.
> Caso di riferimento (dal brief): impiegato, tempo indeterminato, Milano, nessuna agevolazione.

## Impatto ALTO — cambiano il risultato di centinaia di € se violate

| # | Assunzione | Impatto se violata | Note |
|---|---|---|---|
| A1 | **Aliquota contributiva dipendente 9,49%** (IVS 9,19% + CIGS 0,30%): industria >15 dip. o terziario >50 dip. | ±0,30% della RAL (azienda sotto soglia CIGS o coperta da fondo bilaterale: 9,19%) | Il brief non fissa la dimensione aziendale; scelta dichiarata, fonte D.Lgs. 148/2015 art. 23 |
| A2 | **Iscrizione INPS post-1995** → massimale contributivo 122.295 € applicato | Solo RAL > 122.295 €: un ante-1996 paga IVS su tutto (netto più basso, pensionabile più alto) | INPS circ. 6/2026 §6 |
| A3 | **Nessun contributo CCNL** (sanità integrativa, previdenza complementare, enti bilaterali) | 50–300 €/anno tipici a seconda del contratto | Dipendono dal CCNL specifico, non derivabili dalla RAL |
| A4 | **RAL = unica fonte di reddito = reddito complessivo** | Altri redditi cambiano scaglioni, detrazioni, soglie bonus | Standard per un calcolatore da RAL |
| A5 | **Nessun carico familiare** (detrazioni art. 12 non applicate) | Fino a ~950 €/figlio (ma assegno unico ha assorbito gran parte dei casi) | Il brief esclude agevolazioni particolari |

## Impatto MEDIO — cambiano l'interpretazione, non l'ordine di grandezza

| # | Assunzione | Impatto | Note |
|---|---|---|---|
| B1 | **Competenza, non cassa**: le addizionali dell'anno si attribuiscono all'anno | Il cash flow reale paga saldo anno precedente a rate + acconto comunale 30% (su aliquote anno precedente) | Somma identica, timing diverso; documentato in research/03 §A6 |
| B2 | **Imponibile previdenziale = RAL** | Fringe benefit, trasferte, welfare escluderebbero quote; minimale ~18.136 € alza il floor | Valido per impiegato "solo stipendio" |
| B3 | **365 giorni lavorati** | Detrazioni e TI sono ragguagliati ai giorni; assunzione/cessazione in corso d'anno li riduce | Standard |
| B4 | **Trattamento integrativo fascia 15–28k non implementato** | Rilevante solo con detrazioni per mutui/ristrutturazioni ante-2022 capienti | Condizione dipende da spese personali non derivabili dalla RAL |
| B5 | **Netto mensile = media** (annuo ÷ mensilità) | La busta reale varia mese a mese: rate addizionali, conguaglio dicembre, 13ª tassata senza detrazioni | Nota visibile in UI |
| B6 | **Mensilità 12/13/14 selezionabili** | Nessuno sul netto annuo: cambia solo il divisore | Il numero dipende dal CCNL; test dedicato verifica l'invarianza dell'annuo |

## Impatto BASSO — dettagli dichiarati

| # | Assunzione | Impatto |
|---|---|---|
| C1 | Arrotondamento al centesimo per voce (non all'unità di euro come in dichiarazione) | < 1 €; la regola dell'unità è prassi AdE dei modelli, non norma primaria |
| C2 | Tempo indeterminato (minimo detrazione 690 €, non 1.380 €) | Solo redditi bassissimi |
| C3 | Domicilio fiscale Milano al 1° gennaio, invariato tutto l'anno | Cambio residenza sposta le addizionali |
| C4 | Regole uniformi sull'anno (nessun decreto infra-annuale) | Se un decreto cambia le regole a metà anno (successo nel 2023 sui contributi), servono regole per periodo, non per anno. Architettura pronta: il registry passerebbe da chiave-anno a chiave-periodo |

## Fuori scope dichiarato

- TFR: ~6,91% della RAL accantonato dal datore, **non** transita dal netto in busta (nota in UI)
- Costo azienda (contributi c/datore, INAIL): prospettiva diversa dal brief
- Fringe benefit, welfare, premi di risultato detassati
- Agevolazioni (impatriati, madri, ecc.) — escluse dal brief

## Discontinuità normative implementate (non bug)

| Soglia (reddito complessivo) | Effetto | Verificato da test |
|---|---|---|
| ~8.174 € | attivazione trattamento integrativo (capienza): +1.200 | ✓ |
| 8.500 € | fascia somma integrativa 7,1% → 5,3% sull'intero reddito | ✓ |
| 15.000 € | perdita TI (−1.200) quasi compensata dal salto detrazione art. 13 (1.955 → ~3.100): perdita netta ~123 € | ✓ |
| 20.000 € | somma integrativa (max 960) → ulteriore detrazione (1.000): +~40 | ✓ |
| 23.000 € | esenzione comunale Milano a cliff: sopra soglia 0,8% sull'intero imponibile (~184 €) | ✓ |
| IRPEF netta = 0 | addizionali non dovute (gate normativo) | ✓ |
