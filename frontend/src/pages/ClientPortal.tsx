import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Download, MessageSquare, Monitor, ReceiptText, Server } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Panel, StatusBadge } from "../components/ui";
import { timeline } from "../data/mock";
import { apiGet, type ApiClient, type ApiContract, type ApiProject, type ApiService, type ApiSettings } from "../services/api";

export function ClientPortal() {
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => apiGet<ApiClient[]>("/clients") });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => apiGet<ApiProject[]>("/projects") });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => apiGet<ApiService[]>("/services") });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => apiGet<ApiContract[]>("/contracts") });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<ApiSettings>("/settings") });
  const [view, setView] = useState<"projects" | "services">("projects");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const user = readStoredUser();
  const isClientUser = user?.role === "CLIENT";

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0];
  const projectOptions = useMemo(() => {
    if (!selectedClient) return projects;
    return projects.filter((project) => project.clientId === selectedClient.id || project.client?.id === selectedClient.id);
  }, [projects, selectedClient]);
  const selectedProject = projectOptions.find((project) => project.id === selectedProjectId) ?? projectOptions[0] ?? (!selectedClient ? projects[0] : undefined);
  const serviceOptions = useMemo(() => {
    if (!selectedClient) return services;
    return services.filter((service) => service.clientId === selectedClient.id || service.client?.id === selectedClient.id);
  }, [services, selectedClient]);
  const selectedService = serviceOptions.find((service) => service.id === selectedServiceId) ?? serviceOptions[0];
  const selectedProgress = selectedProject ? projectProgress(selectedProject) : 0;
  const projectClient = selectedProject?.client?.name ?? selectedService?.client?.name ?? selectedClient?.name ?? "Cliente";
  const projectModules = useMemo(() => [...(selectedProject?.modules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex), [selectedProject]);
  const currentModule = projectModules.find((module) => !isModuleCompleted(module)) ?? projectModules[projectModules.length - 1];
  const contractUrl = contracts.find((contract) => contract.versions?.length)?.versions.at(-1)?.fileUrl;
  const supportPhone = (settings?.supportPhone || "").replace(/\D/g, "");
  const visibleTimeline = selectedProject?.modules?.length
    ? projectModules.map((module) => ({
        label: module.name,
        date: moduleDateRange(module),
        done: isModuleCompleted(module),
        active: module.id === currentModule?.id && !isModuleCompleted(module)
      }))
    : timeline;

  return (
    <div className="space-y-6">
      <Panel className="p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mono-label text-[color:var(--muted)]">Portal do cliente</p>
            <h1 className="mt-2 font-display text-4xl font-bold">{view === "projects" ? selectedProject?.name ?? "Projeto" : selectedService?.name ?? "Servico"}</h1>
            <p className="mt-3 max-w-2xl text-[color:var(--muted)]">Resumo objetivo de progresso, servicos contratados, arquivos compartilhados, contratos e financeiro de {projectClient}.</p>
          </div>
          <div className={`grid w-full gap-3 ${isClientUser ? "md:grid-cols-[auto]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:w-auto xl:min-w-[620px]"}`}>
            {!isClientUser ? <label className="block">
              <span className="mono-label text-[color:var(--muted)]">Cliente</span>
              <select
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                value={selectedClient?.id ?? ""}
                onChange={(event) => {
                  setSelectedClientId(event.target.value);
                  setSelectedProjectId("");
                  setSelectedServiceId("");
                }}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label> : null}
            {!isClientUser ? <label className="block">
              <span className="mono-label text-[color:var(--muted)]">{view === "projects" ? "Projeto" : "Servico"}</span>
              <select className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none" value={view === "projects" ? selectedProject?.id ?? "" : selectedService?.id ?? ""} onChange={(event) => view === "projects" ? setSelectedProjectId(event.target.value) : setSelectedServiceId(event.target.value)}>
                {view === "projects" && !projectOptions.length ? <option value="">Sem projetos</option> : null}
                {view === "services" && !serviceOptions.length ? <option value="">Sem servicos</option> : null}
                {(view === "projects" ? projectOptions : serviceOptions).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label> : null}
            <div className="flex items-end gap-2">
              <Button aria-label="Baixar contrato" variant="secondary" onClick={() => contractUrl && window.open(contractUrl, "_blank", "noopener,noreferrer")} disabled={!contractUrl}>
                <Download size={17} />
              </Button>
              <Button aria-label="Suporte" onClick={() => supportPhone && window.open(`https://wa.me/${supportPhone}`, "_blank", "noopener,noreferrer")} disabled={!supportPhone}>
                <MessageSquare size={17} />
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={view === "projects" ? "primary" : "secondary"}
          onClick={() => setView("projects")}
        >
          <Activity size={17} />
          Projetos
        </Button>
        <Button
          type="button"
          variant={view === "services" ? "primary" : "secondary"}
          onClick={() => setView("services")}
        >
          <Server size={17} />
          Servicos
        </Button>
      </div>

      {view === "services" ? (
        <ServiceClientView service={selectedService} clientName={projectClient} />
      ) : (
        <>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mono-label text-[color:var(--muted)]">Fase atual</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">{translateProject(selectedProject?.status ?? "PLANNING")}</h2>
            </div>
            <div className="text-right">
              <strong className="font-display text-5xl">{selectedProgress}%</strong>
              <p className="text-sm text-[color:var(--muted)]">concluido</p>
            </div>
          </div>
          <div className="progress-track mt-8 h-2 overflow-hidden rounded-full">
            <div className="progress-fill h-full rounded-full" style={{ width: `${selectedProgress}%` }} />
          </div>
          <div className="mt-4 flex justify-between gap-4 text-sm text-[color:var(--muted)]">
            <span>Cliente: {projectClient}</span>
            <span>Budget: {money(Number(selectedProject?.budget ?? 0))}</span>
          </div>
        </Panel>

        <Panel className="p-6">
          <p className="mono-label text-[color:var(--muted)]">Proxima entrega</p>
          <h2 className="mt-4 font-display text-2xl font-semibold">{currentModule?.name ?? selectedProject?.name ?? "Sem entrega selecionada"}</h2>
          <p className="mt-2 text-[color:var(--muted)]">{currentModule ? moduleDescription(currentModule) : "Projeto filtrado por cliente e pronto para acompanhamento dos stakeholders."}</p>
          <div className="mt-6 flex items-center justify-between border-t border-[color:var(--line)] pt-5">
            <StatusBadge tone="warning">{currentModule?.endDate ? new Date(currentModule.endDate).toLocaleDateString("pt-BR") : translateProject(selectedProject?.status ?? "PLANNING")}</StatusBadge>
            <Button variant="secondary">
              <ReceiptText size={17} />
              Detalhes
            </Button>
          </div>
        </Panel>
      </div>

      <Panel className="p-6">
        <p className="mono-label text-[color:var(--muted)]">Timeline</p>
        <div className="mt-8 overflow-x-auto pb-2">
          <div className="relative grid items-start gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(visibleTimeline.length, 1)}, minmax(120px, 1fr))` }}>
            <div className="absolute left-0 right-0 top-5 h-1 rounded-full bg-[color:var(--line)]" />
            <div className="absolute left-0 top-5 h-1 rounded-full bg-[color:var(--success)] transition-all" style={{ width: `${timelineFill(visibleTimeline)}%` }} />
            {visibleTimeline.map((item, index) => (
              <div className="relative min-w-0 text-center" key={item.label}>
                <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full border-4 border-[color:var(--panel)] text-sm font-bold shadow-panel ${item.done ? "bg-[color:var(--success)] text-white" : item.active ? "bg-[color:var(--accent)] text-white" : "bg-[color:var(--panel-strong)] text-[color:var(--muted)]"}`}>
                  {index + 1}
                </span>
                <p className="mt-3 truncate text-sm font-semibold">{item.label}</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">{item.date}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
        </>
      )}
    </div>
  );
}

function ServiceClientView({
  service,
  clientName,
}: {
  service?: ApiService;
  clientName: string;
}) {
  if (!service) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[color:var(--muted)]">
          Nenhum servico associado a este cliente.
        </p>
      </Panel>
    );
  }

  const healthItems = [
    { label: "Frontend", value: service.frontendHealth ?? "STABLE", icon: Monitor },
    { label: "Backend", value: service.backendHealth ?? "STABLE", icon: Server },
    { label: "DB", value: service.databaseHealth ?? "STABLE", icon: Database },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="p-6">
        <p className="mono-label text-[color:var(--muted)]">Servico fornecido</p>
        <h2 className="mt-2 font-display text-3xl font-bold">{service.name}</h2>
        <p className="mt-3 text-[color:var(--muted)]">
          {service.description || `Servico ativo para ${clientName}.`}
        </p>
        <div className="mt-6 grid gap-3 text-sm">
          <div className="flex items-center justify-between border-t border-[color:var(--line)] pt-4">
            <span className="text-[color:var(--muted)]">Status</span>
            <StatusBadge tone={service.active ? "success" : "neutral"}>
              {service.active ? "Ativo" : "Inativo"}
            </StatusBadge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[color:var(--muted)]">Mensalidade</span>
            <strong>{money(Number(service.monthlyValue ?? 0))}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[color:var(--muted)]">Dia de pagamento</span>
            <strong>Dia {service.paymentDay}</strong>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <p className="mono-label text-[color:var(--muted)]">Saude operacional</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {healthItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4"
                key={item.label}
              >
                <div className="mb-4 flex items-center justify-between">
                  <Icon size={20} className="text-[color:var(--muted)]" />
                  <StatusBadge tone={healthTone(item.value)}>
                    {translateHealth(item.value)}
                  </StatusBadge>
                </div>
                <p className="font-semibold">{item.label}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
          <p className="mono-label text-[color:var(--muted)]">Observacao</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {service.notes || "Nenhuma observacao registrada para este servico."}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem("projectfy-user");
    return raw ? (JSON.parse(raw) as { role: string; clientId?: string }) : null;
  } catch {
    return null;
  }
}

function translateProject(status: string) {
  return { PLANNING: "Planejamento", IN_PROGRESS: "Em andamento", PAUSED: "Pausado", WAITING_CLIENT: "Aguardando cliente", COMPLETED: "Concluido", CANCELLED: "Cancelado" }[status] ?? status;
}

function translateHealth(status: string) {
  return { EXCELLENT: "Excelente", ATTENTION: "Atencao", STABLE: "Estavel" }[status] ?? status;
}

function healthTone(status: string) {
  if (status === "EXCELLENT") return "success";
  if (status === "ATTENTION") return "warning";
  return "neutral";
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function projectProgress(project: ApiProject) {
  if (!project.modules?.length) return 0;
  const completed = project.modules.filter(isModuleCompleted).length;
  return Math.round((completed / project.modules.length) * 100);
}

function isModuleCompleted(module: NonNullable<ApiProject["modules"]>[number]) {
  return Boolean(module.completed) || module.progress >= 100;
}

function moduleDateRange(module: NonNullable<ApiProject["modules"]>[number]) {
  if (!module.startDate && !module.endDate) return `${module.businessDays ?? 0} dias uteis`;
  const start = module.startDate ? new Date(module.startDate).toLocaleDateString("pt-BR") : "sem inicio";
  const end = module.endDate ? new Date(module.endDate).toLocaleDateString("pt-BR") : "sem fim";
  return `${start} - ${end}`;
}

function moduleDescription(module: NonNullable<ApiProject["modules"]>[number]) {
  const amount = module.value ? ` Valor: ${money(Number(module.value))}.` : "";
  return `Modulo ${module.orderIndex}: ${moduleDateRange(module)} com ${module.businessDays ?? 0} dias uteis.${amount}`;
}

function timelineFill(items: Array<{ done?: boolean }>) {
  if (!items.length) return 0;
  const completed = items.filter((item) => item.done).length;
  return items.length === 1 ? (completed ? 100 : 0) : Math.max(0, Math.min(100, (completed / (items.length - 1)) * 100));
}
