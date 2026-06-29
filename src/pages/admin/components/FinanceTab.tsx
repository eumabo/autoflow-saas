import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Copy,
  CreditCard,
  Crown,
  DollarSign,
  LineChart,
  MessageCircle,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

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

type Props = {
  profiles: AdminProfile[];
  fmtMoney: (value: number) => string;
};

type FinanceFilter = "all" | "active" | "trial" | "expired" | "cancelled";

const MONTHLY_PRICE = 29.9;

function isExpired(profile: AdminProfile) {
  if (!profile.subscription_ends_at) return true;
  return new Date(profile.subscription_ends_at).getTime() < Date.now();
}

function fmtDate(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function statusLabel(status?: string | null) {
  if (status === "trial") return "Trial";
  if (status === "active") return "Ativo";
  if (status === "expired") return "Vencido";
  if (status === "cancelled") return "Cancelado";
  if (status === "blocked") return "Bloqueado";
  return "Sem plano";
}

function statusClass(status?: string | null, expired?: boolean) {
  if (expired || status === "expired" || status === "blocked") {
    return "border-red-500/25 bg-red-500/15 text-red-300";
  }

  if (status === "active") {
    return "border-green-500/25 bg-green-500/15 text-green-300";
  }

  if (status === "trial") {
    return "border-yellow-500/25 bg-yellow-500/15 text-yellow-300";
  }

  if (status === "cancelled") {
    return "border-zinc-500/25 bg-zinc-500/15 text-zinc-300";
  }

  return "border-blue-500/25 bg-blue-500/15 text-blue-300";
}

function getWhatsAppNumber(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function getDaysLeft(profile: AdminProfile) {
  if (!profile.subscription_ends_at) return 0;

  return Math.max(
    0,
    Math.ceil(
      (new Date(profile.subscription_ends_at).getTime() - Date.now()) /
        86400000,
    ),
  );
}

function getMonthKey(date?: string | null) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
  });
}

function filterLabel(filter: FinanceFilter) {
  if (filter === "active") return "Ativos";
  if (filter === "trial") return "Trial";
  if (filter === "expired") return "Vencidos";
  if (filter === "cancelled") return "Cancelados";
  return "Todos";
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "red",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  tone?: "red" | "green" | "blue" | "yellow" | "purple" | "zinc";
}) {
  const tones = {
    red: "border-red-500/20 text-red-300 bg-red-500/10",
    green: "border-green-500/20 text-green-300 bg-green-500/10",
    blue: "border-blue-500/20 text-blue-300 bg-blue-500/10",
    yellow: "border-yellow-500/20 text-yellow-300 bg-yellow-500/10",
    purple: "border-purple-500/20 text-purple-300 bg-purple-500/10",
    zinc: "border-white/10 text-white bg-white/5",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card/80 p-5 shadow-[0_0_30px_rgba(0,0,0,0.22)] transition hover:border-red-500/20 hover:bg-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
            {value}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className={`rounded-xl border p-3 ${tones[tone]}`}>{icon}</div>
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-white">{label}</span>
        <span className="text-muted-foreground">
          {value} / {total}
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-red-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MiniButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className =
    "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function FinanceTab({ profiles, fmtMoney }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FinanceFilter>("all");

  const active = profiles.filter(
    (p) => p.subscription_status === "active" && !isExpired(p),
  );

  const trial = profiles.filter(
    (p) => p.subscription_status === "trial" && !isExpired(p),
  );

  const expired = profiles.filter((p) => isExpired(p));
  const cancelled = profiles.filter((p) => p.subscription_status === "cancelled");

  const total = profiles.length;
  const mrr = active.length * MONTHLY_PRICE;
  const revenueMonth = mrr;
  const revenueYearProjection = mrr * 12;
  const ticketAverage = active.length > 0 ? mrr / active.length : 0;
  const payingRate = total > 0 ? (active.length / total) * 100 : 0;
  const churn = total > 0 ? ((expired.length + cancelled.length) / total) * 100 : 0;

  const monthMap = profiles.reduce<Record<string, number>>((acc, profile) => {
    const key = getMonthKey(profile.created_at);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const monthRows = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);

  const maxMonthValue = Math.max(...monthRows.map(([, value]) => value), 1);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return profiles
      .filter((profile) => {
        const expiredNow = isExpired(profile);

        const matchesSearch =
          !term ||
          String(profile.workshop_name || "").toLowerCase().includes(term) ||
          String(profile.owner_name || "").toLowerCase().includes(term) ||
          String(profile.city || "").toLowerCase().includes(term) ||
          String(profile.state || "").toLowerCase().includes(term) ||
          String(profile.phone || "").toLowerCase().includes(term) ||
          String(profile.whatsapp || "").toLowerCase().includes(term);

        const matchesFilter =
          filter === "all" ||
          (filter === "active" &&
            profile.subscription_status === "active" &&
            !expiredNow) ||
          (filter === "trial" &&
            profile.subscription_status === "trial" &&
            !expiredNow) ||
          (filter === "expired" && expiredNow) ||
          (filter === "cancelled" &&
            profile.subscription_status === "cancelled");

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const aExpired = isExpired(a) ? 1 : 0;
        const bExpired = isExpired(b) ? 1 : 0;

        if (aExpired !== bExpired) return bExpired - aExpired;

        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
  }, [profiles, search, filter]);

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      alert("ID copiado!");
    } catch {
      alert("Não foi possível copiar o ID.");
    }
  }

  function exportFinanceCSV() {
    const headers = [
      "Oficina",
      "Responsavel",
      "Plano",
      "Status",
      "Mensalidade",
      "Vencimento",
      "Dias restantes",
      "Cidade",
      "Estado",
      "Criado em",
    ];

    const rows = filteredRows.map((profile) => {
      const expiredNow = isExpired(profile);
      const isPaying =
        profile.subscription_status === "active" && !expiredNow;

      return [
        profile.workshop_name || "",
        profile.owner_name || "",
        "Plano Fundadores",
        expiredNow ? "Vencido" : statusLabel(profile.subscription_status),
        isPaying ? fmtMoney(MONTHLY_PRICE) : "",
        fmtDate(profile.subscription_ends_at),
        String(getDaysLeft(profile)),
        profile.city || "",
        profile.state || "",
        fmtDate(profile.created_at),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"),
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-vortan-financeiro.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-500/10 via-card to-black/50 p-6 shadow-[0_0_45px_rgba(239,68,68,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-red-300">
              Financeiro Vortan
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
              Receita, assinaturas e crescimento
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Agora com busca, filtros, exportação e ações rápidas por cliente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase text-muted-foreground">
                Plano atual
              </p>
              <p className="mt-1 text-lg font-black text-white">Fundadores</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase text-muted-foreground">
                Mensalidade
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {fmtMoney(MONTHLY_PRICE)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="MRR"
          value={fmtMoney(mrr)}
          subtitle="Receita recorrente mensal estimada"
          icon={<DollarSign size={22} />}
          tone="red"
        />

        <MetricCard
          title="Receita do mês"
          value={fmtMoney(revenueMonth)}
          subtitle="Baseada nos clientes ativos"
          icon={<CreditCard size={22} />}
          tone="green"
        />

        <MetricCard
          title="Projeção anual"
          value={fmtMoney(revenueYearProjection)}
          subtitle="MRR multiplicado por 12 meses"
          icon={<LineChart size={22} />}
          tone="blue"
        />

        <MetricCard
          title="Ticket médio"
          value={fmtMoney(ticketAverage)}
          subtitle="Média por cliente pagante"
          icon={<Crown size={22} />}
          tone="yellow"
        />

        <MetricCard
          title="Clientes pagantes"
          value={active.length}
          subtitle={`${payingRate.toFixed(1)}% da base total`}
          icon={<Users size={22} />}
          tone="green"
        />

        <MetricCard
          title="Em trial"
          value={trial.length}
          subtitle="Clientes em teste grátis"
          icon={<TrendingUp size={22} />}
          tone="yellow"
        />

        <MetricCard
          title="Inadimplentes"
          value={expired.length}
          subtitle="Clientes vencidos ou sem validade"
          icon={<AlertTriangle size={22} />}
          tone="red"
        />

        <MetricCard
          title="Churn estimado"
          value={`${churn.toFixed(1)}%`}
          subtitle="Vencidos + cancelados sobre a base"
          icon={<TrendingDown size={22} />}
          tone="purple"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-card/80 p-6 xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">
                Distribuição da base
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Proporção entre ativos, trial, vencidos e cancelados.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white">
              Total: {total}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <ProgressBar label="Ativos" value={active.length} total={total} />
            <ProgressBar label="Trial" value={trial.length} total={total} />
            <ProgressBar label="Vencidos" value={expired.length} total={total} />
            <ProgressBar
              label="Cancelados"
              value={cancelled.length}
              total={total}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/80 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-white">Novos clientes</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Últimos meses cadastrados.
              </p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
              <BarChart3 size={22} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {monthRows.length > 0 ? (
              monthRows.map(([key, value]) => {
                const percent = (value / maxMonthValue) * 100;

                return (
                  <div key={key}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold capitalize text-white">
                        {getMonthLabel(key)}
                      </span>
                      <span className="text-muted-foreground">
                        {value} clientes
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não há dados suficientes.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-card/80">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">
                Clientes e pagamentos
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredRows.length} registro(s) em {filterLabel(filter)}.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-[260px]">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar oficina, responsável, cidade..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-red-500/40"
                />
              </div>

              <button
                onClick={exportFinanceCSV}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
              >
                Exportar financeiro
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(["all", "active", "trial", "expired", "cancelled"] as FinanceFilter[]).map(
              (item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold transition ${
                    filter === item
                      ? "border-red-500/30 bg-red-500/20 text-red-200"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {filterLabel(item)}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-4">Oficina</th>
                <th className="px-5 py-4">Responsável</th>
                <th className="px-5 py-4">Plano</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Mensalidade</th>
                <th className="px-5 py-4">Vencimento</th>
                <th className="px-5 py-4">Uso</th>
                <th className="px-5 py-4">Local</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((profile) => {
                const expiredNow = isExpired(profile);
                const isPaying =
                  profile.subscription_status === "active" && !expiredNow;
                const whatsappNumber = getWhatsAppNumber(
                  profile.whatsapp || profile.phone,
                );

                return (
                  <tr
                    key={profile.id}
                    className={`border-b border-white/10 transition hover:bg-white/[0.03] ${
                      expiredNow ? "bg-red-500/[0.03]" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold text-white">
                        {profile.workshop_name || "Sem nome"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Criado em {fmtDate(profile.created_at)}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {profile.owner_name || "—"}
                    </td>

                    <td className="px-5 py-4 text-white">Plano Fundadores</td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                          profile.subscription_status,
                          expiredNow,
                        )}`}
                      >
                        {expiredNow
                          ? "Vencido"
                          : statusLabel(profile.subscription_status)}
                      </span>

                      {profile.subscription_status !== "cancelled" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {expiredNow
                            ? "0 dias restantes"
                            : `${getDaysLeft(profile)} dias restantes`}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 font-bold text-white">
                      {isPaying ? fmtMoney(MONTHLY_PRICE) : "—"}
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {fmtDate(profile.subscription_ends_at)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2 text-xs">
                        <span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-blue-300">
                          {profile.total_clients || 0} clientes
                        </span>
                        <span className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-300">
                          {profile.total_orders || 0} OS
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {[profile.city, profile.state].filter(Boolean).join(" / ") ||
                        "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <MiniButton
                          onClick={() => copyId(profile.id)}
                        >
                          <Copy size={14} />
                          ID
                        </MiniButton>

                        <MiniButton
                          href={
                            whatsappNumber
                              ? `https://wa.me/${whatsappNumber}`
                              : undefined
                          }
                          disabled={!whatsappNumber}
                        >
                          <MessageCircle size={14} />
                          WhatsApp
                        </MiniButton>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    Nenhum cliente encontrado nesse filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5">
        <p className="text-sm font-semibold text-yellow-200">
          Observação: os valores desta versão são estimativas administrativas
          baseadas no plano Fundadores de {fmtMoney(MONTHLY_PRICE)}. A próxima
          evolução é ligar esta tela na tabela real de pagamentos/assinaturas.
        </p>
      </div>
    </div>
  );
}
