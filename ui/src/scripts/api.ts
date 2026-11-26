/** Calls to the FastAPI backend (live AI features). Browser-side only. */
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE ??
  (import.meta.env.DEV ? "http://localhost:8787" : "https://micemax-backend.onrender.com");

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json() as Promise<T>;
}
