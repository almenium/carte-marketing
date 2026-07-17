/**
 * Déduit le code département à partir d'un code postal français.
 * Porté depuis l'ancienne fonction getDepartementCode() (carte_france.js) :
 * - DOM : préfixe à 3 chiffres (971, 972, 973, 974, 976)
 * - Corse : 2A si code postal <= 20190, sinon 2B
 * - Cas général : 2 premiers chiffres du code postal
 */
export function getDepartementCode(postalCode) {
  if (!postalCode) return null;
  const cp = String(postalCode).trim();
  if (cp.length < 4) return null;

  const prefixe3 = cp.slice(0, 3);
  if (["971", "972", "973", "974", "976"].includes(prefixe3)) {
    return prefixe3;
  }

  const prefixe2 = cp.slice(0, 2);
  if (prefixe2 === "20") {
    const codeNum = parseInt(cp, 10);
    return codeNum <= 20190 ? "2A" : "2B";
  }

  return prefixe2;
}

/**
 * Normalise un nom de commercial pour comparaison insensible à la casse/aux espaces.
 */
export function normalizeManager(nom) {
  return (nom || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Commerciaux réputés "en zone" par construction (ex. commerciaux export/spécifiques
 * sans secteur géographique attribué), pour éviter les faux positifs "hors périmètre".
 * À adapter selon votre organisation.
 */
export const NO_SECTOR_MANAGERS = ["export zone"];

/**
 * Un commercial est "en zone" sur un département s'il en est responsable principal
 * OU s'il y est déclaré en secondaire.
 */
export function isInZone({ commercial, departement, departementsPrincipal, departementsSecondaire }) {
  const norm = normalizeManager(commercial);
  if (NO_SECTOR_MANAGERS.includes(norm)) return true;
  if (!departement) return false;

  const principal = departementsPrincipal[departement];
  if (principal && normalizeManager(principal.commercial) === norm) return true;

  const secondaires = departementsSecondaire[departement] || [];
  if (secondaires.some((c) => normalizeManager(c) === norm)) return true;

  return false;
}

/**
 * Calcule le centroïde pondéré par l'aire d'un polygone/multipolygone GeoJSON.
 * Pour un MultiPolygon, on utilise le plus grand anneau (approximation acceptable
 * pour le placement d'un badge, pas un calcul cartographique exact).
 */
export function computeCentroid(feature) {
  const { geometry } = feature;
  if (!geometry) return null;

  const rings =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((poly) => poly[0]);

  let best = null;
  let bestArea = -Infinity;
  for (const ring of rings) {
    const { centroid, area } = ringCentroid(ring);
    if (Math.abs(area) > Math.abs(bestArea)) {
      bestArea = area;
      best = centroid;
    }
  }
  return best; // [lat, lon]
}

function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area = area / 2;
  if (area === 0) {
    // polygone dégénéré : repli sur la moyenne simple des points
    const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return { centroid: [lat, lon], area: 0 };
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return { centroid: [cy, cx], area }; // GeoJSON = [lon, lat] -> Leaflet = [lat, lon]
}
