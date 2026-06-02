import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import { ContractValidation } from "./pages/ContractValidation";
import { AccessRecovery, ResetPassword } from "./pages/AccessRecovery";
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
        <Route path="/forgot-password" element={<AccessRecovery />} />
        <Route path="/recuperar-acesso" element={<AccessRecovery />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/termos" element={<TermosDeUso />} />
        <Route path="/privacidade" element={<PoliticaDePrivacidade />} />
        <Route path="/suporte" element={<Suporte />} />
        <Route path="/validar-contrato" element={<ContractValidation />} />
        <Route element={<ProtectedLayout />}>
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
          <Route path="/clients/dashboard" element={<ClientPortal />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/mudar-senha" element={<ResetPassword embedded />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

function ProtectedLayout() {
  const location = useLocation();
  const user = readStoredUser();
  const token = localStorage.getItem("projectfy-access-token");

  if (!token || !user) return <Navigate to="/login" replace />;

  const allowedPaths = allowedPathsByRole[user.role] ?? allowedPathsByRole.CLIENT;
  if (!allowedPaths.has(location.pathname)) {
    return <Navigate to={defaultPathByRole[user.role] ?? "/client/dashboard"} replace />;
  }

  return <AppLayout />;
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem("projectfy-user");
    return raw ? (JSON.parse(raw) as { role: string }) : null;
  } catch {
    return null;
  }
}

const allowedPathsByRole: Record<string, Set<string>> = {
  ADMIN: new Set(["/dashboard", "/clients", "/projects", "/services", "/contracts", "/financial", "/appointments", "/agenda", "/resources", "/settings", "/mudar-senha"]),
  MANAGER: new Set(["/dashboard", "/clients", "/projects", "/services", "/contracts", "/financial", "/appointments", "/agenda", "/resources", "/settings", "/mudar-senha"]),
  FINANCIAL: new Set(["/dashboard", "/financial", "/settings", "/mudar-senha"]),
  CLIENT: new Set(["/client/dashboard", "/clients/dashboard", "/settings", "/mudar-senha"]),
};

const defaultPathByRole: Record<string, string> = {
  ADMIN: "/dashboard",
  MANAGER: "/dashboard",
  FINANCIAL: "/financial",
  CLIENT: "/client/dashboard",
};
