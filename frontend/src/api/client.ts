const API_URL = import.meta.env.VITE_API_URL || "/api";

export function getAssetUrl(path?: string | null) {
  if (!path) return "";
  return `${API_URL.replace(/\/api$/, "")}${path}`;
}

export function getToken() {
  return localStorage.getItem("ponto_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("ponto_token", token);
  } else {
    localStorage.removeItem("ponto_token");
  }
}

type ApiOptions = RequestInit & {
  body?: BodyInit | Record<string, unknown> | null;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData) && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : (options.body as BodyInit | null | undefined)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Erro inesperado." }));
    throw new Error(payload.message || "Erro inesperado.");
  }

  return response.json();
}

export async function apiBlob(path: string) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Erro inesperado." }));
    throw new Error(payload.message || "Erro inesperado.");
  }

  return response.blob();
}
