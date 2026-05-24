import { Hono } from "npm:hono"
import { cors } from "npm:hono/cors"
import { logger } from "npm:hono/logger"
import { createClient } from "jsr:@supabase/supabase-js@2"

const app = new Hono();
const P = "/rapid-action";


app.use("*", logger())

app.use("*", cors({
  origin: [
    "https://autoflowoficina.online",
    "https://www.autoflowoficina.online",
    "https://autoflow-saas-git-main-eumabos-projects.vercel.app",
    "https://autoflow-saas-two.vercel.app"
  ],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "apikey"]
}))

app.options("*", (c) => c.text("", 204))

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
  const { data: { user }, error } = await svc().auth.getUser(authHeader.slice(7));
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
  const sub = await getSubscription(user.id);

  if (!isSubscriptionActive(sub)) {
    return c.json(
      {
        error: "Assinatura inativa ou expirada",
        code: "SUBSCRIPTION_REQUIRED",
      },
      402
    );
  }

  return null;
}

// ─── Health ──────────────────────────────────────────────────────────────────

app.get(`${P}/health`, (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

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
  if (!body.workshop_name?.trim()) return badRequest(c, "Nome da oficina é obrigatório");
  const { data, error } = await svc()
    .from("af_profiles")
    .upsert({ id: user.id, workshop_name: body.workshop_name.trim(), owner_name: body.owner_name?.trim() ?? "" })
    .select()
    .single();
  if (error) return serverError(c, error.message);
  return c.json(data);
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
    .insert({ workshop_id: user.id, name: body.name.trim(), phone: body.phone ?? "", whatsapp: body.whatsapp ?? "" })
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
    .update({ name: body.name.trim(), phone: body.phone ?? "", whatsapp: body.whatsapp ?? "" })
    .eq("id", id)
    .eq("workshop_id", user.id)
    .select()
    .single();
  if (error) return serverError(c, error.message);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json(data);
});

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
  if (!body.reported_issue?.trim()) return badRequest(c, "Problema relatado é obrigatório");
  // Verify client + vehicle belong to this workshop
  const { data: vCheck } = await svc()
    .from("af_vehicles")
    .select("id")
    .eq("id", body.vehicle_id)
    .eq("workshop_id", user.id)
    .maybeSingle();
  if (!vCheck) return c.json({ error: "Veículo não encontrado" }, 404);
  const now = new Date().toISOString();
  const { data, error } = await svc()
    .from("af_service_orders")
    .insert({
      workshop_id: user.id,
      client_id: body.client_id,
      vehicle_id: body.vehicle_id,
      reported_issue: body.reported_issue.trim(),
      services_performed: body.services_performed ?? "",
      value: body.value ?? "0",
      status: body.status ?? "aguardando",
      notes: body.notes ?? "",
      created_at: now,
      updated_at: now,
    })
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
  const allowed = ["reported_issue", "services_performed", "value", "status", "notes"];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
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

Deno.serve(app.fetch);

app.post(`${P}/billing/create-checkout`, async (c) => {
  const user = await getUser(c.req.header("Authorization"));
  if (!user) return unauthorized(c);

  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) return serverError(c, "Mercado Pago token não configurado");

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: "AutoFlow Oficina - Plano Mensal",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 49.9,
        },
      ],
      external_reference: user.id,
      back_urls: {
        success: "https://autoflowoficina.online",
        failure: "https://autoflowoficina.online",
        pending: "https://autoflowoficina.online",
      },
      auto_return: "approved",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return c.json({ error: data?.message ?? "Erro ao criar checkout", details: data }, 500);
  }

  return c.json({
    preference_id: data.id,
    checkout_url: data.init_point,
  });
});
