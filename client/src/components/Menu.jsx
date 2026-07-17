import { NavLink } from "react-router-dom";

export default function Menu() {
  return (
    <nav className="menu-cartes">
      <div className="menu-cartes__brand">Ventes &amp; Marketing</div>
      <ul>
        <li>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Carte Monde
          </NavLink>
        </li>
        <li>
          <NavLink to="/carte-france" className={({ isActive }) => (isActive ? "active" : "")}>
            Carte France
          </NavLink>
        </li>
        <li>
          <NavLink to="/parametrage" className={({ isActive }) => (isActive ? "active" : "")}>
            Paramétrage commerciaux
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
