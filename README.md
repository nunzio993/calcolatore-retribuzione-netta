# Calcolatore retribuzione netta — RAL → netto (anno d'imposta 2026)

Prototipo: da una Retribuzione Annua Lorda al netto annuale e mensile, con **tutte le voci
trattenute esposte** — ognuna con la propria base di calcolo, aliquota e riferimento normativo.

Caso standard (dal brief): impiegato a tempo indeterminato, Milano, nessuna agevolazione
particolare. Ogni altra semplificazione è dichiarata e ordinata per impatto in
[docs/assunzioni.md](docs/assunzioni.md).

## Avvio

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 17 test: golden + proprietà + guardrail
```

L'utente inserisce la RAL, sceglie le mensilità (12/13/14) e preme **Calcola**: il risultato
compare in pagina. Cambiando un input, il risultato resta quello dell'ultimo calcolo e un avviso
chiede di ricalcolare — non insegue i tasti mostrando numeri che nessuno ha chiesto.

## Le tre idee del progetto

### 1. Le regole sono dati, non codice

Aliquote, scaglioni e soglie cambiano ogni anno (e a volte a metà anno). Tutti i parametri
normativi vivono in [src/domain/rules/2026.ts](src/domain/rules/2026.ts), **ogni valore con la
sua fonte primaria a fianco**. Il motore ([src/domain/calcolaNetto.ts](src/domain/calcolaNetto.ts))
implementa le formule, il file regole dichiara i numeri. Fuori dagli anni censiti il registry
**fallisce esplicitamente**: mai estrapolare — un numero plausibile ma sbagliato costa più di un
errore dichiarato.

### 2. Il calcolo produce un tracciato, non un numero

`calcolaNetto()` non ritorna "il netto": ritorna una lista di voci (`LineItem[]`) dove ogni riga
espone base imponibile, aliquota e riferimento normativo. Il punto didattico del dominio è che
**ogni voce ha una base diversa**: i contributi si calcolano sulla RAL (con massimale), IRPEF e
addizionali sull'imponibile fiscale, le detrazioni riducono l'imposta (con floor a zero), le
integrazioni del cuneo sono erogazioni esenti che non transitano dall'IRPEF.

### 3. Un calcolatore fiscale invecchia: deve saperlo

La pagina [/stato](http://localhost:3000/stato) mostra anno delle regole, data di verifica delle
fonti, calendario di manutenzione e lo stato del **watchdog automatico** (sotto).

## Catena di calcolo

```
RAL
├─ (−) Contributi dipendente: IVS 9,19% + CIGS 0,30% (+1% oltre 56.224 €; massimale 122.295 €)
= Imponibile fiscale (reddito complessivo)
├─ IRPEF lorda per scaglioni (23% / 33% / 43%)
├─ (−) detrazione lavoro dipendente art. 13 (+65 € tra 25–35k)
├─ (−) ulteriore detrazione L. 207/2024 (RC 20–40k)            → floor a zero (art. 11 c. 3)
├─ (−) addizionale regionale Lombardia (scaglioni propri)      ┐ solo se IRPEF netta > 0;
├─ (−) addizionale comunale Milano (0,8%, esenzione 23k CLIFF) ┘ base SENZA detrazioni
├─ (+) somma integrativa (RC ≤ 20k, esente)
├─ (+) trattamento integrativo (RC ≤ 15k, 1.200 € con capienza)
= Netto annuo → ÷ 13 o 14 = netto mensile (media)
```

Dettagli non ovvi implementati (con test dedicati):

- **Soglia comunale Milano = cliff**, non franchigia: a 23.001 € di imponibile l'addizionale si
  applica all'intero reddito (~184 € di salto). È la norma (art. 1 c. 11 D.L. 138/2011), non un bug.
- **Condizione trattamento integrativo**: imposta lorda > (detrazione art. 13 − **75 €**) — il
  correttivo è nel testo del D.L. 3/2020, quasi sempre omesso.
- **Contributi 9,49%**, non 9,19%: la CIGS 0,30% è a carico del dipendente nel caso standard
  (industria >15 / terziario >50 dip.) — e sopra il massimale contributivo continua mentre IVS e 1% si fermano.
- **A RC 15.000 il sistema è quasi continuo by design**: la perdita del trattamento integrativo
  (−1.200 €) è compensata dal salto della detrazione art. 13 (1.955 → ~3.100). Perdita netta
  reale: ~123 €. Scoperto dai test di proprietà, documentato in un test dedicato.

## Test

- **Golden test**: valori calcolati a mano dalle fonti (non dal codice) per RAL 9k/15k/35k/80k/150k
- **Proprietà**: monotonia del netto, aliquota marginale < 100%, continuità ai punti di scaglione,
  coerenza voci↔totali — con le discontinuità normative legittime censite ed escluse esplicitamente
- **Guardrail**: anno non censito → errore, input invalidi → errore

## Watchdog normativo (monitoraggio automatico)

[monitoraggio/check.mjs](monitoraggio/check.mjs) — Node puro, zero dipendenze:

- **Diff giornaliero sui dataset aperti del MEF** (CSV addizionali comunali e regionali,
  2001–2026): estrae Milano (F205) e Lombardia, confronta con gli snapshot committati, scrive
  [monitoraggio/status.json](monitoraggio/status.json) (letto dalla pagina /stato)
- **Gestisce la trappola `0*`**: nel CSV MEF `0*` significa "delibera non ancora adottata", mai
  aliquota zero → carry-forward all'anno precedente (ad agosto 2026, ~4.900 comuni su 7.900 sono
  ancora `0*`, Milano inclusa)
- **Dead-man switch**: allarme anche sull'*assenza* di aggiornamenti attesi (regole dell'anno nel
  registry entro il 15/1, verifica fonti < 180 giorni) — un watchdog che tace non è un watchdog sano
- **GitHub Actions** ([.github/workflows/monitoraggio.yml](.github/workflows/monitoraggio.yml)):
  cron giornaliero, committa status/snapshot, apre una issue con il diff quando rileva un cambiamento

### Hash dei testi vigenti su Normattiva

Gli URL Normattiva con suffisso `!vig=` servono sempre il **testo vigente** di un articolo — e
sono già citati come fonte in `rules/2026.ts`. Il watchdog ne scarica il testo, lo normalizza e
ne confronta l'hash con lo snapshot committato: se una legge modifica l'art. 11 TUIR, il claim
"scaglioni IRPEF" diventa rosso su /stato da solo. Verificato empiricamente: GET semplice,
nessun JS, hash stabile fra fetch ripetuti. I marker di sanità sono **strutturali** (rubriche,
mai valori): un marker sul "33%" si romperebbe proprio al cambio da rilevare.

Copertura automatica: **10 parametri su 14, senza alcun LLM** — scelta deliberata: il watchdog
confronta, non interpreta; capire *cosa* è cambiato resta compito di chi legge la norma.
Cadenza: MEF ogni notte, Normattiva il lunedì (le leggi non cambiano di notte). Limite noto e
dichiarato: l'hash rileva modifiche agli articoli **citati** — una norma nuova che non li tocca
non viene vista (per quello restano calendario e ri-ricerca).

### Ri-verifica dei parametri: il ciclo completo

I 4 parametri contributivi (IVS, CIGS, fascia, massimale) vivono nelle circolari INPS, che non
hanno un URL "testo vigente" e sono servite da pagine JS-rendered: per quelli la verifica si
lancia a mano, ma **il risultato rientra nello stesso circuito**.

```
prompt versionato          →  chat qualsiasi con accesso al web
research/prompts/             (Claude, ChatGPT, Perplexity…)
verifica-regole.md
                           ↓  modulo JSON compilato
monitoraggio/reports/      ←  commit dell'agente, o "Add file" da GitHub
                           ↓  deploy
/stato                     →  un indicatore per parametro
                              🔴 cambiato · 🟡 incerto · 🟢 confermato
                           ↓  verifichi aprendo le fonti, selezioni
                              la pagina prepara la modifica
src/domain/rules/2026.ts   ←  commit di approvazione → CI → deploy
```

Tre proprietà che tengono in piedi il disegno:

- **`/stato` legge soltanto.** Nessun input sulla pagina, nessun backend, nessuna chiave API. È
  pubblica e non c'è niente da proteggere: l'unica scrittura è un commit, che ha identità, storia
  e revert.
- **Il modulo è un contratto.** Chat diverse rispondono in formati diversi; il prompt impone un
  JSON fisso e la pagina **rifiuta** un report malformato invece di interpretarlo. Un confronto su
  dati sbagliati è peggio di nessun confronto.
- **Un claim senza prova non è approvabile.** Ogni parametro deve arrivare con URL e citazione
  testuale, così la verifica umana è "apri il link, confronta la citazione" e non un atto di fede
  verso un modello che può allucinare. La pagina segnala anche i report **incoerenti**: quelli che
  dichiarano "confermato" ma riportano un valore diverso da quello in vigore.

Il catalogo dei parametri sorvegliati è [src/domain/claims.ts](src/domain/claims.ts): è il
vocabolario condiviso fra prompt e pagina. Aggiungendo un parametro alle regole senza aggiungerlo
al catalogo, la griglia lo mostra come **mai verificato** — il buco è visibile, non silenzioso.

### Demo replay (cambi normativi realmente avvenuti)

```bash
node monitoraggio/check.mjs --seed-replay   # semina gli snapshot da anni storici
node monitoraggio/check.mjs                 # rileva i cambi veri
```

Il seed parte da **Milano 2019** (soglia esenzione 21.000 €) e **Lombardia 2021** (5 scaglioni):
il run successivo rileva il passaggio a 23.000 € (delibera C.C. 46/2020) e la riduzione a 4
scaglioni (riallineamento L. 234/2021) — un cambio di *parametro* e un cambio di *struttura*,
entrambi con storia vera, non simulati.

## Ricerca e fonti

Tutti i parametri derivano da fonti primarie (Normattiva, Gazzetta Ufficiale, circolari INPS,
dataset e provvedimenti MEF, delibere del Comune di Milano), raccolte e verificate in
[research/](research/) con URL, riferimento normativo e livello di confidenza per ogni numero.
Trovate sul campo, a conferma del rischio "dati stale":

- la pagina AdE "Aliquote IRPEF" (agg. 13/01/2026) riportava ancora il 35% quando il 33% era in
  vigore da gennaio (L. 199/2025)
- l'esonero contributivo 6/7% è cessato il 31/12/2024, ma il web ne è ancora pieno
- il dataset MEF dell'anno corrente è consolidato solo dopo il 20 dicembre

I calcolatori pubblici sono usati **solo come check finale** (divergono tra loro dell'1–3%), mai
come fonte. Esito della validazione ([research/04-validazione.md](research/04-validazione.md)):
tutti i valori dentro la forbice dei riferimenti 2026 comparabili (±1%; a RAL 35.000 su Milano
±0,25% vs due fonti indipendenti). Le divergenze residue hanno una firma precisa e spiegata: la
CIGS 0,30% che i calcolatori pubblici omettono, e il cliff di esenzione comunale che gestiamo
secondo norma. Un "calcolatore 2026" su quattro trovati usava ancora le regole 2025: scartato.

## Cosa chiedono gli altri calcolatori, e perché noi non lo chiediamo

I calcolatori pubblici mostrano tipicamente 10–12 campi. Noi ne chiediamo 2. Non è una mancanza
di funzionalità: è una scelta su **cosa derivare invece di domandare**, e su cosa il brief mette
esplicitamente fuori scope (impiegato T.I., Milano, nessuna agevolazione).

| Campo tipico | Nostra scelta |
|---|---|
| **"Includi bonus 100 €: Sì/No"** | **Derivato, mai chiesto.** Il trattamento integrativo ha una condizione di spettanza nel testo di legge (imposta lorda > detrazione art. 13 − 75 €): il motore la valuta. Chiederlo all'utente significa domandargli la risposta che il calcolatore dovrebbe dargli. |
| Regione di residenza | Fuori scope (Milano da brief). Il watchdog scarica già ogni notte i CSV MEF di **tutte** le regioni e ~7.900 comuni: il data layer per l'estensione nazionale esiste già, manca la gestione dei layout multi-aliquota (`FLAG_NUOVA` 3–6). |
| Giorni di lavoro (≠ 365) | Fuori scope. È l'estensione a più alto valore: l'assunzione in corso d'anno è frequente e oggi la sbaglieremmo in silenzio. Richiede il ragguaglio delle detrazioni **con le sue eccezioni** (i minimi 690/1.380 € e il correttivo +65 € non si ragguagliano). |
| Tempo determinato | Fuori scope da brief. Costo quasi nullo: il minimo di detrazione 1.380 € è già un parametro in `rules/2026.ts`. |
| Apprendistato | Fuori scope. Cambia l'aliquota contributiva del dipendente (5,84%): un valore alternativo nel file regole. |
| Coniuge / figli 21–30 / % a carico | Fuori scope ("nessuna agevolazione particolare"). Sotto i 21 anni non è comunque materia di busta paga: c'è l'assegno unico INPS. |
| Welfare / fringe benefit | Fuori scope (assunzione B2). Ridurrebbe **entrambe** le basi, imponibile e previdenziale, entro le soglie 1.000/2.000 €. |
| Mensilità 12/13/14 | **Implementato.** Cambia solo il divisore del netto mensile, mai il netto annuo — c'è un test che lo verifica. |

Ordine con cui le estenderei: giorni lavorati → tempo determinato → apprendistato → carichi
familiari → welfare → regione.

## Come è stato costruito

Costruito con Claude Code, e la trasparenza sul metodo è parte della consegna: il punto non è se
l'AI sia stata usata, ma **dove sta la prova che il dominio è sotto controllo**.

Cosa ha accelerato l'AI: la ricerca in parallelo sulle fonti primarie (tre agenti simultanei su
IRPEF, INPS, addizionali+MEF), lo scaffolding di UI e componenti, la stesura dei test.

Dove sta il controllo, verificabile nel repo:

- **I valori attesi dei golden test sono calcolati a mano dai testi di legge**, non copiati
  dall'output del motore: se il codice sbaglia, il test fallisce invece di ratificare l'errore.
  Ogni assert porta in commento l'aritmetica che lo giustifica.
- **Ogni parametro in `rules/2026.ts` ha la fonte primaria a fianco**, con articolo e comma.
  Nessun numero proviene da un aggregatore.
- **Quattro correzioni al modello fatte durante la costruzione**, ognuna nata da una verifica e
  non da un'intuizione: la CIGS 0,30% mancante (9,19% → 9,49%), il correttivo −75 € nella
  condizione del trattamento integrativo, la soglia comunale di Milano come *cliff* e non come
  franchigia, gli scaglioni regionali lombardi diversi da quelli statali.
- **I test di proprietà hanno trovato quello che i golden test non vedevano**: le discontinuità
  normative a RC 8.500 / 15.000 / 20.000, fra cui il fatto che a 15.000 € la perdita del
  trattamento integrativo è quasi compensata *by design* dal salto della detrazione art. 13
  (perdita netta reale ~123 €, non 1.200).

## Limiti dichiarati

Vedi [docs/assunzioni.md](docs/assunzioni.md) per l'elenco completo ordinato per materialità.
I principali: nessun carico familiare, nessun contributo CCNL, RAL unica fonte di reddito,
365 giorni lavorati, calcolo per competenza (non per cassa), regole uniformi sull'anno
(un cambio infra-annuale richiederebbe regole per periodo — il registry è pronto).

Fuori scope dichiarato: TFR (accantonato dal datore, non transita dal netto — nota in UI),
costo azienda, fringe benefit, agevolazioni.
