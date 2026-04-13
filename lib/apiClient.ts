"use client";

let accessToken: string | null = null;
// Singleton in-flight refresh — all concurrent 401s share one refresh call
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof document !== "undefined") {
    if (token) {
      document.cookie = `access_token=${token}; path=/; max-age=900; SameSite=Strict${location.protocol === "https:" ? "; Secure" : ""}`;
    } else {
      document.cookie = "access_token=; path=/; max-age=0";
    }
  }
}

export function getAccessToken() {
  return accessToken;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/admin/auth/refresh", { method: "POST" });
      if (res.ok) {
        const { accessToken: newToken } = await res.json();
        setAccessToken(newToken);
        return newToken as string;
      }
      setAccessToken(null);
      window.location.href = "/admin/login";
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface FetchOptions extends RequestInit {
  json?: unknown;
}

export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const { json, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };

  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    rest.body = JSON.stringify(json);
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, { ...rest, headers });

  // Auto-refresh on 401
  if (res.status === 401 && path !== "/api/admin/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      return fetch(path, { ...rest, headers });
    }
  }

  return res;
}
