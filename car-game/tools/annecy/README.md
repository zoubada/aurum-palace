# Circuit 2 — Tour du lac d'Annecy : chaîne de données

Ces scripts fabriquent le circuit à partir de **données ouvertes réelles**. Ils ne sont à relancer
que pour régénérer `assets/tracks/annecy/` (déjà fourni dans le dépôt).

```bash
npm run data:annecy        # les 4 étapes ci-dessous (≈ 10 min, ≈ 280 Mo de cache)
```

| Étape | Script | Source | Résultat |
|---|---|---|---|
| 0 | `0-fetch-osm.mjs` | OpenStreetMap (API OSM, cases de 0,01°) | routes, bâtiments, lac, panneaux d'agglomération |
| 1 | `1-route.mjs` | — | trajet réel du tour (D1508 puis D909/D909a), sens antihoraire, ronds-points respectés |
| 2 | `2-fetch-ign.mjs` | IGN Géoplateforme (WMS) | relief RGE ALTI (sol et sursol), photos BD ORTHO |
| 3 | `3-build.mjs` | — | `track.json`, cases de terrain `t/*.bin` + `t/*.webp`, terrain lointain `far.*` |

Détails de l'étape 3 :
- **Tracé** : points OSM rééchantillonnés tous les mètres et lissés ; altitude du RGE ALTI
  (interpolée sur les ponts) ; largeur d'après le nombre de voies OSM, élargie dans les épingles ;
  léger dévers selon la courbure.
- **Terrain** (cases de 1 km, un point tous les 4 m) : sol creusé sous la route, fond du lac
  creusé sous l'eau, et au-delà de ~200 m de la route le modèle de surface (forêts et villages
  en volume vus de loin).
- **Arbres** : là où le modèle de surface dépasse le sol de plus de 3,5 m (canopée réelle),
  hauteur réelle, couleur de la photo.
- **Bâtiments** : emprises OSM, hauteur mesurée (surface − sol), couleur du toit d'après la photo.

Le cache (`tools/cache/`) n'est pas versionné.

## Licences
- OpenStreetMap : © contributeurs OpenStreetMap, licence ODbL — attribution affichée en jeu.
- IGN : RGE ALTI, BD ORTHO — Licence Ouverte 2.0 (Etalab).
