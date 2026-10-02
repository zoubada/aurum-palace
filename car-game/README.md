# Jeu de course 3D — Prototype (Phases 1 à 4)

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
| `npm test` | Tests unitaires : physique (0–100, vitesse max, freinage, aides, collisions), circuit, chronos, IA |
| `npm run build` | Vérification des types + build de production dans `dist/` |
| `npm run preview` | Sert le build sur http://localhost:4173 |
| `npm run smoke` | Test navigateur (Playwright) sur le build : garage, piste d'essai, ville de nuit sous la pluie avec IA, feux de départ, tunnel, lac d'Annecy (sprint), menu, pipeline glTF, son, erreurs console |
| `npm run data:annecy` | Régénère le circuit d'Annecy depuis OpenStreetMap et l'IGN (voir `tools/annecy/README.md`) |

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

### Phase 4 (circuit 2 : tour du lac d'Annecy, données réelles) — fait
- **Tracé réel de 37,5 km** calculé sur les routes OpenStreetMap : départ avenue d'Albigny à Annecy, quai Eustache-Chappuis, **D1508** par Sévrier, Saint-Jorioz et Duingt jusqu'à Doussard, puis **D909a / D909** par Talloires, les lacets du Thoron, Menthon-Saint-Bernard et Veyrier-du-Lac. Sens antihoraire, une vingtaine de ronds-points, ponts. Largeurs d'après le nombre de voies, élargies dans les épingles.
- **Relief réel** (IGN RGE ALTI) : la route monte de 448 à 557 m ; montagnes autour du lac (Semnoz, Tournette, Dents de Lanfon…) sur 48 km.
- **Photos aériennes IGN** (≈ 1 m/pixel) sur le terrain, avec un grain de détail près de la caméra.
- **Arbres à leurs vraies positions** (≈ 100 000 dans les 185 m autour de la route), hauteur mesurée par le modèle de surface de l'IGN, couleur prise sur la photo. Au-delà, forêts et villages en volume grâce au même modèle de surface.
- **≈ 7 900 bâtiments** OpenStreetMap à leur hauteur mesurée, toits à quatre pans ou plats, couleur de toit tirée de la photo, fenêtres et volets.
- **Lac** au contour réel : reflets réels des montagnes en qualité Élevée / Ultra, eau transparente sinon.
- **Bord de route** : marquages français (tirets de 3 m / 10 m, ligne continue en virage, rien dans les ronds-points), accotements, glissières sur poteaux, trottoirs et murets dans les villages, ponts, **panneaux d'entrée et de sortie des villages** aux emplacements OSM.
- **Chargement par zones** (cases de 1 km autour de la caméra, 3 niveaux de détail, libérées quand on s'éloigne) + montagnes en basse résolution au loin.
- **Heure réglable** (matin, midi, fin d'après-midi, coucher du soleil) avec la vraie position du soleil à Annecy fin juin ; **pluie** (ciel couvert, route mouillée, adhérence réduite).
- **Parcours** : tour complet, ou **sprints** rive ouest (Annecy → Doussard, 18 km) et rive est (Doussard → Annecy, 19,5 km).
- Ambiance sonore : vent, oiseaux (par beau temps), pluie.
- L'IA fait le tour complet sans accrochage (911 GT3 RS : 13 min 40 s, 164 km/h de moyenne).

#### Provisoire / limites (Phase 4)
- **Arbres et bâtiments simplifiés** : formes génériques (sapins, feuillus, maisons à toit en croupe), pas de modèles 3D détaillés ni de végétation au sol (herbes, buissons).
- **Photos aériennes** : prises du ciel, elles contiennent leurs propres ombres et voitures garées ; de près, le sol reste un peu flou.
- **Pas encore** : port et bateaux, voies vertes, lampadaires et mobilier urbain, tunnel (le parcours n'en a pas), autres routes en 3D (elles sont visibles sur la photo). Les murs de la course sont continus (route fermée).
- **Données** : le cache de téléchargement n'est pas versionné ; `npm run data:annecy` le reconstruit.
- Fluidité non mesurée ici (pas de carte graphique dans mon environnement) : sur MacBook Air, la qualité **Moyen** est conseillée sur ce circuit.

### Phase 3 (circuit 1 : Métropole de nuit) — fait
- **Circuit de 4,9 km** tracé par une spline (`src/tracks/city/layout.ts`) : boulevard de départ, chicane, montée sur un **pont à haubans** à 14 m au-dessus du fleuve, épingle en descente, **tunnel sous le fleuve** (−12 m), enchaînement entre les tours, **viaduc** relevé, retour sur le boulevard. Relief, dévers, bordures, murs, grillages, panneaux de sponsors (fictifs), trottoirs, ligne de départ et grille.
- **Ville générée** autour : rues en damier, fleuve et quais, tours avec fenêtres éclairées (calculées dans le shader), enseignes au néon, écrans LED animés, feux d'obstacle clignotants, circulation, piétons et feux tricolores décoratifs.
- **Éclairage de nuit** : ciel étoilé, lune (ombres), halo orangé de la ville, brume ; chaque lampadaire éclaire la route, et les plus proches de la caméra deviennent de vraies lumières qui éclairent aussi les voitures (leur nombre dépend de la qualité). Phares de la voiture du joueur, pinceaux de phares des adversaires. Les reflets des voitures et de la route mouillée viennent de la ville elle-même.
- **Tunnel** : éclairage propre, adaptation des yeux à l'entrée et à la sortie (exposition), écho du son.
- **Pluie** (au choix dans le garage) : route mouillée et brillante, gerbes d'eau, pluie qui tombe, brume plus dense, moins d'adhérence (×0,78), bruit de pluie.
- **Physique du relief** : la voiture suit les pentes, les bosses et les dévers (charge des pneus, gravité), adhérence différente sur les bordures et les dégagements, murs du circuit, chocs entre voitures.
- **Chronos** : tours, 3 secteurs (violet = meilleur secteur), dernier et meilleur tour (sauvegardés par voiture, circuit et météo), points de passage tous les 250 m, **tour invalidé** en cas de sortie de piste ou de raccourci.
- **IA de base** (0 à 5 adversaires) : trajectoire idéale calculée, vitesse limite de chaque voiture en chaque point, mêmes pneus et mêmes aides que le joueur, aucun « élastique » ; ralentit derrière une voiture et se décale pour passer. **Feux de départ**, position en course, mini-carte.
- **Trajectoire idéale** affichable (menu pause) : verte = accélérer, jaune = lever le pied, rouge = freiner.
- Tours de l'IA mesurés par les tests (adhérence 95 %, sec) :

| Voiture (IA) | Tour |
|---|---|
| McLaren 720S | 1:53.2 |
| Porsche 911 GT3 RS | 1:56.0 (pluie : 2:03.9) |
| Nissan GT-R | 2:03.8 |
| BMW M3 Competition | 2:04.8 |
| Audi RS 6 performance | 2:07.8 |
| Audi RS 3 | 2:09.7 |
| Ford Mustang GT | 2:10.8 |

#### Provisoire / limites (Phase 3)
- **Bâtiments** : volumes simples avec fenêtres dessinées par le shader, pas de façades détaillées ni de modèles 3D d'architecture.
- **IA** : pas encore de vraie stratégie de dépassement ni de défense (Phase 6) ; en peloton, une voiture rapide peut rester bloquée derrière une plus lente.
- **Courses** : pour l'instant c'est un « essai libre » chronométré avec adversaires ; course avec nombre de tours, classement final, fantôme et championnat arrivent en Phase 6.
- **Reflets** : la ville est capturée une fois depuis un point du boulevard ; les reflets ne suivent pas exactement la position de la voiture.
- **Physique** : Rapier n'est pas utilisé ; les collisions (murs du circuit, voitures) sont calculées par notre propre code à partir de la spline (point par point le long de la courbe), plus simple et plus rapide pour un circuit routier.

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
- **Non fait** : livrées, mains du pilote, clignotants, température et usure des pneus.

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
  game-modes/  session de conduite, monde de course (physique de toutes les voitures, chronos)
  tracks/      spline de circuit, chronométrage, génération de la route ; city/ = circuit 1 ;
               annecy/ = circuit 2 (terrain par zones, arbres, bâtiments, lac) ; piste d'essai
  camera/      caméras de conduite
  render/      renderer, ciel de jour / de nuit, phares, pluie, textures procédurales, effets pneus
  ui/          HUD, tour de chronométrage et mini-carte, menu, styles
  ai/          trajectoire idéale, profil de vitesse, pilote IA
assets/cars                 modèles 3D des voitures (à fournir)
assets/tracks/annecy        données du circuit d'Annecy générées depuis OSM et l'IGN (≈ 28 Mo)
tests/        tests unitaires de la physique
tools/        test navigateur ; tools/annecy = récupération et conversion des données OSM / IGN
```

Ajouter une voiture consiste à créer `src/cars/<id>/config.ts` (un `CarConfig` : physique, visuel, valeurs officielles), puis à l'ajouter dans `src/cars/registry.ts`.

Ajouter un circuit consiste à créer un dossier `src/tracks/<id>/` avec son tracé (points de contrôle : position, altitude, largeur, dévers, zone pont/tunnel/viaduc) et une classe qui implémente `TrackScene` (décor, éclairage, grille de départ), puis à l'ajouter au choix du garage.
