export default function Legend({ title, rows, total }) {
  return (
    <div className="map-panel map-panel--legend">
      {title && <div className="map-panel__title">{title}</div>}
      <ul className="map-panel__list">
        {rows.map((row) => (
          <li key={row.label}>
            {row.color && <span className="color-dot" style={{ backgroundColor: row.color }} />}
            <span>{row.label}</span>
            <strong>
              {row.count}
              {row.extra ? ` (${row.extra})` : ""}
            </strong>
          </li>
        ))}
      </ul>
      {total !== undefined && (
        <div className="map-panel__total">
          Total : <strong>{total}</strong>
        </div>
      )}
    </div>
  );
}
