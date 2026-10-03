/**
 * Ground features of the Annecy circuit from OpenStreetMap, near the route: zebra crossings on
 * the race road, and around it the lawns and parks (the Pâquier), sports pitches (football,
 * tennis…), beaches, swimming pools, squares and car parks, canals and rivers, footpaths, and
 * the pontoons / piers on the lake.
 */

/** Area kinds (runtime: src/tracks/annecy/landscape.ts). */
export const AREA = { GRASS: 1, SOCCER: 2, PITCH: 3, SAND: 4, PARKING: 5, PLAZA: 6, WATER: 7, POOL: 8, FLOWERS: 9, CLAY: 10 };

export function areaKind(t) {
  if (t.leisure === 'pitch') {
    if (t.sport === 'soccer' || t.sport === 'football') return AREA.SOCCER;
    if (/clay/.test(t.surface ?? '')) return AREA.CLAY;
    return AREA.PITCH;
  }
  if (t.leisure === 'swimming_pool') return AREA.POOL;
  if (t.natural === 'beach' || t.leisure === 'beach_resort' || t.natural === 'sand') return AREA.SAND;
  if (t.amenity === 'parking' && t.parking !== 'underground' && t.parking !== 'multi-storey') return AREA.PARKING;
  if ((t.highway === 'pedestrian' && t.area === 'yes') || t.place === 'square' || (t.area === 'yes' && t.highway === 'footway')) return AREA.PLAZA;
  if ((t.natural === 'water' && !/lake/.test(t.water ?? '')) || t.waterway === 'riverbank' || (t.waterway === 'canal' && t.area === 'yes')) return AREA.WATER;
  if (t.landuse === 'flowerbed') return AREA.FLOWERS;
  if (/^(grass|village_green|recreation_ground)$/.test(t.landuse ?? '') || /^(park|playground|dog_park)$/.test(t.leisure ?? '')) return AREA.GRASS;
  return 0;
}

/** Draw order: later kinds on top (a pitch inside a park, a pool in a garden). */
export const AREA_ORDER = [AREA.GRASS, AREA.FLOWERS, AREA.PARKING, AREA.PLAZA, AREA.SAND, AREA.WATER, AREA.PITCH, AREA.CLAY, AREA.SOCCER, AREA.POOL];

export function pathWidth(t) {
  const w = Number.parseFloat(t.width);
  if (w > 0.8 && w < 12) return w;
  if (t.highway === 'pedestrian') return 5;
  if (t.highway === 'cycleway') return 2.6;
  if (t.highway === 'steps') return 2;
  return t.highway === 'path' ? 1.8 : 2.4;
}

export const isPath = (t) => /^(footway|path|pedestrian|cycleway|steps|bridleway)$/.test(t.highway ?? '') && t.area !== 'yes' && t.footway !== 'sidewalk' && t.footway !== 'crossing' && t.cycleway !== 'crossing';

export const isPier = (t) => t.man_made === 'pier' || t.man_made === 'jetty' || t.man_made === 'breakwater';

/** Marked crossing (zebra) on a node of the road. */
export const isZebra = (t) => (t.highway === 'crossing' || t.crossing) && !/unmarked|informal|no/.test(t.crossing ?? '') && t['crossing:markings'] !== 'no';
