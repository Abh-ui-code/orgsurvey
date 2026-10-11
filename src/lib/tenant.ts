/**
 * Multi-tenant host parsing. A workspace lives at <subdomain>.<base domain>
 * (abc.localhost), so the subdomain is the tenant. The bare base domain
 * ("localhost") is the platform host, where people find their workspace.
 */

const RESERVED_SUBDOMAINS = ["admin", "api", "www", "app"];

export function baseDomain(): string {
  return process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN ?? "localhost";
}

/** The tenant subdomain for this host, or null on the platform host. */
export function getTenantFromHost(hostname?: string): string | null {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  const base = baseDomain();
  if (!host.endsWith(`.${base}`)) return null;
  const sub = host.slice(0, -(base.length + 1));
  return sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.includes(sub) ? sub : null;
}

function origin(hostname: string): string {
  const { protocol, port } = window.location;
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}

/** Absolute URL onto a specific workspace, whatever host the user is on now. */
export function workspaceUrl(subdomain: string, path = "/"): string {
  return `${origin(`${subdomain}.${baseDomain()}`)}${path}`;
}

/** Absolute URL onto the platform host (bare base domain), where people find their workspace. */
export function platformUrl(path = "/"): string {
  return `${origin(baseDomain())}${path}`;
}

/** The API shares the browser's hostname, because the backend picks the
 * tenant from the Host header: abc.localhost:3000 must call abc.localhost:8000.
 * Calling a bare localhost:8000 from a tenant host would land on the platform
 * schema, where none of the workspace routes exist. */
export function apiBase(hostname?: string): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "localhost");
  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  const port = process.env.NEXT_PUBLIC_API_PORT ?? "8000";
  return `${protocol}//${host}:${port}/api`;
}
