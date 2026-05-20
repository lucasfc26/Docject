import { ArrowLeft, Mail, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, Panel } from "../components/ui";

type Channel = "whatsapp" | "email";

const WHATSAPP_NUMBER = "5511999999999"; // substituir pelo número real
const SUPPORT_EMAIL = "suporte@masecorp.com";

export function Suporte() {
  const [channel, setChannel] = useState<Channel>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function buildWhatsAppUrl() {
    const text = encodeURIComponent(
      `*Ticket de Suporte — Projectfy*\n\n` +
        `*Nome:* ${name}\n` +
        `*E-mail:* ${email}\n` +
        `*Assunto:* ${subject}\n\n` +
        `*Mensagem:*\n${message}`,
    );
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  }

  function buildMailtoUrl() {
    return (
      `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(`[Suporte] ${subject}`)}` +
      `&body=${encodeURIComponent(`Nome: ${name}\nE-mail: ${email}\n\n${message}`)}`
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.warn("Preencha todos os campos antes de enviar.");
      return;
    }

    setSubmitting(true);

    if (channel === "whatsapp") {
      window.open(buildWhatsAppUrl(), "_blank", "noopener,noreferrer");
      toast.success("Redirecionando para o WhatsApp…");
    } else {
      window.location.href = buildMailtoUrl();
      toast.success("Abrindo seu cliente de e-mail…");
    }

    setSubmitting(false);
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)] hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={16} />
          Voltar para o login
        </Link>

        <Panel className="p-8 md:p-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">
              Central de Suporte
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Abra um ticket e nossa equipe responderá o mais rápido possível.
            </p>
          </div>

          {/* Channel selector */}
          <div className="mb-6 flex gap-3">
            <button
              type="button"
              onClick={() => setChannel("email")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] ${
                channel === "email"
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)] dark:border-[color:var(--accent)] dark:text-[color:var(--accent)]"
                  : "border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:bg-[color:var(--panel)]"
              }`}
            >
              <Mail size={18} />
              E-mail
            </button>

            <button
              type="button"
              onClick={() => setChannel("whatsapp")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] ${
                channel === "whatsapp"
                  ? "border-[#25D366] bg-[#25D366]/10 text-[#25D366]"
                  : "border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--muted)] hover:bg-[color:var(--panel)]"
              }`}
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>
          </div>

          {/* Destination badge */}
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--muted)]">
            {channel === "email" ? (
              <>
                <Mail size={15} />
                <span>
                  Seu ticket será enviado para{" "}
                  <strong className="text-[color:var(--text)]">
                    {SUPPORT_EMAIL}
                  </strong>
                </span>
              </>
            ) : (
              <>
                <MessageCircle size={15} />
                <span>
                  Seu ticket será enviado via{" "}
                  <strong className="text-[color:var(--text)]">WhatsApp</strong>{" "}
                  para a nossa equipe
                </span>
              </>
            )}
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mono-label text-[color:var(--muted)]">
                  Seu nome
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20 dark:focus:border-[color:var(--accent)]"
                  placeholder="João da Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="mono-label text-[color:var(--muted)]">
                  Seu e-mail
                </span>
                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20 dark:focus:border-[color:var(--accent)]"
                  placeholder="joao@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="mono-label text-[color:var(--muted)]">
                Assunto
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20 dark:focus:border-[color:var(--accent)]"
                placeholder="Descreva brevemente o problema"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mono-label text-[color:var(--muted)]">
                Mensagem
              </span>
              <textarea
                rows={5}
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20 dark:focus:border-[color:var(--accent)] resize-none"
                placeholder="Descreva em detalhes sua dúvida ou problema…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>

            <Button
              className="w-full py-3 text-base"
              type="submit"
              disabled={submitting}
            >
              {channel === "whatsapp" ? (
                <>
                  <MessageCircle size={18} />
                  Enviar via WhatsApp
                </>
              ) : (
                <>
                  <Send size={18} />
                  Enviar por E-mail
                </>
              )}
            </Button>
          </form>

          {/* FAQ quick links */}
          <div className="mt-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-5">
            <h2 className="mb-3 text-sm font-semibold">Dúvidas frequentes</h2>
            <ul className="space-y-2 text-sm text-[color:var(--muted)]">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[color:var(--primary)] dark:text-[color:var(--accent)]">
                  •
                </span>
                <span>
                  <strong className="text-[color:var(--text)]">
                    Como redefinir minha senha?
                  </strong>{" "}
                  — Use o link "Recuperar acesso" na tela de login.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[color:var(--primary)] dark:text-[color:var(--accent)]">
                  •
                </span>
                <span>
                  <strong className="text-[color:var(--text)]">
                    Como cancelar minha assinatura?
                  </strong>{" "}
                  — Acesse Configurações &gt; Plano e clique em "Cancelar".
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[color:var(--primary)] dark:text-[color:var(--accent)]">
                  •
                </span>
                <span>
                  <strong className="text-[color:var(--text)]">
                    Tempo médio de resposta:
                  </strong>{" "}
                  até 24 horas em dias úteis.
                </span>
              </li>
            </ul>
          </div>
        </Panel>

        <footer className="mt-8 flex flex-col items-center gap-2 text-xs text-[color:var(--muted)]">
          <span>© 2026 MaseCorp. Todos os direitos reservados.</span>
          <nav className="flex items-center gap-2">
            <Link
              to="/termos"
              className="hover:text-[color:var(--primary)] dark:hover:text-[color:var(--accent)] transition-colors"
            >
              Termos de Uso
            </Link>
            <span aria-hidden="true">•</span>
            <Link
              to="/privacidade"
              className="hover:text-[color:var(--primary)] dark:hover:text-[color:var(--accent)] transition-colors"
            >
              Política de Privacidade
            </Link>
            <span aria-hidden="true">•</span>
            <Link
              to="/suporte"
              className="hover:text-[color:var(--primary)] dark:hover:text-[color:var(--accent)] transition-colors"
            >
              Suporte
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
