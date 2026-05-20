import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "../components/ui";

export function PoliticaDePrivacidade() {
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
            Política de Privacidade
          </h1>
          <p className="mb-8 text-sm text-[color:var(--muted)]">
            Última atualização: 19 de maio de 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-[color:var(--text)]">
            <section>
              <h2 className="mb-2 font-semibold text-base">1. Quem somos</h2>
              <p>
                A <strong>MaseCorp</strong> é a controladora dos dados pessoais
                coletados por meio da plataforma <strong>Projectfy</strong>.
                Nosso e-mail de contato para questões de privacidade é{" "}
                <a
                  href="mailto:privacidade@masecorp.com"
                  className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                >
                  privacidade@masecorp.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                2. Dados que coletamos
              </h2>
              <p>Coletamos os seguintes dados pessoais:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted)]">
                <li>
                  <strong className="text-[color:var(--text)]">
                    Dados de cadastro:
                  </strong>{" "}
                  nome, e-mail, telefone e senha (criptografada);
                </li>
                <li>
                  <strong className="text-[color:var(--text)]">
                    Dados de uso:
                  </strong>{" "}
                  endereço IP, tipo de dispositivo, páginas acessadas e tempo de
                  sessão;
                </li>
                <li>
                  <strong className="text-[color:var(--text)]">
                    Dados de pagamento:
                  </strong>{" "}
                  informações de cobrança (número de cartão não é armazenado por
                  nós);
                </li>
                <li>
                  <strong className="text-[color:var(--text)]">
                    Dados inseridos pelo usuário:
                  </strong>{" "}
                  projetos, clientes, contratos, arquivos e demais informações
                  cadastradas na plataforma.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                3. Finalidade do tratamento
              </h2>
              <p>Utilizamos seus dados para:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted)]">
                <li>Prestação e melhoria dos serviços da plataforma;</li>
                <li>Autenticação e segurança da conta;</li>
                <li>
                  Comunicações transacionais (confirmações, alertas e faturas);
                </li>
                <li>Comunicações de marketing, mediante consentimento;</li>
                <li>Cumprimento de obrigações legais e regulatórias.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                4. Base legal (LGPD)
              </h2>
              <p>
                O tratamento dos seus dados é fundamentado nas seguintes bases
                legais previstas na LGPD (Lei nº 13.709/2018):
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted)]">
                <li>Execução de contrato (art. 7º, V);</li>
                <li>Legítimo interesse (art. 7º, IX);</li>
                <li>
                  Consentimento (art. 7º, I) — para comunicações de marketing;
                </li>
                <li>Cumprimento de obrigação legal (art. 7º, II).</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                5. Compartilhamento de dados
              </h2>
              <p>Não vendemos seus dados. Podemos compartilhá-los com:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted)]">
                <li>
                  Prestadores de serviços essenciais (hospedagem, pagamento,
                  e-mail);
                </li>
                <li>Autoridades públicas quando exigido por lei;</li>
                <li>
                  Parceiros de negócio, mediante seu consentimento explícito.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                6. Retenção de dados
              </h2>
              <p>
                Mantemos seus dados pelo prazo necessário para cumprir as
                finalidades descritas nesta política, ou conforme exigido por
                lei. Após o encerramento da conta, os dados são eliminados em
                até 90 (noventa) dias, exceto quando obrigados a retê-los por
                determinação legal.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">7. Seus direitos</h2>
              <p>Nos termos da LGPD, você pode a qualquer momento:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted)]">
                <li>Confirmar a existência do tratamento;</li>
                <li>Acessar seus dados;</li>
                <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
                <li>
                  Solicitar anonimização, bloqueio ou eliminação de dados
                  desnecessários;
                </li>
                <li>Revogar o consentimento a qualquer momento;</li>
                <li>Solicitar portabilidade para outro fornecedor.</li>
              </ul>
              <p className="mt-2">
                Para exercer esses direitos, contate{" "}
                <a
                  href="mailto:privacidade@masecorp.com"
                  className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                >
                  privacidade@masecorp.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">8. Cookies</h2>
              <p>
                Utilizamos cookies essenciais para o funcionamento da plataforma
                e cookies analíticos para entender como os usuários interagem
                com o sistema. Você pode gerenciar suas preferências de cookies
                nas configurações do seu navegador.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">9. Segurança</h2>
              <p>
                Adotamos medidas técnicas e organizacionais adequadas para
                proteger seus dados contra acesso não autorizado, perda,
                alteração ou divulgação, incluindo criptografia em trânsito
                (TLS) e em repouso, controle de acesso por função e
                monitoramento contínuo de segurança.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">
                10. Alterações nesta Política
              </h2>
              <p>
                Esta Política pode ser atualizada periodicamente. Quando houver
                mudanças relevantes, informaremos por e-mail ou por aviso na
                plataforma. Recomendamos a revisão regular deste documento.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold text-base">11. Contato</h2>
              <p>
                Para dúvidas, solicitações ou reclamações relacionadas à
                privacidade, entre em contato com nosso Encarregado de Proteção
                de Dados (DPO) pelo e-mail{" "}
                <a
                  href="mailto:privacidade@masecorp.com"
                  className="font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]"
                >
                  privacidade@masecorp.com
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
