type AdminProfile = {
  id: string;
  owner_name: string | null;
  workshop_name: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  state?: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  created_at?: string | null;
  is_admin?: boolean | null;

  total_clients?: number;
  total_vehicles?: number;
  total_orders?: number;
};

type FilterType = "all" | "trial" | "active" | "expired";

type Props = {
  filtered: AdminProfile[];
  loading: boolean;
  fmtDate: (date?: string | null) => string;
  onSelect: (profile: AdminProfile) => void;
  search: string;
  setSearch: (value: string) => void;
  filter: FilterType;
  setFilter: (value: FilterType) => void;
};

function filterButtonClass(active: boolean) {
  return active
    ? "border-red-500/40 bg-red-500/20 text-red-200"
    : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white";
}

export function WorkshopsTab({
  filtered,
  loading,
  fmtDate,
  onSelect,
  search,
  setSearch,
  filter,
  setFilter,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/80">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              Oficinas cadastradas
            </h2>

            <p className="text-xs text-muted-foreground">
              {filtered.length} resultado(s)
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar oficina, responsável, cidade ou telefone..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-red-500/40 lg:w-80"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${filterButtonClass(
                  filter === "all",
                )}`}
              >
                Todas
              </button>

              <button
                type="button"
                onClick={() => setFilter("trial")}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${filterButtonClass(
                  filter === "trial",
                )}`}
              >
                Trial
              </button>

              <button
                type="button"
                onClick={() => setFilter("active")}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${filterButtonClass(
                  filter === "active",
                )}`}
              >
                Ativas
              </button>

              <button
                type="button"
                onClick={() => setFilter("expired")}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${filterButtonClass(
                  filter === "expired",
                )}`}
              >
                Vencidas
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Oficina</th>
              <th className="px-5 py-3 text-left">Responsável</th>
              <th className="px-5 py-3 text-left">Cidade</th>
              <th className="px-5 py-3 text-left">Clientes</th>
              <th className="px-5 py-3 text-left">Veículos</th>
              <th className="px-5 py-3 text-left">OS</th>
              <th className="px-5 py-3 text-left">Criado em</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-sm text-muted-foreground"
                >
                  Carregando clientes...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhuma oficina encontrada.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="cursor-pointer hover:bg-white/[0.04]"
                >
                  <td className="px-5 py-4 font-semibold text-white">
                    {p.workshop_name || "Sem nome"}
                  </td>

                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    {p.owner_name || "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    {[p.city, p.state].filter(Boolean).join(" / ") || "—"}
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                      👥 {p.total_clients || 0}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                      🚗 {p.total_vehicles || 0}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                      🔧 {p.total_orders || 0}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    {fmtDate(p.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
