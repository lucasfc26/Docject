import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Filter,
  Focus,
  GripVertical,
  MoreHorizontal,
  Paperclip,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Panel, StatusBadge } from "../components/ui";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type ApiAppointment,
  type ApiClient,
  type ApiContract,
  type ApiProject,
  type ApiResource,
  type ApiService,
  type ApiSettings,
  type ApiTransaction,
  type ApiUser,
} from "../services/api";

type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "datetime-local" | "select" | "password";
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
};

type Row = Record<string, unknown>;

type ProjectModuleForm = {
  id?: string;
  name: string;
  orderIndex: string;
  businessDays: string;
  startDate: string;
  endDate: string;
  value: string;
  completed: boolean;
};

type ProjectForm = {
  name: string;
  clientId: string;
  status: string;
  progress: string;
  budget: string;
};

type PaymentForm = {
  entity: string;
  amount: string;
  kind: string;
  status: string;
  dueDate: string;
};

type ServiceForm = {
  name: string;
  description: string;
  clientId: string;
  monthlyValue: string;
  paymentDay: string;
  startDate: string;
  active: boolean;
};

type AppointmentForm = {
  title: string;
  client: string;
  location: string;
  startsAt: string;
  endsAt: string;
  notes: string;
  repeatMode: "none" | "weekly" | "monthly";
  repeatWeekdays: number[];
  repeatMonthDay: string;
};

const statusTone = (value: unknown) => {
  const text = String(value);
  if (
    [
      "EXCELLENT",
      "Ativo",
      "Pago",
      "Assinado",
      "Concluido",
      "Confirmado",
      "SIGNED",
      "PAID",
    ].includes(text)
  )
    return "success";
  if (
    [
      "ATTENTION",
      "Pendente",
      "Enviado",
      "Em risco",
      "SENT",
      "PENDING",
      "WAITING_CLIENT",
    ].includes(text)
  )
    return "warning";
  return "neutral";
};

export function ClientsPage() {
  return (
    <CrudPage<ApiClient>
      title="Clientes"
      subtitle="Contatos, saude da conta e historico comercial alimentados pelo Postgres."
      queryKey="clients"
      endpoint="/clients"
      columns={[
        { key: "name", label: "Cliente" },
        { key: "segment", label: "Segmento" },
        {
          key: "health",
          label: "Saude",
          render: (row) => translateHealth(String(row.health)),
        },
        {
          key: "revenue",
          label: "Receita",
          render: (row) => money(Number(row.revenue)),
        },
        {
          key: "projects",
          label: "Projetos",
          render: (row) => String(row.projects?.length ?? 0),
        },
      ]}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "segment", label: "Segmento" },
        {
          name: "health",
          label: "Saude",
          type: "select",
          options: healthOptions,
        },
        { name: "revenue", label: "Receita", type: "number" },
      ]}
      normalize={(values) => ({
        ...values,
        revenue: Number(values.revenue ?? 0),
      })}
    />
  );
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<ApiClient[]>("/clients"),
  });
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<ApiProject[]>("/projects"),
  });
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<ApiProject | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<ProjectForm>(defaultProjectForm());
  const [modules, setModules] = useState<ProjectModuleForm[]>([]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        ...(editing ? {} : { clientId: form.clientId }),
        status: form.status,
        progress: projectProgressFromModules(modules),
        budget: Number(form.budget || 0),
      };
      const saved = editing
        ? await apiPatch<ApiProject>(`/projects/${editing.id}`, payload)
        : await apiPost<ApiProject>("/projects", payload);
      const keptIds = new Set(
        modules.map((module) => module.id).filter(Boolean),
      );
      const removed =
        editing?.modules?.filter((module) => !keptIds.has(module.id)) ?? [];

      await Promise.all([
        ...normalizeModuleOrder(modules)
          .filter((module) => module.name.trim())
          .map((module) => {
            const modulePayload = normalizeProjectModule(module);
            return module.id
              ? apiPatch(`/projects/modules/${module.id}`, modulePayload)
              : apiPost(`/projects/${saved.id}/modules`, modulePayload);
          }),
        ...removed.map((module) => apiDelete(`/projects/modules/${module.id}`)),
      ]);

      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setEditing(null);
      setModules([]);
      setForm(defaultProjectForm());
    },
    meta: { successMessage: "Projeto salvo com sucesso." },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setEditing(null);
      setModules([]);
      setForm(defaultProjectForm());
    },
    meta: { successMessage: "Projeto removido." },
  });

  const toggleModuleMutation = useMutation({
    mutationFn: ({
      module,
      completed,
    }: {
      module: NonNullable<ApiProject["modules"]>[number];
      completed: boolean;
    }) =>
      apiPatch(`/projects/modules/${module.id}`, {
        completed,
        progress: completed ? 100 : 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    meta: { successMessage: "Modulo atualizado." },
  });

  const filteredProjects = projects.filter((project) =>
    JSON.stringify(project).toLowerCase().includes(filter.toLowerCase()),
  );

  const startCreate = () => {
    setEditing(null);
    setForm(defaultProjectForm(clients[0]?.id));
    setModules([]);
    setOpen(true);
  };

  const startEdit = (project: ApiProject) => {
    setEditing(project);
    setForm({
      name: project.name,
      clientId: project.clientId ?? "",
      status: project.status,
      progress: String(projectProgress(project)),
      budget: String(project.budget ?? 0),
    });
    setModules(
      normalizeModuleOrder((project.modules ?? []).map(moduleFormFromApi)),
    );
    setOpen(true);
  };

  const addModule = () => {
    setModules((current) =>
      normalizeModuleOrder([
        ...current,
        {
          name: "",
          orderIndex: String(current.length + 1),
          businessDays: "",
          startDate: "",
          endDate: "",
          value: "",
          completed: false,
        },
      ]),
    );
  };

  const updateModuleForm = (
    index: number,
    patch: Partial<ProjectModuleForm>,
  ) => {
    setModules((current) => {
      const next = current.map((module, moduleIndex) =>
        moduleIndex === index ? { ...module, ...patch } : module,
      );
      return patch.orderIndex ? normalizeModuleOrder(next) : next;
    });
  };

  const moveModule = (from: number, to: number) => {
    setModules((current) => {
      if (from === to || from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return normalizeModuleOrder(next);
    });
  };

  return (
    <Panel className="overflow-hidden">
      <div className="p-6">
        <Toolbar
          title="Projetos"
          subtitle="Projetos, modulos, status, progresso e orcamento gravados via API."
          onCreate={startCreate}
          onFilter={() => setFilterOpen((current) => !current)}
        />
        {filterOpen ? (
          <input
            className="mt-4 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
            placeholder="Filtrar projetos..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        ) : null}
      </div>

      {error ? (
        <div className="mx-6 mb-4 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-600 dark:text-ember-400">
          Erro ao carregar projetos da API.
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr className="border-y border-[color:var(--line)] bg-[color:var(--panel-strong)]">
              <th className="w-12 px-6 py-4" />
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Projeto
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Cliente
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Status
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Progresso
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Budget
              </th>
              <th className="px-6 py-4 text-right">
                <MoreHorizontal
                  size={18}
                  className="ml-auto text-[color:var(--muted)]"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-6 py-6 text-sm text-[color:var(--muted)]"
                  colSpan={7}
                >
                  Carregando projetos do banco...
                </td>
              </tr>
            ) : null}
            {filteredProjects.map((project) => {
              const projectModules = [...(project.modules ?? [])].sort(
                (a, b) => a.orderIndex - b.orderIndex,
              );
              const currentModuleId = projectModules.find(
                (module) => !isProjectModuleCompleted(module),
              )?.id;
              const isExpanded = expanded[project.id];

              return (
                <Fragment key={project.id}>
                  <tr
                    className="border-b border-[color:var(--line)] transition hover:bg-[color:var(--panel-strong)]"
                    key={project.id}
                  >
                    <td className="px-6 py-4">
                      <Button
                        aria-label={
                          isExpanded ? "Recolher modulos" : "Expandir modulos"
                        }
                        className="h-9 min-h-9 w-9 px-0"
                        variant="ghost"
                        onClick={() =>
                          setExpanded((current) => ({
                            ...current,
                            [project.id]: !current[project.id],
                          }))
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </Button>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      {project.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {project.client?.name ?? "Sem cliente"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge tone={statusTone(project.status)}>
                        {translateProject(project.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {projectProgress(project)}%
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {money(Number(project.budget))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => startEdit(project)}
                        >
                          <Edit3 size={16} />
                          Editar
                        </Button>
                        <Button
                          aria-label="Apagar projeto"
                          variant="ghost"
                          onClick={() =>
                            deleteProjectMutation.mutate(project.id)
                          }
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr
                      className="border-b border-[color:var(--line)] bg-[color:var(--panel-strong)]/55"
                      key={`${project.id}-modules`}
                    >
                      <td />
                      <td className="px-6 py-5" colSpan={6}>
                        <div className="grid gap-3">
                          {projectModules.length ? (
                            projectModules.map((module, moduleIndex) => (
                              <div
                                className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 md:grid-cols-[72px_minmax(0,1fr)_120px_170px_160px_auto] md:items-center"
                                key={module.id}
                              >
                                <p className="font-mono text-sm font-bold text-[color:var(--muted)]">
                                  #{module.orderIndex || moduleIndex + 1}
                                </p>
                                <div className="flex items-center gap-3">
                                  <button
                                    aria-label={
                                      module.completed
                                        ? "Marcar modulo como pendente"
                                        : "Marcar modulo como concluido"
                                    }
                                    className={`h-4 w-4 rounded-full border transition ${isProjectModuleCompleted(module) ? "border-[color:var(--success)] bg-[color:var(--success)]" : module.id === currentModuleId ? "border-[color:var(--accent)] bg-[color:var(--accent)]" : "border-[color:var(--muted)] bg-[color:var(--muted)]/35"}`}
                                    onClick={() =>
                                      toggleModuleMutation.mutate({
                                        module,
                                        completed:
                                          !isProjectModuleCompleted(module),
                                      })
                                    }
                                    type="button"
                                  />
                                  <div>
                                    <p className="font-semibold">
                                      {module.name}
                                    </p>
                                    <p className="text-xs text-[color:var(--muted)]">
                                      {isProjectModuleCompleted(module)
                                        ? "Concluido"
                                        : module.id === currentModuleId
                                          ? "Modulo atual"
                                          : "Pendente"}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-sm text-[color:var(--muted)]">
                                  {module.businessDays ?? 0} dias uteis
                                </p>
                                <p className="text-sm text-[color:var(--muted)]">
                                  {moduleDateRange(module)}
                                </p>
                                <p className="text-sm font-semibold">
                                  {money(Number(module.value ?? 0))}
                                </p>
                                <p className="text-sm text-[color:var(--muted)]">
                                  {module.progress}%
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 text-sm text-[color:var(--muted)]">
                              Nenhum modulo cadastrado para este projeto.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ModalOverlay open={open}>
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-6xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="mono-label text-[color:var(--muted)]">
                  {editing ? "Editar" : "Novo"}
                </p>
                <h2 className="font-display text-2xl font-semibold">Projeto</h2>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <form
              className="grid gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Nome"
                  required
                  value={form.name}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, name: value }))
                  }
                />
                <label className="block">
                  <span className="mono-label text-[color:var(--muted)]">
                    Cliente
                  </span>
                  <select
                    className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none disabled:opacity-60"
                    disabled={Boolean(editing)}
                    required
                    value={form.clientId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        clientId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mono-label text-[color:var(--muted)]">
                    Status
                  </span>
                  <select
                    className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    {projectStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mono-label text-[color:var(--muted)]">
                    Progresso
                  </span>
                  <div className="mt-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm font-semibold">
                    {projectProgressFromModules(modules)}% pelos modulos
                  </div>
                </label>
                <TextInput
                  label="Budget"
                  type="number"
                  value={form.budget}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, budget: value }))
                  }
                />
              </div>

              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="mono-label text-[color:var(--muted)]">
                      Modulos
                    </p>
                    <h3 className="font-display text-xl font-semibold">
                      Composicao do projeto
                    </h3>
                  </div>
                  <Button type="button" variant="secondary" onClick={addModule}>
                    <Plus size={17} />
                    Modulo
                  </Button>
                </div>
                <div className="grid gap-3">
                  {modules.map((module, index) => (
                    <div
                      className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
                      draggable
                      key={module.id ?? index}
                      onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", String(index))
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) =>
                        moveModule(
                          Number(event.dataTransfer.getData("text/plain")),
                          index,
                        )
                      }
                    >
                      <div className="grid gap-3 xl:grid-cols-[32px_78px_minmax(220px,1.2fr)_150px_150px_130px_120px_44px] xl:items-end">
                        <div className="flex min-h-12 items-center justify-center text-[color:var(--muted)]">
                          <GripVertical size={18} />
                        </div>
                        <TextInput
                          label="Ordem"
                          type="number"
                          value={module.orderIndex}
                          onChange={(value) =>
                            updateModuleForm(index, { orderIndex: value })
                          }
                        />
                        <TextInput
                          label="Titulo do modulo"
                          required
                          value={module.name}
                          onChange={(value) =>
                            updateModuleForm(index, { name: value })
                          }
                        />
                        <TextInput
                          label="Data inicial"
                          type="date"
                          value={module.startDate}
                          onChange={(value) =>
                            updateModuleForm(
                              index,
                              moduleDatePatch(module, { startDate: value }),
                            )
                          }
                        />
                        <TextInput
                          label="Data final"
                          type="date"
                          value={module.endDate}
                          onChange={(value) =>
                            updateModuleForm(
                              index,
                              moduleDatePatch(module, { endDate: value }),
                            )
                          }
                        />
                        <TextInput
                          label="Valor"
                          type="number"
                          value={module.value}
                          onChange={(value) =>
                            updateModuleForm(index, { value })
                          }
                        />
                        <label className="flex min-h-12 items-center gap-2">
                          <input
                            checked={module.completed}
                            className="h-4 w-4 accent-[color:var(--success)]"
                            type="checkbox"
                            onChange={(event) =>
                              updateModuleForm(index, {
                                completed: event.target.checked,
                              })
                            }
                          />
                          <span className="text-sm font-semibold">
                            Concluido
                          </span>
                        </label>
                        <Button
                          aria-label="Remover modulo"
                          className="h-11 min-h-11 w-11 px-0"
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setModules((current) =>
                              current.filter(
                                (_, moduleIndex) => moduleIndex !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!modules.length ? (
                    <p className="rounded-2xl border border-dashed border-[color:var(--line)] p-4 text-sm text-[color:var(--muted)]">
                      Use o botao + Modulo para adicionar etapas ao projeto.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                {editing ? (
                  <Button
                    disabled={deleteProjectMutation.isPending}
                    type="button"
                    variant="ghost"
                    onClick={() => deleteProjectMutation.mutate(editing.id)}
                  >
                    <Trash2 size={17} />
                    Apagar projeto
                  </Button>
                ) : null}
                <Button disabled={saveMutation.isPending} type="submit">
                  <Save size={17} />
                  {saveMutation.isPending ? "Salvando..." : "Salvar projeto"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </ModalOverlay>
    </Panel>
  );
}

function defaultProjectForm(clientId = ""): ProjectForm {
  return {
    name: "",
    clientId,
    status: "PLANNING",
    progress: "0",
    budget: "0",
  };
}

function moduleFormFromApi(
  module: NonNullable<ApiProject["modules"]>[number],
): ProjectModuleForm {
  return {
    id: module.id,
    name: module.name,
    orderIndex: String(module.orderIndex ?? 0),
    businessDays: String(module.businessDays ?? 0),
    startDate: module.startDate ? toDateInput(new Date(module.startDate)) : "",
    endDate: module.endDate ? toDateInput(new Date(module.endDate)) : "",
    value: String(module.value ?? 0),
    completed: isProjectModuleCompleted(module),
  };
}

function isProjectModuleCompleted(
  module: NonNullable<ApiProject["modules"]>[number],
) {
  return Boolean(module.completed) || module.progress >= 100;
}

function projectProgress(project: ApiProject) {
  if (!project.modules?.length) return 0;
  const completed = project.modules.filter(isProjectModuleCompleted).length;
  return Math.round((completed / project.modules.length) * 100);
}

function projectProgressFromModules(items: ProjectModuleForm[]) {
  if (!items.length) return 0;
  const completed = items.filter((module) => module.completed).length;
  return Math.round((completed / items.length) * 100);
}

function normalizeProjectModule(module: ProjectModuleForm) {
  const businessDays =
    module.startDate && module.endDate
      ? countBusinessDays(module.startDate, module.endDate)
      : Number(module.businessDays || 0);
  return {
    name: module.name,
    orderIndex: Number(module.orderIndex || 0),
    businessDays,
    startDate: module.startDate
      ? new Date(`${module.startDate}T00:00:00`).toISOString()
      : undefined,
    endDate: module.endDate
      ? new Date(`${module.endDate}T00:00:00`).toISOString()
      : undefined,
    value: Number(module.value || 0),
    completed: module.completed,
    progress: module.completed ? 100 : 0,
  };
}

function normalizeModuleOrder(items: ProjectModuleForm[]) {
  return [...items]
    .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0))
    .map((module, index) => ({ ...module, orderIndex: String(index + 1) }));
}

function moduleDatePatch(
  module: ProjectModuleForm,
  patch: Partial<Pick<ProjectModuleForm, "startDate" | "endDate">>,
) {
  const next = { ...module, ...patch };
  return {
    ...patch,
    businessDays:
      next.startDate && next.endDate
        ? String(countBusinessDays(next.startDate, next.endDate))
        : "",
  };
}

function countBusinessDays(startValue: string, endValue: string) {
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  )
    return 0;
  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function toDateInput(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function moduleDateRange(module: NonNullable<ApiProject["modules"]>[number]) {
  if (!module.startDate && !module.endDate) return "Sem datas";
  const start = module.startDate
    ? new Date(module.startDate).toLocaleDateString("pt-BR")
    : "sem inicio";
  const end = module.endDate
    ? new Date(module.endDate).toLocaleDateString("pt-BR")
    : "sem fim";
  return `${start} - ${end}`;
}

export function ContractsPage() {
  const queryClient = useQueryClient();
  const {
    data: contracts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => apiGet<ApiContract[]>("/contracts"),
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiContract | null>(null);
  const [form, setForm] = useState({
    title: "",
    status: "DRAFT",
    value: "0",
    fileUrl: "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        status: form.status,
        value: Number(form.value || 0),
      };
      const saved = editing
        ? await apiPatch<ApiContract>(`/contracts/${editing.id}`, payload)
        : await apiPost<ApiContract>("/contracts", payload);
      if (form.fileUrl.trim()) {
        const nextVersion = (saved.versions?.length ?? 0) + 1;
        await apiPost(`/contracts/${saved.id}/versions`, {
          version: nextVersion,
          fileUrl: form.fileUrl.trim(),
        });
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setOpen(false);
      setEditing(null);
      setForm({ title: "", status: "DRAFT", value: "0", fileUrl: "" });
    },
    meta: { successMessage: "Contrato salvo com sucesso." },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/contracts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts"] }),
    meta: { successMessage: "Contrato removido." },
  });

  const startEdit = (contract: ApiContract) => {
    const latest = latestContractUrl(contract);
    setEditing(contract);
    setForm({
      title: contract.title,
      status: contract.status,
      value: String(contract.value ?? 0),
      fileUrl: latest ?? "",
    });
    setOpen(true);
  };

  return (
    <Panel className="overflow-hidden">
      <div className="p-6">
        <Toolbar
          title="Contratos"
          subtitle="Contratos com status, valor e arquivo para download."
          onCreate={() => {
            setEditing(null);
            setForm({ title: "", status: "DRAFT", value: "0", fileUrl: "" });
            setOpen(true);
          }}
        />
      </div>
      {error ? (
        <div className="mx-6 mb-4 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-600 dark:text-ember-400">
          Erro ao carregar contratos.
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse">
          <thead>
            <tr className="border-y border-[color:var(--line)] bg-[color:var(--panel-strong)]">
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Contrato
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Versao
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Status
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Valor
              </th>
              <th className="px-6 py-4 text-right">
                <MoreHorizontal
                  size={18}
                  className="ml-auto text-[color:var(--muted)]"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-6 py-6 text-sm text-[color:var(--muted)]"
                  colSpan={5}
                >
                  Carregando contratos...
                </td>
              </tr>
            ) : null}
            {contracts.map((contract) => {
              const latestUrl = latestContractUrl(contract);
              return (
                <tr
                  className="border-b border-[color:var(--line)] transition hover:bg-[color:var(--panel-strong)]"
                  key={contract.id}
                >
                  <td className="px-6 py-4 text-sm font-semibold">
                    {contract.title}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    v
                    {contract.versions?.[contract.versions.length - 1]
                      ?.version ?? 1}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge tone={statusTone(contract.status)}>
                      {translateContract(contract.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {money(Number(contract.value))}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {latestUrl ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            window.open(
                              latestUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          <Download size={16} />
                          Download
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        onClick={() => startEdit(contract)}
                      >
                        <Edit3 size={16} />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => removeMutation.mutate(contract.id)}
                      >
                        <Trash2 size={16} />
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ModalOverlay open={open}>
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-2xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="mono-label text-[color:var(--muted)]">
                  {editing ? "Editar" : "Novo"}
                </p>
                <h2 className="font-display text-2xl font-semibold">
                  Contrato
                </h2>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <TextInput
                label="Titulo"
                required
                value={form.title}
                onChange={(value) =>
                  setForm((current) => ({ ...current, title: value }))
                }
              />
              <label className="block">
                <span className="mono-label text-[color:var(--muted)]">
                  Status
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  {contractStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextInput
                label="Valor"
                type="number"
                value={form.value}
                onChange={(value) =>
                  setForm((current) => ({ ...current, value }))
                }
              />
              <TextInput
                label="Link do contrato"
                value={form.fileUrl}
                onChange={(value) =>
                  setForm((current) => ({ ...current, fileUrl: value }))
                }
              />
              <label className="block md:col-span-2">
                <span className="mono-label text-[color:var(--muted)]">
                  Anexo
                </span>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
                  <Paperclip size={17} className="text-[color:var(--muted)]" />
                  <input
                    className="min-w-0 flex-1 text-sm"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setForm((current) => ({
                          ...current,
                          fileUrl: String(reader.result ?? ""),
                        }));
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </label>
              <Button
                className="md:col-span-2"
                disabled={saveMutation.isPending}
                type="submit"
              >
                <Save size={17} />
                Salvar contrato
              </Button>
            </form>
          </Panel>
        </div>
      </ModalOverlay>
    </Panel>
  );
}

export function ServicesPage() {
  const queryClient = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<ApiClient[]>("/clients"),
  });
  const {
    data: services = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["services"],
    queryFn: () => apiGet<ApiService[]>("/services"),
  });
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<ApiService | null>(null);
  const [form, setForm] = useState<ServiceForm>(defaultServiceForm());

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        ...(editing ? {} : { clientId: form.clientId }),
        monthlyValue: Number(form.monthlyValue || 0),
        paymentDay: Number(form.paymentDay || 1),
        startDate: new Date(`${form.startDate}T00:00:00`).toISOString(),
        active: form.active,
      };
      return editing
        ? apiPatch<ApiService>(`/services/${editing.id}`, payload)
        : apiPost<ApiService>("/services", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditing(null);
      setForm(defaultServiceForm(clients[0]?.id));
    },
    meta: { successMessage: "Servico salvo e cobrancas sincronizadas." },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditing(null);
      setForm(defaultServiceForm(clients[0]?.id));
    },
    meta: { successMessage: "Servico removido." },
  });

  const filteredServices = services.filter((service) =>
    JSON.stringify(service).toLowerCase().includes(filter.toLowerCase()),
  );

  const startCreate = () => {
    setEditing(null);
    setForm(defaultServiceForm(clients[0]?.id));
    setOpen(true);
  };

  const startEdit = (service: ApiService) => {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description ?? "",
      clientId: service.clientId,
      monthlyValue: String(service.monthlyValue ?? 0),
      paymentDay: String(service.paymentDay ?? 1),
      startDate: toDateInput(new Date(service.startDate)),
      active: service.active,
    });
    setOpen(true);
  };

  return (
    <Panel className="overflow-hidden">
      <div className="p-6">
        <Toolbar
          title="Servicos"
          subtitle="Servicos mensais por cliente com cobrancas recorrentes no financeiro."
          onCreate={startCreate}
          onFilter={() => setFilterOpen((current) => !current)}
          createLabel="Servico"
        />
        {filterOpen ? (
          <input
            className="mt-4 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
            placeholder="Filtrar servicos..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        ) : null}
      </div>

      {error ? (
        <div className="mx-6 mb-4 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-600 dark:text-ember-400">
          Erro ao carregar servicos da API.
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-y border-[color:var(--line)] bg-[color:var(--panel-strong)]">
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Servico
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Cliente
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Mensalidade
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Pagamento
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Inicio
              </th>
              <th className="mono-label px-6 py-4 text-left text-[color:var(--muted)]">
                Status
              </th>
              <th className="px-6 py-4 text-right">
                <MoreHorizontal
                  size={18}
                  className="ml-auto text-[color:var(--muted)]"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-6 py-6 text-sm text-[color:var(--muted)]"
                  colSpan={7}
                >
                  Carregando servicos do banco...
                </td>
              </tr>
            ) : null}
            {filteredServices.map((service) => (
              <tr
                className="border-b border-[color:var(--line)] transition hover:bg-[color:var(--panel-strong)]"
                key={service.id}
              >
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold">{service.name}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[color:var(--muted)]">
                    {service.description || "Servico mensal"}
                  </p>
                </td>
                <td className="px-6 py-4 text-sm">
                  {service.client?.name ?? "Sem cliente"}
                </td>
                <td className="px-6 py-4 text-sm font-semibold">
                  {money(Number(service.monthlyValue))}
                </td>
                <td className="px-6 py-4 text-sm">Dia {service.paymentDay}</td>
                <td className="px-6 py-4 text-sm">
                  {new Date(service.startDate).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-4 text-sm">
                  <StatusBadge tone={service.active ? "success" : "neutral"}>
                    {service.active ? "Ativo" : "Inativo"}
                  </StatusBadge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => startEdit(service)}
                    >
                      <Edit3 size={16} />
                      Editar
                    </Button>
                    <Button
                      aria-label="Apagar servico"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(service.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredServices.length && !isLoading ? (
              <tr>
                <td
                  className="px-6 py-6 text-sm text-[color:var(--muted)]"
                  colSpan={7}
                >
                  Nenhum servico cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ModalOverlay open={open}>
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-3xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="mono-label text-[color:var(--muted)]">
                  {editing ? "Editar" : "Novo"}
                </p>
                <h2 className="font-display text-2xl font-semibold">Servico</h2>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <TextInput
                label="Nome"
                required
                value={form.name}
                onChange={(value) =>
                  setForm((current) => ({ ...current, name: value }))
                }
              />
              <label className="block">
                <span className="mono-label text-[color:var(--muted)]">
                  Cliente
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none disabled:opacity-60"
                  disabled={Boolean(editing)}
                  required
                  value={form.clientId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      clientId: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <TextInput
                label="Mensalidade"
                required
                type="number"
                value={form.monthlyValue}
                onChange={(value) =>
                  setForm((current) => ({ ...current, monthlyValue: value }))
                }
              />
              <TextInput
                label="Dia de pagamento"
                required
                type="number"
                value={form.paymentDay}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    paymentDay: clampPaymentDay(value),
                  }))
                }
              />
              <TextInput
                label="Inicio do servico"
                required
                type="date"
                value={form.startDate}
                onChange={(value) =>
                  setForm((current) => ({ ...current, startDate: value }))
                }
              />
              <label className="flex min-h-20 items-center gap-2">
                <input
                  checked={form.active}
                  className="h-4 w-4 accent-[color:var(--success)]"
                  type="checkbox"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                />
                <span className="text-sm font-semibold">Servico ativo</span>
              </label>
              <TextArea
                label="Descricao"
                value={form.description}
                onChange={(value) =>
                  setForm((current) => ({ ...current, description: value }))
                }
              />
              <div className="flex items-end justify-end gap-2 md:col-span-2">
                {editing ? (
                  <Button
                    disabled={deleteMutation.isPending}
                    type="button"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(editing.id)}
                  >
                    <Trash2 size={17} />
                    Apagar
                  </Button>
                ) : null}
                <Button disabled={saveMutation.isPending} type="submit">
                  <Save size={17} />
                  {saveMutation.isPending ? "Salvando..." : "Salvar servico"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </ModalOverlay>
    </Panel>
  );
}

function defaultServiceForm(clientId = ""): ServiceForm {
  return {
    name: "",
    description: "",
    clientId,
    monthlyValue: "",
    paymentDay: "1",
    startDate: toDateInput(new Date()),
    active: true,
  };
}

function clampPaymentDay(value: string) {
  const day = Math.max(1, Math.min(31, Number(value || 1)));
  return String(day);
}

export function FinancialPage() {
  const queryClient = useQueryClient();
  const {
    data: transactions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["financial"],
    queryFn: () => apiGet<ApiTransaction[]>("/financial"),
  });
  const [view, setView] = useState<"Day" | "Week" | "Month">("Month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ApiTransaction | null>(
    null,
  );
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm());
  const paymentOrders = transactions;
  const attentionOrders = paymentOrders
    .filter((item) => item.status === "PENDING" || item.status === "OVERDUE")
    .sort(
      (a, b) =>
        statusPriority(a.status) - statusPriority(b.status) ||
        new Date(a.dueDate ?? a.id).getTime() -
          new Date(b.dueDate ?? b.id).getTime(),
    );
  const periodDays = financialPeriodDays(currentDate, view);
  const ordersByDay = new Map<string, ApiTransaction[]>();

  for (const order of paymentOrders) {
    const date = order.dueDate ? new Date(order.dueDate) : new Date();
    const key = dateKey(date);
    ordersByDay.set(key, [...(ordersByDay.get(key) ?? []), order]);
  }

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch<ApiTransaction>(`/financial/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    meta: { successMessage: "Ordem de pagamento atualizada." },
  });

  const savePaymentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (editingPayment)
        return apiPatch<ApiTransaction>(
          `/financial/${editingPayment.id}`,
          payload,
        );
      return apiPost<ApiTransaction>("/financial", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditingPayment(null);
      setPaymentForm(defaultPaymentForm());
    },
    meta: { successMessage: "Pagamento salvo." },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/financial/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditingPayment(null);
      setPaymentForm(defaultPaymentForm());
    },
    meta: { successMessage: "Pagamento removido." },
  });

  const startCreatePayment = () => {
    setEditingPayment(null);
    setPaymentForm(defaultPaymentForm(currentDate));
    setOpen(true);
  };

  const startEditPayment = (order: ApiTransaction) => {
    setEditingPayment(order);
    setPaymentForm(paymentFormFromOrder(order));
    setOpen(true);
  };

  const submitPayment = (event: FormEvent) => {
    event.preventDefault();
    savePaymentMutation.mutate({
      entity: paymentForm.entity,
      kind: paymentForm.kind,
      amount:
        paymentForm.kind === "EXPENSE"
          ? -Math.abs(Number(paymentForm.amount || 0))
          : Math.abs(Number(paymentForm.amount || 0)),
      status: paymentForm.status,
      dueDate: paymentForm.dueDate
        ? datetimeLocalToIso(paymentForm.dueDate)
        : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mono-label text-[color:var(--muted)]">Financeiro</p>
            <h1 className="mt-1 font-display text-3xl font-bold">
              Historico de pagamentos
            </h1>
            <p className="mt-2 text-[color:var(--muted)]">
              Ordens geradas automaticamente quando modulos de projeto sao
              concluidos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={startCreatePayment}>
              <Plus size={17} />
              Pagamento
            </Button>
          </div>
        </div>
      </Panel>

      {error ? (
        <div className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-600 dark:text-ember-400">
          Erro ao carregar historico financeiro.
        </div>
      ) : null}

      <Panel className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="mono-label text-[color:var(--muted)]">Atencao</p>
            <h2 className="font-display text-2xl font-semibold">
              Atrasados e pendentes
            </h2>
          </div>
          <StatusBadge tone="warning">
            {attentionOrders.length} ordens
          </StatusBadge>
        </div>
        <div className="grid gap-3">
          {isLoading ? (
            <p className="text-sm text-[color:var(--muted)]">
              Carregando pagamentos...
            </p>
          ) : null}
          {attentionOrders.map((order) => (
            <PaymentOrderCard
              key={order.id}
              order={order}
              onEdit={() => startEditPayment(order)}
              onStatusChange={(status) =>
                updateStatusMutation.mutate({ id: order.id, status })
              }
            />
          ))}
          {!attentionOrders.length && !isLoading ? (
            <p className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm text-[color:var(--muted)]">
              Nenhuma ordem atrasada ou pendente.
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="schedule-shell overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel)] shadow-panel dark:shadow-panel-dark">
        <div className="grid gap-4 border-b border-[color:var(--line)] bg-[color:var(--panel)] p-5 backdrop-blur-xl xl:grid-cols-[minmax(240px,1fr)_auto_minmax(240px,1fr)] xl:items-center">
          <div>
            <p className="mono-label text-[color:var(--muted)]">Calendario</p>
            <h2 className="mt-1 min-w-0 truncate font-display text-3xl font-bold md:text-4xl">
              {financialTitle(currentDate, view)}
            </h2>
          </div>
          <div className="justify-self-start xl:justify-self-center">
            <div className="flex w-[196px] items-center justify-between rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-1">
              <Button
                aria-label="Periodo anterior"
                variant="ghost"
                onClick={() =>
                  setCurrentDate((date) => addFinancialPeriod(date, view, -1))
                }
              >
                <ChevronLeft size={18} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCurrentDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                aria-label="Proximo periodo"
                variant="ghost"
                onClick={() =>
                  setCurrentDate((date) => addFinancialPeriod(date, view, 1))
                }
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-self-end">
            <div className="flex rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-1">
              {(["Day", "Week", "Month"] as const).map((mode) => (
                <button
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === mode ? "bg-[color:var(--primary)] text-white dark:bg-[color:var(--warning)] dark:text-navy-950" : "text-[color:var(--muted)] hover:text-[color:var(--text)]"}`}
                  key={mode}
                  onClick={() => setView(mode)}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="max-h-[760px] overflow-auto bg-[color:var(--bg)]/35">
          {view === "Month" ? (
            <FinancialMonthCalendar
              currentDate={currentDate}
              onDayClick={(day) => {
                setCurrentDate(day);
                setView("Day");
              }}
              ordersByDay={ordersByDay}
              onEdit={startEditPayment}
            />
          ) : (
            <div className="min-w-[980px]">
              <div
                className="sticky top-0 z-20 grid border-b border-[color:var(--line)] bg-[color:var(--panel)] backdrop-blur-xl"
                style={{
                  gridTemplateColumns: `72px repeat(${periodDays.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="border-r border-[color:var(--line)]" />
                {periodDays.map((day) => (
                  <div
                    className={`border-r border-[color:var(--line)] py-4 text-center last:border-r-0 ${isSameDate(day, today) ? "bg-[color:var(--accent)]/10" : ""}`}
                    key={day.toISOString()}
                  >
                    <p className="mono-label text-[color:var(--muted)]">
                      {weekdayLabel(day)}
                    </p>
                    <button
                      className={`mx-auto mt-2 grid h-11 w-11 cursor-pointer place-items-center rounded-full font-display text-2xl font-bold ${isSameDate(day, today) ? "bg-[color:var(--primary)] text-white shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_60%,transparent)] dark:bg-[color:var(--warning)] dark:text-navy-950" : "hover:bg-[color:var(--accent)]/10"}`}
                      onClick={() => {
                        setCurrentDate(day);
                        setView("Day");
                      }}
                      type="button"
                    >
                      {day.getDate()}
                    </button>
                  </div>
                ))}
              </div>
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `72px repeat(${periodDays.length}, minmax(0, 1fr))`,
                  height: `${scheduleHours.length * hourHeight}px`,
                }}
              >
                <div className="border-r border-[color:var(--line)] bg-[color:var(--panel)]/40">
                  {scheduleHours.map((hour) => (
                    <div
                      className="relative border-b border-transparent pr-2 text-right font-mono text-xs text-[color:var(--muted)]"
                      key={hour}
                      style={{ height: hourHeight }}
                    >
                      <span className="relative top-[-2px]">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>
                {periodDays.map((day) => (
                  <div
                    className={`relative border-r border-[color:var(--line)] last:border-r-0 ${isSameDate(day, today) ? "bg-[color:var(--accent)]/8" : ""}`}
                    key={day.toISOString()}
                  >
                    {scheduleHours.map((hour) => (
                      <div
                        className="border-b border-[color:var(--line)]/80"
                        key={hour}
                        style={{ height: hourHeight }}
                      />
                    ))}
                  </div>
                ))}
                {paymentOrders
                  .filter(
                    (order) =>
                      order.dueDate &&
                      isInRange(
                        new Date(order.dueDate),
                        periodDays[0],
                        periodDays[periodDays.length - 1],
                        view,
                      ),
                  )
                  .map((order, index) => (
                    <FinancialScheduleCard
                      dayCount={periodDays.length}
                      index={index}
                      key={order.id}
                      onEdit={startEditPayment}
                      order={order}
                      visibleDays={periodDays}
                    />
                  ))}
                {!isLoading &&
                !paymentOrders.filter(
                  (order) =>
                    order.dueDate &&
                    isInRange(
                      new Date(order.dueDate),
                      periodDays[0],
                      periodDays[periodDays.length - 1],
                      view,
                    ),
                ).length ? (
                  <div className="absolute left-[96px] top-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm text-[color:var(--muted)]">
                    Nenhum pagamento neste periodo.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <ModalOverlay open={open}>
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-2xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="mono-label text-[color:var(--muted)]">
                  {editingPayment ? "Editar" : "Novo"}
                </p>
                <h2 className="font-display text-2xl font-semibold">
                  Pagamento
                </h2>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={submitPayment}
            >
              <TextInput
                label="Descricao"
                required
                value={paymentForm.entity}
                onChange={(value) =>
                  setPaymentForm((current) => ({ ...current, entity: value }))
                }
              />
              <TextInput
                label="Valor"
                required
                type="number"
                value={paymentForm.amount}
                onChange={(value) =>
                  setPaymentForm((current) => ({ ...current, amount: value }))
                }
              />
              <label className="block">
                <span className="mono-label text-[color:var(--muted)]">
                  Tipo
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                  value={paymentForm.kind}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      kind: event.target.value,
                    }))
                  }
                >
                  {kindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mono-label text-[color:var(--muted)]">
                  Status
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                  value={paymentForm.status}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  {transactionStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextInput
                label="Data"
                type="datetime-local"
                value={paymentForm.dueDate}
                onChange={(value) =>
                  setPaymentForm((current) => ({ ...current, dueDate: value }))
                }
              />
              <div className="flex items-end justify-end gap-2 md:col-span-2">
                {editingPayment ? (
                  <Button
                    disabled={deletePaymentMutation.isPending}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      deletePaymentMutation.mutate(editingPayment.id)
                    }
                  >
                    <Trash2 size={17} />
                    Apagar
                  </Button>
                ) : null}
                <Button disabled={savePaymentMutation.isPending} type="submit">
                  <Save size={17} />
                  {savePaymentMutation.isPending
                    ? "Salvando..."
                    : "Salvar pagamento"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </ModalOverlay>
    </div>
  );
}

function PaymentOrderCard({
  order,
  onStatusChange,
  onEdit,
}: {
  order: ApiTransaction;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={`grid gap-3 rounded-2xl border p-4 lg:grid-cols-[minmax(0,1fr)_140px_220px] lg:items-center ${paymentToneClass(order)}`}
    >
      <button className="text-left" onClick={onEdit} type="button">
        <p className="font-semibold">{order.entity}</p>
        <p className="mt-1 text-sm opacity-80">
          {order.dueDate
            ? new Date(order.dueDate).toLocaleDateString("pt-BR")
            : "Sem data"}{" "}
          -{" "}
          {order.module?.project?.name ??
            order.service?.name ??
            "Pagamento manual"}
        </p>
      </button>
      <p className="font-display text-xl font-bold">{signedMoney(order)}</p>
      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Editar
        </Button>
        {order.status !== "PAID" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onStatusChange("PAID")}
          >
            Pago
          </Button>
        ) : null}
        {order.status !== "PENDING" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onStatusChange("PENDING")}
          >
            Pendente
          </Button>
        ) : null}
        {order.status !== "CANCELLED" ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onStatusChange("CANCELLED")}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function defaultPaymentForm(date = new Date()): PaymentForm {
  return {
    entity: "",
    amount: "",
    kind: "REVENUE",
    status: "PENDING",
    dueDate: toDatetimeLocal(date),
  };
}

function paymentFormFromOrder(order: ApiTransaction): PaymentForm {
  return {
    entity: order.entity,
    amount: String(Math.abs(Number(order.amount ?? 0))),
    kind: order.kind ?? "REVENUE",
    status: order.status ?? "PENDING",
    dueDate: order.dueDate ? toDatetimeLocal(new Date(order.dueDate)) : "",
  };
}

function paymentToneClass(order: ApiTransaction) {
  if (order.status === "CANCELLED")
    return "border-[color:var(--line)] bg-[color:var(--muted)]/10 text-[color:var(--muted)]";
  if (order.kind === "EXPENSE")
    return "border-orange-800/40 bg-orange-800/15 text-orange-950 dark:text-orange-200";
  if (order.status === "PAID")
    return "border-mint-500/30 bg-mint-500/10 text-mint-700 dark:text-slate-100";
  if (order.status === "OVERDUE")
    return "border-ember-500/40 bg-ember-500/12 text-ember-700 dark:text-ember-300";
  return "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-200";
}

function signedAmount(order: ApiTransaction) {
  const amount = Math.abs(Number(order.amount ?? 0));
  return order.kind === "EXPENSE" ? -amount : amount;
}

function signedMoney(order: ApiTransaction) {
  return money(signedAmount(order));
}

function statusPriority(status: string) {
  return { OVERDUE: 0, PENDING: 1, PAID: 2, CANCELLED: 3 }[status] ?? 4;
}

function financialPeriodDays(date: Date, view: "Day" | "Week" | "Month") {
  if (view === "Day") {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return [day];
  }
  if (view === "Week") return buildWeek(date);
  return buildMonthDays(date);
}

function addFinancialPeriod(
  date: Date,
  view: "Day" | "Week" | "Month",
  amount: number,
) {
  const next = new Date(date);
  if (view === "Day") next.setDate(next.getDate() + amount);
  if (view === "Week") next.setDate(next.getDate() + amount * 7);
  if (view === "Month") next.setMonth(next.getMonth() + amount);
  return next;
}

function financialTitle(date: Date, view: "Day" | "Week" | "Month") {
  if (view === "Day")
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  if (view === "Week") {
    const days = buildWeek(date);
    return `${days[0].toLocaleDateString("pt-BR")} - ${days[6].toLocaleDateString("pt-BR")}`;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function FinancialMonthCalendar({
  currentDate,
  ordersByDay,
  onEdit,
  onDayClick,
}: {
  currentDate: Date;
  ordersByDay: Map<string, ApiTransaction[]>;
  onEdit: (order: ApiTransaction) => void;
  onDayClick: (day: Date) => void;
}) {
  const today = new Date();
  const days = buildMonthDays(currentDate);

  return (
    <div className="min-w-[820px]">
      <div className="grid grid-cols-7 border-b border-[color:var(--line)] bg-[color:var(--panel)] backdrop-blur-xl">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
          <div
            className="mono-label border-r border-[color:var(--line)] px-4 py-3 text-center text-[color:var(--muted)] last:border-r-0"
            key={day}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayOrders = ordersByDay.get(dateKey(day)) ?? [];
          const muted = day.getMonth() !== currentDate.getMonth();
          return (
            <div
              className={`min-h-36 border-b border-r border-[color:var(--line)] p-3 last:border-r-0 ${muted ? "opacity-45" : ""} ${isSameDate(day, today) ? "bg-[color:var(--accent)]/10" : ""}`}
              key={day.toISOString()}
            >
              <button
                className={`mb-2 grid h-8 w-8 cursor-pointer place-items-center rounded-full font-display font-semibold ${isSameDate(day, today) ? "bg-[color:var(--primary)] text-white dark:bg-[color:var(--warning)] dark:text-navy-950" : "hover:bg-[color:var(--accent)]/10"}`}
                onClick={() => onDayClick(day)}
                type="button"
              >
                {day.getDate()}
              </button>
              <div className="space-y-2">
                {dayOrders.slice(0, 3).map((order) => (
                  <button
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs shadow-panel transition hover:-translate-y-0.5 ${paymentToneClass(order)}`}
                    key={order.id}
                    onClick={() => onEdit(order)}
                    type="button"
                  >
                    <p className="line-clamp-1 font-semibold">
                      {order.module?.name ?? order.entity}
                    </p>
                    <p className="mt-1 opacity-80">
                      {signedMoney(order)} -{" "}
                      {translateTransaction(order.status)}
                    </p>
                  </button>
                ))}
                {dayOrders.length > 3 ? (
                  <p className="text-xs font-semibold text-[color:var(--muted)]">
                    +{dayOrders.length - 3} pagamentos
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinancialScheduleCard({
  order,
  index,
  visibleDays,
  dayCount,
  onEdit,
}: {
  order: ApiTransaction;
  index: number;
  visibleDays: Date[];
  dayCount: number;
  onEdit: (order: ApiTransaction) => void;
}) {
  const start = order.dueDate ? new Date(order.dueDate) : new Date();
  const dayIndex = Math.max(
    0,
    visibleDays.findIndex((day) => isSameDate(day, start)),
  );
  const dayWidth = `calc((100% - 72px) / ${dayCount})`;
  const eventHour = Math.max(
    0,
    Math.min(23.99, start.getHours() + start.getMinutes() / 60),
  );
  const top = eventHour * hourHeight + (index % 3) * 6;

  return (
    <button
      className={`absolute z-20 rounded-r-xl border-l-4 p-3 text-left shadow-panel backdrop-blur-xl transition hover:scale-[1.01] ${paymentToneClass(order)}`}
      style={{
        left: `calc(72px + ${dayIndex} * ${dayWidth})`,
        top,
        width: dayWidth,
        minHeight: 64,
      }}
      onClick={() => onEdit(order)}
      type="button"
    >
      <p className="font-mono text-xs font-bold">
        {timeLabel(start)} - {translateTransaction(order.status)}
      </p>
      <p className="mt-1 line-clamp-2 font-semibold leading-tight">
        {order.module?.name ?? order.entity}
      </p>
      <p className="mt-1 truncate text-xs opacity-80">
        {signedMoney(order)} -{" "}
        {order.module?.project?.name ??
          order.service?.name ??
          "Pagamento manual"}
      </p>
    </button>
  );
}

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => apiGet<ApiAppointment[]>("/appointments"),
  });
  const [open, setOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<"Day" | "Week" | "Month">(
    "Week",
  );
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [editingAppointment, setEditingAppointment] =
    useState<ApiAppointment | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const visibleDays = useMemo(
    () => buildVisibleDays(currentDate, selectedView),
    [currentDate, selectedView],
  );
  const visibleEvents = data.filter((event) =>
    isInRange(
      new Date(event.startsAt),
      visibleDays[0],
      visibleDays[visibleDays.length - 1],
      selectedView,
    ),
  );
  const today = useMemo(() => new Date(), []);
  const sortedAppointments = [...data].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const todayEvents = sortedAppointments.filter((event) =>
    isSameDate(new Date(event.startsAt), today),
  );
  const upcoming = sortedAppointments
    .filter((event) => new Date(event.startsAt).getTime() >= today.getTime())
    .slice(0, 4);
  const upcomingEvents = upcoming.length
    ? upcoming
    : sortedAppointments.slice(0, 4);

  const [form, setForm] = useState(() => defaultAppointmentForm(currentDate));
  const mutation = useMutation({
    mutationFn: async (
      payload: Record<string, unknown> | Record<string, unknown>[],
    ) => {
      if (Array.isArray(payload))
        return Promise.all(
          payload.map((item) => apiPost<ApiAppointment>("/appointments", item)),
        );
      if (editingAppointment)
        return [
          await apiPatch<ApiAppointment>(
            `/appointments/${editingAppointment.id}`,
            payload,
          ),
        ];
      return [await apiPost<ApiAppointment>("/appointments", payload)];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditingAppointment(null);
    },
    meta: { successMessage: "Evento salvo na agenda." },
  });

  const startCreate = () => {
    setEditingAppointment(null);
    setForm(defaultAppointmentForm(currentDate));
    setOpen(true);
  };

  const startEdit = (appointment: ApiAppointment) => {
    setEditingAppointment(appointment);
    setForm(appointmentFormFromEvent(appointment));
    setOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      editingAppointment || form.repeatMode === "none"
        ? appointmentPayloadFromForm(form)
        : buildRecurringAppointmentPayloads(form),
    );
  };

  return (
    <div className="schedule-shell relative overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel)] shadow-panel dark:shadow-panel-dark">
      <div className="grid gap-4 border-b border-[color:var(--line)] bg-[color:var(--panel)] p-5 backdrop-blur-xl xl:grid-cols-[minmax(240px,1fr)_auto_minmax(240px,1fr)] xl:items-center">
        <h1 className="min-w-0 truncate font-display text-3xl font-bold md:text-4xl">
          {calendarTitle(currentDate, selectedView)}
        </h1>
        <div className="justify-self-start xl:justify-self-center">
          <div className="flex w-[196px] items-center justify-between rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-1">
            <Button
              aria-label="Periodo anterior"
              variant="ghost"
              onClick={() =>
                setCurrentDate((date) =>
                  addCalendarPeriod(date, selectedView, -1),
                )
              }
            >
              <ChevronLeft size={18} />
            </Button>
            <Button variant="ghost" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button
              aria-label="Proximo periodo"
              variant="ghost"
              onClick={() =>
                setCurrentDate((date) =>
                  addCalendarPeriod(date, selectedView, 1),
                )
              }
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-self-end">
          <div className="flex rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-1">
            {(["Day", "Week", "Month"] as const).map((view) => (
              <button
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${selectedView === view ? "bg-[color:var(--primary)] text-white dark:bg-[color:var(--warning)] dark:text-navy-950" : "text-[color:var(--muted)] hover:text-[color:var(--text)]"}`}
                key={view}
                onClick={() => {
                  setSelectedView(view);
                  setCurrentDate((date) => new Date(date));
                }}
                type="button"
              >
                {view}
              </button>
            ))}
          </div>
          <Button onClick={startCreate}>
            <Plus size={18} />
            New Event
          </Button>
        </div>
      </div>

      <div className="min-h-[760px]">
        <div className="max-h-[760px] overflow-auto bg-[color:var(--bg)]/35">
          {selectedView === "Month" ? (
            <MonthCalendar
              currentDate={currentDate}
              events={visibleEvents}
              onDayClick={(day) => {
                setCurrentDate(day);
                setSelectedView("Day");
              }}
              onEdit={startEdit}
            />
          ) : (
            <div className="min-w-[980px]">
              <div
                className="sticky top-0 z-20 grid border-b border-[color:var(--line)] bg-[color:var(--panel)] backdrop-blur-xl"
                style={{
                  gridTemplateColumns: `72px repeat(${visibleDays.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="border-r border-[color:var(--line)]" />
                {visibleDays.map((day) => (
                  <div
                    className={`border-r border-[color:var(--line)] py-4 text-center last:border-r-0 ${isSameDate(day, today) ? "bg-[color:var(--accent)]/10" : ""}`}
                    key={day.toISOString()}
                  >
                    <p className="mono-label text-[color:var(--muted)]">
                      {weekdayLabel(day)}
                    </p>
                    <button
                      className={`mx-auto mt-2 grid h-11 w-11 cursor-pointer place-items-center rounded-full font-display text-2xl font-bold ${isSameDate(day, today) ? "bg-[color:var(--primary)] text-white shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_60%,transparent)] dark:bg-[color:var(--warning)] dark:text-navy-950" : "hover:bg-[color:var(--accent)]/10"}`}
                      onClick={() => {
                        setCurrentDate(day);
                        setSelectedView("Day");
                      }}
                      type="button"
                    >
                      {day.getDate()}
                    </button>
                  </div>
                ))}
              </div>

              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `72px repeat(${visibleDays.length}, minmax(0, 1fr))`,
                  height: `${scheduleHours.length * hourHeight}px`,
                }}
              >
                <div className="border-r border-[color:var(--line)] bg-[color:var(--panel)]/40">
                  {scheduleHours.map((hour) => (
                    <div
                      className="relative border-b border-transparent pr-2 text-right font-mono text-xs text-[color:var(--muted)]"
                      key={hour}
                      style={{ height: hourHeight }}
                    >
                      <span className="relative top-[-2px]">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>
                {visibleDays.map((day) => (
                  <div
                    className={`relative border-r border-[color:var(--line)] last:border-r-0 ${isSameDate(day, today) ? "bg-[color:var(--accent)]/8" : ""}`}
                    key={day.toISOString()}
                  >
                    {scheduleHours.map((hour) => (
                      <div
                        className="border-b border-[color:var(--line)]/80"
                        key={hour}
                        style={{ height: hourHeight }}
                      />
                    ))}
                  </div>
                ))}

                {visibleDays.some((day) => isSameDate(day, new Date())) ? (
                  <div
                    className="pointer-events-none absolute left-[72px] right-0 z-10 flex items-center"
                    style={{ top: currentLineTop(new Date()) }}
                  >
                    <span className="h-3 w-3 rounded-full bg-[color:var(--primary)] dark:bg-[color:var(--warning)]" />
                    <span className="h-0.5 flex-1 bg-[color:var(--primary)] shadow-[0_0_18px_color-mix(in_srgb,var(--accent)_75%,transparent)] dark:bg-[color:var(--warning)]" />
                  </div>
                ) : null}

                {visibleEvents.map((event, index) => (
                  <ScheduleEventCard
                    dayCount={visibleDays.length}
                    event={event}
                    index={index}
                    key={event.id}
                    onEdit={startEdit}
                    visibleDays={visibleDays}
                  />
                ))}

                {!visibleEvents.length && !isLoading ? (
                  <div className="absolute left-[96px] top-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm text-[color:var(--muted)]">
                    Nenhum evento neste periodo. Use New Event para gravar um
                    compromisso no banco.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <aside
          className={`absolute bottom-0 right-0 top-24 z-30 flex w-[min(360px,calc(100%-1rem))] flex-col gap-7 overflow-y-auto border-l border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-panel backdrop-blur-xl transition-transform duration-300 dark:shadow-panel-dark ${sidePanelOpen ? "translate-x-0" : "translate-x-[calc(100%-56px)]"}`}
        >
          <button
            className="absolute left-3 top-4 grid h-10 w-10 place-items-center rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--muted)] shadow-sm transition hover:text-[color:var(--text)]"
            onClick={() => setSidePanelOpen((current) => !current)}
            type="button"
            aria-label={sidePanelOpen ? "Recolher painel" : "Expandir painel"}
          >
            {sidePanelOpen ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
          <div
            className={`${sidePanelOpen ? "opacity-100" : "pointer-events-none opacity-0"} pl-8 transition-opacity duration-200`}
          >
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
                <Bell
                  className="text-[color:var(--primary)] dark:text-[color:var(--warning)]"
                  size={24}
                />
                Reminders
              </h2>
              <div className="space-y-3">
                {todayEvents.length ? (
                  todayEvents.map((event) => (
                    <Reminder
                      key={event.id}
                      title={event.title}
                      meta={`${timeRangeLabel(event)}${event.client ? ` - ${event.client}` : ""}`}
                      urgent={
                        new Date(event.startsAt).getTime() < today.getTime()
                      }
                    />
                  ))
                ) : (
                  <p className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm text-[color:var(--muted)]">
                    Nenhum compromisso para hoje.
                  </p>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
                <CalendarDays
                  className="text-[color:var(--primary)] dark:text-[color:var(--warning)]"
                  size={24}
                />
                Upcoming
              </h2>
              <div className="relative space-y-5 border-l border-[color:var(--line)] pl-5">
                {upcomingEvents.map((event, index) => (
                  <div className="relative" key={event.id}>
                    <span
                      className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ${index === 0 ? "bg-[color:var(--primary)] dark:bg-[color:var(--warning)]" : "bg-[color:var(--muted)]"}`}
                    />
                    <p className="mono-label mb-2 text-[color:var(--muted)]">
                      {relativeDayLabel(new Date(event.startsAt), today)}
                    </p>
                    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
                      <p className="font-semibold">{event.title}</p>
                      <p className="mt-2 flex items-center gap-1 text-sm text-[color:var(--muted)]">
                        <Clock size={14} />
                        {timeRangeLabel(event)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-7 overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--warning)]/20 p-5">
              <p className="mono-label text-[color:var(--primary)] dark:text-[color:var(--accent)]">
                Focus Mode
              </p>
              <p className="mt-3 text-sm text-[color:var(--text)]">
                Bloqueie distracoes pelos proximos 120 minutos.
              </p>
              <Button className="mt-4 w-full" variant="secondary">
                <Focus size={17} />
                Enable
              </Button>
            </section>
          </div>
        </aside>
      </div>

      <ModalOverlay open={open}>
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-2xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="mono-label text-[color:var(--muted)]">Agenda</p>
                <h2 className="font-display text-2xl font-semibold">
                  {editingAppointment ? "Edit Event" : "New Event"}
                </h2>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setEditingAppointment(null);
                }}
              >
                <X size={18} />
              </Button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <TextInput
                label="Titulo"
                required
                value={form.title}
                onChange={(value) =>
                  setForm((current) => ({ ...current, title: value }))
                }
              />
              <TextInput
                label="Cliente"
                value={form.client}
                onChange={(value) =>
                  setForm((current) => ({ ...current, client: value }))
                }
              />
              <TextInput
                label="Local"
                value={form.location}
                onChange={(value) =>
                  setForm((current) => ({ ...current, location: value }))
                }
              />
              <TextInput
                label="Inicio"
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(value) =>
                  setForm((current) => ({ ...current, startsAt: value }))
                }
              />
              <TextInput
                label="Fim"
                type="datetime-local"
                value={form.endsAt}
                onChange={(value) =>
                  setForm((current) => ({ ...current, endsAt: value }))
                }
              />
              <TextArea
                label="Observacao"
                value={form.notes}
                onChange={(value) =>
                  setForm((current) => ({ ...current, notes: value }))
                }
              />
              {!editingAppointment ? (
                <>
                  <label className="block md:col-span-2">
                    <span className="mono-label text-[color:var(--muted)]">
                      Repeticao
                    </span>
                    <select
                      className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                      value={form.repeatMode}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          repeatMode: event.target
                            .value as AppointmentForm["repeatMode"],
                        }))
                      }
                    >
                      <option value="none">Nao repetir</option>
                      <option value="weekly">Toda semana</option>
                      <option value="monthly">Todo mes</option>
                    </select>
                  </label>
                  {form.repeatMode === "weekly" ? (
                    <div className="md:col-span-2">
                      <span className="mono-label text-[color:var(--muted)]">
                        Dias da semana
                      </span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {weekdayShortLabels.map((label, index) => (
                          <button
                            className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${form.repeatWeekdays.includes(index) ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white dark:border-[color:var(--warning)] dark:bg-[color:var(--warning)] dark:text-navy-950" : "border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--muted)]"}`}
                            key={label}
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                repeatWeekdays: toggleNumber(
                                  current.repeatWeekdays,
                                  index,
                                ),
                              }))
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {form.repeatMode === "monthly" ? (
                    <TextInput
                      label="Dia do mes"
                      type="number"
                      value={form.repeatMonthDay}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          repeatMonthDay: value,
                        }))
                      }
                    />
                  ) : null}
                </>
              ) : null}
              <Button
                className="md:col-span-2"
                disabled={mutation.isPending}
                type="submit"
              >
                <Save size={17} />
                {mutation.isPending
                  ? "Saving..."
                  : editingAppointment
                    ? "Update Event"
                    : "Save Event"}
              </Button>
            </form>
          </Panel>
        </div>
      </ModalOverlay>
    </div>
  );
}

export function ResourcesPage() {
  return (
    <CrudPage<ApiResource>
      title="Recursos"
      subtitle="Equipe, papeis e capacidade operacional."
      queryKey="resources"
      endpoint="/resources"
      columns={[
        { key: "name", label: "Nome" },
        { key: "role", label: "Papel" },
        {
          key: "capacity",
          label: "Capacidade",
          render: (row) => `${row.capacity}%`,
        },
      ]}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "role", label: "Papel", required: true },
        { name: "capacity", label: "Capacidade", type: "number" },
      ]}
      normalize={(values) => ({
        ...values,
        capacity: Number(values.capacity ?? 100),
      })}
    />
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<ApiSettings>("/settings"),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<ApiUser[]>("/users"),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<ApiClient[]>("/clients"),
  });
  const storedUserId = useMemo(() => {
    try {
      return (
        (
          JSON.parse(localStorage.getItem("projectfy-user") ?? "{}") as {
            id?: string;
          }
        ).id ?? ""
      );
    } catch {
      return "";
    }
  }, []);
  const currentUser =
    users.find((u) => u.id === storedUserId) ??
    users.find((u) => u.role === "ADMIN") ??
    users[0];
  const staffUsers = users.filter((u) => u.id !== currentUser?.id);
  const [settingsForm, setSettingsForm] = useState({
    timezone: "America/Fortaleza",
    currency: "BRL",
    supportPhone: "",
  });
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    role: "ADMIN",
    clientId: "",
    password: "",
    confirmPassword: "",
  });

  const settingsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPatch<ApiSettings>("/settings", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
    meta: { successMessage: "Configuracoes salvas." },
  });

  const userMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      currentUser
        ? apiPatch<ApiUser>(`/users/${currentUser.id}`, payload)
        : apiPost<ApiUser>("/users", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setUserForm((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
    },
    meta: { successMessage: "Dados do usuario salvos." },
  });

  useEffect(() => {
    if (settings)
      setSettingsForm({
        timezone: settings.timezone,
        currency: settings.currency ?? "BRL",
        supportPhone: settings.supportPhone ?? "",
      });
  }, [settings]);

  useEffect(() => {
    if (currentUser)
      setUserForm({
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone ?? "",
        address: currentUser.address ?? "",
        role: currentUser.role,
        clientId: currentUser.clientId ?? "",
        password: "",
        confirmPassword: "",
      });
  }, [currentUser]);

  const saveUser = (event: FormEvent) => {
    event.preventDefault();
    if (userForm.password && userForm.password !== userForm.confirmPassword) {
      userMutation.reset();
      return;
    }
    userMutation.mutate({
      name: userForm.name,
      email: userForm.email,
      phone: userForm.phone || undefined,
      address: userForm.address || undefined,
      role: userForm.role,
      clientId:
        userForm.role === "CLIENT" ? userForm.clientId || undefined : null,
      ...(userForm.password ? { password: userForm.password } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <Toolbar
          title="Configuracoes"
          subtitle="Conta, acesso e preferencias globais."
          onCreate={() => settingsMutation.mutate(settingsForm)}
          createLabel="Salvar"
        />
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={saveUser}>
          <TextInput
            label="Nome"
            required
            value={userForm.name}
            onChange={(value) =>
              setUserForm((current) => ({ ...current, name: value }))
            }
          />
          <TextInput
            label="E-mail de login"
            required
            type="email"
            value={userForm.email}
            onChange={(value) =>
              setUserForm((current) => ({ ...current, email: value }))
            }
          />
          <TextInput
            label="Telefone"
            value={userForm.phone}
            onChange={(value) =>
              setUserForm((current) => ({ ...current, phone: value }))
            }
          />
          <label className="block">
            <span className="mono-label text-[color:var(--muted)]">Perfil</span>
            <select
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
              value={userForm.role}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  role: event.target.value,
                }))
              }
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {userForm.role === "CLIENT" ? (
            <label className="block">
              <span className="mono-label text-[color:var(--muted)]">
                Cliente associado
              </span>
              <select
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                value={userForm.clientId}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    clientId: event.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <TextArea
            label="Endereco"
            value={userForm.address}
            onChange={(value) =>
              setUserForm((current) => ({ ...current, address: value }))
            }
          />
          <TextInput
            label="Nova senha"
            type="password"
            value={userForm.password}
            onChange={(value) =>
              setUserForm((current) => ({ ...current, password: value }))
            }
          />
          <TextInput
            label="Confirmar senha"
            type="password"
            value={userForm.confirmPassword}
            onChange={(value) =>
              setUserForm((current) => ({ ...current, confirmPassword: value }))
            }
          />
          {userForm.password &&
          userForm.password !== userForm.confirmPassword ? (
            <p className="md:col-span-2 text-sm text-ember-600 dark:text-ember-400">
              As senhas precisam ser iguais.
            </p>
          ) : null}
          <Button
            className="md:col-span-2"
            disabled={
              userMutation.isPending ||
              Boolean(
                userForm.password &&
                userForm.password !== userForm.confirmPassword,
              )
            }
            type="submit"
          >
            <Save size={17} />
            Salvar dados do usuario
          </Button>
        </form>
      </Panel>

      <CrudPage<ApiUser>
        title="Equipe e clientes"
        subtitle="Usuarios associados a este admin. Funcionarios (Manager, Financial) e clientes com acesso ao portal."
        queryKey="users"
        endpoint="/users"
        filterFn={(row) => row.id !== currentUser?.id}
        columns={[
          { key: "name", label: "Nome" },
          { key: "email", label: "Email" },
          {
            key: "role",
            label: "Papel",
            render: (row) =>
              roleOptions.find((o) => o.value === row.role)?.label ?? row.role,
          },
          {
            key: "client",
            label: "Cliente",
            render: (row) => row.client?.name ?? "-",
          },
        ]}
        fields={[
          { name: "name", label: "Nome", required: true },
          { name: "email", label: "Email", required: true },
          { name: "password", label: "Senha", type: "password" },
          {
            name: "role",
            label: "Papel",
            type: "select",
            options: roleOptions,
          },
          {
            name: "clientId",
            label: "Cliente associado",
            type: "select",
            options: clients.map((client) => ({
              label: client.name,
              value: client.id,
            })),
          },
        ]}
        normalize={(values, editing) => ({
          name: values.name,
          email: values.email,
          role: values.role || "CLIENT",
          clientId:
            values.role === "CLIENT" ? values.clientId || undefined : null,
          ...(editing || !values.password ? {} : { password: values.password }),
        })}
      />

      <Panel className="p-6">
        <div>
          <p className="mono-label text-[color:var(--muted)]">Sistema</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            Preferencias
          </h2>
        </div>
        <form
          className="mt-6 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            settingsMutation.mutate(settingsForm);
          }}
        >
          <label className="block">
            <span className="mono-label text-[color:var(--muted)]">
              Timezone
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
              value={settingsForm.timezone}
              onChange={(event) =>
                setSettingsForm((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mono-label text-[color:var(--muted)]">Moeda</span>
            <select
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
              value={settingsForm.currency}
              onChange={(event) =>
                setSettingsForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <TextInput
            label="WhatsApp de suporte"
            value={settingsForm.supportPhone}
            onChange={(value) =>
              setSettingsForm((current) => ({
                ...current,
                supportPhone: value,
              }))
            }
          />
          <Button className="md:col-span-2" type="submit">
            <Save size={17} />
            Salvar configuracoes
          </Button>
        </form>
      </Panel>
    </div>
  );
}

function CrudPage<T extends { id: string }>({
  title,
  subtitle,
  queryKey,
  endpoint,
  columns,
  fields,
  normalize,
  afterCreate,
  filterFn,
}: {
  title: string;
  subtitle: string;
  queryKey: string;
  endpoint: string;
  columns: Array<{ key: string; label: string; render?: (row: T) => unknown }>;
  fields: Field[];
  normalize: (
    values: Record<string, string>,
    editing?: T | null,
  ) => Record<string, unknown>;
  afterCreate?: (created: T) => Promise<unknown>;
  filterFn?: (row: T) => boolean;
}) {
  const queryClient = useQueryClient();
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({ queryKey: [queryKey], queryFn: () => apiGet<T[]>(endpoint) });
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) return apiPatch<T>(`${endpoint}/${editing.id}`, payload);
      const created = await apiPost<T>(endpoint, payload);
      if (afterCreate) await afterCreate(created);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditing(null);
      setValues({});
    },
    meta: { successMessage: "Registro salvo com sucesso." },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    meta: { successMessage: "Registro removido com sucesso." },
  });

  const startCreate = () => {
    setEditing(null);
    setValues({});
    setOpen(true);
  };

  const startEdit = (row: T) => {
    setEditing(row);
    setValues(
      Object.fromEntries(
        fields.map((field) => [
          field.name,
          normalizeInputValue((row as Row)[field.name], field.type),
        ]),
      ),
    );
    setOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(normalize(values, editing));
  };

  const filteredData = data
    .filter((row) => (filterFn ? filterFn(row) : true))
    .filter((row) =>
      JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()),
    );

  return (
    <Panel className="overflow-hidden">
      <div className="p-6">
        <Toolbar
          title={title}
          subtitle={subtitle}
          onCreate={startCreate}
          onFilter={() => setFilterOpen((current) => !current)}
        />
        {filterOpen ? (
          <input
            className="mt-4 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
            placeholder="Filtrar os dados carregados do banco..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        ) : null}
      </div>

      {error ? (
        <div className="mx-6 mb-4 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-600 dark:text-ember-400">
          Erro ao carregar dados da API.
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-y border-[color:var(--line)] bg-[color:var(--panel-strong)]">
              {columns.map((column) => (
                <th
                  className="mono-label px-6 py-4 text-left text-[color:var(--muted)]"
                  key={column.key}
                >
                  {column.label}
                </th>
              ))}
              <th className="px-6 py-4 text-right">
                <MoreHorizontal
                  size={18}
                  className="ml-auto text-[color:var(--muted)]"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-6 py-6 text-sm text-[color:var(--muted)]"
                  colSpan={columns.length + 1}
                >
                  Carregando dados do banco...
                </td>
              </tr>
            ) : null}
            {filteredData.map((row) => (
              <tr
                className="border-b border-[color:var(--line)] transition hover:bg-[color:var(--panel-strong)]"
                key={row.id}
              >
                {columns.map((column) => {
                  const value = column.render
                    ? column.render(row)
                    : (row as Row)[column.key];
                  return (
                    <td className="px-6 py-4 text-sm" key={column.key}>
                      {column.key.toLowerCase().includes("status") ||
                      column.key === "health" ||
                      column.key === "role" ? (
                        <StatusBadge tone={statusTone(value)}>
                          {String(value ?? "-")}
                        </StatusBadge>
                      ) : (
                        String(value ?? "-")
                      )}
                    </td>
                  );
                })}
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => startEdit(row)}>
                      <Edit3 size={16} />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => removeMutation.mutate(row.id)}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalOverlay open={open}>
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-2xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="mono-label text-[color:var(--muted)]">
                  {editing ? "Editar" : "Novo"}
                </p>
                <h2 className="font-display text-2xl font-semibold">{title}</h2>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              {fields.map((field) => (
                <FieldInput
                  field={field}
                  key={field.name}
                  value={values[field.name] ?? ""}
                  onChange={(value) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: value,
                    }))
                  }
                  disabled={Boolean(editing && field.name === "clientId")}
                />
              ))}
              <Button
                className="md:col-span-2"
                disabled={mutation.isPending}
                type="submit"
              >
                <Save size={17} />
                {mutation.isPending ? "Salvando..." : "Salvar no banco"}
              </Button>
            </form>
          </Panel>
        </div>
      </ModalOverlay>
    </Panel>
  );
}

function ModalOverlay({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(children, document.body);
}

function Toolbar({
  title,
  subtitle,
  onCreate,
  onFilter,
  createLabel = "Novo",
}: {
  title: string;
  subtitle: string;
  onCreate: () => void;
  onFilter?: () => void;
  createLabel?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="mono-label text-[color:var(--muted)]">Docject</p>
        <h1 className="mt-1 font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-[color:var(--muted)]">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        {onFilter ? (
          <Button variant="secondary" type="button" onClick={onFilter}>
            <Filter size={17} />
            Filtros
          </Button>
        ) : null}
        <Button onClick={onCreate} type="button">
          <Plus size={17} />
          {createLabel}
        </Button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (field.type === "select") {
    return (
      <label className="block">
        <span className="mono-label text-[color:var(--muted)]">
          {field.label}
        </span>
        <select
          className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
          disabled={disabled}
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <TextInput
      disabled={disabled}
      label={field.label}
      required={field.required}
      type={field.type ?? "text"}
      value={value}
      onChange={onChange}
    />
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mono-label text-[color:var(--muted)]">{label}</span>
      <input
        className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none disabled:opacity-60"
        disabled={disabled}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mono-label text-[color:var(--muted)]">{label}</span>
      <textarea
        className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function normalizeInputValue(value: unknown, type?: Field["type"]) {
  if (!value) return "";
  if (type === "datetime-local") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
  }
  return String(value);
}

const healthOptions = [
  { label: "Excelente", value: "EXCELLENT" },
  { label: "Atencao", value: "ATTENTION" },
  { label: "Estavel", value: "STABLE" },
];

const projectStatusOptions = [
  { label: "Planejamento", value: "PLANNING" },
  { label: "Em andamento", value: "IN_PROGRESS" },
  { label: "Pausado", value: "PAUSED" },
  { label: "Aguardando cliente", value: "WAITING_CLIENT" },
  { label: "Concluido", value: "COMPLETED" },
  { label: "Cancelado", value: "CANCELLED" },
];

const contractStatusOptions = [
  { label: "Rascunho", value: "DRAFT" },
  { label: "Enviado", value: "SENT" },
  { label: "Assinado", value: "SIGNED" },
  { label: "Cancelado", value: "CANCELLED" },
];

const transactionStatusOptions = [
  { label: "Pendente", value: "PENDING" },
  { label: "Pago", value: "PAID" },
  { label: "Atrasado", value: "OVERDUE" },
  { label: "Cancelado", value: "CANCELLED" },
];

const kindOptions = [
  { label: "Receita", value: "REVENUE" },
  { label: "Despesa", value: "EXPENSE" },
];

const roleOptions = [
  { label: "Admin", value: "ADMIN" },
  { label: "Manager", value: "MANAGER" },
  { label: "Financial", value: "FINANCIAL" },
  { label: "Client", value: "CLIENT" },
];

const timezoneOptions = [
  { label: "Fortaleza (America/Fortaleza)", value: "America/Fortaleza" },
  { label: "Sao Paulo (America/Sao_Paulo)", value: "America/Sao_Paulo" },
  { label: "Manaus (America/Manaus)", value: "America/Manaus" },
  { label: "UTC", value: "UTC" },
];

const currencyOptions = [
  { label: "Real brasileiro (BRL)", value: "BRL" },
  { label: "Dolar americano (USD)", value: "USD" },
  { label: "Euro (EUR)", value: "EUR" },
];

const weekdayShortLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function translateHealth(status: string) {
  return (
    { EXCELLENT: "Excelente", ATTENTION: "Atencao", STABLE: "Estavel" }[
      status
    ] ?? status
  );
}

function translateProject(status: string) {
  return (
    {
      PLANNING: "Planejamento",
      IN_PROGRESS: "Em andamento",
      PAUSED: "Pausado",
      WAITING_CLIENT: "Em risco",
      COMPLETED: "Concluido",
      CANCELLED: "Cancelado",
    }[status] ?? status
  );
}

function translateContract(status: string) {
  return (
    {
      DRAFT: "Rascunho",
      SENT: "Enviado",
      SIGNED: "Assinado",
      CANCELLED: "Cancelado",
    }[status] ?? status
  );
}

function latestContractUrl(contract: ApiContract) {
  return contract.versions?.[contract.versions.length - 1]?.fileUrl;
}

function translateTransaction(status: string) {
  return (
    {
      PENDING: "Pendente",
      PAID: "Pago",
      OVERDUE: "Atrasado",
      CANCELLED: "Cancelado",
    }[status] ?? status
  );
}

const scheduleHours = Array.from({ length: 24 }, (_, hour) => hour);
const hourHeight = 92;

function buildWeek(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function buildVisibleDays(date: Date, view: "Day" | "Week" | "Month") {
  if (view === "Day") {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return [day];
  }
  if (view === "Month") return buildMonthDays(date);
  return buildWeek(date);
}

function buildMonthDays(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = start.getDay();
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function isInRange(
  date: Date,
  firstDay: Date,
  lastDay: Date,
  view: "Day" | "Week" | "Month",
) {
  const start = new Date(firstDay);
  start.setHours(0, 0, 0, 0);
  const end = new Date(lastDay);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return date >= start && date < end;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function calendarTitle(date: Date, view: "Day" | "Week" | "Month") {
  if (view === "Day") {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "2-digit",
      year: "numeric",
    }).format(date);
  }
  if (view === "Week") {
    const week = buildWeek(date);
    return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(week[0])} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(week[6])}`;
  }
  return monthTitle(date);
}

function addCalendarPeriod(
  date: Date,
  view: "Day" | "Week" | "Month",
  amount: number,
) {
  const next = new Date(date);
  if (view === "Day") next.setDate(next.getDate() + amount);
  if (view === "Week") next.setDate(next.getDate() + amount * 7);
  if (view === "Month") next.setMonth(next.getMonth() + amount);
  return next;
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function timeRangeLabel(event: ApiAppointment) {
  const start = new Date(event.startsAt);
  if (!event.endsAt) return timeLabel(start);
  return `${timeLabel(start)} - ${timeLabel(new Date(event.endsAt))}`;
}

function relativeDayLabel(date: Date, base: Date) {
  if (isSameDate(date, base)) return "Today";
  const tomorrow = new Date(base);
  tomorrow.setDate(base.getDate() + 1);
  if (isSameDate(date, tomorrow)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function currentLineTop(baseDate: Date) {
  const eventHour = Math.max(
    0,
    Math.min(23.99, baseDate.getHours() + baseDate.getMinutes() / 60),
  );
  return `${eventHour * hourHeight}px`;
}

function eventMetrics(event: ApiAppointment) {
  const start = new Date(event.startsAt);
  const end = event.endsAt
    ? new Date(event.endsAt)
    : new Date(start.getTime() + 60 * 60 * 1000);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const durationHours = Math.max(
    0.5,
    (end.getTime() - start.getTime()) / 3600000,
  );
  const top = Math.max(0, Math.min(startHour, 23.99) * hourHeight);
  return {
    start,
    end,
    top,
    height: Math.max(58, Math.min(durationHours * hourHeight - 8, 220)),
  };
}

function defaultAppointmentForm(date: Date): AppointmentForm {
  const startsAt = new Date(date);
  startsAt.setHours(11, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setHours(startsAt.getHours() + 1);
  return {
    title: "",
    client: "",
    location: "Meet",
    startsAt: toDatetimeLocal(startsAt),
    endsAt: toDatetimeLocal(endsAt),
    notes: "",
    repeatMode: "none",
    repeatWeekdays: [startsAt.getDay()],
    repeatMonthDay: String(startsAt.getDate()),
  };
}

function appointmentFormFromEvent(event: ApiAppointment): AppointmentForm {
  const start = new Date(event.startsAt);
  const fallbackEnd = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: event.title,
    client: event.client ?? "",
    location: event.location ?? "",
    startsAt: toDatetimeLocal(start),
    endsAt: event.endsAt
      ? toDatetimeLocal(new Date(event.endsAt))
      : toDatetimeLocal(fallbackEnd),
    notes: event.notes ?? "",
    repeatMode: "none",
    repeatWeekdays: [start.getDay()],
    repeatMonthDay: String(start.getDate()),
  };
}

function appointmentPayloadFromForm(
  form: AppointmentForm,
  startsAtValue = form.startsAt,
  endsAtValue = form.endsAt,
) {
  return {
    title: form.title,
    client: form.client || undefined,
    location: form.location || undefined,
    startsAt: datetimeLocalToIso(startsAtValue),
    endsAt: endsAtValue ? datetimeLocalToIso(endsAtValue) : undefined,
    notes: form.notes || undefined,
  };
}

function buildRecurringAppointmentPayloads(form: AppointmentForm) {
  const start = new Date(form.startsAt);
  const end = form.endsAt
    ? new Date(form.endsAt)
    : new Date(start.getTime() + 60 * 60 * 1000);
  const duration = end.getTime() - start.getTime();
  const payloads: Record<string, unknown>[] = [];

  if (form.repeatMode === "weekly") {
    const selectedDays = form.repeatWeekdays.length
      ? form.repeatWeekdays
      : [start.getDay()];
    const cursor = new Date(start);
    cursor.setHours(start.getHours(), start.getMinutes(), 0, 0);
    while (payloads.length < 24) {
      if (selectedDays.includes(cursor.getDay()) && cursor >= start) {
        const nextEnd = new Date(cursor.getTime() + duration);
        payloads.push(
          appointmentPayloadFromForm(
            form,
            toDatetimeLocal(cursor),
            toDatetimeLocal(nextEnd),
          ),
        );
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return payloads;
  }

  if (form.repeatMode === "monthly") {
    const desiredDay = Math.max(
      1,
      Math.min(31, Number(form.repeatMonthDay || start.getDate())),
    );
    for (let index = 0; index < 12; index += 1) {
      const lastDay = new Date(
        start.getFullYear(),
        start.getMonth() + index + 1,
        0,
      ).getDate();
      const nextStart = new Date(
        start.getFullYear(),
        start.getMonth() + index,
        Math.min(desiredDay, lastDay),
        start.getHours(),
        start.getMinutes(),
        0,
        0,
      );
      if (nextStart < start) continue;
      const nextEnd = new Date(nextStart.getTime() + duration);
      payloads.push(
        appointmentPayloadFromForm(
          form,
          toDatetimeLocal(nextStart),
          toDatetimeLocal(nextEnd),
        ),
      );
    }
  }

  return payloads.length ? payloads : [appointmentPayloadFromForm(form)];
}

function toggleNumber(items: number[], value: number) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value].sort((a, b) => a - b);
}

function toDatetimeLocal(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

function datetimeLocalToIso(value: string) {
  return new Date(value).toISOString();
}

function ScheduleEventCard({
  event,
  index,
  visibleDays,
  dayCount,
  onEdit,
}: {
  event: ApiAppointment;
  index: number;
  visibleDays: Date[];
  dayCount: number;
  onEdit: (event: ApiAppointment) => void;
}) {
  const { start, top, height } = eventMetrics(event);
  const dayIndex = Math.max(
    0,
    visibleDays.findIndex((day) => isSameDate(day, start)),
  );
  const dayWidth = `calc((100% - 72px) / ${dayCount})`;
  const tones = [
    "border-l-[color:var(--warning)] bg-[color:var(--warning)]/15",
    "border-l-[color:var(--primary)] bg-[color:var(--accent)]/18",
    "border-l-[color:var(--success)] bg-[color:var(--success)]/12",
  ];
  const textTones = [
    "text-[color:var(--warning)]",
    "text-[color:var(--primary)] dark:text-[color:var(--accent)]",
    "text-[color:var(--success)] dark:text-slate-300",
  ];

  return (
    <button
      className={`absolute z-20 rounded-r-xl border-l-4 p-3 text-left shadow-panel backdrop-blur-xl transition hover:scale-[1.01] ${tones[index % tones.length]}`}
      style={{
        left: `calc(72px + ${dayIndex} * ${dayWidth})`,
        top,
        width: dayWidth,
        height,
      }}
      onClick={() => onEdit(event)}
      type="button"
    >
      <p
        className={`font-mono text-xs font-bold ${textTones[index % textTones.length]}`}
      >
        {timeRangeLabel(event)}
      </p>
      <p className="mt-1 line-clamp-2 font-semibold leading-tight">
        {event.title}
      </p>
      <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
        {event.client || event.location || "Docject"}
      </p>
      {event.notes ? (
        <p className="mt-1 line-clamp-1 text-xs text-[color:var(--muted)]">
          {event.notes}
        </p>
      ) : null}
    </button>
  );
}

function MonthCalendar({
  currentDate,
  events,
  onEdit,
  onDayClick,
}: {
  currentDate: Date;
  events: ApiAppointment[];
  onEdit: (event: ApiAppointment) => void;
  onDayClick: (day: Date) => void;
}) {
  const today = new Date();
  const days = buildMonthDays(currentDate);
  const eventsByDay = new Map<string, ApiAppointment[]>();
  for (const event of events) {
    const key = dateKey(new Date(event.startsAt));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  return (
    <div className="min-w-[820px]">
      <div className="grid grid-cols-7 border-b border-[color:var(--line)] bg-[color:var(--panel)] backdrop-blur-xl">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            className="mono-label border-r border-[color:var(--line)] px-4 py-3 text-center text-[color:var(--muted)] last:border-r-0"
            key={day}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
          const muted = day.getMonth() !== currentDate.getMonth();
          return (
            <div
              className={`min-h-32 border-b border-r border-[color:var(--line)] p-3 last:border-r-0 ${muted ? "opacity-45" : ""} ${isSameDate(day, today) ? "bg-[color:var(--accent)]/10" : ""}`}
              key={day.toISOString()}
            >
              <button
                className={`mb-2 grid h-8 w-8 cursor-pointer place-items-center rounded-full font-display font-semibold ${isSameDate(day, today) ? "bg-[color:var(--primary)] text-white dark:bg-[color:var(--warning)] dark:text-navy-950" : "hover:bg-[color:var(--accent)]/10"}`}
                onClick={() => onDayClick(day)}
                type="button"
              >
                {day.getDate()}
              </button>
              <div className="space-y-2">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    className="w-full rounded-xl border-l-4 border-l-[color:var(--primary)] bg-[color:var(--panel-strong)] px-3 py-2 text-left text-xs shadow-panel transition hover:-translate-y-0.5 dark:border-l-[color:var(--warning)]"
                    key={event.id}
                    onClick={() => onEdit(event)}
                    type="button"
                  >
                    <p className="font-semibold">{event.title}</p>
                    <p className="mt-1 text-[color:var(--muted)]">
                      {timeRangeLabel(event)}
                    </p>
                  </button>
                ))}
                {dayEvents.length > 3 ? (
                  <p className="text-xs font-semibold text-[color:var(--muted)]">
                    +{dayEvents.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function Reminder({
  title,
  meta,
  urgent,
}: {
  title: string;
  meta: string;
  urgent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p
            className={`mt-1 font-mono text-xs ${urgent ? "text-[color:var(--warning)]" : "text-[color:var(--muted)]"}`}
          >
            {meta}
          </p>
        </div>
        <span
          className={`mt-1 h-4 w-4 rounded-full border ${urgent ? "border-[color:var(--warning)]" : "border-[color:var(--muted)]"}`}
        />
      </div>
    </div>
  );
}
