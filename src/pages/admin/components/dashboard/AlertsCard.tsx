type Props = {
  trial: number;
  expired: number;
};

export function AlertsCard({ trial, expired }: Props) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-card/80 p-5">
      <h2 className="text-lg font-bold text-white">Alertas</h2>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl bg-yellow-500/10 p-4">
          <p className="text-yellow-300 font-semibold">Trials ativos</p>

          <h3 className="text-3xl font-bold text-white">{trial}</h3>
        </div>

        <div className="rounded-xl bg-red-500/10 p-4">
          <p className="text-red-300 font-semibold">Clientes vencidos</p>

          <h3 className="text-3xl font-bold text-white">{expired}</h3>
        </div>
      </div>
    </div>
  );
}
