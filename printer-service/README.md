# Service local d'impression ESC/POS

Ce service recoit un ticket ESC/POS depuis le `front-end` et l'envoie a une imprimante thermique.

## Modes supportes

- `windows`
  - envoie brut `RAW` vers une imprimante Windows installee
  - adapte au cas `POS-80C` partagee par le spooler Windows
- `network`
  - envoie TCP brut vers une imprimante ESC/POS sur le port `9100`

## Demarrage

1. Copier `.env.example` en `.env` si tu veux garder une config locale.
2. Configurer au minimum:
   - `PRINTER_MODE=windows`
   - `PRINTER_NAME=POS-80C`
3. Lancer:

```bash
cd printer-service
npm start
```

Le service ecoute par defaut sur `http://127.0.0.1:3210`.

## Test rapide

```bash
curl http://127.0.0.1:3210/health
```

## Notes

- En mode `windows`, le nom de l'imprimante doit correspondre exactement au nom vu dans Windows.
- Le `front-end` envoie automatiquement le ticket a ce service apres une vente.
- Si le service est indisponible, le `front-end` peut basculer sur l'impression navigateur en secours.
