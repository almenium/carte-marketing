import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { api } from "../lib/api.js";
import FilterPanel from "../components/FilterPanel.jsx";
import Legend from "../components/Legend.jsx";
import { exportCsv } from "../lib/csvExport.js";
import { getDepartementCode, isInZone, computeCentroid } from "../lib/departementUtils.js";

const AGG_ZOOM_THRESHOLD = 7; // équivalent du seuil 9 de l'original (carte moins zoomée par défaut ici)
const NON_ATTRIBUE_COLOR = "#cccccc";

export default function CarteFrance() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const choroplethLayer = useRef(null);
  const badgeLayer = useRef(null);
  const clientClusterLayer = useRef(null);

  const [geojson, setGeojson] = useState(null);
  const [clients, setClients] = useState([]);
  const [deptPrincipal, setDeptPrincipal] = useState({});
  const [deptSecondaire, setDeptSecondaire] = useState({});
  const [checkedCommerciaux, setCheckedCommerciaux] = useState(new Set());
  const [onlyOutOfZone, setOnlyOutOfZone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.departementsGeojson(),
      api.clientsFrance(),
      api.departementsPrincipal(),
      api.departementsSecondaire(),
    ])
      .then(([geo, cli, principal, secondaire]) => {
        setGeojson(geo);
        setClients(cli);
        setDeptPrincipal(principal);
        setDeptSecondaire(secondaire);
        const managers = [...new Set(cli.map((c) => c.accountManager))].sort();
        setCheckedCommerciaux(new Set(managers));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Enrichit chaque client avec département déduit + statut hors périmètre
  const enrichedClients = useMemo(() => {
    return clients.map((c) => {
      const departement = c.departement || getDepartementCode(c.postalCode);
      const horsPerimetre = !isInZone({
        commercial: c.accountManager,
        departement,
        departementsPrincipal: deptPrincipal,
        departementsSecondaire: deptSecondaire,
      });
      return { ...c, departementDeduit: departement, horsPerimetre };
    });
  }, [clients, deptPrincipal, deptSecondaire]);

  const commerciauxPresents = useMemo(() => {
    const map = new Map();
    for (const c of enrichedClients) {
      if (!map.has(c.accountManager)) map.set(c.accountManager, c.couleurCommercial);
    }
    return [...map.entries()]
      .map(([nom, couleur]) => ({ value: nom, label: nom, color: couleur }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enrichedClients]);

  const filteredClients = useMemo(() => {
    return enrichedClients
      .filter((c) => checkedCommerciaux.has(c.accountManager))
      .filter((c) => (onlyOutOfZone ? c.horsPerimetre : true));
  }, [enrichedClients, checkedCommerciaux, onlyOutOfZone]);

  // --- Initialisation carte (une seule fois) ---
  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current).setView([46.6, 2.4], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    mapInstance.current = map;
    badgeLayer.current = L.layerGroup();
    clientClusterLayer.current = L.markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true });

    const updateVisibility = () => {
      const zoom = map.getZoom();
      if (zoom < AGG_ZOOM_THRESHOLD) {
        if (!map.hasLayer(badgeLayer.current)) map.addLayer(badgeLayer.current);
        if (map.hasLayer(clientClusterLayer.current)) map.removeLayer(clientClusterLayer.current);
      } else {
        if (map.hasLayer(badgeLayer.current)) map.removeLayer(badgeLayer.current);
        if (!map.hasLayer(clientClusterLayer.current)) map.addLayer(clientClusterLayer.current);
      }
    };
    map.on("zoomend", updateVisibility);
    updateVisibility();

    return () => {
      map.off("zoomend", updateVisibility);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // --- Choropleth des départements ---
  useEffect(() => {
    if (!mapInstance.current || !geojson) return;
    if (choroplethLayer.current) {
      mapInstance.current.removeLayer(choroplethLayer.current);
    }
    choroplethLayer.current = L.geoJSON(geojson, {
      style: (feature) => {
        const info = deptPrincipal[feature.properties.code];
        return {
          fillColor: info ? info.couleur : NON_ATTRIBUE_COLOR,
          fillOpacity: 0.45,
          color: "#555",
          weight: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const info = deptPrincipal[feature.properties.code];
        layer.bindTooltip(
          `${feature.properties.nom} (${feature.properties.code})<br/>${info ? info.commercial : "Non attribué"}`
        );
      },
    }).addTo(mapInstance.current);
  }, [geojson, deptPrincipal]);

  // --- Badges agrégés par département x commercial (vue dézoomée) ---
  useEffect(() => {
    if (!mapInstance.current || !geojson) return;
    badgeLayer.current.clearLayers();

    const parDeptCommercial = new Map(); // "dept|commercial" -> { count, hors, couleur, nom }
    for (const c of filteredClients) {
      if (!c.departementDeduit) continue;
      const key = `${c.departementDeduit}|${c.accountManager}`;
      if (!parDeptCommercial.has(key)) {
        parDeptCommercial.set(key, { count: 0, hors: 0, couleur: c.couleurCommercial, nom: c.accountManager, dept: c.departementDeduit });
      }
      const entry = parDeptCommercial.get(key);
      entry.count += 1;
      if (c.horsPerimetre) entry.hors += 1;
    }

    const featureByCode = {};
    for (const f of geojson.features) featureByCode[f.properties.code] = f;

    // regroupe par département pour décaler les badges si plusieurs commerciaux
    const parDept = new Map();
    for (const entry of parDeptCommercial.values()) {
      if (!parDept.has(entry.dept)) parDept.set(entry.dept, []);
      parDept.get(entry.dept).push(entry);
    }

    for (const [dept, entries] of parDept.entries()) {
      const feature = featureByCode[dept];
      if (!feature) continue;
      const centroid = computeCentroid(feature);
      if (!centroid) continue;

      entries.forEach((entry, idx) => {
        const offset = (idx - (entries.length - 1) / 2) * 0.18;
        const anomalie = entry.hors > 0;
        const icon = L.divIcon({
          className: "dept-badge" + (anomalie ? " dept-badge--anomalie" : ""),
          html: `<div style="background:${entry.couleur}">${entry.count}</div>`,
          iconSize: [30, 30],
        });
        const marker = L.marker([centroid[0], centroid[1] + offset], { icon });
        marker.bindPopup(
          `<strong>${entry.nom}</strong><br/>${entry.count} client(s) dans le département ${dept}${anomalie ? `<br/><span style="color:#e74c3c">⚠ ${entry.hors} hors périmètre</span>` : ""}`
        );
        badgeLayer.current.addLayer(marker);
      });
    }
  }, [filteredClients, geojson]);

  // --- Marqueurs clients individuels (vue zoomée) ---
  useEffect(() => {
    if (!mapInstance.current) return;
    clientClusterLayer.current.clearLayers();
    for (const c of filteredClients) {
      if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
      const icon = L.divIcon({
        className: "client-marker" + (c.horsPerimetre ? " client-marker--anomalie" : ""),
        html: `<span style="background:${c.couleurCommercial}"></span>`,
        iconSize: [14, 14],
      });
      const marker = L.marker([c.latitude, c.longitude], { icon });
      marker.bindPopup(
        `<strong>${c.name}</strong><br/>Compte : ${c.accountId}<br/>${c.postalCode} ${c.city}<br/>Commercial : ${c.accountManager}` +
          (c.horsPerimetre ? `<br/><span style="color:#e74c3c">⚠ Hors périmètre</span>` : "")
      );
      clientClusterLayer.current.addLayer(marker);
    }
  }, [filteredClients]);

  const toggleCommercial = (value) => {
    setCheckedCommerciaux((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  // Légende : effectifs par commercial, en tenant compte du filtre par commercial (pas de onlyOutOfZone)
  const legendRows = useMemo(() => {
    const base = enrichedClients.filter((c) => checkedCommerciaux.has(c.accountManager));
    return commerciauxPresents
      .filter((cp) => checkedCommerciaux.has(cp.value))
      .map((cp) => {
        const clientsCommercial = base.filter((c) => c.accountManager === cp.value);
        const hors = clientsCommercial.filter((c) => c.horsPerimetre).length;
        return {
          label: cp.label,
          color: cp.color,
          count: clientsCommercial.length,
          extra: hors > 0 ? `+${hors} hors zone` : null,
        };
      });
  }, [enrichedClients, commerciauxPresents, checkedCommerciaux]);

  const handleExportDetail = () => {
    const parDeptCommercial = new Map();
    for (const c of enrichedClients) {
      if (!c.departementDeduit) continue;
      const key = `${c.departementDeduit}|${c.accountManager}`;
      if (!parDeptCommercial.has(key)) {
        parDeptCommercial.set(key, { count: 0, dept: c.departementDeduit, commercial: c.accountManager });
      }
      parDeptCommercial.get(key).count += 1;
    }
    const rows = [...parDeptCommercial.values()]
      .sort((a, b) => a.dept.localeCompare(b.dept))
      .map((entry) => {
        const attendu = deptPrincipal[entry.dept]?.commercial || "Non attribué";
        return {
          Departement: entry.dept,
          Commercial: entry.commercial,
          NombreClients: entry.count,
          CommercialAttendu: attendu,
          En_Zone: attendu === entry.commercial ? "Oui" : "Non",
        };
      });
    exportCsv("carte_france_detail", rows);
  };

  const handleExportHorsZone = () => {
    const rows = filteredClients
      .filter((c) => c.horsPerimetre)
      .map((c) => ({
        Nom: c.name,
        Compte: c.accountId,
        Departement: c.departementDeduit || "",
        CodePostal: c.postalCode,
        Ville: c.city,
        Commercial: c.accountManager,
      }));
    exportCsv("carte_france_hors_zone", rows);
  };

  return (
    <div className="map-page">
      {error && <div className="banner banner--error">{error}</div>}
      {loading && <div className="banner">Chargement…</div>}

      <div className="map-toolbar">
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={onlyOutOfZone}
            onChange={(e) => setOnlyOutOfZone(e.target.checked)}
          />
          Afficher uniquement les clients hors périmètre
        </label>
        <div className="map-toolbar__actions">
          <button type="button" onClick={handleExportDetail}>
            Exporter le détail (CSV)
          </button>
          <button type="button" onClick={handleExportHorsZone}>
            Exporter les clients hors zone (CSV)
          </button>
        </div>
      </div>

      <div ref={mapRef} className="map-container" />

      <div className="map-overlay map-overlay--top-left">
        <FilterPanel
          title="Commerciaux"
          items={commerciauxPresents}
          checked={checkedCommerciaux}
          onToggle={toggleCommercial}
          onAll={() => setCheckedCommerciaux(new Set(commerciauxPresents.map((c) => c.value)))}
          onNone={() => setCheckedCommerciaux(new Set())}
        />
      </div>
      <div className="map-overlay map-overlay--bottom-right">
        <Legend rows={legendRows} />
      </div>
    </div>
  );
}
