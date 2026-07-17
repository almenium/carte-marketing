import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const emptyForm = { nom: "", couleur: "#3498db", departement: "" };

export default function ParametrageCommerciaux() {
  const [tab, setTab] = useState("liste");
  const [departements, setDepartements] = useState([]);
  const [commerciaux, setCommerciaux] = useState([]);
  const [rows, setRows] = useState({}); // état d'édition par ligne (clé = nom original)
  const [message, setMessage] = useState(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const chargerDonnees = () => {
    setLoading(true);
    return api
      .commerciauxReferentiel()
      .then((data) => {
        setDepartements(data.departements);
        setCommerciaux(data.commerciaux);
        const initRows = {};
        for (const c of data.commerciaux) {
          initRows[c.nom] = {
            nom: c.nom,
            couleur: c.couleur,
            zonePrincipale: [...c.zonePrincipale],
            zoneSecondaire: [...c.zoneSecondaire],
          };
        }
        setRows(initRows);
      })
      .catch((err) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const updateRow = (nomOriginal, patch) => {
    setRows((prev) => ({ ...prev, [nomOriginal]: { ...prev[nomOriginal], ...patch } }));
  };

  const handleSelectMultiple = (event) => {
    return [...event.target.selectedOptions].map((o) => o.value);
  };

  const handleSave = async (nomOriginal) => {
    const row = rows[nomOriginal];
    try {
      await api.saveCommercial({
        nom: row.nom,
        ancienNom: nomOriginal,
        couleur: row.couleur,
        zonePrincipale: row.zonePrincipale,
        zoneSecondaire: row.zoneSecondaire,
      });
      setMessage({ type: "success", text: `Commercial "${row.nom}" enregistré.` });
      chargerDonnees();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  const handleDelete = async (nom) => {
    if (!window.confirm(`Supprimer le commercial "${nom}" ? Cette action est irréversible.`)) return;
    try {
      await api.deleteCommercial(nom);
      setMessage({ type: "success", text: `Commercial "${nom}" supprimé.` });
      chargerDonnees();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.saveCommercial({
        nom: createForm.nom,
        couleur: createForm.couleur,
        zonePrincipale: createForm.departement ? [createForm.departement] : [],
        zoneSecondaire: [],
      });
      setMessage({ type: "success", text: `Commercial "${createForm.nom}" créé.` });
      setCreateForm(emptyForm);
      setTab("liste");
      chargerDonnees();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  return (
    <div className="param-page">
      <div className="tabs">
        <button className={tab === "liste" ? "active" : ""} onClick={() => setTab("liste")}>
          Commerciaux
        </button>
        <button className={tab === "nouveau" ? "active" : ""} onClick={() => setTab("nouveau")}>
          Nouveau commercial
        </button>
      </div>

      {message && (
        <div className={`banner ${message.type === "error" ? "banner--error" : "banner--success"}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p>Chargement…</p>
      ) : tab === "liste" ? (
        <table className="commerciaux-table">
          <thead>
            <tr>
              <th>Commercial</th>
              <th>Couleur</th>
              <th>Zone principale</th>
              <th>Zone secondaire</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {commerciaux.map((c) => {
              const row = rows[c.nom] || {};
              return (
                <tr key={c.nom}>
                  <td>
                    <input
                      type="text"
                      value={row.nom ?? ""}
                      onChange={(e) => updateRow(c.nom, { nom: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="color"
                      value={row.couleur ?? "#000000"}
                      onChange={(e) => updateRow(c.nom, { couleur: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      multiple
                      size={5}
                      value={row.zonePrincipale ?? []}
                      onChange={(e) => updateRow(c.nom, { zonePrincipale: handleSelectMultiple(e) })}
                    >
                      {departements.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code} — {d.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      multiple
                      size={5}
                      value={row.zoneSecondaire ?? []}
                      onChange={(e) => updateRow(c.nom, { zoneSecondaire: handleSelectMultiple(e) })}
                    >
                      {departements.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code} — {d.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="commerciaux-table__actions">
                    <button type="button" onClick={() => handleSave(c.nom)}>
                      Enregistrer
                    </button>
                    <button type="button" className="danger" onClick={() => handleDelete(c.nom)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <form className="create-form" onSubmit={handleCreate}>
          <label>
            Nom
            <input
              type="text"
              value={createForm.nom}
              onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))}
              required
            />
          </label>
          <label>
            Couleur
            <input
              type="color"
              value={createForm.couleur}
              onChange={(e) => setCreateForm((f) => ({ ...f, couleur: e.target.value }))}
            />
          </label>
          <label>
            Département (optionnel)
            <select
              value={createForm.departement}
              onChange={(e) => setCreateForm((f) => ({ ...f, departement: e.target.value }))}
            >
              <option value="">— Aucun —</option>
              {departements.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.nom}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Créer</button>
        </form>
      )}
    </div>
  );
}
