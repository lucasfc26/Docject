import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";
import { Button, Panel } from "../components/ui";
import { login } from "../services/api";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="#1877F2"
    >
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

const schema = z.object({
  email: z.string().email("Informe um email valido"),
  password: z.string().min(6, "Use pelo menos 6 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 gap-6">
      <Panel className="w-full max-w-[520px] p-8 md:p-10">
        <div className="mb-8 text-center">
          <div className="flex flex-row items-center justify-center gap-6">
            <img
              alt="Docject"
              className="mx-auto mb-5 h-32 w-auto object-contain"
              src="/DJ LOGO FULL.svg"
            />
            <img
              alt="MaselCorp"
              className="mx-auto mb-5 h-32 w-auto object-contain"
              src="/MaseLCorp3D2.png"
            />
          </div>
          <p className="mt-2 text-[color:var(--muted)]">
            Inicialize sua sessao de comando.
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(
            async (values) => {
              try {
                const session = await login(values.email, values.password);
                toast.success("Sessao iniciada com sucesso.");
                navigate(
                  session.user.role === "CLIENT"
                    ? "/client/dashboard"
                    : "/dashboard",
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nao foi possivel iniciar sessao.",
                );
              }
            },
            (formErrors) => {
              const firstError = Object.values(formErrors)[0]?.message;
              toast.warn(
                typeof firstError === "string"
                  ? firstError
                  : "Revise os campos do formulario.",
              );
            },
          )}
        >
          <label className="block">
            <span className="mono-label text-[color:var(--muted)]">Email</span>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
              <Mail size={18} className="text-[color:var(--muted)]" />
              <input
                className="w-full bg-transparent outline-none"
                {...register("email")}
              />
            </div>
            {errors.email ? (
              <span className="mt-1 block text-sm text-ember-600 dark:text-ember-400">
                {errors.email.message}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mono-label text-[color:var(--muted)]">Senha</span>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
              <Lock size={18} className="text-[color:var(--muted)]" />
              <input
                className="w-full bg-transparent outline-none"
                type="password"
                {...register("password")}
              />
            </div>
            {errors.password ? (
              <span className="mt-1 block text-sm text-ember-600 dark:text-ember-400">
                {errors.password.message}
              </span>
            ) : null}
          </label>

          <Button className="w-full py-3 text-base" type="submit">
            Entrar
            <ArrowRight size={18} />
          </Button>
        </form>

        <div className="mt-7 flex items-center justify-between text-sm">
          <a
            className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
            href="/forgot-password"
          >
            Recuperar acesso
          </a>
          <Link
            className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
            to="/register"
          >
            Criar conta
          </Link>
        </div>

        {/* Social login divider */}
        <div className="mt-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--line)]" />
          <span className="text-xs text-[color:var(--muted)]">
            ou continue com
          </span>
          <span className="h-px flex-1 bg-[color:var(--line)]" />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => toast.info("Login com Google em breve.")}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--panel)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          >
            <GoogleIcon />
            Google
          </button>
          <button
            type="button"
            onClick={() => toast.info("Login com Facebook em breve.")}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--panel)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          >
            <FacebookIcon />
            Facebook
          </button>
        </div>
      </Panel>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2 text-xs text-[color:var(--muted)]">
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
  );
}
