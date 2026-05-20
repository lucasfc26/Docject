import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "./layouts/AppLayout";
import { useThemeStore } from "./stores/theme";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { ClientsPage } from "./pages/ClientsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ServicesPage } from "./pages/ServicesPage";
import { ContractsPage } from "./pages/ContractsPage";
import { FinancialPage } from "./pages/FinancialPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ClientPortal } from "./pages/ClientPortal";
import { TermosDeUso } from "./pages/TermosDeUso";
import { PoliticaDePrivacidade } from "./pages/PoliticaDePrivacidade";
import { Suporte } from "./pages/Suporte";
import {
  CookieConsentBanner,
  ConsentReopenButton,
} from "./components/CookieConsentBanner";

export default function App() {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <>
      <CookieConsentBanner />
      <ConsentReopenButton />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/termos" element={<TermosDeUso />} />
        <Route path="/privacidade" element={<PoliticaDePrivacidade />} />
        <Route path="/suporte" element={<Suporte />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/financial" element={<FinancialPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/agenda" element={<AppointmentsPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/client/dashboard" element={<ClientPortal />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
