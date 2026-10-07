import { useMutation } from "@tanstack/react-query";
import { Download, ExternalLink, ShieldCheck, Upload } from "lucide-react";
import { useRef } from "react";
import { apiPost, apiUploadContractPdf, downloadApiAsset, type ApiContract } from "../services/api";
import { Button } from "./ui";

const GOV_SIGNER_URL = "https://assinador.iti.br";
const GOV_VALIDATOR_URL = "https://validar.iti.gov.br";

/**
 * Once every participant signed, the contract creator can sign the final PDF through gov.br
 * and upload it back; afterwards everyone sees the contract as digitally signed.
 */
export function GovSignatureSection({
  contract,
  userId,
  onSigned,
}: {
  contract: ApiContract;
  userId?: string;
  onSigned: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const upload = await apiUploadContractPdf(file);
      return apiPost<ApiContract>(`/contracts/${contract.id}/gov-signature`, { fileUrl: upload.url });
    },
    onSuccess: onSigned,
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
    meta: { successMessage: "Assinatura gov.br anexada ao contrato." },
  });

  if (contract.govSignedAt) {
    return (
      <div className="rounded-2xl border border-mint-500/30 bg-mint-500/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={17} />
          Assinado digitalmente via gov.br
        </p>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Em {new Date(contract.govSignedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}. O PDF
          final ja e a versao com assinatura digital.
        </p>
        <a
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline"
          href={GOV_VALIDATOR_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Conferir no validador do ITI
          <ExternalLink size={12} />
        </a>
      </div>
    );
  }

  const isCreator = Boolean(userId) && contract.createdBy?.id === userId;
  if (contract.status !== "SIGNED" || !isCreator || !contract.signedFileUrl) return null;
  const signedFileUrl = contract.signedFileUrl;

  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--line)] p-4 text-sm">
      <p className="mono-label text-[color:var(--muted)]">Assinatura digital gov.br</p>
      <p className="mt-2 text-[color:var(--muted)]">
        Todos assinaram. Voce pode assinar o PDF final com sua conta gov.br; o arquivo assinado substitui o documento
        final para todos os participantes.
      </p>
      <ol className="mt-3 grid list-decimal gap-1 pl-5 text-xs text-[color:var(--muted)]">
        <li>Baixe o PDF final do sistema.</li>
        <li>Assine esse mesmo arquivo no assinador gov.br, sem alterar o documento.</li>
        <li>Envie aqui o PDF assinado.</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void downloadApiAsset(signedFileUrl)}>
          <Download size={16} />
          Baixar PDF final
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(GOV_SIGNER_URL, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={16} />
          Abrir assinador gov.br
        </Button>
        <Button disabled={uploadMutation.isPending} type="button" onClick={() => inputRef.current?.click()}>
          <Upload size={16} />
          {uploadMutation.isPending ? "Enviando..." : "Enviar PDF assinado"}
        </Button>
        <input
          accept="application/pdf"
          className="hidden"
          ref={inputRef}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadMutation.mutate(file);
          }}
        />
      </div>
    </div>
  );
}
