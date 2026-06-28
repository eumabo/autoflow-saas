import {
  Users,
  ShieldCheck,
  Clock3,
  Ban,
  DollarSign,
  TrendingUp,
  Activity,
  Database,
  HardDrive,
  CreditCard,
  Lock,
  Server,
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

const services = [
  { name: "API", status: "Online", icon: Server },
  { name: "Banco de dados", status: "Online", icon: Database },
  { name: "Storage", status: "Online", icon: HardDrive },
  { name: "Auth", status: "Online", icon: Lock },
  { name: "Edge Functions", status: "Online", icon: Activity },
  { name: "Mercado Pago", status: "Online", icon: CreditCard },
];

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
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RecentClients profiles={profiles} />

        <div className="rounded-2xl border border-green-500/20 bg-card/80 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Saúde da Plataforma
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Visão rápida dos principais serviços da Vortan.
              </p>
            </div>

            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-green-300">
              <Activity size={22} />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
            <p className="text-sm font-semibold text-green-300">
              🟢 Todos os serviços operando normalmente
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Status manual inicial. Depois podemos ligar em verificações reais.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <div
                  key={service.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-500/10 p-2 text-green-300">
                      <Icon size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-white">
                        {service.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {service.status}
                      </p>
                    </div>
                  </div>

                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase text-muted-foreground">Versão</p>
              <p className="mt-1 text-lg font-black text-white">v1.0.0</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase text-muted-foreground">
                Status geral
              </p>
              <p className="mt-1 text-lg font-black text-green-300">100%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
