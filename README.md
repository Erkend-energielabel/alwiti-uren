# Alwiti Urenregistratie

Urenregistratie voor de monteurs van Alwiti bv (aluminium geveltechniek): monteurs vullen hun uren per project in (buiten, werkplaats of kantoor), kantoor beoordeelt weekstaten, bonnetjes en rapportages, en alles kan naar Excel.

## Let op: deze versie draait in Claude

`index.html` in de hoofdmap is de versie die als app in Claude draait. Opslag, inloggen, rechten (monteur of kantoor), foto's van bonnetjes en "netjes maken" komen van Claude. Open je dit bestand los, bijvoorbeeld via GitHub Pages, dan verschijnt de pagina wel, maar kan er niets worden opgeslagen of geladen.

De werkende app gebruik je via de gedeelde link in Claude. Toegang regel je daar via het Share-menu:
- Monteurs: **Contributor**. Zij zien en vullen alleen hun eigen uren in.
- Kantoor: **Editor**. Zij zien alles.

## Mappen

| Map | Inhoud |
|---|---|
| `index.html` | De Claude-versie van de app (projecten, weekstaten, bonnetjes, ranglijst, locaties, rapport) |
| `documenten/` | Papieren urenlijst (PDF) en Excel-sjablonen voor het inlezen van monteurs en projecten |
| `oude-versie-google-sheet/` | De eerdere losse versie met Google Sheet als opslag en inloggen met pincode. Zie de README in die map. Via GitHub Pages blijft die bereikbaar op `/oude-versie-google-sheet/`. |

## Backup

In Claude draait elke vrijdag om 17:56 een automatische backup naar het project "Alwiti" (map `backups`). Op kantoor kan ook altijd met de hand een backup worden gedownload via **Backup downloaden**.
