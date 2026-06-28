import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { DashboardTab } from "./admin/components/DashboardTab";
import { WorkshopsTab } from "./admin/components/WorkshopsTab";
import { StatsTab } from "./admin/components/StatsTab";
import { FilterButton } from "./admin/components/FilterButton";
import { ActionButton } from "./admin/components/ActionButton";
import { Info } from "./admin/components/Info";

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

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
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
  const [tab, setTab] = useState<"dashboard" | "workshops" | "stats">(
    "dashboard",
  );
  const [selected, setSelected] = useState<AdminProfile | null>(null);

  async function loadProfiles() {
    setLoading(true);
    setError("");

    const { data: profilesData, error: profilesError } = await supabase
      .from("af_profiles")
      .select(
        "id, owner_name, workshop_name, phone, whatsapp, city, state, subscription_status, subscription_ends_at, created_at, is_admin",
      )
      .order("created_at", { ascending: false });

    if (profilesError) {
      setError(profilesError.message || "Erro ao carregar clientes.");
      setProfiles([]);
      setLoading(false);
      return;
    }

    const baseProfiles = (profilesData || []) as AdminProfile[];
    const ids = baseProfiles.map((p) => p.id);
    console.error("=== PROFILE IDS ===", ids);

    if (ids.length === 0) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    const [clientsRes, vehiclesRes, ordersRes] = await Promise.all([
      supabase.from("af_clients").select("id, workshop_id"),
      supabase.from("af_vehicles").select("id, workshop_id"),
      supabase.from("af_service_orders").select("id, workshop_id"),
    ]);

    const countByWorkshop = (rows?: { workshop_id: string }[] | null) => {
      return (rows || []).reduce<Record<string, number>>((acc, row) => {
        acc[row.workshop_id] = (acc[row.workshop_id] || 0) + 1;
        return acc;
      }, {});
    };

    const clientsCount = countByWorkshop(clientsRes.data);
    const vehiclesCount = countByWorkshop(vehiclesRes.data);
    const ordersCount = countByWorkshop(ordersRes.data);

    const enriched = baseProfiles.map((profile) => ({
      ...profile,
      total_clients: clientsCount[profile.id] || 0,
      total_vehicles: vehiclesCount[profile.id] || 0,
      total_orders: ordersCount[profile.id] || 0,
    }));

    setProfiles(enriched);
    setLoading(false);
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

  async function updateProfile(id: string, payload: Partial<AdminProfile>) {
    setSavingId(id);
    setError("");

    const { error } = await supabase
      .from("af_profiles")
      .update(payload)
      .eq("id", id);

    if (error) {
      setError(error.message || "Erro ao atualizar cliente.");
    } else {
      await loadProfiles();
      setSelected((prev) => (prev?.id === id ? { ...prev, ...payload } : prev));
    }

    setSavingId(null);
  }

  async function activate(id: string) {
    await updateProfile(id, {
      subscription_status: "active",
      subscription_ends_at: addDays(30),
    });
  }

  async function renewTrial(id: string) {
    await updateProfile(id, {
      subscription_status: "trial",
      subscription_ends_at: addDays(15),
    });
  }

  async function block(id: string) {
    const ok = confirm("Tem certeza que deseja bloquear este cliente?");
    if (!ok) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await updateProfile(id, {
      subscription_status: "expired",
      subscription_ends_at: yesterday.toISOString(),
    });
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
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                Fechar
              </button>
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
                label="Clientes cadastrados"
                value={String(selected.total_clients || 0)}
              />

              <Info
                label="Veículos cadastrados"
                value={String(selected.total_vehicles || 0)}
              />

              <Info
                label="Ordens de serviço"
                value={String(selected.total_orders || 0)}
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
              <Info
                label="WhatsApp"
                value={selected.whatsapp || selected.phone || "—"}
              />
              <Info
                label="Cidade"
                value={
                  [selected.city, selected.state].filter(Boolean).join(" / ") ||
                  "—"
                }
              />
              <Info label="ID" value={selected.id} wide />
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
