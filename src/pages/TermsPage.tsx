export function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <a href="/" className="text-primary hover:underline">
          ← Voltar
        </a>

        <h1 className="text-3xl font-bold">Termos de Uso</h1>

        <p className="text-muted-foreground">
          Última atualização: 20/06/2026
        </p>

        <p>
          Ao utilizar o AutoFlow, o usuário concorda com estes Termos de Uso.
          O AutoFlow é uma plataforma de gestão para oficinas mecânicas,
          desenvolvida para auxiliar no controle de clientes, veículos,
          ordens de serviço, financeiro e relatórios.
        </p>

        <h2 className="text-xl font-semibold">1. Uso da plataforma</h2>
        <p>
          O usuário é responsável pelas informações cadastradas no sistema,
          incluindo dados de clientes, veículos, ordens de serviço e registros
          financeiros.
        </p>

        <h2 className="text-xl font-semibold">2. Assinatura e pagamento</h2>
        <p>
          O acesso ao AutoFlow pode depender de assinatura mensal. Em caso de
          inadimplência, o acesso poderá ser suspenso até a regularização do
          pagamento.
        </p>

        <h2 className="text-xl font-semibold">3. Cancelamento</h2>
        <p>
          O usuário pode solicitar o cancelamento da assinatura a qualquer
          momento pelos canais oficiais de atendimento.
        </p>

        <h2 className="text-xl font-semibold">4. Disponibilidade</h2>
        <p>
          A plataforma poderá passar por manutenções, atualizações ou ajustes
          técnicos para melhoria do serviço.
        </p>

        <h2 className="text-xl font-semibold">5. Contato</h2>
        <p>
          Em caso de dúvidas, entre em contato pelo e-mail:
          contato.autoflow@gmail.com
        </p>
      </div>
    </div>
  );
}