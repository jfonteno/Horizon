export const EMAIL_CHALLENGE_COOKIE = "horizon_email_challenge";
const CHALLENGE_MINUTES = 10;

export type EmailChallengeMode = "signin" | "link";

type EmailChallenge = {
  challengeId: string;
  email: string;
  codeDigest: string;
  mode: EmailChallengeMode;
  returnTo: string;
  createdAt: number;
  accountId?: string;
};

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function base64Url(input: Uint8Array | string) {
  const raw = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(normalized);
}

function authSecret() {
  const secret = process.env.HORIZON_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("HORIZON_AUTH_SECRET must contain at least 32 characters before email sign-in can be enabled.");
  return secret;
}

async function stateKey() {
  return crypto.subtle.importKey("raw", bytes(authSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(value: string) {
  return new Uint8Array(await crypto.subtle.sign("HMAC", await stateKey(), bytes(value)));
}

function safeReturn(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/?open=profile";
  try {
    const url = new URL(value, "https://horizon.local");
    return url.origin === "https://horizon.local" ? `${url.pathname}${url.search}${url.hash}` : "/?open=profile";
  } catch {
    return "/?open=profile";
  }
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function maskEmail(value: string) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${local.length > 1 ? "***" : ""}@${domain}`;
}

function verificationCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = new DataView(bytes.buffer).getUint32(0) % 100_000_000;
  return value.toString().padStart(8, "0");
}

export async function createEmailChallenge(emailInput: string, mode: EmailChallengeMode, returnTo: string, accountId?: string) {
  const email = normalizeEmail(emailInput);
  if (mode === "link" && !accountId) throw new Error("A signed-in Commander is required to link an email address.");
  const code = verificationCode();
  const challengeId = crypto.randomUUID();
  const codeDigest = base64Url(await sign(`${challengeId}:${code}`));
  const payload: EmailChallenge = {
    challengeId,
    email,
    codeDigest,
    mode,
    returnTo: safeReturn(returnTo),
    createdAt: Date.now(),
    ...(accountId ? { accountId } : {}),
  };
  const encoded = base64Url(JSON.stringify(payload));
  const signature = base64Url(await sign(encoded));
  return { code, email, maskedEmail: maskEmail(email), payload, cookie: `${encoded}.${signature}` };
}

export async function verifyEmailChallenge(cookie: string, codeInput: string) {
  const [encoded, signature] = cookie.split(".");
  if (!encoded || !signature) throw new Error("That email verification request is invalid. Request a new code.");
  const signatureBytes = Uint8Array.from(decodeBase64Url(signature), (character) => character.charCodeAt(0));
  if (!await crypto.subtle.verify("HMAC", await stateKey(), signatureBytes, bytes(encoded))) throw new Error("That email verification request could not be verified.");
  const challenge = JSON.parse(decodeBase64Url(encoded)) as EmailChallenge;
  if (!challenge.createdAt || Date.now() - challenge.createdAt > CHALLENGE_MINUTES * 60_000) throw new Error("That email verification code has expired. Request a new one.");
  const code = codeInput.replace(/\D/g, "");
  if (!/^\d{8}$/.test(code)) throw new Error("Enter the eight-digit verification code.");
  const valid = await crypto.subtle.verify(
    "HMAC",
    await stateKey(),
    Uint8Array.from(decodeBase64Url(challenge.codeDigest), (character) => character.charCodeAt(0)),
    bytes(`${challenge.challengeId}:${code}`),
  );
  if (!valid) throw new Error("That verification code is incorrect.");
  return challenge;
}

export function emailConfiguration() {
  const secret = Boolean(process.env.HORIZON_AUTH_SECRET && process.env.HORIZON_AUTH_SECRET.length >= 32);
  const requested = (process.env.HORIZON_EMAIL_PROVIDER || "disabled").toLowerCase();
  const resend = requested === "resend" && Boolean(process.env.RESEND_API_KEY && process.env.HORIZON_EMAIL_FROM);
  const consoleDelivery = requested === "console" && secret;
  return {
    enabled: secret && (resend || consoleDelivery),
    delivery: resend ? "email" as const : consoleDelivery ? "server-console" as const : "disabled" as const,
  };
}

export async function deliverEmailVerification(email: string, code: string) {
  const configuration = emailConfiguration();
  if (!configuration.enabled) throw new Error("Email sign-in is not configured on this Horizon server.");
  if (configuration.delivery === "server-console") {
    console.log(`[horizon] Email verification for ${maskEmail(email)}: ${code}`);
    return configuration;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.HORIZON_EMAIL_FROM,
      to: [email],
      subject: "Your Horizon verification code",
      text: `Your Horizon verification code is ${code}. It expires in ${CHALLENGE_MINUTES} minutes. If you did not request this code, you can ignore this message.`,
      html: `<div style="font-family:Arial,sans-serif;background:#041118;color:#e8f2f4;padding:28px"><p style="color:#61def7;letter-spacing:.12em">HORIZON COMMANDER IDENTITY</p><h1 style="font-weight:400">${code}</h1><p>This verification code expires in ${CHALLENGE_MINUTES} minutes.</p><p style="color:#8aa0a8">If you did not request this code, you can ignore this message.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error("Horizon could not send the verification email. Try again shortly.");
  return configuration;
}

function requestIsSecure(request: Request) {
  return new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}

export function emailChallengeCookie(value: string, request: Request, maxAge = CHALLENGE_MINUTES * 60) {
  return `${EMAIL_CHALLENGE_COOKIE}=${encodeURIComponent(value)}; Path=/api/auth/email; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${requestIsSecure(request) ? "; Secure" : ""}`;
}

export function emailCookieValue(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}
