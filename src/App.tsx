import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import AppShell from "./layout/AppShell";
import StoreShell from "./layout/StoreShell";
import { appPath } from "./lib/routes";
import ClientDetail from "./pages/ClientDetail";
import Clients from "./pages/Clients";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import LoanDetail from "./pages/LoanDetail";
import Loans from "./pages/Loans";
import Login from "./pages/Login";
import NewClient from "./pages/NewClient";
import NewLoan from "./pages/NewLoan";
import Payments from "./pages/Payments";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import Team from "./pages/Team";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={<RequireAuth />}>
        <Route element={<StoreShell />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="clientes/nuevo" element={<NewClient />} />
            <Route path="clientes/:id" element={<ClientDetail />} />
            <Route path="prestamos" element={<Loans />} />
            <Route path="prestamos/nuevo" element={<NewLoan />} />
            <Route path="prestamos/:id" element={<LoanDetail />} />
            <Route path="pagos" element={<Payments />} />
            <Route path="equipo" element={<Team />} />
            <Route path="configuracion" element={<Settings />} />
            <Route path="*" element={<Navigate to={appPath("/")} replace />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
