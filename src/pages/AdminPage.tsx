import { useEffect, useMemo, useState } from "react";
import { supabase, API_BASE } from "../lib/supabase";
import { DashboardTab } from "./admin/components/DashboardTab";
import { WorkshopsTab } from "./admin/components/WorkshopsTab";
import { StatsTab } from "./admin/components/StatsTab";
import { FilterButton } from "./admin/components/FilterButton";
import { ActionButton } from "./admin/components/ActionButton";
import { Info } from "./admin/components/Info";
import { FinanceTab } from "./admin/components/FinanceTab";

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

function fmtDate(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
    return "bg-red-500/15 text-red-300 border-red-500/25";
  }
  if (status === "active") {
    return "bg-green-500/15 text-green-300 border-green-500/25";
  }
  if (status === "trial") {
    return "bg-yellow-500/15 text-yellow-300 border-yellow-500/25";
  }
  if (status === "cancelled") {
    return "bg-zinc-500/15 text-zinc-300 border-zinc-500/25";
  }
  return "bg-blue-500/15 text-blue-300 border-blue-500/25";
}

function isExpired(profile: AdminProfile) {
  if (!profile.subscription_ends_at) return true;
  return new Date(profile.subscription_ends_at).getTime() < Date.now();
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "trial" | "active" | "expired">(
    "all",
  );
  const [tab, setTab] = useState<
    "dashboard" | "workshops" | "stats" | "finance"
  >("dashboard");

  const [selected, setSelected] = useState<AdminProfile | null>(null);

  function getDaysLeft(profile: AdminProfile) {
    if (!profile.subscription_ends_at) return 0;

    async function copyId(id: string) {
      try {
        await navigator.clipboard.writeText(id);
        alert("ID copiado!");
      } catch {
        alert("Não foi possível copiar o ID.");
      }
    }

    return Math.max(
      0,
      Math.ceil(
        (new Date(profile.subscription_ends_at).getTime() - Date.now()) /
          86400000,
      ),
    );
  }

  function getWhatsAppNumber(value?: string | null) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("55") ? digits : `55${digits}`;
  }

  async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Sessão expirada. Entre novamente.");
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...options.headers,
      },
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error || "Erro administrativo");
    }

    return body as T;
  }

  async function loadProfiles() {
    setLoading(true);
    setError("");

    try {
      const data = await adminFetch<AdminProfile[]>("/admin/workshops");
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar clientes.");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return profiles.filter((p) => {
      const expired = isExpired(p);

      const matchesText =
        !term ||
        String(p.workshop_name || "")
          .toLowerCase()
          .includes(term) ||
        String(p.owner_name || "")
          .toLowerCase()
          .includes(term) ||
        String(p.phone || "")
          .toLowerCase()
          .includes(term) ||
        String(p.whatsapp || "")
          .toLowerCase()
          .includes(term) ||
        String(p.city || "")
          .toLowerCase()
          .includes(term);

      const matchesFilter =
        filter === "all" ||
        (filter === "trial" && p.subscription_status === "trial" && !expired) ||
        (filter === "active" &&
          p.subscription_status === "active" &&
          !expired) ||
        (filter === "expired" && expired);

      return matchesText && matchesFilter;
    });
  }, [profiles, search, filter]);

  const stats = useMemo(() => {
    const total = profiles.length;
    const trial = profiles.filter(
      (p) => p.subscription_status === "trial" && !isExpired(p),
    ).length;
    const active = profiles.filter(
      (p) => p.subscription_status === "active" && !isExpired(p),
    ).length;
    const expired = profiles.filter((p) => isExpired(p)).length;
    const mrr = active * 29.9;
    const now = new Date();

    const newThisMonth = profiles.filter((p) => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);

      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;

    const revenueTotal = mrr * 12;

    return {
      total,
      trial,
      active,
      expired,
      mrr,
      revenueTotal,
      newThisMonth,
    };
  }, [profiles]);

  async function updateSubscription(
    id: string,
    action: "activate" | "renew_trial" | "block",
  ) {
    setSavingId(id);
    setError("");

    try {
      const updated = await adminFetch<AdminProfile>(
        `/admin/workshops/${id}/subscription`,
        {
          method: "POST",
          body: JSON.stringify({ action }),
        },
      );

      await loadProfiles();
      setSelected((prev) => (prev?.id === id ? { ...prev, ...updated } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar cliente.");
    } finally {
      setSavingId(null);
    }
  }

  async function activate(id: string) {
    await updateSubscription(id, "activate");
  }

  async function renewTrial(id: string) {
    await updateSubscription(id, "renew_trial");
  }

  async function block(id: string) {
    const ok = confirm("Tem certeza que deseja bloquear este cliente?");
    if (!ok) return;

    await updateSubscription(id, "block");
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      alert("ID copiado!");
    } catch {
      alert("Não foi possível copiar o ID.");
    }
  }

  function exportCSV() {
    const headers = [
      "Oficina",
      "Responsavel",
      "Status",
      "Expira",
      "Cidade",
      "Estado",
      "Criado em",
    ];

    const rows = filtered.map((p) => [
      p.workshop_name || "",
      p.owner_name || "",
      statusLabel(p.subscription_status),
      fmtDate(p.subscription_ends_at),
      p.city || "",
      p.state || "",
      fmtDate(p.created_at),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"),
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-vortan-clientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.22em] text-red-300">
            VORTAN SYSTEMS
          </div>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Admin Vortan
          </h1>

          <p className="mt-2 max-w-xl text-muted-foreground">
            Painel administrativo da plataforma. Gerencie oficinas, assinaturas,
            clientes, faturamento e crescimento em um único lugar.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-5 py-4">
            <div className="text-xs uppercase text-green-300">STATUS</div>

            <div className="mt-1 text-lg font-bold text-white">● Online</div>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4">
            <div className="text-xs uppercase text-red-300">CLIENTES</div>

            <div className="mt-1 text-lg font-bold text-white">
              {stats.total}
            </div>
          </div>

          <button
            onClick={loadProfiles}
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            Atualizar
          </button>

          <button
            onClick={exportCSV}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white transition hover:bg-white/10"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-card/80 p-2">
        <div className="flex gap-2 overflow-x-auto">
          <FilterButton
            active={tab === "dashboard"}
            onClick={() => setTab("dashboard")}
          >
            Dashboard
          </FilterButton>

          <FilterButton
            active={tab === "workshops"}
            onClick={() => setTab("workshops")}
          >
            Oficinas
          </FilterButton>

          <FilterButton
            active={tab === "stats"}
            onClick={() => setTab("stats")}
          >
            Estatísticas
          </FilterButton>

          <FilterButton
            active={tab === "finance"}
            onClick={() => setTab("finance")}
          >
            Financeiro
          </FilterButton>
        </div>
      </div>

      {tab === "dashboard" && (
        <DashboardTab stats={stats} fmtMoney={fmtMoney} profiles={profiles} />
      )}

      {tab === "workshops" && (
        <WorkshopsTab
          filtered={filtered}
          loading={loading}
          fmtDate={fmtDate}
          onSelect={setSelected}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
        />
      )}

      {tab === "stats" && <StatsTab stats={stats} fmtMoney={fmtMoney} />}
      {tab === "finance" && (
        <FinanceTab profiles={profiles} fmtMoney={fmtMoney} />
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#080b10] p-6 shadow-2xl md:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
                  Cliente
                </div>

                <h2 className="mt-1 text-2xl font-bold text-white">
                  {selected.workshop_name || "Sem nome"}
                </h2>

                <p className="text-sm text-muted-foreground">
                  {selected.owner_name || "Responsável não informado"}
                </p>

                <div
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                    selected.subscription_status,
                    isExpired(selected),
                  )}`}
                >
                  {isExpired(selected)
                    ? "🔴 Vencido"
                    : selected.subscription_status === "active"
                      ? "🟢 Ativo"
                      : selected.subscription_status === "trial"
                        ? "🟡 Trial"
                        : statusLabel(selected.subscription_status)}
                </div>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-xs text-blue-300">👥 Clientes</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {selected.total_clients || 0}
                </p>
              </div>

              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
                <p className="text-xs text-purple-300">🚗 Veículos</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {selected.total_vehicles || 0}
                </p>
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-xs text-red-300">🔧 OS</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {selected.total_orders || 0}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Info
                label="Status"
                value={
                  isExpired(selected)
                    ? "Vencido"
                    : statusLabel(selected.subscription_status)
                }
              />
              <Info label="Responsável" value={selected.owner_name || "—"} />
              <Info label="Telefone" value={selected.phone || "—"} />
              <Info label="Criado em" value={fmtDate(selected.created_at)} />
              <Info
                label="Plano"
                value={statusLabel(selected.subscription_status)}
              />
              <Info
                label="Administrador"
                value={selected.is_admin ? "Sim" : "Não"}
              />

              <Info
                label="Dias restantes"
                value={
                  selected.subscription_ends_at
                    ? `${Math.max(
                        0,
                        Math.ceil(
                          (new Date(selected.subscription_ends_at).getTime() -
                            Date.now()) /
                            86400000,
                        ),
                      )} dias`
                    : "0 dias"
                }
              />
              <Info
                label="Expira"
                value={fmtDate(selected.subscription_ends_at)}
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  WhatsApp
                </p>

                {getWhatsAppNumber(selected.whatsapp || selected.phone) ? (
                  <a
                    href={`https://wa.me/${getWhatsAppNumber(
                      selected.whatsapp || selected.phone,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-sm font-semibold text-green-300 hover:underline"
                  >
                    📲 {selected.whatsapp || selected.phone}
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-white">—</p>
                )}
              </div>
              <Info
                label="Cidade"
                value={
                  [selected.city, selected.state].filter(Boolean).join(" / ") ||
                  "—"
                }
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      ID
                    </p>
                    <p className="mt-1 break-all text-sm font-semibold text-white">
                      {selected.id}
                    </p>
                  </div>

                  <button
                    onClick={() => copyId(selected.id)}
                    className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <ActionButton onClick={() => renewTrial(selected.id)}>
                Renovar trial 15 dias
              </ActionButton>
              <ActionButton onClick={() => activate(selected.id)}>
                Liberar 30 dias
              </ActionButton>
              <ActionButton danger onClick={() => block(selected.id)}>
                Bloquear
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
