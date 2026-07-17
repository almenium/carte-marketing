import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  listCommerciaux,
  saveCommercial,
  deleteCommercial,
  getDepartementsCommercialPrincipal,
  getDepartementsCommerciauxSecondaires,
} from "../lib/commerciauxStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEOJSON_PATH = path.join(__dirname, "..", "..", "data", "departements-france.geojson");

const router = Router();

// GET /api/commerciaux -> référentiel complet (liste des départements + commerciaux et leurs zones)
router.get("/", (req, res) => {
  try {
    const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, "utf-8"));
    const departements = geojson.features
      .map((f) => ({ code: f.properties.code, nom: f.properties.nom }))
      .sort((a, b) => a.code.localeCompare(b.code));

    res.json({
      departements,
      commerciaux: listCommerciaux(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/commerciaux/departements-principal -> dept_code -> { commercial, couleur }
router.get("/departements-principal", (req, res) => {
  res.json(getDepartementsCommercialPrincipal());
});

// GET /api/commerciaux/departements-secondaire -> dept_code -> [commercial, ...]
router.get("/departements-secondaire", (req, res) => {
  res.json(getDepartementsCommerciauxSecondaires());
});

// POST /api/commerciaux -> créer ou modifier (body: { nom, ancienNom?, couleur, zonePrincipale[], zoneSecondaire[] })
router.post("/", (req, res) => {
  try {
    const record = saveCommercial(req.body || {});
    res.json({ success: true, commercial: record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/commerciaux/:nom -> supprime un commercial (libère sa zone principale/secondaire)
router.delete("/:nom", (req, res) => {
  try {
    deleteCommercial(decodeURIComponent(req.params.nom));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
