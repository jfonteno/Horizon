import { accountTokenFromRequest, requireAccount, sessionCookie } from "../../../../../game/server/account-auth";
import { emailCookieValue, EMAIL_CHALLENGE_COOKIE, emailChallengeCookie, maskEmail, verifyEmailChallenge } from "../../../../../game/server/email-auth";
import { enforceRateLimit } from "../../../../../game/server/rate-limit";
import { getAccountService } from "../../../../../game/server/runtime";

type VerifyRequest = {
  code?: string;
  displayName?: string;
  deviceLabel?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as VerifyRequest;
    await enforceRateLimit(request, "email-verification-complete", 12, 10 * 60_000);
    const challenge = await verifyEmailChallenge(emailCookieValue(request, EMAIL_CHALLENGE_COOKIE), body.code || "");
    const service = getAccountService();
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", emailChallengeCookie("", request, 0));
    if (challenge.mode === "link") {
      const account = await requireAccount(request);
      if (!challenge.accountId || account.id !== challenge.accountId) throw new Error("Sign in with the Commander that requested this email link.");
      const token = accountTokenFromRequest(request);
      if (!token) throw new Error("A Commander session is required.");
      await service.linkIdentity(token, "email", challenge.email, maskEmail(challenge.email));
      return Response.json({ linked: true, returnTo: challenge.returnTo }, { headers });
    }
    const result = await service.signInWithProvider(
      "email",
      challenge.email,
      maskEmail(challenge.email),
      body.displayName?.trim().slice(0, 40) || "Commander",
      body.deviceLabel || request.headers.get("user-agent") || undefined,
    );
    headers.append("set-cookie", sessionCookie(result.token, request));
    const publicResult = { ...result };
    delete (publicResult as { token?: string }).token;
    return Response.json({ ...publicResult, returnTo: challenge.returnTo }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email verification failed.";
    return Response.json({ error: message }, { status: message.startsWith("Too many") ? 429 : message.includes("required") ? 401 : 400, headers: { "cache-control": "no-store" } });
  }
}
