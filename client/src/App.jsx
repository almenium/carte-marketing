import { Routes, Route } from "react-router-dom";
import Menu from "./components/Menu.jsx";
import CarteMonde from "./pages/CarteMonde.jsx";
import CarteFrance from "./pages/CarteFrance.jsx";
import ParametrageCommerciaux from "./pages/ParametrageCommerciaux.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <Menu />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<CarteMonde />} />
          <Route path="/carte-france" element={<CarteFrance />} />
          <Route path="/parametrage" element={<ParametrageCommerciaux />} />
        </Routes>
      </main>
    </div>
  );
}
