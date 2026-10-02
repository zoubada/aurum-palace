# Modèles 3D des voitures

Déposez le modèle de chaque voiture ici : `assets/cars/<id>/model.glb`. Le jeu le charge automatiquement et remplace la voiture provisoire, dans le garage comme en conduite.

| Voiture | Dossier |
|---|---|
| Audi RS 3 Sportback (8Y) | `audi-rs3-8y/` |
| Audi RS 6 Avant performance (C8) | `audi-rs6-c8/` |
| Porsche 911 GT3 RS (992) | `porsche-911-gt3-rs-992/` |
| Ford Mustang GT (S650) | `ford-mustang-gt-s650/` |
| BMW M3 Competition (G80) | `bmw-m3-competition-g80/` |
| Nissan GT-R (R35) | `nissan-gt-r-r35/` |
| McLaren 720S | `mclaren-720s/` |

## Format

- **GLB** (glTF 2.0 binaire), en **mètres**, **+Y en haut**, **avant de la voiture vers +Z** (convention glTF).
- Compression acceptée : Draco ou meshopt pour la géométrie, KTX2 (Basis) pour les textures.
- Matériaux PBR (metallic/roughness). L'échelle et la position sont recalées automatiquement : l'empattement est mis à la vraie valeur et les roues sont posées sur les essieux de la physique.

## Noms des nœuds (obligatoires en gras)

| Nœud | Rôle |
|---|---|
| **`wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`** | Roue complète (pneu + jante + disque), origine au centre du moyeu. Tourne et braque. |
| `caliper_FL` … `caliper_RR` | Étriers : suivent le braquage mais ne tournent pas. |
| `steering_wheel` | Volant, axe Z local = axe de la colonne. |

Les nœuds sans maillage (`driver_eye`, `exhaust_tip_N`) doivent survivre à l'optimisation : `prune({ keepLeaves: true })`.
| `door_L`, `door_R` | Portes, origine sur la charnière (ouverture dans le garage). |
| `wing_active` | Aileron mobile, rotation autour de X local (DRS / aérofrein). |
| `mirror_L`, `mirror_R`, `mirror_interior` | Maillages des glaces de rétroviseurs (reçoivent l'image temps réel). |
| `dash_screen` | Écran du combiné d'instruments (reçoit l'affichage animé ; UV glTF, origine en haut à gauche). |
| `exhaust_tip_0`, `exhaust_tip_1`… | Sorties d'échappement (flammes). |
| `driver_eye` | Position des yeux du pilote (caméra cockpit). |
| `hide_in_cockpit…` | Éléments masqués en vue cockpit (appui-tête, etc.). |

## Noms des matériaux

| Contient | Effet |
|---|---|
| `paint` | Peinture carrosserie (vernis ajouté, couleur choisie au garage). |
| `light_brake` / `brake_light` / `taillight` | Feux stop (s'allument au freinage). |
| `reverse` | Feux de recul. |
| `light_head` / `drl` | Phares et feux de jour. |
| `rim` | Jantes (couleur choisie au garage). |
| `caliper` | Étriers. |
| `disc` / `rotor` | Disques de frein (rougissent quand ils chauffent). |
| préfixe `int_` | Habitacle : reflets du ciel atténués (toit et montants le cachent). |

Le test `window.__debug.gltfRoundTrip('<id>')` exporte la voiture provisoire au format ci-dessus puis la recharge par ce même chargeur ; il sert de modèle de référence.
