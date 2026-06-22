import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  FileSignature,
  LayoutDashboard,
  Search,
  Settings,
  UsersRound,
} from "lucide-react";
import type { ComponentType, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";

type SearchApiResponse = {
  clients: Array<{ id: string; name: string; segment?: string; document?: string }>;
  projects: Array<{ id: string; name: string; status: string; client?: { name: string } }>;
  contracts: Array<{ id: string; title: string; status: string; client?: { name: string } }>;
};

type SearchItem = {
  id: string;
  kind: "client" | "project" | "contract" | "navigation";
  title: string;
  subtitle?: string;
  href: string;
  icon: ComponentType<{ size?: number }>;
  group: string;
};

const navigationItems: Array<{
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
  icon: ComponentType<{ size?: number }>;
}> = [
  { id: "nav-dashboard", title: "Dashboard", subtitle: "Ir para o painel", href: "/dashboard", keywords: ["dashboard", "painel", "inicio"], icon: LayoutDashboard },
  { id: "nav-clients", title: "Clientes", subtitle: "Ir para clientes", href: "/clients", keywords: ["clientes", "clients"], icon: UsersRound },
  { id: "nav-projects", title: "Projetos", subtitle: "Ir para projetos", href: "/projects", keywords: ["projetos", "projects", "portfolio"], icon: Briefcase },
  { id: "nav-contracts", title: "Contratos", subtitle: "Ir para contratos", href: "/contracts", keywords: ["contratos", "contracts", "assinatura"], icon: FileSignature },
  { id: "nav-agenda", title: "Agenda", subtitle: "Ir para agenda", href: "/agenda", keywords: ["agenda", "appointments", "compromissos"], icon: LayoutDashboard },
  { id: "nav-financial", title: "Financeiro", subtitle: "Ir para financeiro", href: "/financial", keywords: ["financeiro", "financial"], icon: LayoutDashboard },
  { id: "nav-settings", title: "Configuracoes", subtitle: "Ir para configuracoes", href: "/settings", keywords: ["configuracoes", "settings", "perfil"], icon: Settings },
  { id: "nav-portal", title: "Portal do Cliente", subtitle: "Ir para o portal", href: "/client/dashboard", keywords: ["portal", "cliente"], icon: LayoutDashboard },
];

const allowedPathsByRole: Record<string, Set<string>> = {
  ADMIN: new Set(["/dashboard", "/clients", "/projects", "/services", "/contracts", "/financial", "/appointments", "/agenda", "/resources", "/settings", "/client/dashboard"]),
  MANAGER: new Set(["/dashboard", "/clients", "/projects", "/services", "/contracts", "/financial", "/appointments", "/agenda", "/resources", "/settings", "/client/dashboard"]),
  FINANCIAL: new Set(["/dashboard", "/financial", "/settings"]),
  CLIENT: new Set(["/client/dashboard", "/settings"]),
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function contractStatusLabel(status: string) {
  return (
    {
      DRAFT: "Rascunho",
      SENT: "Enviado",
      SIGNED: "Assinado",
      CANCELLED: "Cancelado",
    }[status] ?? status
  );
}

function buildHref(path: string, id?: string) {
  return id ? `${path}?focus=${encodeURIComponent(id)}` : path;
}

function resolveHref(role: string | undefined, item: SearchItem) {
  if (role === "CLIENT") {
    if (item.kind === "project") return `/client/dashboard?view=projects&focus=${encodeURIComponent(item.id)}`;
    if (item.kind === "contract") return `/client/dashboard?view=contracts&focus=${encodeURIComponent(item.id)}`;
  }
  return item.href;
}

export function GlobalSearch({ role }: { role?: string }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);
  const allowedPaths = allowedPathsByRole[role ?? "CLIENT"] ?? allowedPathsByRole.CLIENT;

  const { data, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => apiGet<SearchApiResponse>(`/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    const term = normalize(query);
    const items: SearchItem[] = [];

    if (term) {
      for (const item of navigationItems) {
        if (!allowedPaths.has(item.href)) continue;
        const matches = item.keywords.some(
          (keyword) => normalize(keyword).includes(term) || term.includes(normalize(keyword)),
        );
        if (!matches) continue;
        items.push({
          id: item.id,
          kind: "navigation",
          title: item.title,
          subtitle: item.subtitle,
          href: item.href,
          icon: item.icon,
          group: "Navegacao",
        });
      }
    }

    if (data && debouncedQuery.trim().length >= 2) {
      if (allowedPaths.has("/clients")) {
        for (const client of data.clients) {
          items.push({
            id: client.id,
            kind: "client",
            title: client.name,
            subtitle: [client.segment, client.document].filter(Boolean).join(" • ") || "Cliente",
            href: buildHref("/clients", client.id),
            icon: UsersRound,
            group: "Clientes",
          });
        }
      }
      if (allowedPaths.has("/projects")) {
        for (const project of data.projects) {
          items.push({
            id: project.id,
            kind: "project",
            title: project.name,
            subtitle: project.client?.name ?? "Projeto",
            href: buildHref("/projects", project.id),
            icon: Briefcase,
            group: "Projetos",
          });
        }
      }
      if (allowedPaths.has("/contracts")) {
        for (const contract of data.contracts) {
          items.push({
            id: contract.id,
            kind: "contract",
            title: contract.title,
            subtitle: `${contractStatusLabel(contract.status)}${contract.client?.name ? ` • ${contract.client.name}` : ""}`,
            href: buildHref("/contracts", contract.id),
            icon: FileSignature,
            group: "Contratos",
          });
        }
      }
    }

    return items;
  }, [allowedPaths, data, debouncedQuery, query]);

  const groups = useMemo(() => {
    const order = ["Navegacao", "Clientes", "Projetos", "Contratos"];
    return order
      .map((label) => ({
        label,
        items: results.filter((item) => item.group === label),
      }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectItem = (item: SearchItem) => {
    setOpen(false);
    setQuery("");
    navigate(resolveHref(role, item));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      selectItem(results[activeIndex]);
    }
  };

  let itemIndex = -1;

  return (
    <div className="relative hidden min-w-80 md:block" ref={rootRef}>
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2">
        <Search size={18} className="text-[color:var(--muted)]" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)]"
          placeholder="Buscar cliente, projeto ou contrato..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {open && query.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel)] p-3 shadow-panel dark:shadow-panel-dark">
          {isFetching && debouncedQuery.trim().length >= 2 ? (
            <p className="px-3 py-2 text-xs text-[color:var(--muted)]">Buscando...</p>
          ) : null}

          {!results.length ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--line)] px-3 py-4 text-sm text-[color:var(--muted)]">
              Nenhum resultado para &quot;{query.trim()}&quot;.
            </p>
          ) : null}

          {groups.map((group) => (
            <div className="mb-2" key={group.label}>
              <p className="mono-label px-3 py-2 text-[color:var(--muted)]">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  itemIndex += 1;
                  const index = itemIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        index === activeIndex
                          ? "bg-[color:var(--panel-strong)]"
                          : "hover:bg-[color:var(--panel-strong)]"
                      }`}
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                    >
                      <span className="mt-0.5 text-[color:var(--muted)]">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{item.title}</span>
                        {item.subtitle ? (
                          <span className="mt-1 block truncate text-xs text-[color:var(--muted)]">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
