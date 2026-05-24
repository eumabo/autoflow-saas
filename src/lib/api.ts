import { supabase, API_BASE } from "./supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  workshop_name: string;
  owner_name: string;
  created_at: string;
}

export interface Client {
  id: string;
  workshop_id: string;
  name: string;
  phone: string;
  whatsapp: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  workshop_id: string;
  client_id: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  mileage: string;
  created_at: string;
}

export type OrderStatus = "aguardando" | "em_manutencao" | "finalizado";

export interface ServiceOrder {
  id: string;
  workshop_id: string;
  client_id: string;
  vehicle_id: string;
  reported_issue: string;
  services_performed: string;
  value: string;
  status: OrderStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  try {
    return await apiFetch<Profile>("/profile");
  } catch {
    return null;
  }
}

export async function upsertProfile(data: { workshop_name: string; owner_name: string }): Promise<Profile> {
  return apiFetch<Profile>("/profile", { method: "POST", body: JSON.stringify(data) });
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  return apiFetch<Client[]>("/clients");
}

export async function createClient_(data: { name: string; phone: string; whatsapp: string }): Promise<Client> {
  return apiFetch<Client>("/clients", { method: "POST", body: JSON.stringify(data) });
}

export async function updateClient(id: string, data: { name: string; phone: string; whatsapp: string }): Promise<Client> {
  return apiFetch<Client>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteClient(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/clients/${id}`, { method: "DELETE" });
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export async function getVehicles(): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>("/vehicles");
}

export async function createVehicle(data: Omit<Vehicle, "id" | "workshop_id" | "created_at">): Promise<Vehicle> {
  return apiFetch<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(data) });
}

export async function updateVehicle(id: string, data: Omit<Vehicle, "id" | "workshop_id" | "created_at">): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteVehicle(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/vehicles/${id}`, { method: "DELETE" });
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<ServiceOrder[]> {
  return apiFetch<ServiceOrder[]>("/orders");
}

export async function createOrder(data: Omit<ServiceOrder, "id" | "workshop_id" | "created_at" | "updated_at">): Promise<ServiceOrder> {
  return apiFetch<ServiceOrder>("/orders", { method: "POST", body: JSON.stringify(data) });
}

export async function updateOrder(id: string, data: Partial<ServiceOrder>): Promise<ServiceOrder> {
  return apiFetch<ServiceOrder>(`/orders/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteOrder(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/orders/${id}`, { method: "DELETE" });
}

export async function createCheckout(): Promise<{ checkout_url: string }> {
  return apiFetch<{ checkout_url: string }>("/billing/create-checkout", {
    method: "POST",
  });
}
