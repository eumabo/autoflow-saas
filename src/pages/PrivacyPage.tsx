export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <a href="/" className="text-primary hover:underline">
          ← Voltar
        </a>

        <h1 className="text-3xl font-bold">Política de Privacidade</h1>

        <p className="text-muted-foreground">
          Última atualização: 20/06/2026
        </p>

        <p>
          Esta Política de Privacidade explica como o AutoFlow coleta, utiliza
          e protege os dados dos usuários da plataforma.
        </p>

        <h2 className="text-xl font-semibold">1. Dados coletados</h2>
        <p>
          Podemos coletar dados como nome, e-mail, telefone, nome da oficina,
          dados de clientes, veículos, ordens de serviço e informações
          financeiras cadastradas pelo próprio usuário.
        </p>

        <h2 className="text-xl font-semibold">2. Uso dos dados</h2>
        <p>
          Os dados são utilizados exclusivamente para funcionamento da
          plataforma, autenticação, suporte, emissão de relatórios e gestão das
          informações cadastradas.
        </p>

        <h2 className="text-xl font-semibold">3. Compartilhamento</h2>
        <p>
          O AutoFlow não vende dados dos usuários. Informações poderão ser
          compartilhadas apenas quando necessário para funcionamento do serviço
          ou cumprimento de obrigações legais.
        </p>

        <h2 className="text-xl font-semibold">4. Segurança</h2>
        <p>
          Utilizamos recursos técnicos para proteger os dados armazenados,
          incluindo autenticação, controle de acesso e infraestrutura segura.
        </p>

        <h2 className="text-xl font-semibold">5. Contato</h2>
        <p>
          Para dúvidas sobre privacidade, entre em contato pelo e-mail:
          contato.autoflow@gmail.com
        </p>
      </div>
    </div>
  );
}