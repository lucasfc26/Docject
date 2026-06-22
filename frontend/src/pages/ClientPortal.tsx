import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Download, ExternalLink, FileSignature, MessageSquare, ReceiptText, Server } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Panel, StatusBadge } from "../components/ui";
import { timeline } from "../data/mock";
import { apiAssetUrl, apiGet, apiPost, buildContractSignPayload, contractParticipantLabel, sortedContractParticipants, type ApiClient, type ApiContract, type ApiProject, type ApiService, type ApiServiceHealthCheckResult, type ApiSettings } from "../services/api";

export function ClientPortal() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => apiGet<ApiClient[]>("/clients") });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => apiGet<ApiProject[]>("/projects") });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => apiGet<ApiService[]>("/services") });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: () => apiGet<ApiContract[]>("/contracts") });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<ApiSettings>("/settings") });
  const [view, setView] = useState<"projects" | "services" | "contracts">("projects");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const user = readStoredUser();
  const isClientUser = user?.role === "CLIENT";

  useEffect(() => {
    const focusId = searchParams.get("focus");
    const requestedView = searchParams.get("view");
    if (requestedView === "projects" || requestedView === "services" || requestedView === "contracts") {
      setView(requestedView);
    }
    if (focusId) {
      if (requestedView === "contracts") setSelectedContractId(focusId);
      if (requestedView === "projects") setSelectedProjectId(focusId);
      if (requestedView === "services") setSelectedServiceId(focusId);
    }
    if (!focusId && !requestedView) return;
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    next.delete("view");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
  const contractOptions = useMemo(() => {
    if (isClientUser && user?.id) {
      return contracts.filter((contract) => isContractParticipant(contract, user.id));
    }
    if (!selectedClient) return contracts;
    return contracts.filter((contract) => contract.clientId === selectedClient.id || contract.client?.id === selectedClient.id);
  }, [contracts, isClientUser, selectedClient, user?.id]);
  const selectedContract = contractOptions.find((contract) => contract.id === selectedContractId) ?? contractOptions[0];
  const { data: serviceHealth = [], isFetching: isCheckingHealth } = useQuery({
    enabled: view === "services" && Boolean(selectedService?.id),
    queryKey: ["service-health", selectedService?.id],
    queryFn: () => apiGet<ApiServiceHealthCheckResult[]>(`/services/${selectedService?.id}/health-checks`),
    refetchInterval: 30000,
  });
  const selectedProgress = selectedProject ? projectProgress(selectedProject) : 0;
  const projectClient = selectedProject?.client?.name ?? selectedService?.client?.name ?? selectedClient?.name ?? "Cliente";
  const projectModules = useMemo(() => [...(selectedProject?.modules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex), [selectedProject]);
  const currentModule = projectModules.find((module) => !isModuleCompleted(module)) ?? projectModules[projectModules.length - 1];
  const contractUrl = selectedContract?.signedFileUrl ?? selectedContract?.versions?.at(-1)?.fileUrl;
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
            <h1 className="mt-2 font-display text-4xl font-bold">{view === "projects" ? selectedProject?.name ?? "Projeto" : view === "services" ? selectedService?.name ?? "Servico" : selectedContract?.title ?? "Contratos"}</h1>
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
                  setSelectedContractId("");
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
              <span className="mono-label text-[color:var(--muted)]">{view === "projects" ? "Projeto" : view === "services" ? "Servico" : "Contrato"}</span>
              <select className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none" value={view === "projects" ? selectedProject?.id ?? "" : view === "services" ? selectedService?.id ?? "" : selectedContract?.id ?? ""} onChange={(event) => view === "projects" ? setSelectedProjectId(event.target.value) : view === "services" ? setSelectedServiceId(event.target.value) : setSelectedContractId(event.target.value)}>
                {view === "projects" && !projectOptions.length ? <option value="">Sem projetos</option> : null}
                {view === "services" && !serviceOptions.length ? <option value="">Sem servicos</option> : null}
                {view === "contracts" && !contractOptions.length ? <option value="">Sem contratos</option> : null}
                {(view === "projects" ? projectOptions : view === "services" ? serviceOptions : contractOptions).map((item) => (
                  <option key={item.id} value={item.id}>
                    {"name" in item ? item.name : item.title}
                  </option>
                ))}
              </select>
            </label> : null}
            <div className="flex items-end gap-2">
              <Button aria-label="Baixar contrato" variant="secondary" onClick={() => contractUrl && window.open(apiAssetUrl(contractUrl), "_blank", "noopener,noreferrer")} disabled={!contractUrl}>
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
        <Button
          type="button"
          variant={view === "contracts" ? "primary" : "secondary"}
          onClick={() => setView("contracts")}
        >
          <FileSignature size={17} />
          Contratos
        </Button>
      </div>

      {view === "contracts" ? (
        <ContractSignatureView
          contract={selectedContract}
          userId={user?.id}
          onSigned={() => queryClient.invalidateQueries({ queryKey: ["contracts"] })}
        />
      ) : view === "services" ? (
        <ServiceClientView
          healthResults={serviceHealth}
          isCheckingHealth={isCheckingHealth}
          service={selectedService}
          clientName={projectClient}
        />
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
  healthResults,
  isCheckingHealth,
}: {
  service?: ApiService;
  clientName: string;
  healthResults: ApiServiceHealthCheckResult[];
  isCheckingHealth: boolean;
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

  const healthItems = healthResults.length
    ? healthResults
    : (service.healthChecks ?? []).map((item) => ({
        ...item,
        status: "PENDING" as const,
        responseTimeMs: null,
        checkedAt: "",
      }));

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
        <div className="flex items-center justify-between gap-3">
          <p className="mono-label text-[color:var(--muted)]">Saude operacional</p>
          <span className="text-xs text-[color:var(--muted)]">
            {isCheckingHealth ? "Verificando..." : "Atualiza a cada 30s"}
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {healthItems.map((item) => {
            return (
              <a
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 transition hover:border-[color:var(--accent)]"
                href={healthCheckHref(item.address)}
                key={item.id ?? `${item.name}-${item.address}`}
                rel="noreferrer"
                target="_blank"
              >
                <div className="mb-4 flex items-center justify-between">
                  <Activity size={20} className="text-[color:var(--muted)]" />
                  <StatusBadge tone={healthTone(item.status)}>
                    {translateHealth(item.status)}
                  </StatusBadge>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                      {item.address}
                    </p>
                    <p className="mt-3 text-sm text-[color:var(--muted)]">
                      {item.responseTimeMs == null
                        ? "Sem resposta medida"
                        : `${item.responseTimeMs} ms`}
                    </p>
                  </div>
                  <ExternalLink
                    size={16}
                    className="mt-1 shrink-0 text-[color:var(--muted)]"
                  />
                </div>
              </a>
            );
          })}
          {!healthItems.length ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-5 text-sm text-[color:var(--muted)] md:col-span-2">
              Nenhum ponto de saude cadastrado para este servico.
            </p>
          ) : null}
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

function ContractSignatureView({
  contract,
  userId,
  onSigned,
}: {
  contract?: ApiContract;
  userId?: string;
  onSigned: () => void;
}) {
  const [password, setPassword] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [participantEmail, setParticipantEmail] = useState("");
  const [participantRole, setParticipantRole] = useState<"CONTRACTOR" | "WITNESS">("CONTRACTOR");
  const signMutation = useMutation({
    mutationFn: async () => {
      return apiPost<ApiContract>(
        `/contracts/${contract?.id}/sign`,
        await buildContractSignPayload(password, shareLocation),
      );
    },
    onSuccess: () => {
      setPassword("");
      setShareLocation(false);
      onSigned();
    },
    meta: { successMessage: "Contrato assinado com sucesso." },
  });
  const addParticipantMutation = useMutation({
    mutationFn: () =>
      apiPost<ApiContract>(`/contracts/${contract?.id}/participants`, {
        email: participantEmail.trim(),
        role: participantRole,
      }),
    onSuccess: () => {
      setParticipantEmail("");
      onSigned();
    },
    meta: { successMessage: "Participante adicionado ao contrato." },
  });

  if (!contract) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-[color:var(--muted)]">
          Nenhum contrato vinculado a esta conta.
        </p>
      </Panel>
    );
  }

  const latestUrl = contract.signedFileUrl ?? contract.versions?.at(-1)?.fileUrl;
  const role = userId ? contractParticipantRole(contract, userId) : undefined;
  const alreadySigned = userId ? hasSignedContract(contract, userId) : false;
  const canSign = contract.status === "SENT" && Boolean(role) && !alreadySigned;
  const participants = sortedContractParticipants(contract);
  const isContractingParty = participants.some(
    (participant) => participant.user.id === userId && participant.role === "CONTRACTING_PARTY",
  );
  const hasContractor = participants.some((participant) => participant.role === "CONTRACTOR");
  const canAddParticipants =
    isContractingParty && (contract.status === "DRAFT" || contract.status === "SENT");

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="p-6">
        <p className="mono-label text-[color:var(--muted)]">Contrato</p>
        <h2 className="mt-2 font-display text-3xl font-bold">{contract.title}</h2>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex items-center justify-between border-t border-[color:var(--line)] pt-4">
            <span className="text-[color:var(--muted)]">Status</span>
            <StatusBadge tone={contractStatusTone(contract.status)}>
              {translateContract(contract.status)}
            </StatusBadge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[color:var(--muted)]">Valor</span>
            <strong>{money(Number(contract.value ?? 0))}</strong>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            disabled={!latestUrl}
            type="button"
            variant="secondary"
            onClick={() => latestUrl && window.open(apiAssetUrl(latestUrl), "_blank", "noopener,noreferrer")}
          >
            <Download size={17} />
            Visualizar PDF
          </Button>
        </div>
        {canSign ? (
          <form
            className="mt-5 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              signMutation.mutate();
            }}
          >
            <label className="block">
              <span className="mono-label text-[color:var(--muted)]">Senha da conta</span>
              <input
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm">
              <input
                checked={shareLocation}
                className="mt-1"
                type="checkbox"
                onChange={(event) => setShareLocation(event.target.checked)}
              />
              <span className="text-[color:var(--muted)]">
                Compartilhar localizacao aproximada no registro da assinatura (opcional).
              </span>
            </label>
            <Button disabled={signMutation.isPending || !password} type="submit">
              <FileSignature size={17} />
              Assinar
            </Button>
          </form>
        ) : null}
      </Panel>

      <Panel className="p-6">
        <p className="mono-label text-[color:var(--muted)]">Assinaturas</p>
        <div className="mt-5 grid gap-3">
          {participants.map((participant) => (
            <div
              className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4"
              key={participant.id}
            >
              <div className="min-w-0">
                <p className="text-sm text-[color:var(--muted)]">
                  {contractParticipantLabel(participant.role, participant.witnessIndex)}
                </p>
                <p className="truncate font-semibold">{participant.user.name}</p>
                <p className="truncate text-xs text-[color:var(--muted)]">
                  {participant.user.email} | CPF: {participant.user.cpf ?? "-"}
                </p>
              </div>
              <StatusBadge tone={participant.signedAt ? "success" : "warning"}>
                {participant.signedAt ? "Assinado" : "Pendente"}
              </StatusBadge>
            </div>
          ))}
        </div>
        {canAddParticipants ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--line)] p-4">
            <p className="mono-label text-[color:var(--muted)]">Adicionar participante</p>
            <div className="mt-3 grid gap-3">
              <select
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none"
                value={participantRole}
                onChange={(event) => setParticipantRole(event.target.value as "CONTRACTOR" | "WITNESS")}
              >
                <option disabled={hasContractor} value="CONTRACTOR">
                  Contratado
                </option>
                <option value="WITNESS">Testemunha</option>
              </select>
              <input
                className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none"
                placeholder="E-mail da conta do participante"
                type="email"
                value={participantEmail}
                onChange={(event) => setParticipantEmail(event.target.value)}
              />
              <Button
                disabled={
                  addParticipantMutation.isPending ||
                  !participantEmail.trim() ||
                  (participantRole === "CONTRACTOR" && hasContractor)
                }
                type="button"
                variant="secondary"
                onClick={() => addParticipantMutation.mutate()}
              >
                Adicionar
              </Button>
            </div>
          </div>
        ) : null}
        {(contract.eventLogs ?? []).length ? (
          <div className="mt-5 grid gap-2">
            <p className="mono-label text-[color:var(--muted)]">Historico</p>
            {(contract.eventLogs ?? []).map((event) => (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-xs" key={event.id}>
                <p className="text-[color:var(--muted)]">
                  {new Date(event.createdAt).toISOString().replace("T", " ").slice(0, 19)} UTC
                </p>
                <p className="mt-1">{event.description}</p>
              </div>
            ))}
          </div>
        ) : null}
        {role && alreadySigned ? (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            Sua assinatura ja foi registrada como {role}.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem("projectfy-user");
    return raw ? (JSON.parse(raw) as { id: string; role: string; clientId?: string }) : null;
  } catch {
    return null;
  }
}

function translateProject(status: string) {
  return { PLANNING: "Planejamento", IN_PROGRESS: "Em andamento", PAUSED: "Pausado", WAITING_CLIENT: "Aguardando cliente", COMPLETED: "Concluido", CANCELLED: "Cancelado" }[status] ?? status;
}

function translateContract(status: string) {
  return { DRAFT: "Rascunho", SENT: "Enviado", SIGNED: "Assinado", CANCELLED: "Cancelado" }[status] ?? status;
}

function contractStatusTone(status: string) {
  if (status === "SIGNED") return "success";
  if (status === "SENT" || status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function isContractParticipant(contract: ApiContract, userId: string) {
  return (contract.participants ?? []).some((participant) => participant.user.id === userId);
}

function contractParticipantRole(contract: ApiContract, userId: string) {
  const participant = (contract.participants ?? []).find((entry) => entry.user.id === userId);
  if (!participant) return undefined;
  return contractParticipantLabel(participant.role, participant.witnessIndex).toLowerCase();
}

function hasSignedContract(contract: ApiContract, userId: string) {
  const participant = (contract.participants ?? []).find((entry) => entry.user.id === userId);
  return Boolean(participant?.signedAt);
}

function translateHealth(status: string) {
  return {
    EXCELLENT: "Excelente",
    ATTENTION: "Atencao",
    STABLE: "Estavel",
    FAST: "Rapido",
    SLOW: "Lento",
    OFFLINE: "Offline",
    PENDING: "Pendente",
  }[status] ?? status;
}

function healthTone(status: string) {
  if (status === "EXCELLENT" || status === "FAST") return "success";
  if (status === "ATTENTION" || status === "SLOW" || status === "PENDING") return "warning";
  if (status === "OFFLINE") return "danger";
  return "neutral";
}

function healthCheckHref(address: string) {
  const value = address.trim();
  if (!value) return "#";
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(value)) return value;
  if (value.includes(":") || /^localhost(?:[:/]|$)/i.test(value) || /^\d{1,3}(?:\.\d{1,3}){3}(?::|\/|$)/.test(value)) {
    return `http://${value}`;
  }
  return `https://${value}`;
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
