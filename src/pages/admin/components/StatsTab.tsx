import {
  Users,
  ShieldCheck,
  Clock3,
  Ban,
  DollarSign,
  TrendingUp,
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

export function StatsTab({ stats, fmtMoney }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
        title="Receita Mensal(MRR)"
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
    </div>
  );
}
