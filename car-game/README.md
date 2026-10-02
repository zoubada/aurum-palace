# Jeu de course 3D — Prototype (Phase 1)

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
| `npm run smoke` | Test navigateur (Playwright) sur le build : conduite, caméras, menu, erreurs console |

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

## État de la Phase 1

### Fait
- **Rendu** : PBR, ciel physique avec nuages, éclairage par image (IBL) cohérent avec le soleil, ombres qui suivent la voiture, bloom, tone mapping ACES. Presets Bas / Moyen / Élevé / Ultra et compteur FPS.
- **Physique** (`src/physics/vehicle.ts`), calculée à 240 Hz en pas fixe :
  - pneus Pacejka avec glissement combiné (ellipse d’adhérence), sensibilité à la charge et longueur de relaxation ;
  - transfert de charge longitudinal et latéral (répartition de raideur au roulis) et appui aéro ;
  - moteur avec courbe de couple, frein moteur, embrayage automatique, launch control et limiteur ;
  - boîte DCT/auto/manuelle avec temps de passage ;
  - différentiels à glissement limité et coupleur central pour la transmission intégrale (4×4) ;
  - ABS (régulation du glissement), antipatinage (régulateur PI), ESP (contrôle du lacet par freinage d’une roue), limiteur de braquage, contre-braquage (Arcade) ;
  - presets Arcade / Intermédiaire / Simulation.
- **Collisions** avec les murs : impulsions avec restitution et frottement. Cônes renversables.
- **Caméras** : poursuite, poursuite éloignée, cockpit (mouvement de tête selon les G), capot, pare-chocs, regard arrière. Effet de vitesse sur le champ de vision. Distance, hauteur et FOV réglables.
- **HUD** : vitesse, rapport, compte-tours avec shift lights, G-mètre, pédales, voyants ABS/TC/ESP. Télémétrie (F3).
- **Menu pause** : aides, graphismes, caméra et tableau des commandes. Réglages sauvegardés (localStorage).
- **Effets** : traces de pneus et fumée générées par le glissement réel des pneus.

### Mesures du prototype (tests automatiques)
| Mesure | Résultat | Cible |
|---|---|---|
| 0–100 km/h | 3,5 s | 3,9 s ± 0,5 |
| Vitesse max | 296 km/h | 290 km/h ± 5 % |
| 100–0 km/h avec ABS | 38,7 m | 30–40 m |
| 100–0 km/h roues bloquées | 40,8 m | > 38 m |
| Accélération latérale max (skidpad R50) | 1,01 g | 0,9–1,35 g |
| Glissement max sur sol glissant avec antipatinage | 0,13 | < 0,25 |

Ces cibles sont celles d’un **prototype fictif**. Les 7 vraies voitures seront testées contre leurs chiffres officiels en Phase 2.

### Provisoire / pas encore fait (prévu)
- **Voiture** : modèle procédural *placeholder* (signalé en jeu). Le pipeline glTF, les 7 vraies voitures, leurs intérieurs et leurs sons arrivent en **Phase 2**.
- **Piste** : zone d’essai plate (ligne droite, skidpad, slalom, boucle peinte). Les 3 circuits arrivent en **Phases 3 à 5**.
- **Physique** : sol plat, donc pas encore de relief, de dévers ni de vibreurs. Le roulis et le tangage sont calculés pour l’affichage, pas en 6 degrés de liberté. Température et usure des pneus : plus tard.
- **Moteurs** : Rapier sera intégré avec les glissières des circuits (Phase 3). La phase 1 utilise une collision maison contre les murs droits.
- **Rendu** : WebGPU pas encore branché (WebGL2 utilisé). Réflexions temps réel (SSR), occlusion ambiante, TAA, flou de mouvement, météo et cycle jour/nuit : **Phase 7**.
- **Commandes** : écran de réassignation des touches et retour de force du volant (Phase 7). Les volants fonctionnent déjà comme une manette.
- **Audio** : rien en Phase 1. Les sons moteur arrivent en Phase 2.

## Structure

```
src/
  core/        boucle de jeu, entrées, qualité, sauvegarde
  physics/     modèle véhicule, pneus, collisions (aucune dépendance à Three.js → testable)
  cars/        types de config, registre, rendu de la voiture ; un dossier par voiture
  tracks/      pistes (Phase 1 : piste d'essai)
  camera/      caméras de conduite
  render/      renderer, ciel/éclairage, textures procédurales, effets pneus
  ui/          HUD, menu, styles
  ai/ audio/ game-modes/   (phases suivantes)
assets/cars, assets/tracks  modèles et textures (à venir)
tests/        tests unitaires de la physique
tools/        test navigateur ; scripts de génération des circuits (Phase 4)
```

Ajouter une voiture consiste à créer `src/cars/<id>/config.ts` (un `CarConfig` : physique, visuel, valeurs officielles), puis à l'ajouter dans `src/cars/registry.ts`.
