import { ArrowUpRight, CalendarClock, CheckCircle2, FileText, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, MiniBarChart, Panel, StatusBadge } from "../components/ui";
import { kpis, projects, timeline } from "../data/mock";
import { apiGet, type ApiProject } from "../services/api";

type DashboardResponse = {
  kpis: {
    clients: number;
    activeProjects: number;
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
    retry: 1
  });

  const apiKpis = data
    ? [
        { label: "Clientes", value: String(data.kpis.clients), trend: "ativos", tone: "blue" },
        { label: "Projetos ativos", value: String(data.kpis.activeProjects), trend: `${data.kpis.averageProgress}% médio`, tone: "blue" },
        { label: "Receita mes", value: money(data.kpis.revenueMonth), trend: revenueTrend(data.kpis.revenueMonthChange, "mes anterior"), tone: data.kpis.revenueMonthChange < 0 ? "red" : "green" },
        { label: "Receita ano", value: money(data.kpis.revenueYear), trend: revenueTrend(data.kpis.revenueYearChange, "ano anterior"), tone: data.kpis.revenueYearChange < 0 ? "red" : "green" }
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
        owner: "Docject"
      }))
    : projects;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mono-label text-[color:var(--muted)]">Executive Overview</p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">Operação em ritmo controlado</h1>
          <p className="mt-3 max-w-2xl text-[color:var(--muted)]">Visão consolidada de clientes, projetos, contratos, receita e entregas críticas.</p>
        </div>
        <Button onClick={() => navigate("/projects")}>
          <Plus size={18} />
          Novo projeto
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {apiKpis.map((kpi) => (
          <Panel className="p-5" key={kpi.label}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label text-[color:var(--muted)]">{kpi.label}</p>
                <strong className="mt-3 block font-display text-3xl">{kpi.value}</strong>
              </div>
              <MiniBarChart values={[30, 42, 58, 82]} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]">{kpi.trend}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="mono-label text-[color:var(--muted)]">Projetos prioritários</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">Portfólio ativo</h2>
            </div>
            <Button variant="secondary" onClick={() => navigate("/projects")}>
              Ver todos
              <ArrowUpRight size={16} />
            </Button>
          </div>
          <div className="space-y-3">
            {visibleProjects.map((project) => (
              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4" key={project.name}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{project.name}</h3>
                    <p className="text-sm text-[color:var(--muted)]">{project.client} · {project.owner}</p>
                  </div>
                  <StatusBadge tone={project.status === "Em risco" ? "warning" : project.status === "Em andamento" ? "success" : "neutral"}>{project.status}</StatusBadge>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="progress-track h-2 flex-1 overflow-hidden rounded-full">
                    <div className="progress-fill h-full rounded-full" style={{ width: `${project.progress}%` }} />
                  </div>
                  <span className="font-mono text-sm font-bold">{project.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="mono-label text-[color:var(--muted)]">Linha do tempo</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Nexus Rewrite</h2>
          <div className="mt-6 space-y-5">
            {timeline.map((item) => (
              <div className="flex gap-3" key={item.label}>
                <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${item.active ? "border-[color:var(--primary)] bg-[color:var(--accent)]/15 dark:border-[color:var(--warning)]" : "border-[color:var(--line)] bg-[color:var(--panel-strong)]"}`}>
                  {item.done ? <CheckCircle2 size={16} /> : <CalendarClock size={15} />}
                </div>
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-sm text-[color:var(--muted)]">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="mono-label text-[color:var(--muted)]">Atividade</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Últimos eventos</h2>
          </div>
          <FileText className="text-[color:var(--muted)]" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(data?.notifications.map((item) => item.title) ?? ["Contrato enviado para Alpha Core", "Pagamento de R$ 85k vence amanhã", "Sprint review agendada para sexta"]).map((event) => (
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm" key={event}>{event}</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
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
    CANCELLED: "Cancelado"
  };
  return map[status] ?? status;
}

function projectProgress(project: ApiProject) {
  if (!project.modules?.length) return 0;
  const completed = project.modules.filter((module) => module.completed || module.progress >= 100).length;
  return Math.round((completed / project.modules.length) * 100);
}
