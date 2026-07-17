import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { api } from "../lib/api.js";
import FilterPanel from "../components/FilterPanel.jsx";
import Legend from "../components/Legend.jsx";

// Vert = actif, Rouge = dormant, Jaune = consommateur (cf. documentation utilisateur)
const STATUTS = [
  { value: "Active Customer", label: "Client actif", color: "#2ecc71" },
  { value: "Sleeping Customer", label: "Client dormant", color: "#e74c3c" },
  { value: "Consumer", label: "Consommateur", color: "#f1c40f" },
];

function makeColoredIcon(color) {
  return L.divIcon({
    className: "client-marker",
    html: `<span style="background:${color}"></span>`,
    iconSize: [14, 14],
  });
}

export default function CarteMonde() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const clusterGroups = useRef({});
  const [clients, setClients] = useState([]);
  const [checked, setChecked] = useState(new Set(STATUTS.map((s) => s.value)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .clientsMonde()
      .then(setClients)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Initialise la carte une seule fois
  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current).setView([25, 10], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    mapInstance.current = map;

    // un markerClusterGroup dédié par statut, pour éviter qu'un cluster mixte
    // n'affiche une couleur "majoritaire" trompeuse (cf. doc technique)
    for (const s of STATUTS) {
      clusterGroups.current[s.value] = L.markerClusterGroup({
        iconCreateFunction: (cluster) =>
          L.divIcon({
            html: `<div style="background:${s.color}">${cluster.getChildCount()}</div>`,
            className: "cluster-marker",
            iconSize: [36, 36],
          }),
      });
    }

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Reconstruit les marqueurs quand les données arrivent
  useEffect(() => {
    if (!mapInstance.current || clients.length === 0) return;
    for (const s of STATUTS) {
      clusterGroups.current[s.value].clearLayers();
    }
    for (const client of clients) {
      const statut = STATUTS.find((s) => s.value === client.type);
      if (!statut) continue;
      const marker = L.marker([client.latitude, client.longitude], {
        icon: makeColoredIcon(statut.color),
      });
      marker.bindPopup(
        `<strong>${client.name}</strong><br/>Compte : ${client.accountId}<br/>${client.address ? client.address + "<br/>" : ""}${client.postalCode} ${client.city}, ${client.country}<br/>Commercial : ${client.accountManager}<br/>Livraison : ${client.locationsShipping || "-"}`
      );
      clusterGroups.current[statut.value].addLayer(marker);
    }
  }, [clients]);

  // Applique le filtre (affiche/masque les couches)
  useEffect(() => {
    if (!mapInstance.current) return;
    for (const s of STATUTS) {
      const layer = clusterGroups.current[s.value];
      if (checked.has(s.value)) {
        if (!mapInstance.current.hasLayer(layer)) mapInstance.current.addLayer(layer);
      } else {
        if (mapInstance.current.hasLayer(layer)) mapInstance.current.removeLayer(layer);
      }
    }
  }, [checked]);

  const toggle = (value) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  // La légende reflète toujours la totalité des données, indépendamment des cases cochées
  const counts = STATUTS.map((s) => ({
    label: s.label,
    color: s.color,
    count: clients.filter((c) => c.type === s.value).length,
  }));

  return (
    <div className="map-page">
      {error && <div className="banner banner--error">{error}</div>}
      {loading && <div className="banner">Chargement des clients…</div>}
      <div ref={mapRef} className="map-container" />
      <div className="map-overlay map-overlay--top-left">
        <FilterPanel
          title="Statuts"
          items={STATUTS}
          checked={checked}
          onToggle={toggle}
          onAll={() => setChecked(new Set(STATUTS.map((s) => s.value)))}
          onNone={() => setChecked(new Set())}
        />
      </div>
      <div className="map-overlay map-overlay--bottom-right">
        <Legend rows={counts} total={clients.length} />
      </div>
    </div>
  );
}
