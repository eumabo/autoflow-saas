import { useState, useEffect, useCallback, useRef } from "react";
import type { User, Session } from "@supabase/supabase-js";
import {
  LayoutDashboard, Users, Car, ClipboardList, History, LogOut,
  Plus, Search, MessageCircle, ChevronRight, X, Edit2, Trash2,
  Wrench, CheckCircle, Clock, AlertCircle, Menu, ArrowLeft, Phone,
  Calendar, Gauge, DollarSign, FileText, Eye, RefreshCw, Building2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import * as API from "../lib/api";
import type { Profile, Client, Vehicle, ServiceOrder, OrderStatus } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = "dashboard" | "clients" | "vehicles" | "orders" | "history" | "order-detail";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando: "Aguardando",
  em_manutencao: "Em Manutenção",
  finalizado: "Finalizado",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  aguardando: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  em_manutencao: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  finalizado: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const icons = {
    aguardando: <Clock size={11} />,
    em_manutencao: <Wrench size={11} />,
    finalizado: <CheckCircle size={11} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-medium ${STATUS_COLOR[status]}`}>
      {icons[status]}
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function fmtMoney(v?: string | number) {
  const n =
    typeof v === "number"
      ? v
      : Number(String(v || "0").replace(",", "."))

  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Input({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>}
      <input
        {...props}
        className={`w-full bg-input-background border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors ${error ? "border-destructive" : "border-border"} ${props.className ?? ""}`}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>}
      <select
        {...props}
        className="w-full bg-input-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors appearance-none"
      >
        {children}
      </select>
    </div>
  );
}

function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>}
      <textarea
        {...props}
        className="w-full bg-input-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none"
      />
    </div>
  );
}

function Btn({
  variant = "primary", size = "md", loading, children, className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const base = "inline-flex items-center gap-2 font-medium rounded-md transition-all focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
    secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
    danger: "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button {...props} disabled={props.disabled || loading} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-lg ${className}`}>{children}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-heading font-bold text-xl text-foreground tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "error" | "success" }) {
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-lg border text-sm font-medium shadow-xl flex items-center gap-2 max-w-sm w-[calc(100%-2rem)] ${
      type === "error"
        ? "bg-destructive/15 border-destructive/30 text-destructive"
        : "bg-primary/15 border-primary/30 text-primary"
    }`}>
      {type === "error" ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
      {message}
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const small = size === "sm";

  return (
    <div className={small ? "relative h-10 w-[150px]" : "relative h-20 w-[420px]"}>
      <img
        src="/autoflow-logo.png?v=6"
        alt="AutoFlow"
        className={
          small
            ? "absolute left-[60%] top-1/2 h-40 w-auto max-w-none -translate-x-1/2 -translate-y-[45%] object-contain"
            : "absolute left-[43%] top-1/2 h-68 w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
        }
      />
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function AuthError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
      <AlertCircle size={14} className="flex-shrink-0" />
      {msg}
    </div>
  );
}

function LoginScreen({ onGoRegister }: { onGoRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 -translate-y-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo />
          <p className="text-sm text-muted-foreground mt-2">Gestão inteligente para sua oficina</p>
        </div>
        <Card className="p-6">
          <h1 className="font-heading font-bold text-xl mb-5 text-foreground">Entrar</h1>
          <form onSubmit={handle} className="flex flex-col gap-4">
            <Input label="E-mail" type="email" placeholder="email@oficina.com.br" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <Input label="Senha" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            <AuthError msg={error} />
            <Btn type="submit" variant="primary" className="w-full justify-center" loading={loading}>
              {!loading && "Entrar"}
            </Btn>
          </form>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Não tem conta?{" "}
          <button onClick={onGoRegister} className="text-primary hover:underline font-medium">
            Cadastrar oficina
          </button>
        </p>
      </div>
    </div>
  );
}

function RegisterScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const [form, setForm] = useState({ name: "", workshopName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Senhas não coincidem."); return; }
    if (form.password.length < 6) { setError("Senha deve ter ao menos 6 caracteres."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      try {
        await API.upsertProfile({ workshop_name: form.workshopName, owner_name: form.name });
      } catch {
        // Profile will be created on next login via onboarding
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Logo />
          <p className="text-sm text-muted-foreground mt-2">Cadastre sua oficina</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handle} className="flex flex-col gap-4">
            <Input label="Seu nome" placeholder="João Silva" value={form.name} onChange={set("name")} required />
            <Input label="Nome da oficina" placeholder="Oficina do João" value={form.workshopName} onChange={set("workshopName")} required />
            <Input label="E-mail" type="email" placeholder="joao@oficina.com.br" value={form.email} onChange={set("email")} required />
            <Input label="Senha" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set("password")} required />
            <Input label="Confirmar senha" type="password" placeholder="Repita a senha" value={form.confirm} onChange={set("confirm")} required />
            <AuthError msg={error} />
            <Btn type="submit" variant="primary" className="w-full justify-center" loading={loading}>
              {!loading && "Criar conta"}
            </Btn>
          </form>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Já tem conta?{" "}
          <button onClick={onGoLogin} className="text-primary hover:underline font-medium">
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
}

// Onboarding for users who signed up without a profile (email confirmation flow)
function OnboardingScreen({ user, onDone }: { user: User; onDone: (p: Profile) => void }) {
  const [form, setForm] = useState({ owner_name: "", workshop_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const profile = await API.upsertProfile(form);
      onDone(profile);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo />
          <p className="text-sm text-muted-foreground mt-2">Bem-vindo! Complete seu cadastro</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handle} className="flex flex-col gap-4">
            <Input label="Seu nome" placeholder="João Silva" value={form.owner_name} onChange={set("owner_name")} required />
            <Input label="Nome da oficina" placeholder="Oficina do João" value={form.workshop_name} onChange={set("workshop_name")} required />
            <AuthError msg={error} />
            <Btn type="submit" variant="primary" className="w-full justify-center" loading={loading}>
              {!loading && "Salvar e continuar"}
            </Btn>
          </form>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-3">
  Dev By Guilherme S ® - DMCA 2026 ®️
</p>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV = [
  { page: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { page: "orders" as Page, label: "Ordens de Serviço", icon: ClipboardList },
  { page: "clients" as Page, label: "Clientes", icon: Users },
  { page: "vehicles" as Page, label: "Veículos", icon: Car },
  { page: "history" as Page, label: "Histórico", icon: History },
];

function Sidebar({ profile, page, onNav, onLogout, open, onClose }: {
  profile: Profile | null;
  page: Page;
  onNav: (p: Page) => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
  <>
    {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}

    <aside className={`fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40 transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex flex-col items-center justify-center gap-2">
          <img
            src="/autoflow-logo.png?v=6"
            alt="AutoFlow"
            className="h-14 w-auto object-contain"
          />

          {profile && (
            <span className="text-xs text-muted-foreground truncate">
              {profile.workshop_name}
            </span>
          )}
        </div>
      </div>

        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ page: p, label, icon: Icon }) => {
            const active = page === p || (page === "order-detail" && p === "orders");
            return (
              <button
                key={p}
                onClick={() => { onNav(p); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-sidebar-border">
          {profile && (
            <div className="px-3 py-2 mb-1">
              <div className="text-xs font-medium text-foreground truncate">{profile.owner_name}</div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ clients, vehicles, orders, onNav, onViewOrder }: {
  clients: Client[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  onNav: (p: Page) => void;
  onViewOrder: (o: ServiceOrder) => void;
}) {
  const open = orders.filter(o => o.status !== "finalizado");
  const done = orders.filter(o => o.status === "finalizado");
  const inProgress = orders.filter(o => o.status === "em_manutencao");
  const waiting = orders.filter(o => o.status === "aguardando");
  const recent = [...orders].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground tracking-wide">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da oficina</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ordens Abertas", val: open.length, icon: ClipboardList, color: "text-primary", bg: "bg-primary/10" },
          { label: "Em Manutenção", val: inProgress.length, icon: Wrench, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Aguardando", val: waiting.length, icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
          { label: "Finalizadas", val: done.length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10" },
        ].map(({ label, val, icon: Icon, color, bg }) => (
          <Card key={label} className="p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon size={17} className={color} />
            </div>
            <div>
              <div className="text-xl font-heading font-bold text-foreground">{val}</div>
              <div className="text-xs text-muted-foreground leading-tight">{label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { page: "clients" as Page, label: "Clientes", val: clients.length, icon: Users },
          { page: "vehicles" as Page, label: "Veículos", val: vehicles.length, icon: Car },
          { page: "history" as Page, label: "Histórico", val: orders.length, icon: History },
        ].map(({ page, label, val, icon: Icon }) => (
          <button key={page} onClick={() => onNav(page)} className="group text-left">
            <Card className="p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon size={15} className="text-primary" />
                </div>
                <div>
                  <div className="text-base font-heading font-bold text-foreground">{val}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
              <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-semibold text-base text-foreground">Ordens Recentes</h2>
          <button onClick={() => onNav("orders")} className="text-xs text-primary hover:underline">Ver todas</button>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <ClipboardList size={28} className="mx-auto text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço ainda.</p>
            <Btn variant="primary" size="sm" className="mt-3 mx-auto" onClick={() => onNav("orders")}>
              <Plus size={13} /> Criar primeira OS
            </Btn>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map(o => {
              const client = clients.find(c => c.id === o.client_id);
              const vehicle = vehicles.find(v => v.id === o.vehicle_id);
              return (
                <button key={o.id} onClick={() => onViewOrder(o)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{client?.name ?? "—"}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : "—"} · {fmt(o.created_at)}
                    </div>
                  </div>
                  <div className="text-sm font-mono font-medium text-primary flex-shrink-0">{fmtMoney(o.value)}</div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Clients ─────────────────────────────────────────────────────────────────

function ClientsPage({ clients, onReload }: {
  clients: Client[];
  onReload: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "add" | Client>(null);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "" });
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.whatsapp.includes(search)
  );

  function showToast(msg: string, type: "error" | "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openEdit(c: Client) {
    setForm({ name: c.name, phone: c.phone, whatsapp: c.whatsapp });
    setModal(c);
  }

  function openAdd() {
    setForm({ name: "", phone: "", whatsapp: "" });
    setModal("add");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (modal === "add") {
        await API.createClient_(form);
      } else if (modal && typeof modal === "object") {
        await API.updateClient(modal.id, form);
      }
      await onReload();
      setModal(null);
      showToast(modal === "add" ? "Cliente criado!" : "Cliente atualizado!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
    setLoading(false);
  }

  async function del(id: string) {
    try {
      await API.deleteClient(id);
      await onReload();
      setConfirmDel(null);
      showToast("Cliente excluído.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground tracking-wide">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients.length} cadastrados</p>
        </div>
        <Btn variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Novo</Btn>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes..." className="w-full bg-input-background border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {filtered.length === 0 ? (
        <Card className="py-14 text-center">
          <Users size={30} className="mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">{search ? "Nenhum resultado." : "Nenhum cliente cadastrado."}</p>
          {!search && <Btn variant="primary" size="sm" className="mt-3 mx-auto" onClick={openAdd}><Plus size={13} /> Adicionar cliente</Btn>}
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {filtered.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-heading font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{c.name}</div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                    {c.whatsapp && <span className="text-xs text-emerald-400 flex items-center gap-1"><MessageCircle size={10} />{c.whatsapp}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => setConfirmDel(c.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal && (
        <Modal title={modal === "add" ? "Novo Cliente" : "Editar Cliente"} onClose={() => setModal(null)}>
          <form onSubmit={save} className="flex flex-col gap-4">
            <Input label="Nome completo" placeholder="Maria Aparecida" value={form.name} onChange={set("name")} required />
            <Input label="Telefone" placeholder="(11) 98765-4321" value={form.phone} onChange={set("phone")} />
            <Input label="WhatsApp" placeholder="(11) 98765-4321" value={form.whatsapp} onChange={set("whatsapp")} />
            <div className="flex gap-2 pt-1">
              <Btn type="button" variant="secondary" className="flex-1 justify-center" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn type="submit" variant="primary" className="flex-1 justify-center" loading={loading}>{!loading && "Salvar"}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Excluir cliente?" onClose={() => setConfirmDel(null)}>
          <p className="text-sm text-muted-foreground mb-4">Esta ação não pode ser desfeita. Todos os veículos e ordens vinculados também serão excluídos.</p>
          <div className="flex gap-2">
            <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
            <Btn variant="danger" className="flex-1 justify-center" onClick={() => del(confirmDel)}><Trash2 size={13} /> Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

function VehiclesPage({ vehicles, clients, onReload }: {
  vehicles: Vehicle[];
  clients: Client[];
  onReload: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "add" | Vehicle>(null);
  const [form, setForm] = useState({ client_id: "", plate: "", brand: "", model: "", year: "", mileage: "" });
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase()) ||
    v.brand.toLowerCase().includes(search.toLowerCase())
  );

  function showToast(msg: string, type: "error" | "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openAdd() {
    setForm({ client_id: clients[0]?.id ?? "", plate: "", brand: "", model: "", year: "", mileage: "" });
    setModal("add");
  }

  function openEdit(v: Vehicle) {
    setForm({ client_id: v.client_id, plate: v.plate, brand: v.brand, model: v.model, year: v.year, mileage: v.mileage });
    setModal(v);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (modal === "add") {
        await API.createVehicle(form);
      } else if (modal && typeof modal === "object") {
        await API.updateVehicle(modal.id, form);
      }
      await onReload();
      setModal(null);
      showToast(modal === "add" ? "Veículo cadastrado!" : "Veículo atualizado!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
    setLoading(false);
  }

  async function del(id: string) {
    try {
      await API.deleteVehicle(id);
      await onReload();
      setConfirmDel(null);
      showToast("Veículo excluído.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground tracking-wide">Veículos</h1>
          <p className="text-sm text-muted-foreground">{vehicles.length} cadastrados</p>
        </div>
        <Btn variant="primary" size="sm" onClick={openAdd} disabled={clients.length === 0}><Plus size={14} /> Novo</Btn>
      </div>

      {clients.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm">
          <AlertCircle size={14} /> Cadastre um cliente antes de adicionar veículos.
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por placa, modelo..." className="w-full bg-input-background border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {filtered.length === 0 ? (
        <Card className="py-14 text-center">
          <Car size={30} className="mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">{search ? "Nenhum resultado." : "Nenhum veículo cadastrado."}</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {filtered.map(v => {
              const client = clients.find(c => c.id === v.client_id);
              return (
                <div key={v.id} className="px-4 py-3 flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center flex-shrink-0">
                    <Car size={15} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{v.brand} {v.model}</span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">{v.plate}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {v.year && <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={10} />{v.year}</span>}
                      {v.mileage && <span className="text-xs text-muted-foreground flex items-center gap-1"><Gauge size={10} />{parseInt(v.mileage).toLocaleString("pt-BR")} km</span>}
                      {client && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users size={10} />{client.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(v)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => setConfirmDel(v.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {modal && (
        <Modal title={modal === "add" ? "Novo Veículo" : "Editar Veículo"} onClose={() => setModal(null)}>
          <form onSubmit={save} className="flex flex-col gap-4">
            <Select label="Cliente" value={form.client_id} onChange={set("client_id")} required>
              <option value="">Selecione o cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Placa" placeholder="ABC-1234" value={form.plate} onChange={set("plate")} required className="uppercase" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Marca" placeholder="Toyota" value={form.brand} onChange={set("brand")} />
              <Input label="Modelo" placeholder="Corolla" value={form.model} onChange={set("model")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Ano" placeholder="2021" type="number" value={form.year} onChange={set("year")} />
              <Input label="Quilometragem" placeholder="45000" type="number" value={form.mileage} onChange={set("mileage")} />
            </div>
            <div className="flex gap-2 pt-1">
              <Btn type="button" variant="secondary" className="flex-1 justify-center" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn type="submit" variant="primary" className="flex-1 justify-center" loading={loading}>{!loading && "Salvar"}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Excluir veículo?" onClose={() => setConfirmDel(null)}>
          <p className="text-sm text-muted-foreground mb-4">Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
            <Btn variant="danger" className="flex-1 justify-center" onClick={() => del(confirmDel)}><Trash2 size={13} /> Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────

function OrdersPage({ orders, clients, vehicles, onReload, onView }: {
  orders: ServiceOrder[];
  clients: Client[];
  vehicles: Vehicle[];
  onReload: () => Promise<void>;
  onView: (o: ServiceOrder) => void;
}) {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    client_id: "", vehicle_id: "", reported_issue: "",
    services_performed: "", value: "", status: "aguardando" as OrderStatus, notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const clientVehicles = vehicles.filter(v => v.client_id === form.client_id);
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const sorted = [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  function showToast(msg: string, type: "error" | "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openAdd() {
    const firstClient = clients[0];
    const firstVehicle = firstClient ? vehicles.find(v => v.client_id === firstClient.id) : null;
    setForm({
      client_id: firstClient?.id ?? "",
      vehicle_id: firstVehicle?.id ?? "",
      reported_issue: "", services_performed: "", value: "",
      status: "aguardando", notes: "",
    });
    setModal(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicle_id) { showToast("Selecione um veículo.", "error"); return; }
    setLoading(true);
    try {
      await API.createOrder(form);
      await onReload();
      setModal(false);
      showToast("Ordem de serviço criada!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
    setLoading(false);
  }

  async function del(id: string) {
    try {
      await API.deleteOrder(id);
      await onReload();
      setConfirmDel(null);
      showToast("Ordem excluída.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setForm(p => {
      const next = { ...p, [k]: val };
      if (k === "client_id") {
        const veh = vehicles.find(v => v.client_id === val);
        next.vehicle_id = veh?.id ?? "";
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground tracking-wide">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{orders.length} total</p>
        </div>
        <Btn variant="primary" size="sm" onClick={openAdd} disabled={!clients.length || !vehicles.length}>
          <Plus size={14} /> Nova OS
        </Btn>
      </div>

      {(!clients.length || !vehicles.length) && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm">
          <AlertCircle size={14} /> Cadastre clientes e veículos antes de abrir uma ordem de serviço.
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {(["all", "aguardando", "em_manutencao", "finalizado"] as const).map(s => {
          const count = s === "all" ? orders.length : orders.filter(o => o.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                filter === s
                  ? s === "all" ? "bg-primary/15 text-primary border-primary/30" : STATUS_COLOR[s as OrderStatus]
                  : "text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {s === "all" ? "Todas" : STATUS_LABEL[s as OrderStatus]} ({count})
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <Card className="py-14 text-center">
          <ClipboardList size={30} className="mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço.</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {sorted.map(o => {
              const client = clients.find(c => c.id === o.client_id);
              const vehicle = vehicles.find(v => v.id === o.vehicle_id);
              return (
                <div key={o.id} className="px-4 py-3 flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{client?.name ?? "—"}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : "—"}
                    </div>
                    {o.reported_issue && <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">{o.reported_issue}</div>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-mono font-medium text-primary">{fmtMoney(o.value)}</div>
                    <div className="text-xs text-muted-foreground">{fmt(o.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onView(o)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><Eye size={13} /></button>
                    <button onClick={() => setConfirmDel(o.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {modal && (
        <Modal title="Nova Ordem de Serviço" onClose={() => setModal(false)}>
          <form onSubmit={save} className="flex flex-col gap-4">
            <Select label="Cliente" value={form.client_id} onChange={set("client_id")} required>
              <option value="">Selecione...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Veículo" value={form.vehicle_id} onChange={set("vehicle_id")} required>
              <option value="">Selecione...</option>
              {clientVehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}
            </Select>
            <Textarea label="Problema relatado" placeholder="Descreva o problema..." value={form.reported_issue} onChange={set("reported_issue")} rows={3} required />
            <Textarea label="Serviços previstos" placeholder="Revisão, troca de óleo..." value={form.services_performed} onChange={set("services_performed")} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valor (R$)" placeholder="0,00" value={form.value} onChange={set("value")} />
              <Select label="Status" value={form.status} onChange={set("status")}>
                {(["aguardando", "em_manutencao", "finalizado"] as OrderStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </div>
            <Textarea label="Observações" placeholder="Notas adicionais..." value={form.notes} onChange={set("notes")} rows={2} />
            <div className="flex gap-2 pt-1">
              <Btn type="button" variant="secondary" className="flex-1 justify-center" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn type="submit" variant="primary" className="flex-1 justify-center" loading={loading}>{!loading && "Abrir OS"}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Excluir ordem?" onClose={() => setConfirmDel(null)}>
          <p className="text-sm text-muted-foreground mb-4">Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
            <Btn variant="danger" className="flex-1 justify-center" onClick={() => del(confirmDel)}><Trash2 size={13} /> Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Order Detail ─────────────────────────────────────────────────────────────

function OrderDetail({ order, clients, vehicles, onBack, onReload }: {
  order: ServiceOrder;
  clients: Client[];
  vehicles: Vehicle[];
  onBack: () => void;
  onReload: () => Promise<void>;
}) {
  const client = clients.find(c => c.id === order.client_id);
  const vehicle = vehicles.find(v => v.id === order.vehicle_id);
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(order);
  const [form, setForm] = useState({
    services_performed: order.services_performed,
    value: order.value,
    status: order.status,
    notes: order.notes,
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);

  function showToast(msg: string, type: "error" | "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await API.updateOrder(order.id, form);
      setCurrent(updated);
      setForm({ services_performed: updated.services_performed, value: updated.value, status: updated.status, notes: updated.notes });
      setEditing(false);
      await onReload();
      showToast("Ordem atualizada!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
    setLoading(false);
  }

  async function quickStatus(status: OrderStatus) {
    try {
      const updated = await API.updateOrder(order.id, { status });
      setCurrent(updated);
      setForm(p => ({ ...p, status: updated.status }));
      await onReload();
      showToast(`Status: ${STATUS_LABEL[status]}`, "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  function sendWhatsApp() {
    const num = (client?.whatsapp || client?.phone || "").replace(/\D/g, "");
    if (!num) { showToast("Cliente sem WhatsApp cadastrado.", "error"); return; }
    const msg = encodeURIComponent(
      `Olá ${client?.name}! 👋\n\nAtualização da sua OS na nossa oficina:\n\n🚗 Veículo: ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plate})\n📋 Problema: ${current.reported_issue}\n🔧 Status atual: ${STATUS_LABEL[form.status]}\n💰 Valor: ${fmtMoney(form.value)}\n\nQualquer dúvida, estamos à disposição!`
    );
    window.open(`https://wa.me/55${num}?text=${msg}`, "_blank");
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground tracking-wide">Ordem de Serviço</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={form.status} />
            <span className="text-xs font-mono text-muted-foreground">{fmt(current.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
            <Edit2 size={13} /> {editing ? "Cancelar" : "Editar"}
          </Btn>
          <Btn size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5d] border-0" onClick={sendWhatsApp}>
            <MessageCircle size={14} /> WhatsApp
          </Btn>
        </div>
      </div>

      {/* Quick status change */}
      {!editing && (
        <div className="flex gap-2 flex-wrap">
          {(["aguardando", "em_manutencao", "finalizado"] as OrderStatus[]).map(s => (
            <button
              key={s}
              onClick={() => quickStatus(s)}
              disabled={form.status === s}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-default ${
                form.status === s ? STATUS_COLOR[s] : "text-muted-foreground border-border hover:text-foreground hover:border-border/60"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users size={10} /> Cliente</div>
          <div className="text-sm font-medium text-foreground">{client?.name ?? "—"}</div>
          {client?.phone && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Phone size={10} />{client.phone}</div>}
          {client?.whatsapp && <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><MessageCircle size={10} />{client.whatsapp}</div>}
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Car size={10} /> Veículo</div>
          {vehicle ? (
            <>
              <div className="text-sm font-medium text-foreground">{vehicle.brand} {vehicle.model}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">{vehicle.plate}</span>
                {vehicle.year && <span className="text-xs text-muted-foreground">{vehicle.year}</span>}
                {vehicle.mileage && <span className="text-xs text-muted-foreground">{parseInt(vehicle.mileage).toLocaleString("pt-BR")} km</span>}
              </div>
            </>
          ) : <div className="text-sm text-muted-foreground">—</div>}
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><AlertCircle size={10} /> Problema Relatado</div>
        <p className="text-sm text-foreground leading-relaxed">{current.reported_issue || "—"}</p>
      </Card>

      {editing ? (
        <form onSubmit={save}>
          <Card className="p-4 space-y-4">
            <Textarea label="Serviços executados" value={form.services_performed} onChange={set("services_performed")} rows={3} placeholder="Descreva os serviços realizados..." />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valor (R$)" value={form.value} onChange={set("value")} placeholder="0,00" />
              <Select label="Status" value={form.status} onChange={set("status")}>
                {(["aguardando", "em_manutencao", "finalizado"] as OrderStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </div>
            <Textarea label="Observações" value={form.notes} onChange={set("notes")} rows={2} placeholder="Notas adicionais..." />
            <div className="flex gap-2">
              <Btn type="button" variant="secondary" className="flex-1 justify-center" onClick={() => setEditing(false)}>Cancelar</Btn>
              <Btn type="submit" variant="primary" className="flex-1 justify-center" loading={loading}>{!loading && "Salvar"}</Btn>
            </div>
          </Card>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Wrench size={10} /> Serviços Executados</div>
            <p className="text-sm text-foreground leading-relaxed">
              {form.services_performed || <span className="text-muted-foreground/50 italic">Nenhum serviço registrado ainda.</span>}
            </p>
          </Card>
          <div className="space-y-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><DollarSign size={10} /> Valor</div>
              <div className="text-xl font-heading font-bold text-primary">{fmtMoney(form.value)}</div>
            </Card>
            {form.notes && (
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={10} /> Observações</div>
                <p className="text-sm text-foreground leading-relaxed">{form.notes}</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistoryPage({ orders, clients, vehicles, onView }: {
  orders: ServiceOrder[];
  clients: Client[];
  vehicles: Vehicle[];
  onView: (o: ServiceOrder) => void;
}) {
  const [search, setSearch] = useState("");

  const done = orders.filter(o => o.status === "finalizado");
  const filtered = done.filter(o => {
    const client = clients.find(c => c.id === o.client_id);
    const vehicle = vehicles.find(v => v.id === o.vehicle_id);
    const q = search.toLowerCase();
    return !q || client?.name.toLowerCase().includes(q) || vehicle?.plate.toLowerCase().includes(q) || o.reported_issue.toLowerCase().includes(q);
  });
  const sorted = [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground tracking-wide">Histórico</h1>
        <p className="text-sm text-muted-foreground">{done.length} ordens finalizadas</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar histórico..." className="w-full bg-input-background border border-border rounded-md pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {sorted.length === 0 ? (
        <Card className="py-14 text-center">
          <History size={30} className="mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">{search ? "Nenhum resultado." : "Nenhuma ordem finalizada ainda."}</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {sorted.map(o => {
              const client = clients.find(c => c.id === o.client_id);
              const vehicle = vehicles.find(v => v.id === o.vehicle_id);
              return (
                <button key={o.id} onClick={() => onView(o)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors text-left">
                  <div className="w-1 h-10 rounded-full bg-emerald-400/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{client?.name ?? "—"}</span>
                      {vehicle && <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">{vehicle.plate}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{o.reported_issue}</div>
                    {o.services_performed && <div className="text-xs text-muted-foreground/50 mt-0.5 truncate">{o.services_performed}</div>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-mono font-medium text-primary">{fmtMoney(o.value)}</div>
                    <div className="text-xs text-muted-foreground">{fmt(o.updated_at)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Logo />
      <RefreshCw size={20} className="text-muted-foreground animate-spin mt-2" />
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authPage, setAuthPage] = useState<"login" | "register">("login");
  const [page, setPage] = useState<Page>("dashboard");
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Setup DB + load data when session available
  useEffect(() => {
    if (!session || session === "loading") {
      setDataLoaded(false);
      setProfile(null);
      setClients([]);
      setVehicles([]);
      setOrders([]);
      setNeedsOnboarding(false);
      return;
    }

    async function init() {
  try {
    const [prof, cls, vehs, ords] = await Promise.allSettled([
      API.getProfile(),
      API.getClients(),
      API.getVehicles(),
      API.getOrders(),
    ]);

    const p = prof.status === "fulfilled" ? prof.value : null;

    if (!p) {
      setNeedsOnboarding(true);
    } else {
      setProfile(p);
      setNeedsOnboarding(false);
    }

    setClients(cls.status === "fulfilled" ? cls.value : []);
    setVehicles(vehs.status === "fulfilled" ? vehs.value : []);
    setOrders(ords.status === "fulfilled" ? ords.value : []);
  } catch (err) {
    console.error("INIT ERROR:", err);
  } finally {
    setDataLoaded(true);
  }
}

    init();
  }, [session]);

  const loadClients = useCallback(async () => {
    const data = await API.getClients();
    setClients(data);
  }, []);

  const loadVehicles = useCallback(async () => {
    const data = await API.getVehicles();
    setVehicles(data);
  }, []);

  const loadOrders = useCallback(async () => {
    const data = await API.getOrders();
    setOrders(data);
  }, []);

  const loadAll = useCallback(async () => {
    const [cls, vehs, ords] = await Promise.all([
      API.getClients(),
      API.getVehicles(),
      API.getOrders(),
    ]);
    setClients(cls);
    setVehicles(vehs);
    setOrders(ords);
  }, []);

  function nav(p: Page) {
    setPage(p);
    setSidebarOpen(false);
    if (p !== "order-detail") setActiveOrder(null);
  }

  function viewOrder(o: ServiceOrder) {
    setActiveOrder(o);
    setPage("order-detail");
  }

  async function logout() {
    await supabase.auth.signOut();
    setPage("dashboard");
    setSidebarOpen(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (session === "loading") return <LoadingScreen />;

  if (!session) {
    if (authPage === "register") return <RegisterScreen onGoLogin={() => setAuthPage("login")} />;
    return <LoginScreen onGoRegister={() => setAuthPage("register")} />;
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen
        user={session.user}
        onDone={async (p) => {
          setProfile(p);
          setNeedsOnboarding(false);
          await loadAll();
          setDataLoaded(true);
        }}
      />
    );
  }

  if (!dataLoaded) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background dark" style={{ fontFamily: "var(--font-body, 'DM Sans', sans-serif)" }}>
      <Sidebar
        profile={profile}
        page={page}
        onNav={nav}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-64 min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground p-0.5">
            <Menu size={20} />
          </button>
          <Logo size="sm" />
          <div className="w-8" />
        </header>

        <main className="flex-1 px-4 py-5 max-w-4xl mx-auto w-full pb-8">
          {page === "dashboard" && (
            <Dashboard clients={clients} vehicles={vehicles} orders={orders} onNav={nav} onViewOrder={viewOrder} />
          )}
          {page === "clients" && (
            <ClientsPage clients={clients} onReload={loadClients} />
          )}
          {page === "vehicles" && (
            <VehiclesPage vehicles={vehicles} clients={clients} onReload={loadVehicles} />
          )}
          {page === "orders" && (
            <OrdersPage orders={orders} clients={clients} vehicles={vehicles} onReload={loadOrders} onView={viewOrder} />
          )}
          {page === "history" && (
            <HistoryPage orders={orders} clients={clients} vehicles={vehicles} onView={viewOrder} />
          )}
          {page === "order-detail" && activeOrder && (
            <OrderDetail
              order={activeOrder}
              clients={clients}
              vehicles={vehicles}
              onBack={() => nav("orders")}
              onReload={loadOrders}
            />
          )}
        </main>
      </div>
    </div>
  );
}
