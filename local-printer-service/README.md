# Local Printer Service

Mini service local Windows pour l'impression des tickets POSapp via ESC/POS.

## Ce que fait ce service

- expose `GET /health`
- expose `GET /printers`
- expose `POST /print`
- liste les imprimantes Windows locales
- envoie les octets bruts du ticket a l'imprimante choisie

## Installation en mode Node

Depuis la racine du projet :

```powershell
cd local-printer-service
npm install
npm start
```

Le service demarre par defaut sur :

```text
http://127.0.0.1:3210
```

## Endpoints

### `GET /health`

Retourne l'etat du service.

### `GET /printers`

Retourne les imprimantes Windows disponibles.

### `POST /print`

Payload JSON attendu :

```json
{
  "contentBase64": "....",
  "printerName": "POS-80C",
  "jobName": "POSapp Ticket"
}
```

Si `printerName` est vide, le service tente d'utiliser l'imprimante par defaut du poste.

## Reglage dans POSapp

Dans les parametres caisse :

- Mode d'impression : `Service local ESC/POS`
- URL du service local : `http://127.0.0.1:3210`
- Nom de l'imprimante : laisse vide pour utiliser l'imprimante par defaut, ou renseigne le nom exact Windows

## Test rapide

Lister les imprimantes :

```powershell
Invoke-RestMethod http://127.0.0.1:3210/printers
```

## Construction de l'executable Windows

Le projet reste prepare pour etre package en `.exe` avec `pkg`.

### Build manuel

```powershell
cd local-printer-service
npm install
npm run build:win
```

Sortie attendue :

```text
local-printer-service/dist/posapp-local-printer-service.exe
```

### Build via script PowerShell

```powershell
cd local-printer-service
.\build-win.ps1
```

### Lancement rapide

Pour un lancement local simple :

```text
local-printer-service/run-local-printer-service.bat
```

Le batch :
- lance l'executable s'il existe deja
- sinon lance `node src/server.js`

## Installeur Windows recommande

Pour les postes caisse, la voie recommandee est maintenant l'installeur Windows qui embarque `node.exe` et deploie le service dans `%LOCALAPPDATA%\POSapp Local Printer Service`.

### Generer l'installeur

```powershell
cd local-printer-service
npm run build:installer
```

Sortie attendue :

```text
local-printer-service/dist/posapp-local-printer-service-installer.exe
```

### Ce que fait l'installeur

- copie `node.exe`
- copie les fichiers du service
- copie les scripts PowerShell d'impression
- installe le tout dans `%LOCALAPPDATA%\POSapp Local Printer Service`
- demarre le service sur `http://127.0.0.1:3210`

## Limites actuelles

- cible Windows uniquement
- fonctionne mieux avec les imprimantes thermiques ESC/POS
- le `.exe` standalone `pkg` peut rencontrer une limitation sur certains postes pour lancer les sous-processus Windows

## Etape suivante

La prochaine etape sera de :
- generer l'installeur `.exe`
- le lancer comme un vrai poste caisse
- tester `GET /printers`
- tester `POST /print`
