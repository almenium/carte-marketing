/**
 * Génère et déclenche le téléchargement d'un CSV compatible Excel
 * (BOM UTF-8, séparateur ';'), nommé <prefix>_<date>.csv.
 * Porté depuis map-commons.js (exportCsv).
 */
export function exportCsv(filenamePrefix, rows) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(";"),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(";")),
  ];

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${date}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
