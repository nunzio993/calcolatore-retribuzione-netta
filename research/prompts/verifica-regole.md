# Prompt di verifica — parametri fiscali e contributivi

Da lanciare in **una chat qualsiasi** con accesso al web (Claude, ChatGPT, Perplexity…).
Restituisce un report strutturato che, depositato in `monitoraggio/reports/`, accende gli
indicatori sulla pagina `/stato` del calcolatore.

## Come si usa

1. Copia il prompt qui sotto e lancialo in chat
2. Ottieni un blocco JSON
3. Salvalo come `monitoraggio/reports/AAAA-MM-GG-verifica.json` nel repository
   (l'agente lo committa da solo, oppure "Add file" da GitHub web)
4. Apri `/stato`: i parametri cambiati compaiono in rosso con vecchio → nuovo

Il deposito di un report **non modifica nessuna regola**: è materia prima. Le regole cambiano
solo con il commit successivo, quello che approvi tu dopo aver verificato le fonti.

## Perché un modulo fisso

Chat diverse rispondono in formati diversi: prosa, tabelle, elenchi. Tutti corretti, tutti
inconfrontabili. Il modulo JSON è il **contratto** fra la ricerca e la pagina: se un report non
lo rispetta, `/stato` lo segnala come malformato con l'errore preciso invece di mostrare un
confronto sbagliato. Meglio nessun dato che un dato interpretato a indovinare.

---

## PROMPT — copia da qui

Sei un ricercatore fiscale. Devi verificare se i parametri fiscali e contributivi italiani
elencati sotto sono **ancora quelli in vigore** per l'anno d'imposta **2026**.

**Regole di ricerca, vincolanti:**

- Usa **solo fonti primarie o quasi-primarie**: Normattiva, Gazzetta Ufficiale, sito Agenzia
  delle Entrate, circolari INPS, portale MEF/Dipartimento Finanze, delibere comunali/regionali.
  **Mai** blog, aggregatori o calcolatori online.
- **Trappola nota:** il web è pieno di contenuti 2024 e 2025 scritti al presente. Verifica sempre
  che il valore sia quello vigente per l'anno d'imposta 2026. La riforma del cuneo fiscale è
  cambiata nel 2025 (da esonero contributivo a somma integrativa + ulteriore detrazione): non
  mescolare i due regimi. Anche pagine ufficiali possono essere in ritardo — se il testo di legge
  su Normattiva contraddice una scheda divulgativa, **prevale il testo di legge**.
- Per ogni parametro riporta una **citazione testuale** dalla fonte. Un valore senza citazione non
  è approvabile: in quel caso usa esito `"incerto"`.
- Se non riesci a confermare un parametro, dichiara `"incerto"`. **Non indovinare**: un valore
  inventato che sembra plausibile è il danno peggiore possibile.

**Parametri da verificare** (usa esattamente questi `id`):

| id | Cosa verificare |
|---|---|
| `irpef.scaglioni` | Scaglioni e aliquote IRPEF (art. 11 c. 1 TUIR) |
| `detrazione.fascia1` | Detrazione lavoro dipendente, fascia base e minimo (art. 13 c. 1 lett. a TUIR) |
| `detrazione.correttivo` | Correttivo aggiuntivo alla detrazione (art. 13 c. 1.1 TUIR) |
| `cuneo.sommaIntegrativa` | Somma integrativa: percentuali per fascia e soglia di reddito |
| `cuneo.ulterioreDetrazione` | Ulteriore detrazione: importo, soglie, décalage |
| `cuneo.trattamentoIntegrativo` | Trattamento integrativo: importo e soglia di reddito |
| `cuneo.capienzaTrattamento` | Trattamento integrativo: condizione di capienza e franchigia |
| `contributi.ivs` | Aliquota IVS a carico del lavoratore dipendente (FPLD) |
| `contributi.cigs` | Aliquota CIGS a carico del lavoratore |
| `contributi.primaFascia` | Prima fascia di retribuzione pensionabile e aliquota aggiuntiva |
| `contributi.massimale` | Massimale contributivo per iscritti dal 1996 |
| `addizionali.regionale` | Addizionale regionale IRPEF Lombardia: scaglioni e aliquote |
| `addizionali.comunaleAliquota` | Addizionale comunale IRPEF Milano: aliquota |
| `addizionali.comunaleEsenzione` | Addizionale comunale IRPEF Milano: soglia di esenzione |

**Formato di risposta — compila esattamente questo modulo, un blocco JSON e nient'altro:**

```json
{
  "schema": "verifica-regole/v1",
  "dataRicerca": "AAAA-MM-GG",
  "annoImposta": 2026,
  "strumento": "nome del modello/chat usata",
  "claims": [
    {
      "id": "irpef.scaglioni",
      "esito": "confermato",
      "valore": "23% fino a 28.000 € · 33% fino a 50.000 € · 43% oltre",
      "riferimento": "Art. 11 c. 1 TUIR, mod. L. 199/2025 art. 1 c. 3",
      "url": "https://www.normattiva.it/...",
      "citazione": "a) fino a 28.000 euro, 23 per cento; b) oltre 28.000 euro e fino a 50.000 euro, 33 per cento; c) oltre 50.000 euro, 43 per cento.",
      "note": "facoltativo"
    }
  ]
}
```

Campi:

- `esito`: `"confermato"` se la fonte dice ancora quello che ci aspettiamo · `"cambiato"` se dice
  altro · `"incerto"` se non sei riuscito a stabilirlo
- `valore`: **cosa dice la fonte oggi**, in forma leggibile e compatta (non il valore atteso)
- `citazione`: testo **verbatim** dalla fonte, obbligatorio salvo esito `"incerto"`
- `url`: link diretto alla fonte, deve aprirsi e contenere la citazione

Includi **tutti e quattordici** i parametri. Nessun testo fuori dal blocco JSON.
