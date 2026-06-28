import {
  Users,
  ShieldCheck,
  Clock3,
  Ban,
  DollarSign,
  TrendingUp,
  BarChart3,
  Activity,
} from "lucide-react";
import { StatCard } from "./StatCard";

type Props = {
  stats: {
    total: number;
    trial: number;
    active: number;
    expired: number;
    mrr: number;
    revenueTotal: number;
    newThisMonth: number;
  };
  fmtMoney: (value: number) => string;
};

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function barWidth(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.max(4, Math.round((value / total) * 100))}%`;
}

export function StatsTab({ stats, fmtMoney }: Props) {
  const activePercent = percent(stats.active, stats.total);
  const trialPercent = percent(stats.trial, stats.total);
  const expiredPercent = percent(stats.expired, stats.total);

  const distribution = [
    {
      label: "Assinantes ativos",
      value: stats.active,
      percent: activePercent,
      bar: "bg-green-400",
      text: "text-green-300",
      border: "border-green-500/20",
      bg: "bg-green-500/10",
    },
    {
      label: "Em trial",
      value: stats.trial,
      percent: trialPercent,
      bar: "bg-yellow-400",
      text: "text-yellow-300",
      border: "border-yellow-500/20",
      bg: "bg-yellow-500/10",
    },
    {
      label: "Vencidos",
      value: stats.expired,
      percent: expiredPercent,
      bar: "bg-red-400",
      text: "text-red-300",
      border: "border-red-500/20",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Clientes"
          value={stats.total}
          border="border-red-500/20"
          icon={<Users size={22} />}
        />

        <StatCard
          title="Em Trial"
          value={stats.trial}
          border="border-yellow-500/20"
          icon={<Clock3 size={22} />}
        />

        <StatCard
          title="Assinantes"
          value={stats.active}
          border="border-green-500/20"
          icon={<ShieldCheck size={22} />}
        />

        <StatCard
          title="Vencidos"
          value={stats.expired}
          border="border-red-500/20"
          icon={<Ban size={22} />}
        />

        <StatCard
          title="Receita Mensal"
          value={fmtMoney(stats.mrr)}
          border="border-blue-500/20"
          icon={<DollarSign size={22} />}
        />

        <StatCard
          title="Receita Anual Estimada"
          value={fmtMoney(stats.revenueTotal)}
          border="border-emerald-500/20"
          icon={<TrendingUp size={22} />}
        />

        <StatCard
          title="Novos este mês"
          value={stats.newThisMonth}
          border="border-purple-500/20"
          icon={<Users size={22} />}
        />

        <StatCard
          title="Saúde da base"
          value={`${activePercent}%`}
          border="border-cyan-500/20"
          icon={<Activity size={22} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-card/80 p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">
                Distribuição dos clientes
              </h2>
              <p className="text-sm text-muted-foreground">
                Visão geral entre ativos, trials e vencidos.
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
              <BarChart3 size={22} />
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {distribution.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${item.bar}`}
                    />
                    <span className="text-sm font-semibold text-white">
                      {item.label}
                    </span>
                  </div>

                  <span className={`text-sm font-bold ${item.text}`}>
                    {item.value} • {item.percent}%
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${item.bar}`}
                    style={{ width: barWidth(item.value, stats.total) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-bold text-white">Resumo rápido</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores principais da Vortan.
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs uppercase text-blue-300">Receita mensal</p>
              <p className="mt-1 text-2xl font-black text-white">
                {fmtMoney(stats.mrr)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Baseado nos assinantes ativos.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase text-emerald-300">
                Projeção anual
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {fmtMoney(stats.revenueTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Receita mensal × 12 meses.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
              <p className="text-xs uppercase text-purple-300">
                Novos este mês
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {stats.newThisMonth}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Novas oficinas cadastradas no mês atual.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
