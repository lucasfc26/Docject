import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, FileSignature, Globe, Loader2, MapPin, MonitorSmartphone, RotateCcw, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiPost, type ApiContract, type ContractDeviceInfo, type ContractSignPayload } from "../services/api";
import { Button, Panel } from "./ui";

type LocationState =
  | { status: "off" }
  | { status: "requesting" }
  | { status: "granted"; coords: { latitude: number; longitude: number; accuracy: number } }
  | { status: "denied"; blocked: boolean }
  | { status: "error"; message: string };

/**
 * Collects everything a signature needs to be legally consistent: account password,
 * identity (name, e-mail, CPF), location, IP, device data and acceptance of the terms.
 * Each item has its own required switch; the sign button stays locked until all are satisfied.
 */
export function SignContractDialog({
  contract,
  onClose,
  onSigned,
}: {
  contract: ApiContract;
  onClose: () => void;
  onSigned: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [location, setLocation] = useState<LocationState>({ status: "off" });
  const [identityConsent, setIdentityConsent] = useState(false);
  const [ipConsent, setIpConsent] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<ContractDeviceInfo | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const signer = currentParticipant(contract);
  const missingCpf = Boolean(signer && !signer.user.cpf);
  const requestId = useRef(0);

  const requestLocation = useCallback(async () => {
    const id = ++requestId.current;
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocation({
        status: "error",
        message: "Este navegador nao permite obter a localizacao nesta pagina. Acesse o sistema por HTTPS ou use outro navegador.",
      });
      return;
    }
    setLocation({ status: "requesting" });
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 0,
          timeout: 30_000,
        }),
      );
      if (id !== requestId.current) return;
      setLocation({
        status: "granted",
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
      });
    } catch (error) {
      if (id !== requestId.current) return;
      const geoError = error as GeolocationPositionError;
      if (geoError.code === 1) {
        setLocation({ status: "denied", blocked: (await locationPermissionState()) === "denied" });
        return;
      }
      setLocation({
        status: "error",
        message:
          geoError.code === 3
            ? "A localizacao demorou demais para responder. Verifique se o GPS/servico de localizacao do dispositivo esta ligado."
            : "Nao foi possivel determinar sua localizacao. Verifique se o servico de localizacao do dispositivo esta ligado.",
      });
    }
  }, []);

  // When the user unblocks location in the browser settings, retry without another click.
  useEffect(() => {
    if (location.status !== "denied" || !navigator.permissions) return;
    let status: PermissionStatus | undefined;
    let cancelled = false;
    void navigator.permissions.query({ name: "geolocation" }).then((result) => {
      if (cancelled) return;
      status = result;
      result.onchange = () => {
        if (result.state !== "denied") void requestLocation();
      };
    });
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [location.status, requestLocation]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleLocation = (enabled: boolean) => {
    if (enabled) {
      void requestLocation();
      return;
    }
    requestId.current += 1;
    setLocation({ status: "off" });
  };

  const resetPermissions = () => {
    setIdentityConsent(false);
    setIpConsent(false);
    setDeviceInfo(null);
    setAcceptedTerms(false);
    void requestLocation();
  };

  const signMutation = useMutation({
    mutationFn: () => {
      if (location.status !== "granted") throw new Error("Localizacao obrigatoria para assinar.");
      if (!deviceInfo) throw new Error("Autorize o registro do dispositivo para assinar.");
      const payload: ContractSignPayload = {
        password,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        geoAccuracy: location.coords.accuracy,
        acceptedTerms: true,
        deviceInfo,
      };
      return apiPost<ApiContract>(`/contracts/${contract.id}/sign`, payload);
    },
    onSuccess: () => {
      onSigned();
      onClose();
    },
    meta: { successMessage: "Contrato assinado com sucesso." },
  });

  const locationOk = location.status === "granted";
  const missingPermission = location.status === "denied" || location.status === "error";
  const ready =
    !missingCpf && identityConsent && locationOk && ipConsent && Boolean(deviceInfo) && acceptedTerms && password.length > 0;
  const pending: string[] = [];
  if (!password) pending.push("digitar sua senha");
  if (!identityConsent) pending.push("confirmar sua identificacao");
  if (!locationOk) pending.push("permitir a localizacao");
  if (!ipConsent) pending.push("autorizar o registro do IP");
  if (!deviceInfo) pending.push("autorizar o registro do dispositivo");
  if (!acceptedTerms) pending.push("aceitar os termos");

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <Panel className="w-full max-w-lg p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mono-label text-[color:var(--muted)]">Assinar contrato</p>
            <h2 className="mt-1 truncate font-display text-2xl font-semibold">{contract.title}</h2>
          </div>
          <Button aria-label="Fechar" type="button" variant="ghost" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) signMutation.mutate();
          }}
        >
          <label className="block">
            <span className="mono-label text-[color:var(--muted)]">Senha da conta</span>
            <div className="mt-2 flex items-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] pr-2">
              <input
                autoComplete="current-password"
                autoFocus
                className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="px-3"
                type="button"
                variant="ghost"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          </label>

          <div className="grid gap-2">
            <span className="mono-label text-[color:var(--muted)]">Permissoes obrigatorias</span>
            <PermissionSwitch
              checked={identityConsent}
              description={
                signer
                  ? `${signer.user.name} · ${signer.user.email} · CPF ${signer.user.cpf ?? "nao cadastrado"}`
                  : "Nome, e-mail e CPF da sua conta."
              }
              disabled={missingCpf}
              icon={<UserCheck size={18} />}
              label="Identificacao do assinante"
              status={identityConsent ? <StatusOk text="Confirmado" /> : null}
              onChange={setIdentityConsent}
            />
            <PermissionSwitch
              checked={location.status !== "off"}
              description="Registra a localizacao aproximada no log da assinatura."
              icon={<MapPin size={18} />}
              label="Localizacao"
              status={<LocationStatus state={location} />}
              onChange={toggleLocation}
            />
            <PermissionSwitch
              checked={ipConsent}
              description="O servidor registra o endereco IP publico da sua conexao."
              icon={<Globe size={18} />}
              label="Endereco IP"
              status={ipConsent ? <StatusOk /> : null}
              onChange={setIpConsent}
            />
            <PermissionSwitch
              checked={Boolean(deviceInfo)}
              description="Navegador (user-agent), sistema, idioma, fuso horario e tela."
              icon={<MonitorSmartphone size={18} />}
              label="Navegador e dispositivo"
              status={deviceInfo ? <StatusOk text={describeDevice(deviceInfo)} /> : null}
              onChange={(enabled) => setDeviceInfo(enabled ? collectDeviceInfo() : null)}
            />
          </div>

          {missingCpf ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-300">
                <AlertTriangle size={16} />
                Nao foi possivel assinar: sua conta nao tem CPF cadastrado.
              </p>
              <p className="mt-2 text-[color:var(--muted)]">
                Cadastre o CPF em{" "}
                <a className="font-semibold underline" href="/settings">
                  Configuracoes
                </a>{" "}
                e volte para assinar.
              </p>
            </div>
          ) : null}

          {missingPermission ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-300">
                <AlertTriangle size={16} />
                Nao foi possivel assinar o contrato por falta de permissoes.
              </p>
              <p className="mt-2 text-[color:var(--muted)]">
                {location.status === "error"
                  ? location.message
                  : location.blocked
                    ? "O navegador bloqueou a localizacao para este site. Clique no icone de cadeado ao lado do endereco, permita a localizacao e depois clique abaixo."
                    : "A localizacao foi negada. Ela e necessaria para consolidar a assinatura e dar validade juridica ao contrato."}
              </p>
              <Button className="mt-3" type="button" variant="secondary" onClick={resetPermissions}>
                <RotateCcw size={16} />
                Redefinir permissoes e perguntar de novo
              </Button>
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm">
            <input
              checked={acceptedTerms}
              className="mt-1 h-4 w-4 shrink-0"
              type="checkbox"
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span className="text-[color:var(--muted)]">
              Li e aceito os{" "}
              <a className="font-semibold underline" href="/termos" rel="noopener noreferrer" target="_blank">
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a className="font-semibold underline" href="/privacidade" rel="noopener noreferrer" target="_blank">
                Politica de Privacidade
              </a>
              . Entendo que a senha, minha identificacao, a localizacao, o IP e os dados do dispositivo sao necessarios
              para consolidar esta assinatura eletronica e garantir a validade juridica do contrato.
            </span>
          </label>

          <p className="text-xs text-[color:var(--muted)]">
            Tambem ficam registrados automaticamente: data e hora (UTC), hash SHA-256 do documento assinado e hash da
            sua sessao autenticada. Tudo aparece no log de assinaturas anexado ao PDF final.
          </p>

          {!ready && !missingPermission ? (
            <p className="text-xs text-[color:var(--muted)]">Para assinar, falta: {pending.join(", ")}.</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!ready || signMutation.isPending}
              type="submit"
            >
              {signMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <FileSignature size={17} />}
              {signMutation.isPending ? "Assinando..." : "Assinar"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>,
    document.body,
  );
}

function PermissionSwitch({
  checked,
  disabled = false,
  label,
  description,
  icon,
  status,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: React.ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
      <span className="text-[color:var(--muted)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="break-words text-xs text-[color:var(--muted)]">{description}</p>
        {status ? <div className="mt-1 text-xs">{status}</div> : null}
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] ${
          checked ? "bg-[color:var(--primary)] dark:bg-[color:var(--warning)]" : "bg-[color:var(--line)]"
        } disabled:cursor-not-allowed disabled:opacity-40`}
        disabled={disabled}
        role="switch"
        type="button"
        onClick={() => onChange(!checked)}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

function LocationStatus({ state }: { state: LocationState }) {
  if (state.status === "requesting") {
    return (
      <span className="flex items-center gap-1 text-[color:var(--muted)]">
        <Loader2 className="animate-spin" size={12} />
        Aguardando voce permitir a localizacao no navegador...
      </span>
    );
  }
  if (state.status === "granted") {
    return <StatusOk text={`Localizacao obtida (precisao ~${Math.round(state.coords.accuracy)} m)`} />;
  }
  if (state.status === "denied" || state.status === "error") {
    return <span className="font-semibold text-rose-600 dark:text-rose-300">Permissao nao concedida</span>;
  }
  return null;
}

function StatusOk({ text = "Autorizado" }: { text?: string }) {
  return (
    <span className="flex items-center gap-1 font-semibold text-mint-600 dark:text-mint-400">
      <CheckCircle2 size={12} />
      {text}
    </span>
  );
}

async function locationPermissionState() {
  try {
    return (await navigator.permissions?.query({ name: "geolocation" }))?.state;
  } catch {
    return undefined;
  }
}

function currentParticipant(contract: ApiContract) {
  try {
    const raw = localStorage.getItem("projectfy-user");
    const userId = raw ? (JSON.parse(raw) as { id?: string }).id : undefined;
    return (contract.participants ?? []).find((participant) => participant.user.id === userId);
  } catch {
    return undefined;
  }
}

function collectDeviceInfo(): ContractDeviceInfo {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return {
    platform: uaData?.platform || navigator.platform || "desconhecido",
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${window.screen.width}x${window.screen.height}`,
    pixelRatio: window.devicePixelRatio,
    touchPoints: navigator.maxTouchPoints ?? 0,
  };
}

function describeDevice(info: ContractDeviceInfo) {
  return `${info.platform} · ${info.language} · ${info.timezone} · ${info.screen}`;
}
