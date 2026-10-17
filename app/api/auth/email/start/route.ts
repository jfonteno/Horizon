import { requireAccount } from "../../../../../game/server/account-auth";
import { createEmailChallenge, deliverEmailVerification, emailChallengeCookie, normalizeEmail, type EmailChallengeMode } from "../../../../../game/server/email-auth";
import { enforceRateLimit } from "../../../../../game/server/rate-limit";

type StartRequest = {
  email?: string;
  mode?: EmailChallengeMode;
  returnTo?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as StartRequest;
    const mode: EmailChallengeMode = body.mode === "link" ? "link" : "signin";
    await enforceRateLimit(request, "email-verification-start-address", 20, 10 * 60_000);
    const email = normalizeEmail(body.email || "");
    await enforceRateLimit(request, "email-verification-start-identity", 5, 10 * 60_000, email);
    const account = mode === "link" ? await requireAccount(request) : null;
    const challenge = await createEmailChallenge(email, mode, body.returnTo || "/?open=profile", account?.id);
    const delivery = await deliverEmailVerification(challenge.email, challenge.code);
    return Response.json(
      { ok: true, maskedEmail: challenge.maskedEmail, expiresInSeconds: 600, delivery: delivery.delivery },
      { headers: { "cache-control": "no-store", "set-cookie": emailChallengeCookie(challenge.cookie, request) } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email verification could not begin.";
    return Response.json({ error: message }, { status: message.startsWith("Too many") ? 429 : message.includes("required") ? 401 : 400, headers: { "cache-control": "no-store" } });
  }
}
