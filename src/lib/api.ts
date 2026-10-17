import { apiBase } from "@/lib/tenant";
import type { Paginated } from "@/types/common";

const ACCESS = "orgsurvey.access";
const REFRESH = "orgsurvey.refresh";

/** Anything the API says no to. `message` is safe to show the person as-is. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const tokens = {
  get access() {
    return typeof window === "undefined" ? null : read(ACCESS);
  },
  get refresh() {
    return typeof window === "undefined" ? null : read(REFRESH);
  },
  set(access: string, refresh?: string) {
    window.localStorage.setItem(ACCESS, access);
    if (refresh) window.localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    window.localStorage.removeItem(ACCESS);
    window.localStorage.removeItem(REFRESH);
  },
};

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageOf(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) return String((body as { detail: unknown }).detail);
  return status >= 500 ? "Something went wrong on the server." : `Request failed (${status}).`;
}

/** One in-flight refresh shared by every request that hits an expired token. */
let refreshing: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${apiBase()}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access: string; refresh?: string };
      tokens.set(data.access, data.refresh);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function request<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.auth !== false && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
    return fetch(`${apiBase()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && opts.auth !== false && (await refreshAccess())) res = await send();
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", 0);
  }

  const data = await parse(res);
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false) tokens.clear();
    throw new ApiError(messageOf(res.status, data), res.status);
  }
  return data as T;
}

/** Query-string parameters; empty values are left out so callers can pass
 * `{ search: "", status: undefined }` straight from component state. */
export type Params = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, params?: Params): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}${path.includes("?") ? "&" : "?"}${text}` : path;
}

export const api = {
  get: <T>(path: string, params?: Params, opts?: { auth?: boolean }) => request<T>("GET", withQuery(path, params), undefined, opts),
  /** A paginated list: `{ count, next, previous, results }`. */
  list: <T>(path: string, params?: Params) => request<Paginated<T>>("GET", withQuery(path, params)),
  post: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) => request<T>("POST", path, body ?? {}, opts),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<null>("DELETE", path),
};

/** Download a file the API builds (an Excel report, say) and hand it to the
 * browser to save. Uses the same sign-in and token refresh as every call. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const send = () => fetch(`${apiBase()}${path}`, { headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {} });
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && (await refreshAccess())) res = await send();
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", 0);
  }
  if (!res.ok) throw new ApiError(messageOf(res.status, await parse(res)), res.status);
  const name = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
