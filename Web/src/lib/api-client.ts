import { env } from "@/lib/env";

export type ApiErrorBody = {
  code?: string;
  message?: string;
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "api_error", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    const detail = body.detail as ApiErrorBody | ApiErrorBody[] | string | undefined;
    if (typeof detail === "string") {
      return new ApiError(detail, "api_error", response.status);
    }
    if (Array.isArray(detail) && detail[0]?.message) {
      return new ApiError(detail[0].message, detail[0].code ?? "api_error", response.status);
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      return new ApiError(
        detail.message ?? "Request failed",
        detail.code ?? "api_error",
        response.status
      );
    }
  } catch {
    // ignore parse errors
  }
  return new ApiError("Request failed", "api_error", response.status);
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${env.apiUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await response.json()) as { access_token: string };
      setAccessToken(data.access_token);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
