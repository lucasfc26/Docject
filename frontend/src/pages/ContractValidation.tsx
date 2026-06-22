import { FormEvent, useState } from "react";
import { Download, ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import { Button, Panel, StatusBadge } from "../components/ui";
import { apiAssetUrl, apiValidateContract, downloadApiAsset, sortedContractParticipants, contractParticipantLabel, type ApiContract } from "../services/api";

export function ContractValidation() {
  const [code, setCode] = useState("");
  const [contract, setContract] = useState<ApiContract | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      setContract(await apiValidateContract(code));
      toast.success("Contrato validado com sucesso.");
    } catch (err) {
      setContract(null);
      setError(err instanceof Error ? err.message : "Senha invalida.");
    } finally {
      setLoading(false);
    }
  };

  const pdfUrl = contract?.signedFileUrl ?? contract?.versions?.at(-1)?.fileUrl;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] p-4 text-[color:var(--text)] md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Panel className="p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mono-label text-[color:var(--muted)]">Docject</p>
              <h1 className="mt-2 font-display text-3xl font-bold">Validar contrato</h1>
              <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
                Use a senha de validacao impressa no registro de assinaturas do PDF.
              </p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--panel-strong)] text-[color:var(--primary)]">
              <ShieldCheck size={24} />
            </div>
          </div>
          <form className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={submit}>
            <input
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 font-mono outline-none"
              placeholder="Senha de validacao"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button disabled={loading} type="submit">
              <FileCheck2 size={17} />
              {loading ? "Validando..." : "Validar"}
            </Button>
          </form>
          {error ? (
            <p className="mt-4 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-600 dark:text-ember-400">
              {error}
            </p>
          ) : null}
        </Panel>

        {contract ? (
          <Panel className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mono-label text-[color:var(--muted)]">Contrato validado</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">{contract.title}</h2>
                <p className="mt-2 text-sm text-[color:var(--muted)]">UUID: {contract.id}</p>
              </div>
              <StatusBadge tone="success">Assinado</StatusBadge>
            </div>
            <div className="mt-6 grid gap-3 text-sm">
              <p className="break-all font-mono text-xs text-[color:var(--muted)]">
                Hash original: {contract.originalDocumentHash ?? "-"}
              </p>
              <p className="break-all font-mono text-xs text-[color:var(--muted)]">
                Hash final: {contract.signedDocumentHash ?? "-"}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                disabled={!pdfUrl}
                type="button"
                onClick={() => pdfUrl && window.open(apiAssetUrl(pdfUrl), "_blank", "noopener,noreferrer")}
              >
                <ExternalLink size={17} />
                Visualizar contrato
              </Button>
              <Button
                disabled={!pdfUrl}
                type="button"
                variant="secondary"
                onClick={() => pdfUrl && void downloadApiAsset(pdfUrl)}
              >
                <Download size={17} />
                Baixar PDF
              </Button>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {(contract.eventLogs ?? []).map((event) => (
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 md:col-span-2" key={event.id}>
                  <p className="text-xs text-[color:var(--muted)]">{new Date(event.createdAt).toISOString().replace("T", " ").slice(0, 19)} UTC</p>
                  <p className="mt-1 text-sm">{event.description}</p>
                </div>
              ))}
              {sortedContractParticipants(contract).map((participant) => (
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4" key={participant.id}>
                  <p className="font-semibold">
                    {contractParticipantLabel(participant.role, participant.witnessIndex)} - {participant.user.name}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    CPF: {participant.user.cpf ?? "-"} | E-mail: {participant.user.email}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    {participant.signedAt
                      ? `Assinado em ${new Date(participant.signedAt).toISOString().replace("T", " ").slice(0, 19)} UTC`
                      : "Assinatura pendente"}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </main>
  );
}
