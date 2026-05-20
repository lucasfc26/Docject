import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  FileSignature,
  Handshake,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserCog,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Button } from "../components/ui";
import { apiGet, apiPatch, logout, type ApiFeature } from "../services/api";
import { useThemeStore } from "../stores/theme";

const titles: Record<string, string> = {
  "/dashboard": "Painel de Controle",
  "/clients": "Clientes",
  "/projects": "Portfolio de Projetos",
  "/services": "Servicos",
  "/contracts": "Contratos",
  "/financial": "Inteligencia Financeira",
  "/appointments": "Agenda",
  "/agenda": "Agenda",
  "/resources": "Recursos",
  "/client/dashboard": "Portal do Cliente",
  "/settings": "Configuracoes",
};

type HeaderNotification = {
  id: string;
  title: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useThemeStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const title = titles[location.pathname] ?? "Docject";
  const user = readStoredUser();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<HeaderNotification[]>("/notifications"),
  });
  const { data: features = [] } = useQuery({
    queryKey: ["features"],
    queryFn: () => apiGet<ApiFeature[]>("/features"),
  });
  const navFeatures = features.length ? features : defaultFeaturesForRole(user?.role);
  const unreadNotifications = notifications.filter((item) => !item.read);
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/notifications/${id}/read`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const signOut = () => {
    logout();
    navigate("/login");
  };

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className="hidden border-r border-[color:var(--line)] bg-[color:var(--panel)] px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="mb-10 flex items-center gap-3">
          <img
            alt="Docject"
            className="h-11 w-11 rounded-2xl object-contain"
            src="/DJ LOGO.svg"
          />
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">
              Docject
            </h1>
            <p className="mono-label mt-1 text-[color:var(--muted)]">
              Operations OS
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navFeatures.map((item) => {
            const Icon = featureIcons[item.path] ?? LayoutDashboard;
            return (
              <NavLink
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[color:var(--primary)] text-white shadow-panel dark:bg-[color:var(--panel-strong)] dark:text-[color:var(--accent)]"
                      : "text-[color:var(--muted)] hover:bg-[color:var(--panel-strong)] hover:text-[color:var(--text)]"
                  }`
                }
                key={item.path}
                to={item.path}
              >
                <Icon size={19} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-[color:var(--line)] bg-[color:var(--bg)]/78 px-4 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              className="lg:hidden"
              variant="secondary"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </Button>
            <div>
              <p className="mono-label text-[color:var(--muted)]">Docject</p>
              <h2 className="truncate font-display text-xl font-semibold md:text-2xl">
                {title}
              </h2>
            </div>
          </div>

          <div className="hidden min-w-80 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2 md:flex">
            <Search size={18} className="text-[color:var(--muted)]" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)]"
              placeholder="Buscar cliente, projeto ou contrato..."
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate("/projects");
              }}
            />
          </div>

          <div className="relative flex items-center gap-2">
            <Button
              aria-label="Alternar tema"
              variant="secondary"
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </Button>
            <Button
              aria-label="Notificacoes"
              className="relative"
              variant="secondary"
              onClick={() => {
                setNotificationsOpen((current) => !current);
                setProfileOpen(false);
              }}
            >
              <Bell size={18} />
              {unreadNotifications.length ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-white">
                  {unreadNotifications.length}
                </span>
              ) : null}
            </Button>
            <Button
              className="hidden md:inline-flex"
              variant="secondary"
              onClick={() => {
                setProfileOpen((current) => !current);
                setNotificationsOpen(false);
              }}
            >
              {user?.name ?? "Admin"}
              <ChevronDown size={16} />
            </Button>

            {notificationsOpen ? (
              <div className="absolute right-0 top-14 z-40 w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 shadow-panel dark:shadow-panel-dark">
                <div className="mb-3 flex items-center justify-between">
                  <p className="mono-label text-[color:var(--muted)]">Avisos</p>
                  <span className="text-xs font-semibold text-[color:var(--muted)]">
                    {unreadNotifications.length} nao lidos
                  </span>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {notifications.slice(0, 8).map((item) => (
                    <button
                      className={`w-full rounded-2xl border border-[color:var(--line)] p-3 text-left text-sm transition hover:bg-[color:var(--panel-strong)] ${item.read ? "opacity-60" : "bg-[color:var(--panel-strong)]"}`}
                      key={item.id}
                      onClick={() => markReadMutation.mutate(item.id)}
                      type="button"
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        {new Date(item.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </button>
                  ))}
                  {!notifications.length ? (
                    <p className="rounded-2xl border border-dashed border-[color:var(--line)] p-3 text-sm text-[color:var(--muted)]">
                      Sem avisos por enquanto.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {profileOpen ? (
              <div className="absolute right-0 top-14 z-40 w-64 rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel)] p-3 shadow-panel dark:shadow-panel-dark">
                <div className="border-b border-[color:var(--line)] px-3 py-3">
                  <p className="font-semibold">{user?.name ?? "Admin"}</p>
                  <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                    {user?.email ?? "admin@projectfy.io"}
                  </p>
                </div>
                <button
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--panel-strong)]"
                  onClick={() => navigate("/settings")}
                  type="button"
                >
                  <UserRound size={17} />
                  Meu perfil
                </button>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--panel-strong)]"
                  onClick={() => navigate("/settings")}
                  type="button"
                >
                  <KeyRound size={17} />
                  Mudar senha
                </button>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-ember-600 transition hover:bg-ember-500/10 dark:text-ember-300"
                  onClick={signOut}
                  type="button"
                >
                  <LogOut size={17} />
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const featureIcons: Record<string, ComponentType<{ size?: number }>> = {
  "/dashboard": LayoutDashboard,
  "/clients": UsersRound,
  "/projects": Briefcase,
  "/services": Handshake,
  "/contracts": FileSignature,
  "/financial": CircleDollarSign,
  "/agenda": CalendarDays,
  "/resources": UserCog,
  "/client/dashboard": Activity,
  "/settings": Settings,
};

function defaultFeaturesForRole(role?: string): ApiFeature[] {
  const paths =
    role === "CLIENT"
      ? ["/client/dashboard", "/settings"]
      : [
          "/dashboard",
          "/clients",
          "/projects",
          "/services",
          "/contracts",
          "/financial",
          "/agenda",
          "/resources",
          "/settings",
        ];

  return paths.map((path, index) => ({
    id: path,
    name: featureNames[path] ?? path,
    path,
    orderIndex: index + 1,
    role: role ?? "ADMIN",
  }));
}

const featureNames: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clientes",
  "/projects": "Projetos",
  "/services": "Servicos",
  "/contracts": "Contratos",
  "/financial": "Financeiro",
  "/agenda": "Agenda",
  "/resources": "Recursos",
  "/client/dashboard": "Portal Cliente",
  "/settings": "Configuracoes",
};

function readStoredUser() {
  try {
    const raw = localStorage.getItem("projectfy-user");
    return raw
      ? (JSON.parse(raw) as {
          id: string;
          name: string;
          email: string;
          role: string;
          clientId?: string;
        })
      : null;
  } catch {
    return null;
  }
}
