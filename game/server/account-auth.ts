import { accountHasRole, type AccountRole, type StoredAccount } from "./accounts";
import { getAccountService } from "./runtime";

export const SESSION_COOKIE = "horizon_session";

export function accountTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  const explicit = request.headers.get("x-horizon-account-token");
  if (explicit) return explicit.trim();
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function sessionCookie(token: string, request?: Request, maxAge = 60 * 60 * 24 * 30) {
  const secure = !request || new URL(request.url).protocol === "https:";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function requireAccount(request: Request, allowSuspended = false): Promise<StoredAccount> {
  const token = accountTokenFromRequest(request);
  if (!token) throw new Error("A Commander session is required.");
  return getAccountService().authenticate(token, allowSuspended);
}

export async function requireAccountRole(request: Request, roles: AccountRole[]) {
  const account = await requireAccount(request);
  if (!accountHasRole(account, roles)) throw new Error("This Commander account is not authorized for Horizon Operations.");
  return account;
}
