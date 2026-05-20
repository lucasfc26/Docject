import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "../components/ui";

export function TermosDeUso() {
  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)] hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={16} />
          Voltar para o login
        </Link>

        <Panel className="p-8 md:p-12">
          <h1 className="mb-2 text-2xl font-bold tracking-tight">
            Termos de Uso
          </h1>
          <p className="mb-8 text-sm text-[color:var(--muted)]">
            Última atualização: 19 de maio de 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-[color:var(--text)]">
            <section>
              <h2 className="mb-2 font-semibold text-base">
                1. Aceitação dos Termos
              </h2>
              <p>
                Ao acessar ou usar a plataforma <strong>Projectfy</strong>,
                operada pela <strong>MaseCorp</strong>, você declara que leu,
                compreendeu e concorda com estes Termos de Uso. Se você não
                concordar com qualquer parte destes termos, não utilize nossos
                serviços.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                2. Descrição do Serviço
              </h2>
              <p>
                O Projectfy é uma plataforma de gestão de projetos, clientes,
                contratos, agenda e finanças voltada para agências e prestadores
                de serviços. Os recursos disponíveis variam conforme o plano
                contratado.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                3. Cadastro e Conta
              </h2>
              <p>
                Para utilizar o Projectfy você deve criar uma conta com
                informações verídicas e mantê-la atualizada. Você é responsável
                pela confidencialidade de sua senha e por todas as atividades
                realizadas em sua conta. Em caso de acesso não autorizado,
                notifique-nos imediatamente pelo{" "}
                <a
                  href="mailto:suporte@masecorp.com"
                  className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                >
                  suporte@masecorp.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">4. Uso Permitido</h2>
              <p>
                Você concorda em utilizar a plataforma somente para fins lícitos
                e de acordo com estes Termos. É vedado:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted)]">
                <li>
                  Usar a plataforma para atividades ilegais ou fraudulentas;
                </li>
                <li>Tentar acessar contas ou dados de outros usuários;</li>
                <li>
                  Realizar engenharia reversa, descompilar ou extrair o
                  código-fonte;
                </li>
                <li>
                  Sobrecarregar intencionalmente a infraestrutura da plataforma;
                </li>
                <li>
                  Transmitir vírus, malware ou qualquer código prejudicial.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                5. Propriedade Intelectual
              </h2>
              <p>
                Todo o conteúdo da plataforma — incluindo interface, logotipos,
                código e documentação — é de propriedade da MaseCorp e protegido
                pelas leis de propriedade intelectual aplicáveis. É proibida a
                reprodução sem autorização prévia por escrito.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                6. Dados e Privacidade
              </h2>
              <p>
                O tratamento dos seus dados pessoais é regido pela nossa{" "}
                <Link
                  to="/privacidade"
                  className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                >
                  Política de Privacidade
                </Link>
                , em conformidade com a Lei Geral de Proteção de Dados (LGPD —
                Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                7. Limitação de Responsabilidade
              </h2>
              <p>
                A MaseCorp não se responsabiliza por danos indiretos,
                incidentais ou consequentes decorrentes do uso ou
                impossibilidade de uso da plataforma. A responsabilidade total
                da MaseCorp fica limitada ao valor pago pelo usuário nos últimos
                3 (três) meses de serviço.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">8. Rescisão</h2>
              <p>
                A MaseCorp reserva-se o direito de suspender ou encerrar sua
                conta, a qualquer momento e sem aviso prévio, em caso de
                violação destes Termos.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                9. Alterações nos Termos
              </h2>
              <p>
                Podemos atualizar estes Termos periodicamente. Notificaremos
                alterações relevantes por e-mail ou por aviso na plataforma. O
                uso contínuo após a notificação implica aceitação dos novos
                termos.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                10. Legislação Aplicável
              </h2>
              <p>
                Estes Termos são regidos pelas leis da República Federativa do
                Brasil. Fica eleito o foro da comarca de São Paulo/SP para
                resolução de eventuais conflitos.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">11. Contato</h2>
              <p>
                Dúvidas sobre estes Termos? Entre em contato pelo{" "}
                <a
                  href="mailto:juridico@masecorp.com"
                  className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                >
                  juridico@masecorp.com
                </a>{" "}
                ou acesse nossa{" "}
                <Link
                  to="/suporte"
                  className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                >
                  página de suporte
                </Link>
                .
              </p>
            </section>
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
