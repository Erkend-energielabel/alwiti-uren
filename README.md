# Alwiti Urenregistratie: installatie

## 1. Google Sheet (opslag)
1. Ga naar sheets.new en noem de Sheet "Alwiti uren".
2. Kies Extensies > Apps Script.
3. Plak de inhoud van **Code.gs** over de bestaande code heen.
4. (Optioneel) Bestaande gegevens: plak Migratie.gs als extra scriptbestand.
5. Kies bovenaan de functie **installeer** en klik op Uitvoeren. Geef toestemming:
   - Kies je account.
   - Klik op Geavanceerd.
   - Klik op "Ga naar ... (onveilig)".
   - Klik op Toestaan.
6. Vul in de Sheet, tabblad **Monteurs**, bij jezelf een pincode in. Je rol staat al op *kantoor*.
7. Ga in Apps Script naar Implementeren > Nieuwe implementatie > tandwiel > **Web-app**:
   - Uitvoeren als: **Ik**
   - Toegang: **Iedereen**
   - Klik op Implementeren en kopieer de **web-app-URL** (eindigt op `/exec`).

## 2. GitHub Pages (de app)
1. Maak op github.com een nieuwe repository, bijvoorbeeld `alwiti-uren`, en zet hem op **Public**.
2. Upload **index.html** en **config.js** (via Add file > Upload files).
3. Open config.js op GitHub (potloodje) en plak je web-app-URL tussen de aanhalingstekens:
   `window.ALWITI_API = "https://script.google.com/macros/s/..../exec";`
4. Ga naar Settings > Pages en zet Source op **Deploy from a branch**: `main` / `(root)`.
5. Na 1-2 minuten staat de app op `https://<gebruikersnaam>.github.io/alwiti-uren/`.

## Dagelijks gebruik
- **Monteur toevoegen:** in de app, tabblad Monteurs: naam + pincode. Dit kan ook direct in de Sheet (tabblad Monteurs).
- **Kantoormedewerker:** zet in de Sheet de Rol op `kantoor`.
- **Pincode vergeten:** stel in de app een nieuwe in. Na 5 foute pogingen wordt de monteur 10 minuten geblokkeerd.
- **Alle uren** staan leesbaar in het tabblad **Uren** van de Sheet. Het tabblad **Data** is van de app zelf: niet aanpassen.
- **Code.gs aangepast?** Kies Implementeren > Implementaties beheren > potloodje > Versie: Nieuwe versie. De URL blijft dan hetzelfde.
