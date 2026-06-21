  import { Hono } from "npm:hono"
  import { cors } from "npm:hono/cors"
  import { logger } from "npm:hono/logger"
  import { createClient } from "jsr:@supabase/supabase-js@2"

  const app = new Hono();
  const P = "/rapid-action";


  app.use("*", logger())

  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:5173",
        "https://autoflowoficina.online",
        "https://www.autoflowoficina.online",
      ],
      allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );

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
})
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

   // ===== ROTA PÚBLICA DA OS =====
    app.get(`${P}/public/orders/:token`, async (c) => {
  const token = c.req.param("token");

  const { data: order, error } = await svc()
    .from("af_service_orders")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (error) return serverError(c, error.message);
  if (!order) return c.json({ error: "OS não encontrada" }, 404);

  const [{ data: profile }, { data: client }, { data: vehicle }] =
    await Promise.all([
      svc()
        .from("af_profiles")
        .select("*")
        .eq("id", order.workshop_id)
        .maybeSingle(),

      svc()
        .from("af_clients")
        .select("*")
        .eq("id", order.client_id)
        .maybeSingle(),

      svc()
        .from("af_vehicles")
        .select("*")
        .eq("id", order.vehicle_id)
        .maybeSingle(),
    ]);

  return c.json({
    order,
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
    if (!body.reported_issue?.trim()) return badRequest(c, "Problema relatado é obrigatório");
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
    if (!vCheck) return c.json({ error: "Veículo não encontrado para este cliente" }, 404);
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
    const allowed = ["reported_issue", "employee_name", "services_performed", "value", "status", "notes", "delivery_date", "checklist"];
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    if (patch.status && !["aguardando", "em_manutencao", "finalizado"].includes(patch.status)) {
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

  
async function activateSubscriptionAccess(params: {
  userId: string;
  email?: string | null;
  paymentId?: string | null;
  expiresAt?: Date;
}) {
  const expiresAt =
    params.expiresAt ?? new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);

  const { error: subError } = await svc()
    .from("subscriptions")
    .upsert({
      user_id: params.userId,
      status: "active",
      expires_at: expiresAt.toISOString(),
    });

  if (subError) throw subError;

  const { error: profileError } = await svc()
    .from("af_profiles")
    .update({
      plan: "active",
      subscription_status: "active",
      subscription_ends_at: expiresAt.toISOString(),
      mercadopago_payment_id: params.paymentId ?? null,
      email: params.email ?? null,
    })
    .eq("id", params.userId);

  if (profileError) throw profileError;
}

async function deactivateSubscriptionAccess(params: {
  userId: string;
  status?: string;
}) {
  const now = new Date();

  const { error: subError } = await svc()
    .from("subscriptions")
    .upsert({
      user_id: params.userId,
      status: params.status ?? "inactive",
      expires_at: now.toISOString(),
    });

  if (subError) throw subError;

  const { error: profileError } = await svc()
    .from("af_profiles")
    .update({
      plan: "inactive",
      subscription_status: params.status ?? "inactive",
      subscription_ends_at: now.toISOString(),
    })
    .eq("id", params.userId);

  if (profileError) throw profileError;
}

function getMonthlyExpiration() {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  return expiresAt;
}



  app.post(`${P}/billing/create-checkout`, async (c) => {
    const user = await getUser(c.req.header("Authorization"));
    if (!user) return unauthorized(c);

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) return serverError(c, "Mercado Pago token não configurado");

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: "Assinatura Vortan Oficina",
            quantity: 1,
            currency_id: "BRL",
            unit_price: 29.9,
          },
        ],
        external_reference: user.id,
        payer: {
          email: user.email,
        },
        back_urls: {
    success: "https://www.autoflowoficina.online",
    failure: "https://www.autoflowoficina.online",
    pending: "https://www.autoflowoficina.online",
  },
        notification_url:
          "https://kddlzartfawqjnrafzdb.supabase.co/functions/v1/rapid-action/billing/webhook",
      }),
    });




    const data = await res.json();

if (!res.ok) {
  return c.json(
    {
      error: data?.message ?? "Erro ao criar assinatura recorrente",
      details: data,
    },
    500
  );
}

await svc()
  .from("subscriptions")
  .upsert({
    user_id: user.id,
    status: "pending",
    preapproval_id: data.id,
    expires_at: new Date().toISOString(),
  });

return c.json({
  id: data.id,
  url: data.init_point,
  init_point: data.init_point,
});

 });
   app.post(`${P}/billing/create-subscription`, async (c) => {
  try {
    const user = await getUser(c.req.header("Authorization"));
    if (!user) return unauthorized(c);

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return serverError(c, "Mercado Pago token não configurado");
    }

    const planId = Deno.env.get("MERCADOPAGO_PREAPPROVAL_PLAN_ID");
    if (!planId) {
      return serverError(c, "ID do plano recorrente não configurado");
    }

    if (!user.email) {
      return badRequest(c, "Usuário sem e-mail para criar assinatura");
    }

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preapproval_plan_id: planId,
        reason: "Vortan Oficina - Plano Mensal",
        external_reference: user.id,
        payer_email: user.email,
        back_url: "https://www.vortanoficina.com.br",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return c.json(
        {
          error: data?.message ?? "Erro ao criar assinatura recorrente",
          details: data,
        },
        500
      );
    }

    await svc()
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        status: "pending",
        preapproval_id: data.id,
        expires_at: new Date().toISOString(),
      });

    return c.json({
      id: data.id,
      url: data.init_point,
      init_point: data.init_point,
    });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: err.message,
      },
      500
    );
  }
});

app.post(`${P}/billing/webhook`, async (c) => {
  try {
    const body = await c.req.json();

    const paymentId = body?.data?.id || body?.id;

    if (!paymentId) {
      return c.json(
        {
          ok: false,
          error: "Pagamento sem ID",
        },
        400
      );
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return serverError(c, "Mercado Pago token não configurado");
    }

    const paymentRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payment = await paymentRes.json();

    if (payment.status !== "approved") {
      return c.json({
        ok: true,
        ignored: true,
        status: payment.status,
      });
    }

    const userId = payment.external_reference;

    if (!userId) {
      return c.json(
        {
          ok: false,
          error: "Sem external_reference",
        },
        400
      );
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const { error: subError } = await svc()
      .from("subscriptions")
      .upsert({
        user_id: userId,
        status: "active",
        expires_at: expiresAt.toISOString(),
        mercadopago_payment_id: String(payment.id),
      });

    if (subError) {
      return c.json(
        {
          ok: false,
          error: subError.message,
        },
        500
      );
    }

    const { error: profileError } = await svc()
      .from("af_profiles")
      .update({
        plan: "active",
        subscription_status: "active",
        subscription_ends_at: expiresAt.toISOString(),
        mercadopago_payment_id: String(payment.id),
        email: payment.payer?.email ?? null,
      })
      .eq("id", userId);

    if (profileError) {
      return c.json(
        {
          ok: false,
          error: profileError.message,
        },
        500
      );
    }

    return c.json({ ok: true });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: err.message,
      },
      500
    );
  }
});

app.post(`${P}/billing/cancel-subscription`, async (c) => {
  try {
    const user = await getUser(c.req.header("Authorization"));
    if (!user) return unauthorized(c);

    const { data: sub, error: subError } = await svc()
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      return serverError(c, subError.message);
    }

    if (!sub?.preapproval_id) {
      return c.json(
        {
          error: "Assinatura não encontrada",
        },
        404
      );
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return serverError(c, "Mercado Pago token não configurado");
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/preapproval/${sub.preapproval_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
        }),
      }
    );

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      return c.json(
        {
          error: "Erro ao cancelar assinatura",
          details: mpData,
        },
        500
      );
    }

    await svc()
      .from("subscriptions")
      .update({
        status: "cancelled",
      })
      .eq("user_id", user.id);

    await svc()
      .from("af_profiles")
      .update({
        subscription_status: "cancelled",
      })
      .eq("id", user.id);

    return c.json({
      ok: true,
      message: "Assinatura cancelada",
    });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: err.message,
      },
      500
    );
  }
});

Deno.serve(app.fetch);