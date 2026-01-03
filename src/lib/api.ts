export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

type Opts = RequestInit & { auth?: boolean };

export async function apiFetch<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers = new Headers(opts.headers);

  if (opts.auth) {
    const t = getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }

  if (opts.body && typeof opts.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (data as T) ?? ({} as T);
}

function safeJson(t: string) {
  try { return JSON.parse(t); } catch { return null; }
}
