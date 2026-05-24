import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  { auth: { persistSession: true, autoRefreshToken: true } },
);

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/rapid-action";

export const API_BASE = apiBase.replace(/\/$/, "");
