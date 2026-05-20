import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, MiniBarChart, Panel, StatusBadge } from "../components/ui";
import { kpis, projects, timeline } from "../data/mock";
import { apiGet, type ApiAppointment, type ApiProject } from "../services/api";

type DashboardResponse = {
  kpis: {
    clients: number;
    activeProjects: number;
    activeServices: number;
    contracts: number;
    revenueMonth: number;
    revenueMonthChange: number;
    revenueYear: number;
    revenueYearChange: number;
    averageProgress: number;
  };
  projects: ApiProject[];
  notifications: Array<{ id: string; title: string }>;
};

export function Dashboard() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardResponse>("/dashboard"),
    retry: 1,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => apiGet<ApiAppointment[]>("/appointments"),
    retry: 1,
  });

  const apiKpis = data
    ? [
        {
          label: "Clientes",
          value: String(data.kpis.clients),
          trend: "cadastrados",
        },
        {
          label: "Projetos Ativos",
          value: String(data.kpis.activeProjects),
          trend: `${data.kpis.averageProgress}% de progresso médio`,
        },
        {
          label: "Serviços Ativos",
          value: String(data.kpis.activeServices),
          trend: "recorrentes",
        },
        {
          label: "Receita Mês",
          value: money(data.kpis.revenueMonth),
          trend: revenueTrend(data.kpis.revenueMonthChange, "mês anterior"),
        },
        {
          label: "Receita Ano",
          value: money(data.kpis.revenueYear),
          trend: revenueTrend(data.kpis.revenueYearChange, "ano anterior"),
        },
      ]
    : kpis;

  const visibleProjects = data?.projects?.length
    ? data.projects.map((project) => ({
        name: project.name,
        client: project.client?.name ?? "Cliente",
        status: translateStatus(project.status),
        progress: projectProgress(project),
        due: "Roadmap",
        budget: money(Number(project.budget)),
        owner: "Docject",
      }))
    : projects;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mono-label text-[color:var(--muted)]">
            Executive Overview
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">
            Operação em ritmo controlado
          </h1>
          <p className="mt-3 max-w-2xl text-[color:var(--muted)]">
            Visão consolidada de clientes, projetos, contratos, receita e
            entregas críticas.
          </p>
        </div>
        <Button onClick={() => navigate("/projects")}>
          <Plus size={18} />
          Novo projeto
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {apiKpis.map((kpi) => (
          <Panel className="p-5" key={kpi.label}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label text-[color:var(--muted)]">
                  {kpi.label}
                </p>
                <strong className="mt-3 block font-display text-3xl">
                  {kpi.value}
                </strong>
              </div>
              <MiniBarChart values={[30, 42, 58, 82]} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]">
              {kpi.trend}
            </p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="mono-label text-[color:var(--muted)]">
                Projetos prioritários
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                Portfólio ativo
              </h2>
            </div>
            <Button variant="secondary" onClick={() => navigate("/projects")}>
              Ver todos
              <ArrowUpRight size={16} />
            </Button>
          </div>
          <div className="space-y-3">
            {visibleProjects.map((project) => (
              <div
                className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4"
                key={project.name}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold">
                      {project.name}
                    </h3>
                    <p className="text-sm text-[color:var(--muted)]">
                      {project.client} · {project.owner}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      project.status === "Em risco"
                        ? "warning"
                        : project.status === "Em andamento"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {project.status}
                  </StatusBadge>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="progress-track h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="progress-fill h-full rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm font-bold">
                    {project.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="mono-label text-[color:var(--muted)]">Linha do tempo</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Entregas</h2>
          <div className="relative mt-6">
            {/* linha vertical conectora */}
            <span
              className="absolute left-[15px] top-2 h-[calc(100%-16px)] w-px bg-[color:var(--line)]"
              aria-hidden="true"
            />
            <ol className="space-y-5">
              {buildTimeline(data?.projects ?? [], appointments).map(
                (item, idx) => (
                  <li key={idx} className="flex gap-3">
                    {item.kind === "done" && (
                      <>
                        <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--muted)]">
                          <CheckCircle2 size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[color:var(--muted)] line-through">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-[color:var(--muted)]">
                            {item.project} · {item.date}
                          </p>
                        </div>
                      </>
                    )}
                    {item.kind === "current" && (
                      <>
                        <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--primary)] bg-[color:var(--accent)]/15 text-[color:var(--primary)] dark:border-[color:var(--warning)] dark:text-[color:var(--warning)]">
                          <CalendarClock size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{item.name}</p>
                          <p className="truncate text-xs text-[color:var(--muted)]">
                            {item.project} · {item.date}
                          </p>
                          <span className="mt-1 inline-block rounded-full bg-[color:var(--primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--primary)] dark:bg-[color:var(--accent)]/15 dark:text-[color:var(--accent)]">
                            Em andamento
                          </span>
                        </div>
                      </>
                    )}
                    {item.kind === "upcoming" && (
                      <>
                        <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--muted)]">
                          <CalendarDays size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {item.title}
                          </p>
                          <p className="truncate text-xs text-[color:var(--muted)]">
                            {item.date}
                          </p>
                        </div>
                      </>
                    )}
                  </li>
                ),
              )}
              {buildTimeline(data?.projects ?? [], appointments).length ===
                0 && (
                <li className="pl-11 text-sm text-[color:var(--muted)]">
                  Nenhuma entrega encontrada.
                </li>
              )}
            </ol>
          </div>
        </Panel>
      </div>

      <Panel className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="mono-label text-[color:var(--muted)]">Atividade</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              Últimos eventos
            </h2>
          </div>
          <FileText className="text-[color:var(--muted)]" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(
            data?.notifications.map((item) => item.title) ?? [
              "Contrato enviado para Alpha Core",
              "Pagamento de R$ 85k vence amanhã",
              "Sprint review agendada para sexta",
            ]
          ).map((event) => (
            <div
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm"
              key={event}
            >
              {event}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function revenueTrend(change: number, period: string) {
  if (change === 0) return `igual ao ${period}`;
  const direction = change > 0 ? "mais" : "menos";
  return `${Math.abs(change)}% ${direction} que o ${period}`;
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    PLANNING: "Planejamento",
    IN_PROGRESS: "Em andamento",
    WAITING_CLIENT: "Em risco",
    PAUSED: "Pausado",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
  };
  return map[status] ?? status;
}

function projectProgress(project: ApiProject) {
  if (!project.modules?.length) return 0;
  const completed = project.modules.filter(
    (module) => module.completed || module.progress >= 100,
  ).length;
  return Math.round((completed / project.modules.length) * 100);
}

// ── Timeline ──────────────────────────────────────────────────────────────────

type TimelineItem =
  | { kind: "done"; name: string; project: string; date: string }
  | { kind: "current"; name: string; project: string; date: string }
  | { kind: "upcoming"; title: string; date: string };

function buildTimeline(
  projects: ApiProject[],
  appointments: ApiAppointment[],
): TimelineItem[] {
  type FlatModule = NonNullable<ApiProject["modules"]>[number] & {
    projectName: string;
  };

  const allModules: FlatModule[] = projects.flatMap((p) =>
    (p.modules ?? []).map((m) => ({
      ...m,
      projectName: p.client?.name ? `${p.name} · ${p.client.name}` : p.name,
    })),
  );

  // 2 últimas entregas concluídas (mais recentes primeiro, revertido para cronológico)
  const done: TimelineItem[] = allModules
    .filter((m) => m.completed || m.progress >= 100)
    .sort((a, b) => {
      const da = a.endDate ? new Date(a.endDate).getTime() : 0;
      const db = b.endDate ? new Date(b.endDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 2)
    .reverse()
    .map((m) => ({
      kind: "done",
      name: m.name,
      project: m.projectName,
      date: m.endDate
        ? new Date(m.endDate).toLocaleDateString("pt-BR")
        : "Concluído",
    }));

  // Entrega atual: primeiro módulo incompleto com menor endDate
  const currentModule = allModules
    .filter((m) => !m.completed && m.progress < 100)
    .sort((a, b) => {
      const da = a.endDate
        ? new Date(a.endDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const db = b.endDate
        ? new Date(b.endDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      return da - db;
    })[0];

  const current: TimelineItem[] = currentModule
    ? [
        {
          kind: "current",
          name: currentModule.name,
          project: currentModule.projectName,
          date: currentModule.endDate
            ? new Date(currentModule.endDate).toLocaleDateString("pt-BR")
            : "Em aberto",
        },
      ]
    : [];

  // Próximas 2 na agenda (eventos futuros)
  const now = new Date();
  const upcoming: TimelineItem[] = appointments
    .filter((a) => new Date(a.startsAt) > now)
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, 2)
    .map((a) => ({
      kind: "upcoming",
      title: a.title,
      date: new Date(a.startsAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

  return [...done, ...current, ...upcoming];
}
