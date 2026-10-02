# Jeu de course 3D — Prototype (Phases 1 et 2)

Jeu de course réaliste dans le navigateur (TypeScript + Vite + Three.js), développé par phases selon le cahier des charges.
« APEX » est un nom de travail provisoire.

## Lancer le jeu

```bash
cd car-game
npm install
npm run dev        # serveur de dev → http://localhost:5173
```

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm test` | Tests unitaires de la physique (0–100, vitesse max, freinage, adhérence, aides, collisions) |
| `npm run build` | Vérification des types + build de production dans `dist/` |
| `npm run preview` | Sert le build sur http://localhost:4173 |
| `npm run smoke` | Test navigateur (Playwright) sur le build : garage, conduite, caméras, menu, pipeline glTF, son, erreurs console |

## Commandes

| Action | Clavier | Manette |
|---|---|---|
| Accélérer | ↑ / Z (AZERTY) · W (QWERTY) | RT |
| Freiner / marche arrière (boîte auto, à l’arrêt) | ↓ / S | LT |
| Diriger | ← → / Q·A, D | Stick gauche |
| Frein à main | Espace | B |
| Rapport + / − (boîte manuelle) | E / A (AZERTY) · Q | RB / LB |
| Changer de caméra | C | Y |
| Regarder derrière | V (maintenu) | X (maintenu) |
| Replacer la voiture | R | View |
| Menu pause / réglages | Échap | Menu |
| Presets d’aides | 1 Arcade · 2 Intermédiaire · 3 Simulation | — |
| HUD / télémétrie des pneus | H / F3 | — |

Les vibrations de la manette suivent le glissement des pneus et les chocs.

## État du projet

### Phase 2 (voitures) — fait
- **7 voitures** avec leurs caractéristiques officielles (`src/cars/<id>/config.ts`) : Audi RS 3 (8Y), Audi RS 6 Avant performance (C8), Porsche 911 GT3 RS (992), Ford Mustang GT (S650), BMW M3 Competition (G80), Nissan GT-R (R35), McLaren 720S.
- **Physique calée sur les chiffres réels** (tests automatiques) :

| Voiture | 0–100 officiel | 0–100 simulé | Vmax officielle | Vmax simulée |
|---|---|---|---|---|
| Audi RS 3 | 3,8 s | 3,85 s | 290 km/h | 290 km/h |
| Audi RS 6 performance | 3,4 s | 3,23 s | 305 km/h | 305 km/h |
| Porsche 911 GT3 RS | 3,2 s | 3,21 s | 296 km/h | 292 km/h |
| Ford Mustang GT | 4,6 s * | 4,61 s | 250 km/h | 250 km/h |
| BMW M3 Competition | 3,9 s | 4,05 s | 290 km/h | 290 km/h |
| Nissan GT-R | 3,3 s * | 3,44 s | 315 km/h | 315 km/h |
| McLaren 720S | 2,9 s | 2,85 s | 341 km/h | 340 km/h |

  \* Pas de 0–100 km/h constructeur fiable : la référence vient d'essais presse (détail dans chaque fiche).
- **Spécificités** : limiteurs de vitesse, DRS de la GT3 RS, aérofrein de la 720S, RS Torque Splitter de la RS 3, coupleur central des 4×4, boîtes double embrayage sans coupure, automatiques à embrayages.
- **Sons moteur synthétisés** pour chaque architecture (5 cylindres, V8 à vilebrequin croisé ou plat, flat-six, 6 en ligne, V6), turbo, soupape de décharge, pétarades, limiteur, pneus, vent, chocs. Volumes réglables.
- **Animations** : suspension, roues et braquage (Ackermann), volant, feux stop et recul, disques de frein qui rougissent, aileron actif, flammes d'échappement, portes (garage).
- **Intérieur** : combiné d'instruments animé au style de chaque marque, rétroviseurs intérieur et extérieurs en temps réel, volant à palettes.
- **Garage** : plateau tournant sous éclairage studio, fiche technique, comparaison entre voitures, peintures et jantes d'usine, réglages (répartition de freinage, équilibre, appui, rapport de pont) avec mesure en simulation.
- **Pipeline des vrais modèles 3D** (glTF + Draco/meshopt/KTX2), vérifié par un test aller-retour : voir `assets/cars/README.md`.

### Provisoire
- **Modèles 3D** : en attendant vos fichiers `.glb`, chaque voiture est une maquette procédurale à ses vraies dimensions, avec les signatures de la marque (calandre, feux, aileron). Ce n'est pas une reproduction fidèle ; c'est signalé dans le garage et en jeu.
- **Sons** : synthèse, pas d'enregistrements des vrais moteurs.
- **Non fait** : livrées, mains du pilote, clignotants et phares automatiques (avec les circuits de nuit, Phase 3), température et usure des pneus.

## Phase 1 (socle) — rappel
Rendu PBR, physique 240 Hz (pneus Pacejka, transferts de charge, aides), piste d'essai, 5 caméras + regard arrière, HUD, menu, clavier et manette.

## Structure

```
src/
  core/        boucle de jeu, entrées, qualité, sauvegarde
  physics/     modèle véhicule, pneus, collisions (aucune dépendance à Three.js → testable)
  cars/        un dossier par voiture (config.ts), maquettes procédurales, chargeur glTF, compteurs
  audio/       moteur audio et synthèse des sons de voiture
  garage/      garage / showroom
  game-modes/  session de conduite (courses en Phase 6)
  tracks/      pistes (Phase 1 : piste d'essai)
  camera/      caméras de conduite
  render/      renderer, ciel/éclairage, textures procédurales, effets pneus
  ui/          HUD, menu, styles
  ai/          (Phase 3+)
assets/cars, assets/tracks  modèles et textures (à venir)
tests/        tests unitaires de la physique
tools/        test navigateur ; scripts de génération des circuits (Phase 4)
```

Ajouter une voiture consiste à créer `src/cars/<id>/config.ts` (un `CarConfig` : physique, visuel, valeurs officielles), puis à l'ajouter dans `src/cars/registry.ts`.
