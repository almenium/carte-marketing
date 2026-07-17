export default function FilterPanel({ title, items, checked, onToggle, onAll, onNone, extra }) {
  return (
    <div className="map-panel map-panel--filter">
      {title && <div className="map-panel__title">{title}</div>}
      <div className="map-panel__quick-actions">
        <button type="button" onClick={onAll}>
          Tous
        </button>
        <button type="button" onClick={onNone}>
          Aucun
        </button>
      </div>
      <ul className="map-panel__list">
        {items.map((item) => (
          <li key={item.value}>
            <label>
              <input
                type="checkbox"
                checked={checked.has(item.value)}
                onChange={() => onToggle(item.value)}
              />
              {item.color && (
                <span className="color-dot" style={{ backgroundColor: item.color }} />
              )}
              {item.label}
            </label>
          </li>
        ))}
      </ul>
      {extra}
    </div>
  );
}
