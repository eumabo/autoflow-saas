type Profile = {
  id: string;
  workshop_name: string | null;
  owner_name: string | null;
  created_at?: string | null;
};

type Props = {
  profiles: Profile[];
};

export default function RecentClients({ profiles }: Props) {
  const recent = [...profiles]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    )
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-white/10 bg-card/80 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          Últimas oficinas cadastradas
        </h2>

        <span className="text-xs text-zinc-400">{recent.length} registros</span>
      </div>

      <div className="space-y-4">
        {recent.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3"
          >
            <div>
              <p className="font-semibold text-white">
                {item.workshop_name || "Sem nome"}
              </p>

              <p className="text-sm text-zinc-400">
                {item.owner_name || "Sem responsável"}
              </p>
            </div>

            <span className="text-xs text-zinc-500">
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString("pt-BR")
                : "--"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
