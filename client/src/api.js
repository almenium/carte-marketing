const BASE = "/api";

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur API (${res.status}) sur ${url}`);
  return res.json();
}

export const api = {
  clientsMonde: () => getJSON(`${BASE}/clients/monde`),
  clientsFrance: (country = "France") =>
    getJSON(`${BASE}/clients/france?country=${encodeURIComponent(country)}`),
  departementsGeojson: () => getJSON(`${BASE}/departements-geojson`),
  commerciauxReferentiel: () => getJSON(`${BASE}/commerciaux`),
  departementsPrincipal: () => getJSON(`${BASE}/commerciaux/departements-principal`),
  departementsSecondaire: () => getJSON(`${BASE}/commerciaux/departements-secondaire`),

  async saveCommercial(payload) {
    const res = await fetch(`${BASE}/commerciaux`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Erreur lors de l'enregistrement.");
    }
    return data.commercial;
  },

  async deleteCommercial(nom) {
    const res = await fetch(`${BASE}/commerciaux/${encodeURIComponent(nom)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Erreur lors de la suppression.");
    }
    return true;
  },
};
