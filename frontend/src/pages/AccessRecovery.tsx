import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Lock, Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, Panel } from "../components/ui";
import { requestPasswordReset, resetPassword } from "../services/api";

const passwordRuleMessage =
  "A senha deve ter no minimo 6 caracteres e pelo menos um caractere especial.";
const passwordSpecialCharacterPattern = /[^A-Za-z0-9]/;

export function AccessRecovery() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      toast.success("Acesso localizado. Defina uma nova senha.");
      navigate(`/reset-password?email=${encodeURIComponent(result.email || email)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel recuperar o acesso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Recuperar acesso" title="Informe seu email cadastrado">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Email</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
            <Mail size={18} className="text-[color:var(--muted)]" />
            <input
              className="w-full bg-transparent outline-none"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>
        <Button className="w-full py-3 text-base" disabled={loading} type="submit">
          {loading ? "Verificando..." : "Continuar"}
          <ArrowRight size={18} />
        </Button>
      </form>
      <AuthFooter />
    </AuthShell>
  );
}

export function ResetPassword({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storedEmail = useMemo(() => readStoredUserEmail(), []);
  const [email, setEmail] = useState(searchParams.get("email") ?? storedEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordsMatch = !password || password === confirmPassword;
  const passwordValid =
    !password ||
    (password.length >= 6 && passwordSpecialCharacterPattern.test(password));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordsMatch || !passwordValid) return;
    setLoading(true);
    try {
      await resetPassword(email, password);
      toast.success("Senha alterada com sucesso.");
      navigate(embedded ? "/settings" : "/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel alterar a senha.");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Email</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
            <Mail size={18} className="text-[color:var(--muted)]" />
            <input
              className="w-full bg-transparent outline-none"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Nova senha</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
            <Lock size={18} className="text-[color:var(--muted)]" />
            <input
              className="w-full bg-transparent outline-none"
              minLength={6}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </label>

        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Confirmar senha</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
            <KeyRound size={18} className="text-[color:var(--muted)]" />
            <input
              className="w-full bg-transparent outline-none"
              minLength={6}
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        </label>

        {!passwordValid ? (
          <p className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-3 text-sm text-ember-600 dark:text-ember-400">
            {passwordRuleMessage}
          </p>
        ) : null}
        {!passwordsMatch ? (
          <p className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-3 text-sm text-ember-600 dark:text-ember-400">
            As senhas precisam ser iguais.
          </p>
        ) : null}

        <Button
          className="w-full py-3 text-base"
          disabled={loading || !password || !passwordValid || !passwordsMatch}
          type="submit"
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
          <ArrowRight size={18} />
        </Button>
      </form>
      {!embedded ? <AuthFooter /> : null}
    </>
  );

  if (embedded) {
    return (
      <Panel className="mx-auto max-w-xl p-6 md:p-8">
        <p className="mono-label text-[color:var(--muted)]">Mudar senha</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Defina uma nova senha</h1>
        <div className="mt-6">{content}</div>
      </Panel>
    );
  }

  return (
    <AuthShell eyebrow="Nova senha" title="Defina uma nova senha">
      {content}
    </AuthShell>
  );
}

function AuthShell({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--bg)] px-4 py-10 text-[color:var(--text)]">
      <Panel className="w-full max-w-[520px] p-8 md:p-10">
        <Link
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
          to="/login"
        >
          <ArrowLeft size={17} />
          Voltar
        </Link>
        <p className="mono-label text-[color:var(--muted)]">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold">{title}</h1>
        <div className="mt-7">{children}</div>
      </Panel>
    </main>
  );
}

function AuthFooter() {
  return (
    <div className="mt-7 flex items-center justify-between text-sm">
      <Link
        className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
        to="/login"
      >
        Entrar
      </Link>
      <Link
        className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
        to="/register"
      >
        Criar conta
      </Link>
    </div>
  );
}

function readStoredUserEmail() {
  try {
    const raw = localStorage.getItem("projectfy-user");
    return raw ? (JSON.parse(raw) as { email?: string }).email : undefined;
  } catch {
    return undefined;
  }
}
