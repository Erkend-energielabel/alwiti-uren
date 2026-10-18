# Alwiti Urenregistratie

Urenregistratie voor de monteurs van Alwiti bv (aluminium geveltechniek). Monteurs vullen hun uren per project in (buiten, werkplaats of kantoor) en sturen bonnetjes in. Kantoor beoordeelt weekstaten en bonnetjes, bekijkt rapporten en exporteert alles naar Excel.

De app werkt los van Claude. Inloggen gaat met naam en pincode, en alle gegevens staan in een Google Sheet van Alwiti.

## Mappen

| Bestand of map | Inhoud |
|---|---|
| `index.html` | De app (via GitHub Pages: `https://erkend-energielabel.github.io/alwiti-uren/`) |
| `config.js` | De link naar de Google Sheet (web-app-URL van Apps Script) |
| `Code.gs` | De code die in de Google Sheet draait (Extensies > Apps Script) |
| `documenten/` | Papieren urenlijst (PDF) en Excel-sjablonen voor het inlezen van monteurs en projecten |
| `claude-versie/` | Dezelfde app zoals hij in Claude draait (werkt alleen binnen Claude) |

## Bijwerken vanaf de vorige versie

De Google Sheet en `config.js` blijven hetzelfde, dus monteurs en uren blijven bewaard. Alleen de code in de Sheet moet worden vervangen:

1. Open de Google Sheet en kies **Extensies > Apps Script**.
2. Selecteer alle code in `Code.gs`, verwijder die en plak de nieuwe **Code.gs** uit deze map. Klik op Opslaan.
3. Kies bovenaan de functie **installeer** en klik op **Uitvoeren**. Dit maakt de nieuwe tabbladen Bonnen en Fotos aan. Bestaande gegevens blijven staan.
4. Kies **Implementeren > Implementaties beheren**, klik op het potloodje, kies bij Versie **Nieuwe versie** en klik op **Implementeren**. De link blijft hetzelfde.
5. Zet in het tabblad **Monteurs** bij jezelf de Rol op **eigenaar**. Alleen de eigenaar kan de administratie leegmaken.

## Nieuwe installatie

1. Ga naar sheets.new en noem de Sheet "Alwiti uren".
2. Kies **Extensies > Apps Script** en plak de inhoud van **Code.gs** over de bestaande code heen.
3. Kies de functie **installeer** en klik op Uitvoeren. Geef toestemming (Geavanceerd > Ga naar … > Toestaan).
4. Vul in het tabblad **Monteurs** bij jezelf een naam en pincode in, met Rol **eigenaar**.
5. Kies **Implementeren > Nieuwe implementatie > Web-app**, met Uitvoeren als **Ik** en Toegang **Iedereen**. Kopieer de web-app-URL (eindigt op `/exec`).
6. Plak die URL in `config.js`.

## Rollen

| Rol (tabblad Monteurs) | Wat kan iemand |
|---|---|
| monteur | Alleen eigen uren en bonnetjes invullen en bekijken |
| kantoor | Alles zien, goedkeuren, aanpassen, rapporten en export |
| eigenaar | Als kantoor, en daarnaast de administratie leegmaken |

## Dagelijks gebruik

- **Monteur toevoegen:** in de app, tabblad Monteurs. Voeg de naam toe, kies hem in de lijst en stel een pincode in. Het kan ook direct in de Sheet.
- **Blokkeren:** een geblokkeerde monteur kan niet meer inloggen. Zijn uren blijven bewaard.
- **Pincode vergeten:** stel in de app een nieuwe in.
- **5 keer een foute pincode:** het account gaat op slot tot kantoor het vrijgeeft. Dat doe je in de app (tabblad Monteurs, kies de monteur, Vrijgeven), door een nieuwe pincode in te stellen, of door in de Sheet de cel Vergrendeld leeg te maken.
- **Overzichten in de Sheet:** de tabbladen Uren, Werken en Bonnen worden automatisch bijgewerkt. Laat de tabbladen Data en Fotos ongemoeid.
- **Materiaal bestellen:** zet per monteur aan in tabblad Monteurs (Mag materiaal bestellen). De monteur maakt een foto, vult in wat en hoeveel, en het komt binnen op tabblad Bestellingen. Daar zet kantoor de status op Besteld, Geleverd of Afgewezen en zie je per monteur wie wat besteld heeft (ook schoenen en kleding).
- **Vraag over een bestelling:** op tabblad Bestellingen klik je op Vraag stellen en typ of spreek je je vraag in. De monteur krijgt een rood bolletje en een melding, en zijn antwoord zie je direct bij de bestelling.
- **Monteur-app:** monteurs zien vier tabbladen: Uren invullen, Materiaal bestellen (als het aan staat), Bonnetjes en Topper van de week.
- **Exporteren naar PDF:** op elk kantooroverzicht staat een knop die het overzicht op A3 liggend klaarzet; kies in het venster "Opslaan als PDF".
- **Backup en Excel:** op kantoor via de knoppen **Backup downloaden** en **Exporteer naar Excel**. De Google Sheet zelf houdt ook een versiegeschiedenis bij (Bestand > Versiegeschiedenis).

## Wat alleen in de Claude-versie zit

"Netjes maken" van ingesproken tekst en het uitlezen van een foto van een papieren urenlijst gebruiken Claude. In deze losse versie staan die knoppen uit. Inspreken via het toetsenbord van de telefoon werkt wel.

## Beveiliging

De pagina zelf is openbaar te openen, maar zonder naam en pincode is er niets te zien. Alle gegevens staan in de Google Sheet, en de Sheet bepaalt per verzoek wat iemand mag lezen of wijzigen. Monteurs zien alleen hun eigen uren, bonnetjes en foto's.
