import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";

const app = new Hono();
const P = "/rapid-action";

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173",
      "https://autoflowoficina.online",
      "https://www.autoflowoficina.online",
      "https://vortanoficina.com.br",
      "https://www.vortanoficina.com.br",
    ],
    allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.options("*", (c) => c.text("", 204));

// ─── Helpers ────────────────────────────────────────────────────────────────

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const {
    data: { user },
    error,
  } = await svc().auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return user;
}

const unauthorized = (c: any) => c.json({ error: "Unauthorized" }, 401);
const badRequest = (c: any, msg: string) => c.json({ error: msg }, 400);
const serverError = (c: any, msg: string) => c.json({ error: msg }, 500);

async function getSubscription(userId: string) {
  const { data, error } = await svc()
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function isSubscriptionActive(sub: any) {
  if (!sub) return false;
  if (sub.status !== "active" && sub.status !== "trial") return false;
  if (!sub.expires_at) return false;
  return new Date(sub.expires_at).getTime() > Date.now();
}

async function requireActiveSubscription(c: any, user: any) {
  const { data: profile, error: profileError } = await svc()
    .from("af_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return c.json({ error: profileError.message }, 500);
  }

  if (profile?.is_admin === true) {
    return null;
  }

  const sub = await getSubscription(user.id);

  if (!isSubscriptionActive(sub)) {
    return c.json(
      {
        error: "Assinatura inativa ou expirada",
        code: "SUBSCRIPTION_REQUIRED",
      },
      402,
    );
  }

  return null;
}

async function requireAdmin(c: any) {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return { user: null, response: unauthorized(c) };

  const { data: profile, error } = await svc()
    .from("af_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { user: null, response: serverError(c, error.message) };
  }

  if (profile?.is_admin !== true) {
    return {
      user: null,
      response: c.json({ error: "Acesso administrativo negado" }, 403),
    };
  }

  return { user, response: null };
}

// ─── Admin ───────────────────────────────────────────────────────────────────

app.get(`${P}/admin/workshops`, async (c) => {
  const admin = await requireAdmin(c);
  if (admin.response) return admin.response;

  const [profilesRes, clientsRes, vehiclesRes, ordersRes] = await Promise.all([
    svc()
      .from("af_profiles")
      .select(
        "id, owner_name, workshop_name, phone, whatsapp, city, state, subscription_status, subscription_ends_at, created_at, is_admin",
      )
      .order("created_at", { ascending: false }),
    svc().from("af_clients").select("id, workshop_id"),
    svc().from("af_vehicles").select("id, workshop_id"),
    svc().from("af_service_orders").select("id, workshop_id"),
  ]);

  const firstError =
    profilesRes.error ||
    clientsRes.error ||
    vehiclesRes.error ||
    ordersRes.error;
  if (firstError) return serverError(c, firstError.message);

  const countByWorkshop = (rows: any[] | null) =>
    (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      if (row.workshop_id) {
        acc[row.workshop_id] = (acc[row.workshop_id] ?? 0) + 1;
      }
      return acc;
    }, {});

  const clientsCount = countByWorkshop(clientsRes.data);
  const vehiclesCount = countByWorkshop(vehiclesRes.data);
  const ordersCount = countByWorkshop(ordersRes.data);

  const profiles = (profilesRes.data ?? []).map((profile: any) => ({
    ...profile,
    total_clients: clientsCount[profile.id] ?? 0,
    total_vehicles: vehiclesCount[profile.id] ?? 0,
    total_orders: ordersCount[profile.id] ?? 0,
  }));

  return c.json(profiles);
});

app.post(`${P}/admin/workshops/:id/subscription`, async (c) => {
  const admin = await requireAdmin(c);
  if (admin.response) return admin.response;

  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (!isUuid(targetId)) return badRequest(c, "Oficina inválida");

  const { data: targetProfile, error: targetError } = await svc()
    .from("af_profiles")
    .select("id, is_admin")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError) return serverError(c, targetError.message);
  if (!targetProfile) return c.json({ error: "Oficina não encontrada" }, 404);

  const now = new Date();
  let status: "active" | "trial" | "expired";
  let expiresAt: Date;
  let subscriptionPatch: Record<string, unknown> = {};

  if (action === "activate") {
    status = "active";
    expiresAt = addMonths(now, 1);
    subscriptionPatch = {
      provider_status: "manual_admin",
      cancel_at_period_end: false,
      canceled_at: null,
    };
  } else if (action === "renew_trial") {
    status = "trial";
    expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 15);
    subscriptionPatch = {
      provider_status: "manual_admin",
      trial_started_at: now.toISOString(),
      trial_ends_at: expiresAt.toISOString(),
      trial_used: true,
      cancel_at_period_end: false,
      canceled_at: null,
    };
  } else if (action === "block") {
    status = "expired";
    expiresAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    subscriptionPatch = {
      provider_status: "blocked_by_admin",
      cancel_at_period_end: false,
    };
  } else {
    return badRequest(c, "Ação administrativa inválida");
  }

  try {
    await syncAccessState({
      userId: targetId,
      status,
      expiresAt,
      subscriptionPatch,
    });
  } catch (error: any) {
    return serverError(c, error?.message ?? "Erro ao atualizar assinatura");
  }

  const { data, error } = await svc()
    .from("af_profiles")
    .select(
      "id, owner_name, workshop_name, phone, whatsapp, city, state, subscription_status, subscription_ends_at, created_at, is_admin",
    )
    .eq("id", targetId)
    .maybeSingle();

  if (error) return serverError(c, error.message);
  if (!data) return c.json({ error: "Oficina não encontrada" }, 404);

  return c.json(data);
});

// ─── Health ──────────────────────────────────────────────────────────────────

app.get(`${P}/health`, (c) =>
  c.json({ status: "ok", ts: new Date().toISOString() }),
);

// ─── Profile ─────────────────────────────────────────────────────────────────

app.get(`${P}/profile`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);
  const { data, error } = await svc()
    .from("af_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return serverError(c, error.message);
  return c.json(data);
});

app.post(`${P}/profile`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const body = await c.req.json();

  if (!body.workshop_name?.trim()) {
    return badRequest(c, "Nome da oficina é obrigatório");
  }

  const { error } = await svc()
    .from("af_profiles")
    .upsert({
      id: user.id,
      workshop_name: body.workshop_name?.trim() ?? "",
      owner_name: body.owner_name?.trim() ?? "",
      phone: body.phone ?? "",
      whatsapp: body.whatsapp ?? "",
      instagram: body.instagram ?? "",
      address: body.address ?? "",
      city: body.city ?? "",
      state: body.state ?? "",
      logo_url: body.logo_url ?? "",
    });

  if (error) return serverError(c, error.message);

  try {
    await activateTrialAccess({
      userId: user.id,
      email: user.email,
    });
  } catch (trialError) {
    console.error("Erro ao criar teste grátis:", trialError);
    return serverError(c, "Erro ao ativar teste grátis");
  }

  const { data: updatedProfile, error: profileError } = await svc()
    .from("af_profiles")
    .select()
    .eq("id", user.id)
    .single();

  if (profileError) return serverError(c, profileError.message);

  return c.json(updatedProfile);
});

// ─── Clients ─────────────────────────────────────────────────────────────────

app.get(`${P}/clients`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const { data, error } = await svc()
    .from("af_clients")
    .select("*")
    .eq("workshop_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return serverError(c, error.message);
  return c.json(data ?? []);
});

app.post(`${P}/clients`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const body = await c.req.json();
  if (!body.name?.trim()) return badRequest(c, "Nome é obrigatório");
  const { data, error } = await svc()
    .from("af_clients")
    .insert({
      workshop_id: user.id,
      name: body.name.trim(),
      phone: body.phone ?? "",
      whatsapp: body.whatsapp ?? "",
    })
    .select()
    .single();
  if (error) return serverError(c, error.message);
  return c.json(data, 201);
});

app.put(`${P}/clients/:id`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const body = await c.req.json();
  if (!body.name?.trim()) return badRequest(c, "Nome é obrigatório");
  const { data, error } = await svc()
    .from("af_clients")
    .update({
      name: body.name.trim(),
      phone: body.phone ?? "",
      whatsapp: body.whatsapp ?? "",
    })
    .eq("id", id)
    .eq("workshop_id", user.id)
    .select()
    .single();
  if (error) return serverError(c, error.message);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json(data);
});

// ===== ROTA PÚBLICA DA OS =====
app.get(`${P}/public/orders/:token`, async (c) => {
  const token = c.req.param("token");
  if (!isUuid(token)) return badRequest(c, "Token inválido");

  const { data: order, error } = await svc()
    .from("af_service_orders")
    .select(
      "id, workshop_id, client_id, vehicle_id, status, value, delivery_date, reported_issue, services_performed, notes",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error) return serverError(c, error.message);
  if (!order) return c.json({ error: "OS não encontrada" }, 404);

  const [{ data: profile }, { data: client }, { data: vehicle }] =
    await Promise.all([
      svc()
        .from("af_profiles")
        .select("workshop_name, logo_url, whatsapp")
        .eq("id", order.workshop_id)
        .maybeSingle(),
      svc()
        .from("af_clients")
        .select("name")
        .eq("id", order.client_id)
        .eq("workshop_id", order.workshop_id)
        .maybeSingle(),
      svc()
        .from("af_vehicles")
        .select("brand, model, plate")
        .eq("id", order.vehicle_id)
        .eq("workshop_id", order.workshop_id)
        .maybeSingle(),
    ]);

  return c.json({
    order: {
      ...order,
      notes: sanitizePublicNotes(order.notes),
    },
    profile,
    client,
    vehicle,
  });
});

// ===== DELETE =====
app.delete(`${P}/clients/:id`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const { error } = await svc()
    .from("af_clients")
    .delete()
    .eq("id", id)
    .eq("workshop_id", user.id);
  if (error) return serverError(c, error.message);
  return c.json({ ok: true });
});

// ─── Vehicles ─────────────────────────────────────────────────────────────────

app.get(`${P}/vehicles`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const { data, error } = await svc()
    .from("af_vehicles")
    .select("*")
    .eq("workshop_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return serverError(c, error.message);
  return c.json(data ?? []);
});

app.post(`${P}/vehicles`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const body = await c.req.json();
  if (!body.plate?.trim()) return badRequest(c, "Placa é obrigatória");
  if (!body.client_id) return badRequest(c, "Cliente é obrigatório");
  // Verify client belongs to this workshop
  const { data: clientCheck } = await svc()
    .from("af_clients")
    .select("id")
    .eq("id", body.client_id)
    .eq("workshop_id", user.id)
    .maybeSingle();
  if (!clientCheck) return c.json({ error: "Cliente não encontrado" }, 404);
  const { data, error } = await svc()
    .from("af_vehicles")
    .insert({
      workshop_id: user.id,
      client_id: body.client_id,
      plate: body.plate.trim().toUpperCase(),
      brand: body.brand ?? "",
      model: body.model ?? "",
      year: body.year ?? "",
    })
    .select()
    .single();
  if (error) return serverError(c, error.message);
  return c.json(data, 201);
});

app.put(`${P}/vehicles/:id`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const body = await c.req.json();
  if (!body.plate?.trim()) return badRequest(c, "Placa é obrigatória");
  if (!body.client_id) return badRequest(c, "Cliente é obrigatório");

  const { data: clientCheck } = await svc()
    .from("af_clients")
    .select("id")
    .eq("id", body.client_id)
    .eq("workshop_id", user.id)
    .maybeSingle();
  if (!clientCheck) return c.json({ error: "Cliente não encontrado" }, 404);

  const { data, error } = await svc()
    .from("af_vehicles")
    .update({
      client_id: body.client_id,
      plate: body.plate.trim().toUpperCase(),
      brand: body.brand ?? "",
      model: body.model ?? "",
      year: body.year ?? "",
      mileage: body.mileage ?? "",
    })
    .eq("id", id)
    .eq("workshop_id", user.id)
    .select()
    .single();
  if (error) return serverError(c, error.message);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json(data);
});

app.delete(`${P}/vehicles/:id`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const { error } = await svc()
    .from("af_vehicles")
    .delete()
    .eq("id", id)
    .eq("workshop_id", user.id);
  if (error) return serverError(c, error.message);
  return c.json({ ok: true });
});

// ─── Financial ─────────────────────────────────────────

app.get(`${P}/financial`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;

  const { data, error } = await svc()
    .from("af_financial_entries")
    .select("*")
    .eq("workshop_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return serverError(c, error.message);

  return c.json(data ?? []);
});

app.post(`${P}/financial`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;

  const body = await c.req.json();

  const { data, error } = await svc()
    .from("af_financial_entries")
    .insert({
      workshop_id: user.id,
      description: body.description,
      amount: body.amount,
      type: body.type,
      category: body.category ?? "",
    })
    .select()
    .single();

  if (error) return serverError(c, error.message);

  return c.json(data);
});

app.delete(`${P}/financial/:id`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;

  const id = c.req.param("id");

  const { error } = await svc()
    .from("af_financial_entries")
    .delete()
    .eq("id", id)
    .eq("workshop_id", user.id);

  if (error) return serverError(c, error.message);

  return c.json({ ok: true });
});

// ─── Service Orders ───────────────────────────────────────────────────────────

app.get(`${P}/orders`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const { data, error } = await svc()
    .from("af_service_orders")
    .select("*")
    .eq("workshop_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) return serverError(c, error.message);
  return c.json(data ?? []);
});

app.post(`${P}/orders`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const body = await c.req.json();
  if (!body.client_id) return badRequest(c, "Cliente é obrigatório");
  if (!body.vehicle_id) return badRequest(c, "Veículo é obrigatório");
  if (!body.reported_issue?.trim())
    return badRequest(c, "Problema relatado é obrigatório");
  // Verify client + vehicle belong to this workshop
  const { data: clientCheck } = await svc()
    .from("af_clients")
    .select("id")
    .eq("id", body.client_id)
    .eq("workshop_id", user.id)
    .maybeSingle();
  if (!clientCheck) return c.json({ error: "Cliente não encontrado" }, 404);

  const { data: vCheck } = await svc()
    .from("af_vehicles")
    .select("id")
    .eq("id", body.vehicle_id)
    .eq("client_id", body.client_id)
    .eq("workshop_id", user.id)
    .maybeSingle();
  if (!vCheck)
    return c.json({ error: "Veículo não encontrado para este cliente" }, 404);
  const now = new Date().toISOString();

  const orderInsert: Record<string, any> = {
    public_token: crypto.randomUUID(),
    workshop_id: user.id,
    client_id: body.client_id,
    vehicle_id: body.vehicle_id,
    reported_issue: body.reported_issue.trim(),
    employee_name: body.employee_name?.trim() ?? "",
    services_performed: body.services_performed ?? "",
    value: body.value ?? "0",
    status: body.status ?? "aguardando",
    notes: body.notes ?? "",
    created_at: now,
    updated_at: now,
  };

  if (body.delivery_date) orderInsert.delivery_date = body.delivery_date;
  if (body.checklist) orderInsert.checklist = body.checklist;

  const { data, error } = await svc()
    .from("af_service_orders")
    .insert(orderInsert)
    .select()
    .single();
  if (error) return serverError(c, error.message);
  return c.json(data, 201);
});

app.put(`${P}/orders/:id`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const body = await c.req.json();
  const allowed = [
    "reported_issue",
    "employee_name",
    "services_performed",
    "value",
    "status",
    "notes",
    "delivery_date",
    "checklist",
  ];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  if (
    patch.status &&
    !["aguardando", "em_manutencao", "finalizado"].includes(patch.status)
  ) {
    return badRequest(c, "Status inválido");
  }

  const { data, error } = await svc()
    .from("af_service_orders")
    .update(patch)
    .eq("id", id)
    .eq("workshop_id", user.id)
    .select()
    .single();
  if (error) return serverError(c, error.message);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json(data);
});

app.delete(`${P}/orders/:id`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const blocked = await requireActiveSubscription(c, user);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const { error } = await svc()
    .from("af_service_orders")
    .delete()
    .eq("id", id)
    .eq("workshop_id", user.id);
  if (error) return serverError(c, error.message);

  return c.json({ ok: true });
});

type AccessStatus =
  | "active"
  | "trial"
  | "pending"
  | "expired"
  | "canceled"
  | "inactive";

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function sanitizePublicNotes(value: unknown) {
  const text = String(value ?? "");
  const marker = "[VORTAN_ORCAMENTO]";
  const markerIndex = text.indexOf(marker);
  return (markerIndex >= 0 ? text.slice(0, markerIndex) : text).trim();
}

async function syncAccessState(params: {
  userId: string;
  status: AccessStatus;
  expiresAt: Date;
  email?: string | null;
  paymentId?: string | null;
  subscriptionPatch?: Record<string, unknown>;
}) {
  const subscriptionPayload: Record<string, unknown> = {
    user_id: params.userId,
    plan_name: "mensal",
    status: params.status,
    expires_at: params.expiresAt.toISOString(),
    ...(params.subscriptionPatch ?? {}),
  };

  const { error: subscriptionError } = await svc()
    .from("subscriptions")
    .upsert(subscriptionPayload, { onConflict: "user_id" });

  if (subscriptionError) throw subscriptionError;

  const profilePayload: Record<string, unknown> = {
    plan:
      params.status === "active"
        ? "active"
        : params.status === "trial"
          ? "trial"
          : "inactive",
    subscription_status: params.status,
    subscription_ends_at: params.expiresAt.toISOString(),
  };

  if (params.paymentId !== undefined) {
    profilePayload.mercadopago_payment_id = params.paymentId;
  }
  if (params.email !== undefined) profilePayload.email = params.email;

  const { data: profile, error: profileError } = await svc()
    .from("af_profiles")
    .update(profilePayload)
    .eq("id", params.userId)
    .select("id")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Perfil da oficina não encontrado");
}

async function activateTrialAccess(params: {
  userId: string;
  email?: string | null;
}) {
  const { data: existingSubscription, error: findError } = await svc()
    .from("subscriptions")
    .select("id, status, trial_used, trial_ends_at")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (findError) throw findError;
  if (existingSubscription?.status === "active") return;
  if (existingSubscription?.status === "trial") return;
  if (existingSubscription?.trial_used === true) return;

  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

  await syncAccessState({
    userId: params.userId,
    email: params.email,
    status: "trial",
    expiresAt: trialEndsAt,
    subscriptionPatch: {
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      trial_used: true,
      provider_status: "trial",
      cancel_at_period_end: false,
      canceled_at: null,
    },
  });
}

function getMercadoPagoToken() {
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) throw new Error("Mercado Pago token não configurado");
  return accessToken;
}

async function mercadoPagoGet(path: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${getMercadoPagoToken()}` },
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqualHex(left: string, right: string) {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  if (!leftBytes || !rightBytes || leftBytes.length !== rightBytes.length)
    return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function validateMercadoPagoWebhookSignature(c: any, dataId: string) {
  const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("MERCADOPAGO_WEBHOOK_SECRET não configurado");
  }

  const signatureHeader = c.req.header("x-signature") ?? "";
  const requestId = c.req.header("x-request-id") ?? "";
  let timestamp = "";
  let receivedHash = "";

  for (const part of signatureHeader.split(",")) {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey?.trim();
    const value = rawValue.join("=").trim();
    if (key === "ts") timestamp = value;
    if (key === "v1") receivedHash = value;
  }

  if (!timestamp || !receivedHash) return false;

  const manifestParts: string[] = [];
  const normalizedDataId = dataId.trim().toLowerCase();
  if (normalizedDataId) manifestParts.push(`id:${normalizedDataId}`);
  if (requestId) manifestParts.push(`request-id:${requestId}`);
  manifestParts.push(`ts:${timestamp}`);
  const manifest = `${manifestParts.join(";")};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest),
  );
  const calculatedHash = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqualHex(calculatedHash, receivedHash.toLowerCase());
}

function webhookEventKey(params: {
  topic: string;
  resourceId: string;
  notificationId: string;
  action: string;
  createdAt: string;
  requestId: string;
}) {
  if (params.notificationId) {
    return `${params.topic}:notification:${params.notificationId}`;
  }
  return [
    params.topic,
    params.resourceId,
    params.action || "no-action",
    params.createdAt || params.requestId || "no-date",
  ].join(":");
}

async function claimWebhookEvent(params: {
  topic: string;
  resourceId: string;
  notificationId: string;
  action: string;
  createdAt: string;
  requestId: string;
  payload: unknown;
}) {
  const eventKey = webhookEventKey(params);
  const database = svc();
  const now = new Date().toISOString();
  const { data, error } = await database
    .from("billing_webhook_events")
    .insert({
      provider: "mercadopago",
      event_key: eventKey,
      topic: params.topic,
      resource_id: params.resourceId,
      notification_id: params.notificationId || null,
      request_id: params.requestId || null,
      status: "processing",
      attempts: 1,
      payload: params.payload,
      updated_at: now,
    })
    .select("id")
    .single();

  if (!error && data) {
    return { id: data.id as string, duplicate: false };
  }
  if (error?.code !== "23505") throw error;

  const { data: existing, error: existingError } = await database
    .from("billing_webhook_events")
    .select("id, status, attempts, updated_at")
    .eq("provider", "mercadopago")
    .eq("event_key", eventKey)
    .single();

  if (existingError) throw existingError;
  if (existing.status === "processed") {
    return { id: existing.id as string, duplicate: true };
  }

  const lastUpdate = new Date(existing.updated_at).getTime();
  const processingIsFresh =
    existing.status === "processing" &&
    Number.isFinite(lastUpdate) &&
    Date.now() - lastUpdate < 5 * 60 * 1000;

  if (processingIsFresh) {
    return { id: existing.id as string, duplicate: true };
  }

  const { error: retryError } = await database
    .from("billing_webhook_events")
    .update({
      status: "processing",
      attempts: Number(existing.attempts ?? 0) + 1,
      error_message: null,
      payload: params.payload,
      request_id: params.requestId || null,
      updated_at: now,
    })
    .eq("id", existing.id);

  if (retryError) throw retryError;
  return { id: existing.id as string, duplicate: false };
}

async function finishWebhookEvent(eventId: string) {
  const { error } = await svc()
    .from("billing_webhook_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", eventId);
  if (error) throw error;
}

async function failWebhookEvent(eventId: string, errorMessage: string) {
  const { error } = await svc()
    .from("billing_webhook_events")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (error) console.error("Erro ao registrar falha do webhook:", error);
}

async function processApprovedPayment(paymentId: string) {
  const { response, data: payment } = await mercadoPagoGet(
    `/v1/payments/${encodeURIComponent(paymentId)}`,
  );

  if (!response.ok) {
    throw new Error(
      payment?.message ?? "Pagamento não encontrado no Mercado Pago",
    );
  }

  if (payment?.status !== "approved") {
    return { ok: true, ignored: true, status: payment?.status ?? "unknown" };
  }

  const userId = String(payment?.external_reference ?? "");
  if (!isUuid(userId))
    throw new Error("Pagamento sem referência de usuário válida");

  const expectedCurrency = Deno.env.get("MERCADOPAGO_CURRENCY") ?? "BRL";
  const expectedAmount = Number(
    Deno.env.get("VORTAN_MONTHLY_PRICE") ?? "29.90",
  );
  const receivedAmount = Number(payment?.transaction_amount);

  if (payment?.currency_id !== expectedCurrency) {
    throw new Error("Moeda do pagamento inválida");
  }
  if (
    !Number.isFinite(receivedAmount) ||
    Math.abs(receivedAmount - expectedAmount) > 0.009
  ) {
    throw new Error("Valor do pagamento inválido");
  }

  const expectedCollector = Deno.env.get("MERCADOPAGO_COLLECTOR_ID");
  if (
    expectedCollector &&
    String(payment?.collector_id ?? "") !== expectedCollector
  ) {
    throw new Error("Recebedor do pagamento inválido");
  }

  const { data: profile, error: profileError } = await svc()
    .from("af_profiles")
    .select("id, subscription_ends_at, mercadopago_payment_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Usuário do pagamento não encontrado");

  const { data: subscription, error: subscriptionError } = await svc()
    .from("subscriptions")
    .select("status, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (subscriptionError) throw subscriptionError;

  const normalizedPaymentId = String(payment.id);
  const duplicate = profile.mercadopago_payment_id === normalizedPaymentId;

  if (duplicate) {
    const knownExpiration =
      profile.subscription_ends_at ?? subscription?.expires_at;
    const expiresAt = knownExpiration ? new Date(knownExpiration) : new Date();
    await syncAccessState({
      userId,
      email: payment?.payer?.email ?? undefined,
      paymentId: normalizedPaymentId,
      status: "active",
      expiresAt: Number.isNaN(expiresAt.getTime()) ? new Date() : expiresAt,
      subscriptionPatch: {
        provider_status: "approved",
        cancel_at_period_end: false,
        canceled_at: null,
      },
    });
    return { ok: true, duplicate: true };
  }

  const approvedAt = payment?.date_approved
    ? new Date(payment.date_approved)
    : new Date();
  const safeApprovedAt = Number.isNaN(approvedAt.getTime())
    ? new Date()
    : approvedAt;
  const existingExpiration = subscription?.expires_at
    ? new Date(subscription.expires_at)
    : null;
  const baseDate =
    existingExpiration &&
    !Number.isNaN(existingExpiration.getTime()) &&
    existingExpiration.getTime() > safeApprovedAt.getTime()
      ? existingExpiration
      : safeApprovedAt;
  const expiresAt = addMonths(baseDate, 1);

  await syncAccessState({
    userId,
    email: payment?.payer?.email ?? undefined,
    paymentId: normalizedPaymentId,
    status: "active",
    expiresAt,
    subscriptionPatch: {
      provider_status: "approved",
      cancel_at_period_end: false,
      canceled_at: null,
    },
  });

  return { ok: true, expires_at: expiresAt.toISOString() };
}

async function processPreapproval(preapprovalId: string) {
  const { response, data: preapproval } = await mercadoPagoGet(
    `/preapproval/${encodeURIComponent(preapprovalId)}`,
  );

  if (!response.ok) {
    throw new Error(
      preapproval?.message ?? "Assinatura não encontrada no Mercado Pago",
    );
  }

  const userId = String(preapproval?.external_reference ?? "");
  if (!isUuid(userId))
    throw new Error("Assinatura sem referência de usuário válida");

  const expectedPlanId = Deno.env.get("MERCADOPAGO_PREAPPROVAL_PLAN_ID");
  if (expectedPlanId && preapproval?.preapproval_plan_id !== expectedPlanId) {
    throw new Error("Plano da assinatura inválido");
  }

  const current = await getSubscription(userId);
  const providerStatus = String(preapproval?.status ?? "unknown");
  const currentExpiration = current?.expires_at
    ? new Date(current.expires_at)
    : new Date();
  const safeExpiration = Number.isNaN(currentExpiration.getTime())
    ? new Date()
    : currentExpiration;
  const stillHasAccess = isSubscriptionActive(current);

  if (["cancelled", "canceled", "paused"].includes(providerStatus)) {
    if (stillHasAccess) {
      const { error } = await svc()
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_name: "mensal",
            status: current.status,
            expires_at: safeExpiration.toISOString(),
            preapproval_id: String(preapproval.id),
            mercadopago_subscription_id: String(preapproval.id),
            provider_status: providerStatus,
            cancel_at_period_end: true,
            canceled_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    } else {
      await syncAccessState({
        userId,
        status: "canceled",
        expiresAt: new Date(),
        subscriptionPatch: {
          preapproval_id: String(preapproval.id),
          mercadopago_subscription_id: String(preapproval.id),
          provider_status: providerStatus,
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
        },
      });
    }
  } else {
    const status: AccessStatus = stillHasAccess ? current.status : "pending";
    const { error } = await svc()
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_name: "mensal",
          status,
          expires_at: safeExpiration.toISOString(),
          preapproval_id: String(preapproval.id),
          mercadopago_subscription_id: String(preapproval.id),
          provider_status: providerStatus,
          cancel_at_period_end: false,
          canceled_at: null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  }

  return { ok: true, provider_status: providerStatus };
}

// ─── Billing ────────────────────────────────────────────────────────────────

app.post(`${P}/billing/create-checkout`, async (c) => {
  try {
    const user = await getUser(c.req.header("Authorization"));
    if (!user) return unauthorized(c);

    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getMercadoPagoToken()}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          items: [
            {
              id: "vortan-oficina-mensal",
              title: "Assinatura Vortan Oficina - 1 mês",
              quantity: 1,
              currency_id: "BRL",
              unit_price: Number(
                Deno.env.get("VORTAN_MONTHLY_PRICE") ?? "29.90",
              ),
            },
          ],
          external_reference: user.id,
          metadata: {
            product_code: "vortan_oficina_monthly",
            user_id: user.id,
          },
          payer: { email: user.email },
          back_urls: {
            success: "https://www.vortanoficina.com.br",
            failure: "https://www.vortanoficina.com.br",
            pending: "https://www.vortanoficina.com.br",
          },
          auto_return: "approved",
          notification_url:
            "https://kddlzartfawqjnrafzdb.supabase.co/functions/v1/rapid-action/billing/webhook?source_news=webhooks",
        }),
      },
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return c.json(
        {
          error: data?.message ?? "Erro ao criar pagamento",
          details: data,
        },
        502,
      );
    }

    return c.json({
      id: data.id,
      checkout_url: data.init_point,
      init_point: data.init_point,
      url: data.init_point,
    });
  } catch (error: any) {
    return serverError(c, error?.message ?? "Erro ao criar pagamento");
  }
});

app.post(`${P}/billing/create-subscription`, async (c) => {
  try {
    const user = await getUser(c.req.header("Authorization"));
    if (!user) return unauthorized(c);
    if (!user.email) return badRequest(c, "Usuário sem e-mail válido");

    const planId = Deno.env.get("MERCADOPAGO_PREAPPROVAL_PLAN_ID");
    if (!planId)
      return serverError(c, "ID do plano recorrente não configurado");

    const existing = await getSubscription(user.id);
    if (existing?.preapproval_id) {
      const existingPreapproval = await mercadoPagoGet(
        `/preapproval/${encodeURIComponent(existing.preapproval_id)}`,
      );
      const existingData = existingPreapproval.data;
      if (
        existingPreapproval.response.ok &&
        String(existingData?.external_reference ?? "") === user.id &&
        existingData?.init_point &&
        ["pending", "authorized", "paused"].includes(
          String(existingData?.status ?? ""),
        )
      ) {
        return c.json({
          id: existingData.id,
          init_point: existingData.init_point,
          url: existingData.init_point,
          reused: true,
        });
      }
    }

    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getMercadoPagoToken()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        preapproval_plan_id: planId,
        reason: "Assinatura mensal Vortan Oficina",
        external_reference: user.id,
        payer_email: user.email,
        back_url: "https://www.vortanoficina.com.br",
        status: "pending",
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return c.json(
        {
          error: data?.message ?? "Erro ao criar assinatura recorrente",
          details: data,
        },
        502,
      );
    }
    if (!data?.id || !data?.init_point) {
      return serverError(
        c,
        "Mercado Pago não retornou a assinatura corretamente",
      );
    }

    const keepCurrentAccess = isSubscriptionActive(existing);
    const expiresAt = existing?.expires_at ?? new Date().toISOString();
    const { error } = await svc()
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_name: "mensal",
          status: keepCurrentAccess ? existing.status : "pending",
          expires_at: expiresAt,
          preapproval_id: String(data.id),
          mercadopago_subscription_id: String(data.id),
          provider_status: String(data.status ?? "pending"),
          cancel_at_period_end: false,
          canceled_at: null,
        },
        { onConflict: "user_id" },
      );

    if (error) return serverError(c, error.message);

    return c.json({
      id: data.id,
      init_point: data.init_point,
      url: data.init_point,
    });
  } catch (error: any) {
    return serverError(c, error?.message ?? "Erro ao criar assinatura");
  }
});

app.post(`${P}/billing/webhook`, async (c) => {
  let claimedEventId: string | null = null;

  try {
    const body = await c.req.json().catch(() => ({}));
    const topic = String(
      body?.type ?? c.req.query("type") ?? c.req.query("topic") ?? "payment",
    );
    const resourceId = String(
      body?.data?.id ??
        c.req.query("data.id") ??
        c.req.query("data_id") ??
        body?.id ??
        c.req.query("id") ??
        "",
    );
    const signatureDataId = String(
      c.req.query("data.id") ?? c.req.query("data_id") ?? body?.data?.id ?? "",
    );

    if (!resourceId) return badRequest(c, "Notificação sem ID");

    const validSignature = await validateMercadoPagoWebhookSignature(
      c,
      signatureDataId,
    );
    if (!validSignature) {
      return c.json(
        { ok: false, error: "Assinatura do webhook inválida" },
        401,
      );
    }

    const requestId = c.req.header("x-request-id") ?? "";
    const claim = await claimWebhookEvent({
      topic,
      resourceId,
      notificationId: String(body?.id ?? ""),
      action: String(body?.action ?? ""),
      createdAt: String(body?.date_created ?? ""),
      requestId,
      payload: body,
    });
    claimedEventId = claim.id;

    if (claim.duplicate) {
      return c.json({ ok: true, duplicate: true });
    }

    let result: Record<string, unknown>;

    if (topic === "subscription_preapproval") {
      result = await processPreapproval(resourceId);
    } else if (topic === "subscription_authorized_payment") {
      const invoice = await mercadoPagoGet(
        `/authorized_payments/${encodeURIComponent(resourceId)}`,
      );
      if (!invoice.response.ok) {
        throw new Error(invoice.data?.message ?? "Fatura não encontrada");
      }
      const linkedPaymentId = invoice.data?.payment?.id;
      if (!linkedPaymentId || invoice.data?.payment?.status !== "approved") {
        result = {
          ok: true,
          ignored: true,
          status:
            invoice.data?.payment?.status ?? invoice.data?.status ?? "unknown",
        };
      } else {
        result = await processApprovedPayment(String(linkedPaymentId));
      }
    } else if (topic !== "payment" && topic !== "topic_payment") {
      result = { ok: true, ignored: true, topic };
    } else {
      result = await processApprovedPayment(resourceId);
    }

    await finishWebhookEvent(claimedEventId);
    return c.json(result);
  } catch (error: any) {
    const errorMessage = error?.message ?? "Erro ao processar notificação";
    if (claimedEventId) await failWebhookEvent(claimedEventId, errorMessage);
    console.error("Erro no webhook do Mercado Pago:", error);
    return c.json({ ok: false, error: errorMessage }, 500);
  }
});

app.post(`${P}/billing/cancel-subscription`, async (c) => {
  try {
    const user = await getUser(c.req.header("Authorization"));
    if (!user) return unauthorized(c);

    const sub = await getSubscription(user.id);
    if (!sub?.preapproval_id) {
      return c.json({ error: "Assinatura recorrente não encontrada." }, 404);
    }

    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(sub.preapproval_id)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getMercadoPagoToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      },
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return c.json(
        {
          error: "Erro ao cancelar assinatura no Mercado Pago.",
          details: data,
        },
        502,
      );
    }

    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : new Date();
    const safeExpiration = Number.isNaN(expiresAt.getTime())
      ? new Date()
      : expiresAt;
    const stillHasAccess =
      safeExpiration.getTime() > Date.now() &&
      ["active", "trial"].includes(sub.status);

    if (stillHasAccess) {
      const { error } = await svc()
        .from("subscriptions")
        .update({
          provider_status: "cancelled",
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      await syncAccessState({
        userId: user.id,
        status: "canceled",
        expiresAt: safeExpiration,
        subscriptionPatch: {
          provider_status: "cancelled",
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
        },
      });
    }

    return c.json({
      ok: true,
      message: stillHasAccess
        ? "Assinatura cancelada. Você continuará com acesso até o fim do período pago."
        : "Assinatura cancelada.",
      expires_at: sub.expires_at,
    });
  } catch (error: any) {
    console.error("Erro ao cancelar assinatura:", error);
    return serverError(
      c,
      error?.message ?? "Erro interno ao cancelar assinatura",
    );
  }
});

Deno.serve(app.fetch);
