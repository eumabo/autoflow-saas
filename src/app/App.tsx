import { useState, useEffect, useCallback, useRef } from "react";
import type { User, Session } from "@supabase/supabase-js";
import {
  LayoutDashboard, Users, Car, ClipboardList, History, LogOut,
  Plus, Search, MessageCircle, ChevronRight, X, Edit2, Trash2,
  Wrench, CheckCircle, Clock, AlertCircle, Menu, ArrowLeft, Phone,
  Calendar, Gauge, DollarSign, FileText, Eye, RefreshCw, Building2,
  Download, Upload, Image as ImageIcon, Send,TrendingUp, 
Target, 
} from "lucide-react";
import { supabase } from "../lib/supabase";
import * as API from "../lib/api";
import type { Profile, Client, Vehicle, ServiceOrder, OrderStatus, FinancialEntry } from "../lib/api";
import jsPDF from "jspdf";


// ─── Types ────────────────────────────────────────────────────────────────────

type Page = "billing" | "dashboard" | "clients" | "vehicles" | "orders" | "history" | "order-detail" | "settings" | "financial";

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

function cleanFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function csvEscape(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n|\r/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    const blob = new Blob([""], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvEscape).join(";"),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(";")),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#0B0F14]/80 backdrop-blur-md border border-green-500/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(34,197,94,0.08)] transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
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

function Logo({ size = "md", src }: { size?: "sm" | "md"; src?: string | null }) {
  const small = size === "sm";

  return (
    <div className={small
  ? "flex justify-center items-center w-full h-24"
  : "flex justify-center items-center w-full h-28"}>
      <img
        src={src || "/autoflow-logo.png?v=10"}
        alt="Logo"
        className={
  small
  ? "h-36 w-auto object-contain"
  : "h-40 w-auto object-contain"
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


function LandingPage({
  onGoLogin,
  onGoRegister,
}: {
  onGoLogin: () => void;
  onGoRegister: () => void;
}) {
  return (
    <div className="min-h-screen text-foreground bg-[#05070A] bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.16),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(22,163,74,0.10),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.08),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.035)_0,rgba(255,255,255,0)_35%)] relative overflow-hidden">
      <div className="fixed left-[-200px] top-1/4 w-[500px] h-[500px] rounded-full bg-green-500/10 blur-[180px] pointer-events-none" />
      <div className="fixed right-[-200px] top-1/3 w-[500px] h-[500px] rounded-full bg-green-500/10 blur-[180px] pointer-events-none" />
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[linear-gradient(rgba(34,197,94,1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,1)_1px,transparent_1px)] bg-[size:80px_80px]" />

      <section className="max-w-7xl mx-auto px-4 pt-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 shadow-2xl shadow-green-500/10">
          <img
            src="/autoflow-banner.png?v=1"
            alt="AutoFlow - Gestão completa para oficinas mecânicas"
            className="w-full h-auto object-cover block"
          />

          <button
            type="button"
            onClick={onGoLogin}
            className="absolute top-6 right-6 text-sm text-white/80 hover:text-white bg-black/35 border border-white/15 rounded-lg px-4 py-2 backdrop-blur-sm"
          >
            Entrar
          </button>
        </div>
      </section>

      <main className="w-full px-8 py-4 pb-8">
        <section className="grid lg:grid-cols-2 gap-10 items-center min-h-[70vh]">
          <div>

<Card className="max-w-lg border-primary/20 mb-8">
  <div className="p-6">
    <div className="text-primary font-semibold text-sm uppercase tracking-wider">
      Plano Fundadores
    </div>

    <div className="flex items-end gap-2 mt-2">
      <span className="text-5xl font-bold">
        R$ 29,90
      </span>

      <span className="text-muted-foreground mb-2">
        /mês
      </span>
    </div>

    <div className="mt-4 space-y-2 text-sm">
      <div>✓ Clientes ilimitados</div>
      <div>✓ Veículos ilimitados</div>
      <div>✓ Ordens de Serviço</div>
      <div>✓ Controle Financeiro</div>
    </div>

    <p className="text-xs text-muted-foreground mt-4">
      Valor promocional para os primeiros clientes do AutoFlow.
    </p>
  </div>
</Card>

            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Gestão completa para oficinas modernas.
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mt-4">
              Controle clientes, veículos, ordens de serviço, financeiro e
              acompanhamento online em um único sistema.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <Btn variant="primary" size="lg" onClick={onGoRegister}>
                Começar agora
              </Btn>

              <Btn variant="secondary" size="lg" onClick={onGoLogin}>
                Já tenho conta
              </Btn>
            </div>

            <p className="text-sm text-muted-foreground mt-4 max-w-xl">
              Projetado para oficinas que buscam mais organização, agilidade e
              profissionalismo no atendimento.
            </p>

          
          </div>

          <Card className="p-5">
            <div className="text-xs text-muted-foreground mb-2">
              PAINEL AUTOFLOW
            </div>

            <h2 className="font-heading font-bold text-2xl mb-5">
              Tudo que você precisa para gerenciar sua oficina
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["Clientes", "Cadastro e histórico completo"],
                ["Veículos", "Informações sempre organizadas"],
                ["Ordens de Serviço", "Controle profissional dos serviços"],
                ["PDF Profissional", "Pronto para impressão e envio"],
                ["Financeiro", "Receitas, despesas e faturamento"],
                ["Acompanhamento Online", "Cliente acompanha o andamento da OS"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="p-4 rounded-lg bg-secondary/40 border border-border"
                >
                  <div className="text-primary font-bold text-sm">{title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {desc}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

     
       <section className="py-16">
  <div className="text-center mb-8">
    <h2 className="font-heading font-bold text-3xl">
      Veja o AutoFlow em ação
    </h2>

    <p className="text-muted-foreground mt-2">
      Dashboard real do sistema utilizado pelas oficinas.
    </p>
  </div>

  <Card className="overflow-hidden border-primary/20 max-w-6xl mx-auto">
    <img
  src="public/dashboard-real.png"
  alt="Dashboard AutoFlow"
  className="w-full object-cover"
/>
  </Card>
</section>

        <section className="py-16">
          <div className="text-center mb-8">
            <h2 className="font-heading font-bold text-3xl">
              Recursos que simplificam o dia a dia da oficina
            </h2>

            <p className="text-muted-foreground mt-2">
              Ferramentas pensadas para organizar processos, economizar tempo e
              profissionalizar o atendimento.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
  ["Cadastro de clientes e veículos", "Organize informações e histórico completo."],
  ["Ordens de serviço organizadas", "Acompanhe cada serviço em tempo real."],
  ["Controle financeiro da oficina", "Receitas, despesas e faturamento."],
  ["PDF profissional para impressão", "Documentos prontos para entregar ao cliente."],
  ["Envio por WhatsApp", "Compartilhe atualizações rapidamente."],
  ["Acompanhamento online da OS", "Cliente acompanha o andamento da ordem."],
]
.map(([title, desc]) => (
  <Card key={title} className="p-4">
    <CheckCircle size={18} className="text-primary mb-3" />

    <p className="font-medium">{title}</p>

    <p className="text-xs text-muted-foreground mt-2">
      {desc}
    </p>
  </Card>

            ))}
          </div>
        </section>
      </main>
      
        <section className="py-20">
  <Card className="max-w-4xl mx-auto text-center p-10 border-primary/20">
    <h2 className="text-4xl font-bold">
      Pronto para organizar sua oficina?
    </h2>

    <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
      Comece hoje mesmo a controlar clientes, veículos,
      ordens de serviço e financeiro em um único lugar.
    </p>

    <div className="mt-8">
      <Btn
        variant="primary"
        size="lg"
        onClick={onGoRegister}
      >
        Começar Agora
      </Btn>
    </div>
  </Card>
</section>


       <section className="py-16">
  <div className="max-w-5xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="font-heading font-bold text-3xl">
        Perguntas frequentes
      </h2>

      <p className="text-muted-foreground mt-2">
        Tudo que você precisa saber antes de começar.
      </p>
    </div>

    <div className="grid md:grid-cols-2 gap-4">
      {[
        [
          "Precisa instalar?",
          "Não. O AutoFlow funciona direto pelo navegador, sem instalação.",
        ],
        [
          "Funciona no celular?",
          "Sim. Você pode acessar pelo computador, tablet ou celular.",
        ],
        [
          "Os dados ficam salvos?",
          "Sim. As informações ficam armazenadas online com segurança.",
        ],
        [
          "Tem suporte?",
          "Sim. Clientes do plano fundador contam com suporte dedicado.",
        ],
      ].map(([title, desc]) => (
  <Card key={title} className="p-4">
    <CheckCircle size={18} className="text-primary mb-3" />

    <p className="font-medium">{title}</p>

    <p className="text-xs text-muted-foreground mt-2">
      {desc}
    </p>
  </Card>
))}
    </div>
  </div>
</section>

      <footer className="border-t border-border py-8">
  <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
    <div className="text-center md:text-left">
      <div className="font-bold text-foreground">AutoFlow</div>
      <div>Gestão completa para oficinas modernas.</div>
    </div>

    <div className="text-center">
      <div>Contato</div>
      <a
        href="mailto:contato.autoflow@gmail.com"
        className="text-primary hover:underline"
      >
        contato.autoflow@gmail.com
      </a>
    </div>

    <div className="text-center md:text-right text-xs">
      <div>Desenvolvido por Vortan Systems</div>
      <div>© 2026 AutoFlow</div>
    </div>
  </div>
</footer>
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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setError(
      error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : "Não foi possível entrar. Verifique seus dados e tente novamente."
    );
  }

  setLoading(false);
}

async function handleForgotPassword() {
  setError("");

  if (!email) {
    setError("Digite seu e-mail acima para recuperar a senha.");
    return;
  }

  setLoading(true);

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://www.autoflowoficina.online?reset-password=true",
  });

  if (resetError) {
    setError("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
  } else {
    setError("Enviamos um link de recuperação para o seu e-mail.");
  }

  setLoading(false);
}

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
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
             <button
  type="button"
  onClick={handleForgotPassword}
  className="text-xs text-primary hover:underline text-right"
>
  Esqueci minha senha
</button>
            
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
  const [pendingEmail, setPendingEmail] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Senhas não coincidem.");
      return;
    }

    if (form.password.length < 6) {
      setError("Senha deve ter ao menos 6 caracteres.");
      return;
    }

    setLoading(true);

    localStorage.setItem(
      "autoflow_pending_profile",
      JSON.stringify({ owner_name: form.name, workshop_name: form.workshopName })
    );

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
  localStorage.removeItem("autoflow_pending_profile");

  if (
    error.message.toLowerCase().includes("password") ||
    error.message.toLowerCase().includes("senha")
  ) {
    setError(
      "A senha precisa ter pelo menos 6 caracteres, uma letra maiúscula e um número."
    );
  } else if (
    error.message.toLowerCase().includes("user already registered")
  ) {
    setError("Já existe uma conta cadastrada com este e-mail.");
  } else {
    setError("Não foi possível concluir o cadastro. Tente novamente.");
  }

  setLoading(false);
  return;
}

    setPendingEmail(form.email);
    setLoading(false);
  }

  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center">
          <Logo />

          <Card className="p-6 mt-8">
            <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/25 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle size={24} className="text-primary" />
            </div>

            <h1 className="font-heading font-bold text-2xl mb-3 text-foreground">
              Confirme seu e-mail
            </h1>

            <p className="text-sm text-muted-foreground mb-3">
              Enviamos um link de confirmação para:
            </p>

            <p className="text-primary font-semibold mb-5 break-all">
              {pendingEmail}
            </p>

            <p className="text-sm text-muted-foreground">
              Depois de confirmar pelo link recebido, você volta automaticamente para o AutoFlow.
            </p>
          </Card>

          <button onClick={onGoLogin} className="text-primary hover:underline font-medium mt-5 text-sm">
            Voltar para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
  <Logo />
  <p className="text-sm text-muted-foreground mt-2 text-center">
    Cadastre sua oficina
  </p>
</div>
        <Card className="p-6">
          <form onSubmit={handle} className="flex flex-col gap-4">
            <Input label="Seu nome" placeholder="Ex: João Souza" value={form.name} onChange={set("name")} required />
            <Input label="Nome da oficina" placeholder="Ex: Oficina do Autoflow" value={form.workshopName} onChange={set("workshopName")} required />
            <Input label="E-mail" type="email" placeholder="Ex: autoflow@oficina.com.br" value={form.email} onChange={set("email")} required />
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
            <Input label="Seu nome" placeholder="Ex: João Souza" value={form.owner_name} onChange={set("owner_name")} required />
            <Input label="Nome da oficina" placeholder="Ex: Oficina Autoflow" value={form.workshop_name} onChange={set("workshop_name")} required />
            <AuthError msg={error} />
            <Btn type="submit" variant="primary" className="w-full justify-center" loading={loading}>
              {!loading && "Salvar e continuar"}
            </Btn>
          </form>
        </Card>
    <button
  onClick={async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }}
 ></button>

 <div className="flex justify-center mt-4">
  <button
    type="button"
    onClick={async () => {
      await supabase.auth.signOut();
      window.location.href = "/login";
    }}
    className="text-green-600 hover:text-green-500 text-sm"
  >
    Sair
  </button>
</div>


  
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
  {
  page: "financial" as Page,
  label: "Financeiro",
  icon: DollarSign,
}, 
  {
  page: "settings" as Page,
  label: "Configurações",
  icon: Building2,
}
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
      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#070A0D]/90 backdrop-blur-xl border-r border-green-500/10 flex flex-col z-40 transition-transform duration-200 lg:translate-x-0 shadow-[20px_0_80px_rgba(34,197,94,0.06)] ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="relative px-4 py-4 border-b border-green-500/10 overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-transparent pointer-events-none" />
  <div className="relative z-10">
    
  </div>
          <Logo size="sm" src={profile?.logo_url} />
          
          {profile && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground pl-9">
              <Building2 size={10} />
              <span className="truncate">{profile.workshop_name}</span>
            </div>
          )}
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
                    ? "bg-green-500/15 text-green-400 border border-green-500/25 shadow-[0_0_25px_rgba(34,197,94,0.12)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
          
          

            <button
  type="button"
  onClick={() => {
    window.open(
      "https://wa.me/5527999826504?text=Olá,%20preciso%20de%20suporte%20com%20o%20AutoFlow.",
      "_blank",
      "noopener,noreferrer" /* CONTATO SUPORTE 5527996126147*/
    );
    onClose();
  }}
  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-green-400 hover:bg-green-500/10 border border-green-500/15 transition-all mt-2"
>   
  <MessageCircle size={16} />
  Suporte 24h
</button>
        </nav>

        <div className="px-2 py-3 border-t border-sidebar-border">
            
          {profile && (
  <div className="mx-2 mb-3 p-3 rounded-xl border border-green-500/10 bg-green-500/[0.03]">
    
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center text-green-400 font-semibold">
        {profile.owner_name?.charAt(0)?.toUpperCase()}
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {profile.owner_name}
        </div>

        <div className="text-xs text-muted-foreground truncate">
          {profile.workshop_name}
        </div>
      </div>
    </div>

    <div className="mt-3 flex justify-center">
      <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
        Plano Fundadores
      </span>
    </div>

  </div>
)}

          <div className="px-3 pb-3 text-center">
  <div className="text-[10px] text-muted-foreground">
    AutoFlow v1.0.0
  </div>

  <div className="flex justify-center gap-3 mt-2 text-[10px]">
    <a
      href="https://instagram.com/autoflowoficina"
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:text-green-400 transition-colors"
    >
      Instagram
    </a>

    <a
      href="https://www.autoflowoficina.online"
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:text-green-400 transition-colors"
    >
      Site
    </a>
  </div>
</div>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
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

const totalRevenue = orders
  .filter(o => o.status === "finalizado")
  .reduce((acc, o) => acc + Number(o.value || 0), 0);

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const monthlyRevenue = orders
  .filter(o => {
    const d = new Date(o.updated_at);
    return (
      o.status === "finalizado" &&
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear
    );
  })
  .reduce((acc, o) => acc + Number(o.value || 0), 0);




const averageTicket =
  done.length > 0 ? totalRevenue / done.length : 0;

const monthlyDone = done.filter(o => {
  const d = new Date(o.updated_at);

  return (
    d.getMonth() === currentMonth &&
    d.getFullYear() === currentYear
  );
});

const completionRate =
  orders.length > 0
    ? Math.round((done.length / orders.length) * 100)
    : 0;

const activeOrders =
  open.length + inProgress.length + waiting.length;  

const recent = [...orders]
  .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  .slice(0, 6);


  const openRevenue = orders
  .filter(o => o.status !== "finalizado")
  .reduce((acc, o) => acc + Number(o.value || 0), 0);

  function exportClients() {
    downloadCSV("clientes.csv", clients.map(c => ({
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      whatsapp: c.whatsapp,
      criado_em: c.created_at,
    })));
  }

  function exportVehicles() {
    downloadCSV("veiculos.csv", vehicles.map(v => {
      const client = clients.find(c => c.id === v.client_id);
      return {
        id: v.id,
        cliente: client?.name ?? "",
        placa: v.plate,
        marca: v.brand,
        modelo: v.model,
        ano: v.year,
        quilometragem: v.mileage,
        criado_em: v.created_at,
      };
    }));
  }

  function exportOrders() {
    downloadCSV("ordens-servico.csv", orders.map(o => {
      const client = clients.find(c => c.id === o.client_id);
      const vehicle = vehicles.find(v => v.id === o.vehicle_id);
      return {
        id: o.id,
        cliente: client?.name ?? "",
        veiculo: vehicle ? `${vehicle.brand} ${vehicle.model}` : "",
        placa: vehicle?.plate ?? "",
        problema_relatado: o.reported_issue,
        servicos_executados: o.services_performed,
        status: STATUS_LABEL[o.status],
        valor: o.value,
        data_prevista_entrega: (o as any).delivery_date ?? "",
        observacoes: o.notes,
        criado_em: o.created_at,
        atualizado_em: o.updated_at,
      };
    }));
  }

  function exportFinance() {
    downloadCSV("financeiro.csv", orders.map(o => {
      const client = clients.find(c => c.id === o.client_id);
      const vehicle = vehicles.find(v => v.id === o.vehicle_id);
      const value = Number(String(o.value || "0").replace(",", "."));
      return {
        os_id: o.id,
        cliente: client?.name ?? "",
        placa: vehicle?.plate ?? "",
        status: STATUS_LABEL[o.status],
        valor: value.toFixed(2).replace(".", ","),
        recebido: o.status === "finalizado" ? "Sim" : "Não",
        data_referencia: o.updated_at,
      };
    }));
  }

return (

    <div className="space-y-5">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground tracking-wide">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da oficina</p>
      </div>

     <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
  <Card className="p-4">
    <div className="text-xs text-muted-foreground">Faturamento Total</div>
    <div className="text-2xl font-bold text-green-500">
      {fmtMoney(totalRevenue)}
    </div>
  </Card>

  <Card className="p-4">
    <div className="text-xs text-muted-foreground">Faturamento do Mês</div>
    <div className="text-2xl font-bold text-green-500">
      {fmtMoney(monthlyRevenue)}
    </div>

  <div className="flex items-center gap-2 mb-2">
  
  <div className="text-xs text-muted-foreground">
    Faturamento do Mês
  </div>
</div>
</Card>

  <Card className="p-4">
  <div className="text-xs text-muted-foreground">Ticket Médio</div>
  <div className="text-2xl font-bold text-primary">
    {fmtMoney(averageTicket)}
  </div>
</Card>

  <Card className="p-4">
    <div className="text-xs text-muted-foreground">OS Finalizadas no Mês</div>
    <div className="text-2xl font-bold text-emerald-400">
      {monthlyDone.length}
    </div>
  </Card>

  <Card className="p-4">
    <div className="text-xs text-muted-foreground">Taxa de Conclusão</div>
    <div className="text-2xl font-bold text-blue-400">
      {completionRate}%
    </div>
  </Card>

 <Card className="p-4">
  <div className="text-xs text-muted-foreground">OS Ativas</div>
  <div className="text-2xl font-bold text-amber-400">
    {activeOrders}
  </div>
</Card>

  <Card className="p-4">
  <div className="text-xs text-muted-foreground">
    Serviços em Aberto
  </div>
  <div className="text-2xl font-bold text-amber-400">
    {fmtMoney(openRevenue)}
  </div>
</Card>

</div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-heading font-semibold text-base text-foreground">Exportações</h2>
            <p className="text-xs text-muted-foreground">Baixe os dados da oficina em CSV.</p>
          </div>
          <Download size={18} className="text-primary" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Btn variant="secondary" size="sm" className="justify-center" onClick={exportClients}>Exportar Clientes</Btn>
          <Btn variant="secondary" size="sm" className="justify-center" onClick={exportVehicles}>Exportar Veículos</Btn>
          <Btn variant="secondary" size="sm" className="justify-center" onClick={exportOrders}>Exportar OS</Btn>
          <Btn variant="secondary" size="sm" className="justify-center" onClick={exportFinance}>Exportar Financeiro</Btn>
        </div>
      </Card>

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






// ─── Financeiro ─────────────────────────────────────────────────────────────────

function FinancialPage({
  orders,
  entries,
  onReload,
}: {
  orders: ServiceOrder[];
  entries: FinancialEntry[];
  onReload: () => Promise<void>;
}) {
  const [modal, setModal] = useState<null | "income" | "expense">(null);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "",
  });
  const [loading, setLoading] = useState(false);

  const finalizedOrders = orders.filter((o) => o.status === "finalizado");

  const orderIncome = finalizedOrders.reduce(
    (acc, o) => acc + Number(String(o.value || "0").replace(",", ".")),
    0
  );

  const manualIncome = entries
    .filter((e) => e.type === "income")
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const expenses = entries
    .filter((e) => e.type === "expense")
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const totalRevenue = orderIncome + manualIncome;
  const profit = totalRevenue - expenses;

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (!modal) return;

    setLoading(true);

    try {
      await API.createFinancialEntry({
        description: form.description,
        amount: Number(String(form.amount || "0").replace(",", ".")),
        type: modal,
        category: form.category,
      });

      await onReload();

      setModal(null);
      setForm({
        description: "",
        amount: "",
        category: "",
      });
    } catch (err: any) {
      alert(err.message);
    }

    setLoading(false);
  }

  async function del(id: string) {
    if (!confirm("Deseja excluir esta movimentação?")) return;

    try {
      await API.deleteFinancialEntry(id);
      await onReload();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">
            Financeiro
          </h1>

          <p className="text-sm text-muted-foreground">
            Controle financeiro da oficina
          </p>
        </div>

        <div className="flex gap-2">
          <Btn
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setModal("expense")}
          >
            Nova Despesa
          </Btn>

          <Btn
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setModal("income")}
          >
            Nova Receita
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
  <div className="flex items-center gap-2 mb-2">
    <DollarSign size={16} className="text-green-500" />
    <div className="text-xs text-muted-foreground">
      Faturamento Total
    </div>
  </div>

  <div className="text-2xl font-bold text-green-500">
    {fmtMoney(totalRevenue)}
  </div>
</Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Receitas</div>

          <div className="text-2xl font-bold text-green-600">
            {totalRevenue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Despesas</div>

          <div className="text-2xl font-bold text-red-600">
            {expenses.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Lucro</div>

          <div className="text-2xl font-bold text-primary">
            {profit.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-heading font-semibold text-base text-foreground">
            Movimentações
          </h2>
        </div>

        {entries.length === 0 ? (
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              Nenhuma movimentação cadastrada.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {entry.description}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {entry.category || "Sem categoria"} ·{" "}
                    {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={
                      entry.type === "income"
                        ? "text-sm font-bold text-green-600"
                        : "text-sm font-bold text-red-600"
                    }
                  >
                    {entry.type === "income" ? "+" : "-"}{" "}
                    {Number(entry.amount || 0).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => del(entry.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal && (
        <Modal
          title={modal === "income" ? "Nova Receita" : "Nova Despesa"}
          onClose={() => setModal(null)}
        >
          <form onSubmit={save} className="flex flex-col gap-4">
            <Input
              label="Descrição"
              placeholder={
                modal === "income"
                  ? "Ex: Venda de peça"
                  : "Ex: Compra de óleo"
              }
              value={form.description}
              onChange={set("description")}
              required
            />

            <Input
              label="Valor"
              placeholder="0,00"
              value={form.amount}
              onChange={set("amount")}
              required
            />

            <Input
              label="Categoria"
              placeholder={
                modal === "income"
                  ? "Ex: Peças, serviços, outros"
                  : "Ex: Peças, aluguel, ferramentas"
              }
              value={form.category}
              onChange={set("category")}
            />

            <div className="flex gap-2 pt-1">
              <Btn
                type="button"
                variant="secondary"
                className="flex-1 justify-center"
                onClick={() => setModal(null)}
              >
                Cancelar
              </Btn>

              <Btn
                type="submit"
                variant="primary"
                className="flex-1 justify-center"
                loading={loading}
              >
                {!loading && "Salvar"}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
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

type OrderPhoto = {
  id: string;
  order_id: string;
  workshop_id: string;
  file_path: string;
  public_url: string;
  file_name: string;
  photo_type: "antes" | "depois" | "geral";
  created_at: string;
};

function OrderDetail({ profile, order, clients, vehicles, onBack, onReload }: {
  profile: Profile | null;
  order: ServiceOrder;
  clients: Client[];
  vehicles: Vehicle[];
  onBack: () => void;
  onReload: () => Promise<void>;
}) {
  const client = clients.find(c => c.id === order.client_id);
  const vehicle = vehicles.find(v => v.id === order.vehicle_id);
  const workshopName = profile?.workshop_name || "Oficina";
  const workshopSignature =
  `${profile?.workshop_name || "Oficina"}\n` +
  `${profile?.whatsapp || profile?.phone ? `Tel/WhatsApp: ${profile?.whatsapp || profile?.phone}\n` : ""}` +
  `${profile?.city || profile?.state ? `${profile?.city || ""}${profile?.city && profile?.state ? " - " : ""}${profile?.state || ""}` : ""}`;

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(order);
  const [form, setForm] = useState({
    services_performed: order.services_performed || "",
    value: order.value || "0",
    status: order.status,
    notes: order.notes || "",
    delivery_date: (order as any).delivery_date || "",
    checklist: (order as any).checklist || "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<OrderPhoto[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  function showToast(msg: string, type: "error" | "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    setCurrent(order);
    setForm({
      services_performed: order.services_performed || "",
      value: order.value || "0",
      status: order.status,
      notes: order.notes || "",
      delivery_date: (order as any).delivery_date || "",
      checklist: (order as any).checklist || "",
    });
  }, [order]);

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("af_order_photos")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Fotos da OS indisponíveis:", error.message);
      return;
    }

    setPhotos((data ?? []) as OrderPhoto[]);
  }

  useEffect(() => {
    loadPhotos();
  }, [order.id]);

  function buildUpdateMessage(includePdfText = false) {
    const statusText =
      form.status === "aguardando"
        ? "Aguardando aprovação"
        : form.status === "em_manutencao"
        ? "Em manutenção"
        : "Finalizado";

    return (
      `Olá, ${client?.name || "cliente"}.\n\n` +
      `Sua Ordem de Serviço foi atualizada.\n\n` +
      `Veículo: ${vehicle?.brand || ""} ${vehicle?.model || ""} (${vehicle?.plate || "-"})\n` +
      `Status: ${statusText}\n` +
      `Valor: ${fmtMoney(form.value)}\n` +
      (getPublicOrderUrl(current) ? `Link de acompanhamento: ${getPublicOrderUrl(current)}\n` : "") +
      (form.delivery_date ? `Previsão de entrega: ${new Date(form.delivery_date).toLocaleDateString("pt-BR")}\n` : "") +
      `\nServiços realizados:\n${form.services_performed || "Em andamento"}\n\n` +
      (includePdfText
        ? `O PDF anexado é a via digital da sua Ordem de Serviço. Ele contém os dados do veículo, problema relatado, serviços, status e valor registrado pela oficina.\n\n`
        : "") +
      `Em caso de dúvidas, estamos à disposição.\n\n` +
      `Obrigado pela preferência.\n\n` +
      `${workshopSignature}`
    );
  }

  function openWhatsApp(message: string) {
    const num = (client?.whatsapp || client?.phone || "").replace(/\D/g, "");

    if (!num) {
      showToast("Cliente sem WhatsApp cadastrado.", "error");
      return;
    }

    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(message)}`, "_blank");
  }

  function sendUpdateWhatsApp() {
    openWhatsApp(buildUpdateMessage(false));
  }

  async function sendPdfWhatsApp() {
  await generatePDF();
  openWhatsApp(buildUpdateMessage(true));
}

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const previousStatus = current.status;
      const patch: Partial<ServiceOrder> & Record<string, any> = {
        services_performed: form.services_performed,
        value: form.value,
        status: form.status,
        notes: form.notes,
      };

      if (form.delivery_date) patch.delivery_date = form.delivery_date;
      if (form.checklist) patch.checklist = form.checklist;

      const updated = await API.updateOrder(order.id, patch);
      setCurrent(updated);
      setForm({
        services_performed: updated.services_performed || "",
        value: updated.value || "0",
        status: updated.status,
        notes: updated.notes || "",
        delivery_date: (updated as any).delivery_date || "",
        checklist: (updated as any).checklist || "",
      });
      setEditing(false);
      await onReload();
      showToast("Ordem atualizada!", "success");

      if (previousStatus !== "finalizado" && updated.status === "finalizado") {
          openWhatsApp(buildFinishedMessage(updated));
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }

    setLoading(false);
  }

  async function quickStatus(status: OrderStatus) {
    try {
      const previousStatus = current.status;
      const updated = await API.updateOrder(order.id, { status });
      setCurrent(updated);
      setForm(p => ({ ...p, status: updated.status }));
      await onReload();
      showToast(`Status: ${STATUS_LABEL[status]}`, "success");

      if (previousStatus !== "finalizado" && status === "finalizado") {
        openWhatsApp(buildFinishedMessage(updated));
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

   function getPublicOrderUrl(orderData: ServiceOrder = current) {
  const token = (orderData as any).public_token;

  if (!token) return "";

  return `${window.location.origin}/os/${token}`;
}

function buildFinishedMessage(orderData: ServiceOrder) {
  const publicUrl = getPublicOrderUrl(orderData);

  return (
    `Olá, ${client?.name || "cliente"}.\n\n` +
    `Seu veículo ${vehicle?.brand || ""} ${vehicle?.model || ""} (${vehicle?.plate || "-"}) está pronto para retirada.\n\n` +
    `Valor do serviço: ${fmtMoney(orderData.value)}\n\n` +
    (publicUrl ? `Acompanhe sua OS pelo link:\n${publicUrl}\n\n` : "") +
    `Agradecemos pela confiança.\n\n` +
    `${workshopName}`
  );
}

  async function uploadPhoto(file: File, photoType: OrderPhoto["photo_type"]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Sessão expirada. Faça login novamente.", "error");
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${cleanFileName(file.name || `foto.${ext}`)}`;
      const filePath = `${user.id}/${order.id}/${photoType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("order-photos")
        .upload(filePath, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("order-photos")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("af_order_photos")
        .insert({
          workshop_id: user.id,
          order_id: order.id,
          file_path: filePath,
          public_url: publicData.publicUrl,
          file_name: file.name,
          photo_type: photoType,
        });

      if (insertError) throw insertError;

      await loadPhotos();
      showToast("Foto anexada à OS.", "success");
    } catch (err: any) {
      showToast(err.message || "Erro ao anexar foto.", "error");
    }

    setUploading(false);
  }

  async function deletePhoto(photo: OrderPhoto) {
    try {
      await supabase.storage.from("order-photos").remove([photo.file_path]);
      const { error } = await supabase.from("af_order_photos").delete().eq("id", photo.id);
      if (error) throw error;
      setPhotos(p => p.filter(x => x.id !== photo.id));
      showToast("Foto removida.", "success");
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir foto.", "error");
    }
  }

  async function generatePDF() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    async function imageToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();

  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

    doc.setFillColor(8, 13, 23);
    doc.rect(0, 0, pageWidth, 34, "F");
    if (profile?.logo_url) {
  try {
    const logoBase64 = await imageToBase64(profile.logo_url);
    doc.addImage(logoBase64, "PNG", 16, 6, 20, 20);
  } catch (err) {
    console.warn("Erro ao carregar logo no PDF:", err);
  }
}

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(workshopName.toUpperCase(), profile?.logo_url ? 46 : 20, 17);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Ordem de Serviço digital", 20, 25);

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 150, 90);
    doc.setLineWidth(1.2);
    doc.line(20, 42, 190, 42);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ORDEM DE SERVICO", 20, 54);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${new Date(current.created_at).toLocaleDateString("pt-BR")}`, 150, 52);
    doc.text(`Status: ${STATUS_LABEL[form.status]}`, 150, 58);

    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(20, 65, 80, 38, 3, 3);
    doc.roundedRect(110, 65, 80, 38, 3, 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CLIENTE", 25, 75);
    doc.text("VEICULO", 115, 75);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Nome: ${client?.name || "-"}`, 25, 84);
    doc.text(`Telefone: ${client?.phone || "-"}`, 25, 91);
    doc.text(`WhatsApp: ${client?.whatsapp || "-"}`, 25, 98);

    doc.text(`Modelo: ${vehicle?.brand || ""} ${vehicle?.model || ""}`, 115, 84);
    doc.text(`Placa: ${vehicle?.plate || "-"}`, 115, 91);
    doc.text(`KM: ${vehicle?.mileage || "-"}`, 115, 98);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PROBLEMA RELATADO", 20, 118);

    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(20, 123, 170, 30, 3, 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(current.reported_issue || "-", 160), 25, 133);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SERVICOS EXECUTADOS", 20, 166);

    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(20, 171, 170, 32, 3, 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(form.services_performed || "-", 160), 25, 181);

    if (form.delivery_date) {
      doc.setFont("helvetica", "bold");
      doc.text("PREVISAO DE ENTREGA", 20, 216);
      doc.setFont("helvetica", "normal");
      doc.text(new Date(form.delivery_date).toLocaleDateString("pt-BR"), 70, 216);
    }

    doc.setFillColor(0, 150, 90);
    doc.roundedRect(20, 225, 170, 25, 3, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("VALOR TOTAL", 25, 235);

    doc.setFontSize(18);
    doc.text(fmtMoney(form.value), 25, 245);

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 150, 90);
    doc.line(20, 270, 90, 270);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Assinatura do Cliente", 20, 277);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Documento gerado por ${workshopName}`, 20, 290);
    doc.text("Sistema AutoFlow", 155, 290);

    doc.save(`OS-${vehicle?.plate || "AUTOFLOW"}.pdf`);
  }

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

          <Btn variant="secondary" size="sm" onClick={sendUpdateWhatsApp}>
            <Send size={14} /> Enviar atualização
          </Btn>

          <Btn variant="secondary" size="sm" onClick={sendPdfWhatsApp}>
            <FileText size={14} /> Enviar PDF
          </Btn>

           
           
          <Btn
  type="button"
  onClick={() => {
    const publicUrl = getPublicOrderUrl(current);

    if (!publicUrl) {
      showToast("Essa OS ainda não tem link público.", "error");
      return;
    }

    navigator.clipboard.writeText(publicUrl);

    alert("Link copiado!");
  }}
>
  📲 Compartilhar acompanhamento
</Btn>
          
        </div>
      </div>

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
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
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
              
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Valor (R$)" value={form.value} onChange={set("value")} placeholder="0,00" />
              <Select label="Status" value={form.status} onChange={set("status")}>
                {(["aguardando", "em_manutencao", "finalizado"] as OrderStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </Select>
              <Input label="Previsão de entrega" type="date" value={form.delivery_date} onChange={set("delivery_date")} />
            </div>

            <Textarea label="Checklist do veículo" value={form.checklist} onChange={set("checklist")} rows={3} placeholder="Ex: documento, chave, estepe, macaco, triângulo, avarias visíveis..." />
            <Textarea label="Observações" value={form.notes} onChange={set("notes")} rows={2} placeholder="Notas adicionais..." />

            <div className="flex gap-2">
              <Btn type="button" variant="secondary" className="flex-1 justify-center" onClick={() => setEditing(false)}>
                Cancelar
              </Btn>
              <Btn type="submit" variant="primary" className="flex-1 justify-center" loading={loading}>
                {!loading && "Salvar"}
              </Btn>
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

            {form.delivery_date && (
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar size={10} /> Previsão de entrega</div>
                <div className="text-sm text-foreground">{new Date(form.delivery_date).toLocaleDateString("pt-BR")}</div>
              </Card>
            )}

            {form.checklist && (
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><CheckCircle size={10} /> Checklist do veículo</div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{form.checklist}</p>
              </Card>
            )}

            {form.notes && (
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={10} /> Observações</div>
                <p className="text-sm text-foreground leading-relaxed">{form.notes}</p>
              </Card>
            )}
          </div>
        </div>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
              <ImageIcon size={16} className="text-primary" /> Fotos da OS
            </h2>
            <p className="text-xs text-muted-foreground">Anexe fotos antes, depois ou gerais do serviço.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["antes", "depois", "geral"] as OrderPhoto["photo_type"][]).map(type => (
            <label key={type} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary text-sm text-secondary-foreground hover:bg-secondary/80 cursor-pointer transition-colors">
              <Upload size={14} /> {type === "antes" ? "Foto antes" : type === "depois" ? "Foto depois" : "Foto geral"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (file) uploadPhoto(file, type);
                }}
              />
            </label>
          ))}
        </div>

        {uploading && <p className="text-xs text-muted-foreground">Enviando foto...</p>}

        {photos.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
            Nenhuma foto anexada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="border border-border rounded-lg overflow-hidden bg-secondary/30">
                <a href={photo.public_url} target="_blank" rel="noreferrer">
                  <img src={photo.public_url} alt={photo.file_name} className="w-full h-32 object-cover" />
                </a>
                <div className="p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{photo.photo_type}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{photo.file_name}</div>
                  </div>
                  <button onClick={() => deletePhoto(photo)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}








function SettingsPage({
  profile,
}: {
  profile: Profile | null;
}) {
  const [form, setForm] = useState({
  workshop_name: profile?.workshop_name ?? "",
  owner_name: profile?.owner_name ?? "",
  phone: profile?.phone ?? "",
  whatsapp: profile?.whatsapp ?? "",
  instagram: profile?.instagram ?? "",
  city: profile?.city ?? "",
  state: profile?.state ?? "",
  zip_code: profile?.zip_code ?? "",
  logo_url: profile?.logo_url ?? "",
});

const [toast, setToast] = useState<{
  msg: string;
  type: "success" | "error";
} | null>(null);
  

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleCepChange(
  e: React.ChangeEvent<HTMLInputElement>
) {
  const cep = e.target.value.replace(/\D/g, "");

  setForm((p) => ({
    ...p,
    zip_code: e.target.value,
  }));

  if (cep.length !== 8) return;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();

    if (data.erro) return;

    setForm((p) => ({
      ...p,
      zip_code: e.target.value,
      city: data.localidade || "",
      state: data.uf || "",
    }));
  } catch (err) {
    console.error("Erro ao buscar CEP", err);
  }
}

   async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Usuário não encontrado");
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("workshop-logos")
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("workshop-logos")
      .getPublicUrl(fileName);

    setForm((p) => ({
      ...p,
      logo_url: data.publicUrl,
    }));

    setToast({
  msg: "Logo enviada com sucesso! Agora clique em Salvar Alterações.",
  type: "success",
});
  } catch (err) {
    console.error(err);
    alert("Erro ao enviar logo");
  }
}

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} />}
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">
          Configurações
        </h1>

        <p className="text-sm text-muted-foreground">
          Dados da oficina
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-5">
          {form.logo_url && (
            <img
              src={form.logo_url}
              alt="Logo"
              className="h-20 w-auto object-contain mb-3 border border-border rounded p-2"
            />
          )}

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 cursor-pointer text-sm font-medium">
            <Upload size={14} />
            Escolher logo da oficina

            <input
  type="file"
  accept="image/*"
  className="hidden"
  onChange={handleLogoUpload}
/>
            
          </label>

          <p className="text-xs text-muted-foreground mt-2">
  PNG transparente • Recomendado 1500x900 px
</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome da Oficina"
            value={form.workshop_name}
            onChange={set("workshop_name")}
          />

          <Input
            label="Responsável"
            value={form.owner_name}
            onChange={set("owner_name")}
          />

          <Input
            label="Telefone"
            value={form.phone}
            onChange={set("phone")}
          />

          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={set("whatsapp")}
          />

          <Input
            label="Instagram"
            value={form.instagram}
            onChange={set("instagram")}
          />

          <Input
            label="Cidade"
            value={form.city}
            onChange={set("city")}
          />

          <Input
            label="Estado"
            value={form.state}
            onChange={set("state")}
          />

          <Input
  label="CEP"
  value={form.zip_code}
  onChange={handleCepChange}
/>
        </div>

        <div className="mt-4">
          <Btn
  type="button"
  onClick={async () => {
    try {
      console.log("LOGO URL:", form.logo_url);
      console.log("FORM SALVANDO:", JSON.stringify(form, null, 2));

      const updatedProfile = await API.upsertProfile(form);

      setForm({
        workshop_name: updatedProfile.workshop_name ?? "",
        owner_name: updatedProfile.owner_name ?? "",
        phone: updatedProfile.phone ?? "",
        whatsapp: updatedProfile.whatsapp ?? "",
        instagram: updatedProfile.instagram ?? "",
        city: updatedProfile.city ?? "",
        state: updatedProfile.state ?? "",
        zip_code: updatedProfile.zip_code ?? "",
        logo_url: updatedProfile.logo_url ?? "",
      });

      setToast({
  msg: "Configurações salvas com sucesso!",
  type: "success",
});

setTimeout(() => {
  window.location.reload();
}, 800);
    } catch (err: any) {
      alert(err.message);
    }
  }}
>
  Salvar Alterações
</Btn>
        </div>
      </Card>
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
  console.log("ORDERS NO HISTORICO:", orders);
console.log("STATUS DAS OS:", orders.map(o => o.status));

  const done = orders.filter(o =>
  String(o.status).trim().toLowerCase() === "finalizado"
);
  const filtered = done.filter(o => {
    const client = clients.find(c => c.id === o.client_id);
    const vehicle = vehicles.find(v => v.id === o.vehicle_id);
    const q = search.toLowerCase();
    return !q || client?.name.toLowerCase().includes(q) || vehicle?.plate.toLowerCase().includes(q) || o.reported_issue.toLowerCase().includes(q);
  });
  const sorted = [...filtered].sort((a, b) =>
  new Date(b.updated_at || b.created_at).getTime() -
  new Date(a.updated_at || a.created_at).getTime()
);

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

function isPaid(profile: Profile | null) {
  const p = profile as any;

  if (p?.is_admin === true) {
    return true;
  }

  const notExpired =
    p?.subscription_ends_at &&
    new Date(p.subscription_ends_at) > new Date();

  return Boolean(
    (p?.subscription_status === "active" || p?.plan === "active") &&
    notExpired
  );
}

function PublicOrderPage({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `https://kddlzartfawqjnrafzdb.supabase.co/functions/v1/rapid-action/public/orders/${token}`
        );

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground">
        Carregando...
      </div>
    );
  }

  if (!data?.order) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive">
        Ordem de serviço não encontrada.
      </div>
    );
  }

  const { order, profile, client, vehicle } = data;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">

        <Card className="p-6 text-center">
          {profile?.logo_url && (
            <img
              src={profile.logo_url}
              alt="Logo"
              className="h-24 mx-auto mb-4 object-contain"
            />
          )}

          <h1 className="text-2xl font-bold text-foreground">
            {profile?.workshop_name}
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o andamento do seu veículo em tempo real
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                STATUS
              </p>
                 
                 
              

              <StatusBadge status={order.status} />
            </div>

            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                VALOR
              </p>

              <p className="text-2xl font-bold text-primary">
                {fmtMoney(order.value)}
              </p>
            </div>
          </div>
        </Card>

         {order.delivery_date && (
  <Card className="p-4">
    <p className="text-xs text-muted-foreground">
      PREVISÃO DE ENTREGA
    </p>

    <p className="font-semibold">
      {fmt(order.delivery_date)}
    </p>
  </Card>
)}
                     

        <Card className="p-6 space-y-4">

          <div>
            <p className="text-xs text-muted-foreground">
              CLIENTE
            </p>

            <p className="font-medium text-foreground">
              {client?.name ?? "-"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              VEÍCULO
            </p>

            <p className="font-medium text-foreground">
              {vehicle?.brand} {vehicle?.model}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              PLACA
            </p>

            <p className="font-mono text-foreground">
              {vehicle?.plate}
            </p>
          </div>

        </Card>

        <Card className="p-6">

          <h2 className="font-semibold text-lg mb-2">
            Problema Relatado
          </h2>

          <p className="text-muted-foreground">
            {order.reported_issue || "-"}
          </p>

        </Card>

        <Card className="p-6">

          <h2 className="font-semibold text-lg mb-2">
            Serviços Executados
          </h2>

          <p className="text-muted-foreground whitespace-pre-wrap">
            {order.services_performed || "-"}
          </p>

        </Card>

        {order.notes && (
          <Card className="p-6">

            <h2 className="font-semibold text-lg mb-2">
              Observações
            </h2>

            <p className="text-muted-foreground whitespace-pre-wrap">
              {order.notes}
            </p>

          </Card>
        )}
            
{profile?.whatsapp && (
  <Card className="p-4 text-center">
    <p className="text-sm text-muted-foreground">
      Dúvidas sobre o serviço?
    </p>

    <p className="font-semibold text-primary mt-1">
      WhatsApp: {profile.whatsapp}
    </p>
  </Card>
)}

        <div className="text-center text-xs text-muted-foreground py-4">
          Powered by AutoFlow
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  /*const [needsOnboarding, setNeedsOnboarding] = useState(false);*/
  const [authPage, setAuthPage] = useState<"landing" | "login" | "register">("landing");
  const [page, setPage] = useState<Page>("dashboard");
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const publicOrderToken = window.location.pathname.startsWith("/os/")
  ? window.location.pathname.replace("/os/", "").trim()
  : null;

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setSessionLoading(false);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    setSessionLoading(false);
  });

  return () => subscription.unsubscribe();
}, []);

  // Setup DB + load data when session available
  useEffect(() => {
        if (!session) {
      setDataLoaded(false);
      setProfile(null);
      setClients([]);
      setVehicles([]);
      setFinancialEntries([]);
      
      /*setNeedsOnboarding(false);*/
      return;
    }

    async function init() {
     const [prof, cls, vehs, ords, fins] = await Promise.allSettled([
  API.getProfile(),
  API.getClients(),
  API.getVehicles(),
  API.getOrders(),
  API.getFinancialEntries(),
]);

      let p = prof.status === "fulfilled" ? prof.value : null;

      if (!p) {
        const pendingProfileRaw = localStorage.getItem("autoflow_pending_profile");

        if (pendingProfileRaw) {
          try {
            const pendingProfile = JSON.parse(pendingProfileRaw) as {
              owner_name: string;
              workshop_name: string;
            };

            p = await API.upsertProfile(pendingProfile);
            localStorage.removeItem("autoflow_pending_profile");
          } catch {
            localStorage.removeItem("autoflow_pending_profile");
          }
        }
      }

      if (!p) {
  await supabase.auth.signOut();
  setAuthPage("login");
  setDataLoaded(true);
  return;
} else {
  setProfile(p);
}

      setClients(cls.status === "fulfilled" ? cls.value : []);
      setVehicles(vehs.status === "fulfilled" ? vehs.value : []);
      setOrders(ords.status === "fulfilled" ? ords.value : []);
      setFinancialEntries(fins.status === "fulfilled" ? fins.value : []);
      setDataLoaded(true);
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
  const [cls, vehs, ords, fins] = await Promise.all([
    API.getClients(),
    API.getVehicles(),
    API.getOrders(),
    API.getFinancialEntries(),
  ]);

  setClients(cls);
  setVehicles(vehs);
  setOrders(ords);
  setFinancialEntries(fins);
}, []);

   const loadFinancialEntries = useCallback(async () => {
  const data = await API.getFinancialEntries();
  setFinancialEntries(data);
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



  // ── Reset password ────────────────────────────────────────────────────────────────

function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("A senha precisa ter pelo menos uma letra maiúscula.");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("A senha precisa ter pelo menos um número.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError("Não foi possível alterar sua senha. Tente novamente.");
    } else {
      setSuccess("Senha alterada com sucesso. Você já pode entrar novamente.");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo />
          <p className="text-sm text-muted-foreground mt-2">
            Crie uma nova senha para acessar sua conta
          </p>
        </div>

        <Card className="p-6">
          <h1 className="font-heading font-bold text-xl mb-5 text-foreground">
            Redefinir senha
          </h1>

          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <Input
              label="Nova senha"
              type="password"
              placeholder="Digite sua nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirmar senha"
              type="password"
              placeholder="Confirme sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <AuthError msg={error || success} />

            <Btn
              type="submit"
              variant="primary"
              className="w-full justify-center"
              loading={loading}
            >
              {!loading && "Salvar nova senha"}
            </Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}



  // ── Render ────────────────────────────────────────────────────────────────

const isResetPasswordPage =
  window.location.search.includes("reset-password=true") ||
  window.location.hash.includes("type=recovery") ||
  window.location.hash.includes("access_token");


if (publicOrderToken) {
  return <PublicOrderPage token={publicOrderToken} />;
}
if (sessionLoading) return <LoadingScreen />;

console.log("SEARCH:", window.location.search);
console.log("RESET PAGE:", isResetPasswordPage);

if (isResetPasswordPage) {
  console.log("ENTROU NO RESET");
  return <ResetPasswordScreen />;
}

if (!session) {
    if (authPage === "register") {
      return <RegisterScreen onGoLogin={() => setAuthPage("login")} />;
    }

    if (authPage === "login") {
      return <LoginScreen onGoRegister={() => setAuthPage("register")} />;
    }

    return (
      <LandingPage
        onGoLogin={() => setAuthPage("login")}
        onGoRegister={() => setAuthPage("register")}
      />
    );
  }
/*
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
*/
  if (!dataLoaded) return <LoadingScreen />;

  if (profile && !isPaid(profile)) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Logo />

        <Card className="p-6 mt-6">
  <h1 className="font-heading font-bold text-2xl text-foreground mb-3">
    Assinatura necessária
  </h1>

  <p className="text-sm text-muted-foreground mb-5">
    Sua conta está criada. Para acessar o painel, finalize a assinatura.
  </p>

  <Btn
    variant="primary"
    className="w-full justify-center"
    onClick={async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;

        if (!session) {
          alert("Sessão expirada. Faça login novamente.");
          return;
        }

        const res = await fetch(
          "https://kddlzartfawqjnrafzdb.supabase.co/functions/v1/rapid-action/billing/create-checkout",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!res.ok) {
          alert("Não foi possível gerar o pagamento agora.");
          return;
        }

        const data = await res.json();
        const checkoutUrl = data?.checkout_url || data?.init_point || data?.url;

        if (checkoutUrl) {
          window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        } else {
          alert("Checkout não retornou link.");
        }
      } catch {
        alert("Erro ao conectar com pagamento.");
      }
    }}
  >
    Assinar agora
  </Btn>

  <Btn
    variant="secondary"
    className="w-full justify-center mt-2"
    loading={checkingPayment}
    onClick={async () => {
      setCheckingPayment(true);

      try {
        const updated = await API.getProfile();
console.log("PROFILE ATUALIZADO:", updated);
setProfile(updated);

if (isPaid(updated)) {
          setPage("dashboard");
          await loadAll();
        } else {
          alert("Pagamento ainda não confirmado.");
        }
      } finally {
        setCheckingPayment(false);
      }
    }}
  >
    {!checkingPayment ? "Já paguei, atualizar acesso" : null}
  </Btn>

  <Btn
    variant="ghost"
    className="w-full justify-center mt-2"
    onClick={logout}
  >
    Sair
  </Btn>
</Card>
      </div>
    </div>
  );
}

return (
  <div
    className="min-h-screen bg-[#05070A] dark relative overflow-hidden"
    style={{ fontFamily: "var(--font-body, 'DM Sans', sans-serif)" }}
  >
    {/* Background premium do sistema logado */}
    <div className="fixed left-[-280px] top-[8%] w-[720px] h-[720px] rounded-full bg-green-500/10 blur-[220px] pointer-events-none z-0" />
    <div className="fixed right-[-280px] bottom-[5%] w-[720px] h-[720px] rounded-full bg-emerald-500/15 blur-[220px] pointer-events-none z-0" />
    <div className="fixed inset-0 opacity-[0.025] pointer-events-none z-0 bg-[linear-gradient(rgba(34,197,94,1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,1)_1px,transparent_1px)] bg-[size:80px_80px]" />

    <div className="relative z-20">
      <Sidebar
        profile={profile}
        page={page}
        onNav={nav}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>

    <div className="relative z-10 lg:pl-64 min-h-screen flex flex-col">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-20 bg-sidebar/90 backdrop-blur-md border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground p-0.5">
          <Menu size={20} />
        </button>
        <Logo size="sm" />
        <div className="w-8" />
      </header>

      <main className="flex-1 px-4 py-5 max-w-6xl mx-auto w-full pb-8">
        {page === "dashboard" && (
          <Dashboard clients={clients} vehicles={vehicles} orders={orders} onNav={nav} onViewOrder={viewOrder} />
        )}

        {page === "clients" && (
          <ClientsPage clients={clients} onReload={loadAll} />
        )}

        {page === "vehicles" && (
          <VehiclesPage vehicles={vehicles} clients={clients} onReload={loadAll} />
        )}

        {page === "orders" && (
          <OrdersPage orders={orders} clients={clients} vehicles={vehicles} onReload={loadAll} onView={viewOrder} />
        )}

        {page === "order-detail" && activeOrder && (
          <OrderDetail
            profile={profile}
            order={activeOrder}
            clients={clients}
            vehicles={vehicles}
            onBack={() => nav("orders")}
            onReload={loadAll}
          />
        )}

        {page === "history" && (
          <HistoryPage
            orders={orders}
            clients={clients}
            vehicles={vehicles}
            onView={(order) => {
              setActiveOrder(order);
              nav("order-detail");
            }}
          />
        )}

        {page === "financial" && (
          <FinancialPage
            orders={orders}
            entries={financialEntries}
            onReload={loadAll}
          />
        )}

        {page === "settings" && (
          <SettingsPage profile={profile} />
        )}
      </main>
    </div>
  </div>
);
}
