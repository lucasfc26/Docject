import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Edit3, FileText, Printer, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  apiGet,
  apiPatch,
  apiPost,
  type ApiServiceBackupStatus,
  type ApiServiceReport,
  type ApiServiceReportSummary,
} from "../services/api";
import { Button, Panel, StatusBadge } from "./ui";

type ReportForm = {
  backupStatus: ApiServiceBackupStatus | "";
  backupNotes: string;
  incidentNotes: string;
  otherOccurrences: string;
};

const backupStatusLabels: Record<ApiServiceBackupStatus, string> = {
  OK: "Rotinas em dia",
  ATTENTION: "Com falhas pontuais",
  FAILED: "Falhando",
  NOT_APPLICABLE: "Nao se aplica",
};

const backupStatusTones: Record<ApiServiceBackupStatus, "success" | "warning" | "danger" | "neutral"> = {
  OK: "success",
  ATTENTION: "warning",
  FAILED: "danger",
  NOT_APPLICABLE: "neutral",
};

export function ServiceMonthlyReport({
  serviceId,
  canEdit = false,
}: {
  serviceId: string;
  canEdit?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: months = [] } = useQuery({
    queryKey: ["service-reports", serviceId],
    queryFn: () => apiGet<ApiServiceReportSummary[]>(`/services/${serviceId}/reports`),
  });
  const [month, setMonth] = useState("");
  useEffect(() => {
    if (!months.length) return;
    if (!month || !months.some((item) => item.month === month)) {
      // Months come newest first, so the first one is the month in progress.
      setMonth(months[0].month);
    }
  }, [months, month]);
  const monthIndex = months.findIndex((item) => item.month === month);
  const selectedMonth = monthIndex >= 0 ? months[monthIndex] : undefined;
  const olderMonth = monthIndex >= 0 ? months[monthIndex + 1] : undefined;
  const newerMonth = monthIndex > 0 ? months[monthIndex - 1] : undefined;

  const { data: report, isLoading, error } = useQuery({
    enabled: Boolean(month),
    queryKey: ["service-report", serviceId, month],
    queryFn: () => apiGet<ApiServiceReport>(`/services/${serviceId}/reports/${month}`),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReportForm>(emptyForm());

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["service-report", serviceId] });
    queryClient.invalidateQueries({ queryKey: ["service-reports", serviceId] });
  };

  const saveMutation = useMutation({
    mutationFn: () => apiPatch<ApiServiceReport>(`/services/${serviceId}/reports/${month}`, form),
    onSuccess: () => {
      refresh();
      setEditing(false);
    },
    meta: { successMessage: "Relatorio atualizado." },
  });

  const recalculateMutation = useMutation({
    mutationFn: () => apiPost<ApiServiceReport>(`/services/${serviceId}/reports/${month}/recalculate`, {}),
    onSuccess: refresh,
    meta: { successMessage: "Monitoramento do mes recalculado." },
  });

  const startEdit = () => {
    if (!report) return;
    setForm({
      backupStatus: report.backup.manualStatus ?? "",
      backupNotes: report.backup.notes ?? "",
      incidentNotes: report.incidents.notes ?? "",
      otherOccurrences: report.otherOccurrences ?? "",
    });
    setEditing(true);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[260px]">
          <span className="mono-label text-[color:var(--muted)]">Relatorio mensal</span>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-1">
            <Button
              aria-label="Mes anterior"
              className="px-3 disabled:cursor-not-allowed disabled:opacity-30"
              disabled={!olderMonth}
              title={olderMonth ? formatMonth(olderMonth.month) : undefined}
              type="button"
              variant="ghost"
              onClick={() => olderMonth && setMonth(olderMonth.month)}
            >
              <ChevronLeft size={18} />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate font-semibold">{selectedMonth ? formatMonth(selectedMonth.month) : "-"}</p>
              {selectedMonth?.status === "OPEN" ? (
                <p className="text-xs text-[color:var(--muted)]">Em apuracao</p>
              ) : null}
            </div>
            <Button
              aria-label="Proximo mes"
              className="px-3 disabled:cursor-not-allowed disabled:opacity-30"
              disabled={!newerMonth}
              title={newerMonth ? formatMonth(newerMonth.month) : undefined}
              type="button"
              variant="ghost"
              onClick={() => newerMonth && setMonth(newerMonth.month)}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
        {report ? (
          <div className="flex flex-wrap gap-2">
            {canEdit && report.status === "CLOSED" ? (
              <Button
                disabled={recalculateMutation.isPending}
                title="Refaz a apuracao com as amostras ainda guardadas (ate 3 meses)"
                type="button"
                variant="ghost"
                onClick={() => recalculateMutation.mutate()}
              >
                <RefreshCw size={16} />
                Recalcular
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="secondary" onClick={startEdit}>
                <Edit3 size={16} />
                Preencher
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => printReport(report)}>
              <Printer size={16} />
              Imprimir
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? <p className="text-sm text-[color:var(--muted)]">Gerando relatorio...</p> : null}
      {error ? (
        <p className="text-sm text-ember-600 dark:text-ember-400">Erro ao carregar o relatorio.</p>
      ) : null}
      {!months.length ? (
        <p className="text-sm text-[color:var(--muted)]">Nenhum relatorio disponivel para este servico.</p>
      ) : null}

      {report ? <ReportBody report={report} /> : null}

      {editing && report
        ? createPortal(
            <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4 backdrop-blur-sm">
              <Panel className="w-full max-w-2xl p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="mono-label text-[color:var(--muted)]">Relatorio de {formatMonth(month)}</p>
                    <h2 className="font-display text-2xl font-semibold">{report.serviceName}</h2>
                  </div>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    <X size={18} />
                  </Button>
                </div>
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveMutation.mutate();
                  }}
                >
                  <label className="block">
                    <span className="mono-label text-[color:var(--muted)]">III — Situacao dos backups</span>
                    <select
                      className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                      value={form.backupStatus}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          backupStatus: event.target.value as ReportForm["backupStatus"],
                        }))
                      }
                    >
                      <option value="">
                        Automatico
                        {report.backup.summary?.autoStatus
                          ? ` (${backupStatusLabels[report.backup.summary.autoStatus]})`
                          : " (sem dados de monitoramento)"}
                      </option>
                      {(Object.keys(backupStatusLabels) as ApiServiceBackupStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {backupStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ReportTextArea
                    label="III — Observacoes sobre backups"
                    value={form.backupNotes}
                    onChange={(value) => setForm((current) => ({ ...current, backupNotes: value }))}
                  />
                  <ReportTextArea
                    label="II — Incidentes relevantes (complemento aos detectados)"
                    value={form.incidentNotes}
                    onChange={(value) => setForm((current) => ({ ...current, incidentNotes: value }))}
                  />
                  <ReportTextArea
                    label="VI — Demais ocorrencias relevantes"
                    value={form.otherOccurrences}
                    onChange={(value) => setForm((current) => ({ ...current, otherOccurrences: value }))}
                  />
                  <div className="flex justify-end">
                    <Button disabled={saveMutation.isPending} type="submit">
                      <Save size={17} />
                      {saveMutation.isPending ? "Salvando..." : "Salvar relatorio"}
                    </Button>
                  </div>
                </form>
              </Panel>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function ReportBody({ report }: { report: ApiServiceReport }) {
  const { availability, incidents, backup, hours, carriedHours } = report;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
        <FileText size={14} />
        {report.status === "CLOSED"
          ? `Fechado em ${formatDateTime(report.closedAt)}`
          : "Mes em apuracao — os numeros sao atualizados a cada 15 minutos."}
        {report.updatedBy ? ` · Preenchido por ${report.updatedBy.name}` : ""}
      </div>

      <ReportSection title="I — Disponibilidade mensal apurada">
        {availability.percent == null ? (
          <p className="text-sm text-[color:var(--muted)]">Sem amostras de monitoramento neste mes.</p>
        ) : (
          <>
            <p className="font-display text-3xl font-bold">{formatPercent(availability.percent)}</p>
            <p className="text-xs text-[color:var(--muted)]">
              {availability.samplesOnline} de {availability.samplesTotal} verificacoes online (a cada{" "}
              {availability.intervalMinutes} min)
            </p>
            <ul className="mt-3 grid gap-1 text-sm">
              {availability.checks.map((check) => (
                <li className="flex flex-wrap justify-between gap-2" key={check.checkKey}>
                  <span className="font-semibold">{check.checkName}</span>
                  <span className="text-[color:var(--muted)]">
                    {formatPercent(check.availabilityPercent)} · indisponivel ~{formatDuration(check.downtimeMinutes)}
                    {check.avgResponseMs != null ? ` · ${check.avgResponseMs} ms medio` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ReportSection>

      <ReportSection title="II — Incidentes relevantes registrados">
        {incidents.auto.length ? (
          <ul className="grid gap-1 text-sm">
            {incidents.auto.map((incident) => (
              <li className="flex flex-wrap justify-between gap-2" key={`${incident.checkName}-${incident.startedAt}`}>
                <span>
                  <strong>{incident.checkName}</strong> fora do ar em {formatDateTime(incident.startedAt)}
                </span>
                <span className="text-[color:var(--muted)]">
                  {incident.endedAt ? `~${formatDuration(incident.durationMinutes)}` : "sem retorno no periodo"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">Nenhuma indisponibilidade detectada pelo monitoramento.</p>
        )}
        {incidents.notes ? <p className="mt-3 whitespace-pre-line text-sm">{incidents.notes}</p> : null}
      </ReportSection>

      <ReportSection title="III — Situacao das rotinas de backup">
        {backup.status ? (
          <StatusBadge tone={backupStatusTones[backup.status]}>{backupStatusLabels[backup.status]}</StatusBadge>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">Backups nao monitorados neste servico.</p>
        )}
        {backup.summary ? (
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            {backup.summary.samplesOk} de {backup.summary.samplesTotal} verificacoes com backup em dia
            {backup.summary.lastDetail ? ` · ${backup.summary.lastDetail}` : ""}
          </p>
        ) : null}
        {backup.notes ? <p className="mt-3 whitespace-pre-line text-sm">{backup.notes}</p> : null}
      </ReportSection>

      <ReportSection title="IV — Horas utilizadas da bolsa mensal">
        <p className="text-sm">
          <strong>{formatHours(hours.usedHours)}</strong> utilizadas de {formatHours(hours.availableHours)} disponiveis
          {" "}(bolsa do mes: {formatHours(hours.monthlyHours)}) ·{" "}
          {hours.overageHours > 0
            ? `excedente de ${formatHours(hours.overageHours)}`
            : `saldo de ${formatHours(hours.remainingHours)}`}
        </p>
        {hours.logs.length ? (
          <ul className="mt-3 grid gap-1 border-l border-[color:var(--line)] pl-4 text-sm">
            {hours.logs.map((log) => (
              <li className="flex justify-between gap-3" key={log.id}>
                <span className="whitespace-pre-line">{log.description}</span>
                <strong className="shrink-0">{formatHours(log.hours)}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </ReportSection>

      <ReportSection title="V — Horas transferidas de meses anteriores">
        <p className="text-sm">
          <strong>{formatHours(carriedHours.hours)}</strong> transferidas
          {carriedHours.cohorts.length
            ? ` (${carriedHours.cohorts.map((cohort) => `${formatHours(cohort.hours)} de ${formatMonth(cohort.originMonth)}`).join(", ")})`
            : ""}
        </p>
        {carriedHours.expiredHours > 0 ? (
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {formatHours(carriedHours.expiredHours)} expiraram na virada do mes.
          </p>
        ) : null}
      </ReportSection>

      <ReportSection title="VI — Demais ocorrencias relevantes">
        <p className="whitespace-pre-line text-sm">
          {report.otherOccurrences || "Nenhuma ocorrencia adicional registrada."}
        </p>
      </ReportSection>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <p className="mono-label mb-2 text-[color:var(--muted)]">{title}</p>
      {children}
    </section>
  );
}

function ReportTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mono-label text-[color:var(--muted)]">{label}</span>
      <textarea
        className="mt-2 min-h-24 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function emptyForm(): ReportForm {
  return { backupStatus: "", backupNotes: "", incidentNotes: "", otherOccurrences: "" };
}

function formatMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  const label = new Date(year, value - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatPercent(value: number | null) {
  return value == null ? "-" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function formatHours(value: number) {
  return `${Number(value.toFixed(2)).toLocaleString("pt-BR")}h`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function printReport(report: ApiServiceReport) {
  const text = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");
  const section = (title: string, body: string) => `<h2>${title}</h2>${body}`;
  const { availability, incidents, backup, hours, carriedHours } = report;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatorio ${escapeHtml(report.serviceName)} - ${formatMonth(report.month)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#111;line-height:1.45}h1{margin-bottom:4px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}.muted{color:#666;font-size:13px}td{padding:2px 12px 2px 0;font-size:14px}</style></head><body>
<h1>Relatorio mensal de operacao</h1>
<p class="muted">${escapeHtml(report.serviceName)}${report.clientName ? ` · ${escapeHtml(report.clientName)}` : ""} · ${formatMonth(report.month)} · ${report.status === "CLOSED" ? `fechado em ${formatDateTime(report.closedAt)}` : "parcial (mes em apuracao)"}</p>
${section(
  "I — Disponibilidade mensal apurada",
  availability.percent == null
    ? `<p>Sem amostras de monitoramento neste mes.</p>`
    : `<p><strong>${formatPercent(availability.percent)}</strong> (${availability.samplesOnline} de ${availability.samplesTotal} verificacoes online, a cada ${availability.intervalMinutes} min)</p><table>${availability.checks
        .map((check) => `<tr><td>${escapeHtml(check.checkName)}</td><td>${formatPercent(check.availabilityPercent)}</td><td>indisponivel ~${formatDuration(check.downtimeMinutes)}</td></tr>`)
        .join("")}</table>`,
)}
${section(
  "II — Incidentes relevantes registrados",
  (incidents.auto.length
    ? `<ul>${incidents.auto
        .map((incident) => `<li>${escapeHtml(incident.checkName)} fora do ar em ${formatDateTime(incident.startedAt)} — ${incident.endedAt ? `~${formatDuration(incident.durationMinutes)}` : "sem retorno no periodo"}</li>`)
        .join("")}</ul>`
    : `<p>Nenhuma indisponibilidade detectada pelo monitoramento.</p>`) + (incidents.notes ? `<p>${text(incidents.notes)}</p>` : ""),
)}
${section(
  "III — Situacao das rotinas de backup",
  `<p>${backup.status ? backupStatusLabels[backup.status] : "Backups nao monitorados neste servico."}${backup.summary ? ` (${backup.summary.samplesOk} de ${backup.summary.samplesTotal} verificacoes em dia${backup.summary.lastDetail ? ` · ${escapeHtml(backup.summary.lastDetail)}` : ""})` : ""}</p>${backup.notes ? `<p>${text(backup.notes)}</p>` : ""}`,
)}
${section(
  "IV — Horas utilizadas da bolsa mensal",
  `<p><strong>${formatHours(hours.usedHours)}</strong> utilizadas de ${formatHours(hours.availableHours)} disponiveis (bolsa do mes: ${formatHours(hours.monthlyHours)}) · ${hours.overageHours > 0 ? `excedente de ${formatHours(hours.overageHours)}` : `saldo de ${formatHours(hours.remainingHours)}`}</p>${
    hours.logs.length ? `<table>${hours.logs.map((log) => `<tr><td>${text(log.description)}</td><td>${formatHours(log.hours)}</td></tr>`).join("")}</table>` : ""
  }`,
)}
${section(
  "V — Horas transferidas de meses anteriores",
  `<p><strong>${formatHours(carriedHours.hours)}</strong>${carriedHours.cohorts.length ? ` (${carriedHours.cohorts.map((cohort) => `${formatHours(cohort.hours)} de ${formatMonth(cohort.originMonth)}`).join(", ")})` : ""}${carriedHours.expiredHours > 0 ? ` · ${formatHours(carriedHours.expiredHours)} expiraram na virada do mes` : ""}</p>`,
)}
${section("VI — Demais ocorrencias relevantes", `<p>${report.otherOccurrences ? text(report.otherOccurrences) : "Nenhuma ocorrencia adicional registrada."}</p>`)}
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
