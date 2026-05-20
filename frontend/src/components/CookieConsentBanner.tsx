import { Cookie, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui";
import { useConsentStore } from "../stores/consent";

export function CookieConsentBanner() {
  const { status, accept, reject } = useConsentStore();

  if (status !== "pending") return null;

  return (
    <>
      {/* Overlay semitransparente que bloqueia interação com o fundo */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Banner */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-desc"
        className="fixed inset-x-4 bottom-6 z-[9999] mx-auto max-w-2xl rounded-3xl border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl"
      >
        <div className="flex items-start gap-4">
          {/* Ícone */}
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--primary)]/10">
            <Cookie
              size={20}
              className="text-[color:var(--primary)] dark:text-[color:var(--accent)]"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2
              id="consent-title"
              className="font-semibold text-[color:var(--text)]"
            >
              Privacidade &amp; Cookies
            </h2>
            <p
              id="consent-desc"
              className="mt-1 text-sm leading-relaxed text-[color:var(--muted)]"
            >
              Utilizamos cookies e coletamos dados para autenticação, segurança
              e melhoria da plataforma, conforme nossa{" "}
              <Link
                to="/privacidade"
                className="font-semibold text-[color:var(--primary)] underline underline-offset-2 hover:opacity-80 dark:text-[color:var(--accent)]"
              >
                Política de Privacidade
              </Link>{" "}
              e nossos{" "}
              <Link
                to="/termos"
                className="font-semibold text-[color:var(--primary)] underline underline-offset-2 hover:opacity-80 dark:text-[color:var(--accent)]"
              >
                Termos de Uso
              </Link>
              . Ao aceitar, você autoriza o tratamento de dados necessários para
              o funcionamento completo da plataforma (LGPD — Lei nº
              13.709/2018).
            </p>

            {/* Bullets de o que é coletado */}
            <ul className="mt-3 grid gap-1 text-xs text-[color:var(--muted)] sm:grid-cols-2">
              {[
                "Dados de autenticação e sessão",
                "Ações e eventos dentro da plataforma",
                "Dispositivo, navegador e IP de acesso",
                "Dados inseridos por você (projetos, clientes etc.)",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <ShieldCheck
                    size={12}
                    className="shrink-0 text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                  />
                  {item}
                </li>
              ))}
            </ul>

            {/* Botões */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={accept} className="flex-1 py-2.5 sm:flex-none">
                <ShieldCheck size={16} />
                Aceitar e continuar
              </Button>
              <Button
                variant="secondary"
                onClick={reject}
                className="flex-1 py-2.5 sm:flex-none"
              >
                Rejeitar
              </Button>
              <p className="w-full text-xs text-[color:var(--muted)] sm:w-auto sm:flex-1">
                Ao rejeitar, funcionalidades que dependem de coleta de dados
                serão desativadas.
              </p>
            </div>
          </div>

          {/* Botão fechar (só fecha o visual sem registrar decisão — força aceitar/rejeitar) */}
          <button
            type="button"
            aria-label="Ignorar por agora"
            onClick={reject}
            className="mt-0.5 shrink-0 rounded-full p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--panel-strong)] hover:text-[color:var(--text)]"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

/** Pequeno botão flutuante para reabrir as preferências de consentimento (exibido após a decisão). */
export function ConsentReopenButton() {
  const { status, reset } = useConsentStore();

  if (status === "pending") return null;

  return (
    <button
      type="button"
      title="Preferências de privacidade"
      onClick={reset}
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] text-[color:var(--muted)] shadow-panel transition hover:bg-[color:var(--panel-strong)] hover:text-[color:var(--text)]"
    >
      <Cookie size={18} />
    </button>
  );
}
