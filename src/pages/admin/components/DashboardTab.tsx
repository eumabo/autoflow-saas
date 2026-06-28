import {
  Users,
  ShieldCheck,
  Clock3,
  Ban,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "./StatCard";
import RecentClients from "./dashboard/RecentClients";

type AdminProfile = {
  id: string;
  owner_name: string | null;
  workshop_name: string | null;
  created_at?: string | null;
};

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
  profiles: AdminProfile[];
};

export function DashboardTab({ stats, fmtMoney, profiles }: Props) {
  return (
    <div className="space-y-6">
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
          title="MRR"
          value={fmtMoney(stats.mrr)}
          border="border-blue-500/20"
          icon={<DollarSign size={22} />}
        />

        <StatCard
          title="Receita Estimada"
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RecentClients profiles={profiles} />

        <div className="rounded-2xl border border-red-500/20 bg-card/80 p-5">
          <h2 className="text-lg font-bold text-white">Alertas</h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-yellow-500/10 p-4">
              <p className="text-yellow-300">Trials ativos</p>

              <h2 className="mt-1 text-3xl font-bold text-white">
                {stats.trial}
              </h2>
            </div>

            <div className="rounded-xl bg-red-500/10 p-4">
              <p className="text-red-300">Clientes vencidos</p>

              <h2 className="mt-1 text-3xl font-bold text-white">
                {stats.expired}
              </h2>
            </div>

            <div className="rounded-xl bg-green-500/10 p-4">
              <p className="text-green-300">Novos este mês</p>

              <h2 className="mt-1 text-3xl font-bold text-white">
                {stats.newThisMonth}
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
