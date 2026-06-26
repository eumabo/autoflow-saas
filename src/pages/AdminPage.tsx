export default function AdminPage() {
  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold text-white">
          Admin Vortan
        </h1>

        <p className="text-muted-foreground">
          Painel administrativo da plataforma.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        <div className="rounded-2xl border border-red-500/20 bg-card p-5">
          <p className="text-sm text-muted-foreground">
            👥 Clientes
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            --
          </h2>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-card p-5">
          <p className="text-sm text-muted-foreground">
            🧪 Em Trial
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            --
          </h2>
        </div>

        <div className="rounded-2xl border border-green-500/20 bg-card p-5">
          <p className="text-sm text-muted-foreground">
            💎 Assinantes
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            --
          </h2>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-card p-5">
          <p className="text-sm text-muted-foreground">
            💰 Receita
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            R$ --
          </h2>
        </div>

      </div>

      {/* Clientes */}
      <div className="rounded-2xl border bg-card overflow-hidden">

        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            Oficinas cadastradas
          </h2>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead className="bg-muted/40">

              <tr>

                <th className="text-left px-5 py-3">
                  Oficina
                </th>

                <th className="text-left px-5 py-3">
                  Plano
                </th>

                <th className="text-left px-5 py-3">
                  Expira
                </th>

                <th className="text-left px-5 py-3">
                  Status
                </th>

                <th className="text-right px-5 py-3">
                  Ações
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t">

                <td className="px-5 py-4">
                  Auto Center Exemplo
                </td>

                <td className="px-5 py-4">
                  Trial
                </td>

                <td className="px-5 py-4">
                  10/07/2026
                </td>

                <td className="px-5 py-4">

                  <span className="rounded-full bg-green-500/15 px-3 py-1 text-sm text-green-400">
                    Ativo
                  </span>

                </td>

                <td className="px-5 py-4 text-right space-x-2">

                  <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500">
                    Ver
                  </button>

                  <button className="rounded-lg bg-yellow-600 px-3 py-2 text-sm text-white hover:bg-yellow-500">
                    Renovar
                  </button>

                  <button className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500">
                    Bloquear
                  </button>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}
