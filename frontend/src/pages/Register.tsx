import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";
import { Button, Panel } from "../components/ui";
import { registerUser } from "../services/api";

const passwordSpecialCharacterPattern = /[^A-Za-z0-9]/;

const schema = z
  .object({
    name: z.string().min(2, "Informe seu nome"),
    email: z.string().email("Informe um email valido"),
    password: z
      .string()
      .min(6, "Use pelo menos 6 caracteres")
      .regex(
        passwordSpecialCharacterPattern,
        "Use pelo menos um caractere especial, como , . ! @ #",
      ),
    confirmPassword: z.string().min(6, "Confirme sua senha")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas precisam ser iguais",
    path: ["confirmPassword"]
  });

type FormValues = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" }
  });

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <Panel className="w-full max-w-[540px] p-8 md:p-10">
        <div className="mb-8 text-center">
          <img alt="Docject" className="mx-auto mb-5 h-28 w-auto object-contain" src="/DJ LOGO FULL.svg" />
          <p className="mt-2 text-[color:var(--muted)]">Crie seu acesso ao Docject.</p>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(
            async (values) => {
              try {
                await registerUser(values.name, values.email, values.password);
                toast.success("Conta criada com sucesso.");
                navigate("/dashboard");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Nao foi possivel criar a conta.");
              }
            },
            (formErrors) => {
              const firstError = Object.values(formErrors)[0]?.message;
              toast.warn(typeof firstError === "string" ? firstError : "Revise os campos do formulario.");
            }
          )}
        >
          <RegisterField error={errors.name?.message} icon={<UserRound size={18} />} label="Nome">
            <input className="w-full bg-transparent outline-none" {...register("name")} />
          </RegisterField>
          <RegisterField error={errors.email?.message} icon={<Mail size={18} />} label="Email">
            <input
              className="w-full bg-transparent outline-none"
              type="email"
              {...register("email", {
                setValueAs: (value) => String(value).trim().toLowerCase(),
              })}
            />
          </RegisterField>
          <RegisterField error={errors.password?.message} icon={<Lock size={18} />} label="Senha">
            <input className="w-full bg-transparent outline-none" type="password" {...register("password")} />
          </RegisterField>
          <RegisterField error={errors.confirmPassword?.message} icon={<Lock size={18} />} label="Confirmar senha">
            <input className="w-full bg-transparent outline-none" type="password" {...register("confirmPassword")} />
          </RegisterField>

          <Button className="w-full py-3 text-base" type="submit">
            Criar conta
            <ArrowRight size={18} />
          </Button>
        </form>

        <div className="mt-7 text-center text-sm">
          <Link className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]" to="/login">
            Ja tenho acesso
          </Link>
        </div>
      </Panel>
    </div>
  );
}

function RegisterField({ children, error, icon, label }: { children: React.ReactNode; error?: string; icon: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mono-label text-[color:var(--muted)]">{label}</span>
      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 text-[color:var(--muted)]">
        {icon}
        {children}
      </div>
      {error ? <span className="mt-1 block text-sm text-ember-600 dark:text-ember-400">{error}</span> : null}
    </label>
  );
}
