import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AccountService,
  createEmailChallenge,
  maskEmail,
  MemoryAccountRepository,
  normalizeEmail,
  setAccountRepository,
  verifyEmailChallenge,
} from "../game";
import { POST as startEmail } from "../app/api/auth/email/start/route";
import { POST as verifyEmail } from "../app/api/auth/email/verify/route";

function setIdentityEnvironment(context: test.TestContext) {
  const previous = {
    secret: process.env.HORIZON_AUTH_SECRET,
    provider: process.env.HORIZON_EMAIL_PROVIDER,
  };
  process.env.HORIZON_AUTH_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
  process.env.HORIZON_EMAIL_PROVIDER = "console";
  context.after(() => {
    if (previous.secret === undefined) delete process.env.HORIZON_AUTH_SECRET;
    else process.env.HORIZON_AUTH_SECRET = previous.secret;
    if (previous.provider === undefined) delete process.env.HORIZON_EMAIL_PROVIDER;
    else process.env.HORIZON_EMAIL_PROVIDER = previous.provider;
  });
}

test("email identities normalize, mask, and use signed time-bounded verification codes", async (context) => {
  setIdentityEnvironment(context);
  assert.equal(normalizeEmail("  Commander@Example.COM "), "commander@example.com");
  assert.equal(maskEmail("commander@example.com"), "c***@example.com");
  assert.throws(() => normalizeEmail("not-an-email"), /valid email/);
  const challenge = await createEmailChallenge("commander@example.com", "signin", "/?join=ABC234");
  const verified = await verifyEmailChallenge(challenge.cookie, challenge.code);
  assert.equal(verified.email, "commander@example.com");
  assert.equal(verified.returnTo, "/?join=ABC234");
  await assert.rejects(() => verifyEmailChallenge(challenge.cookie, "00000000"), /incorrect/);
  const [payload, signature] = challenge.cookie.split(".");
  const tampered = `${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  await assert.rejects(() => verifyEmailChallenge(tampered, challenge.code), /verified/);
});

test("email sign-in creates a durable Commander and returns to an invitation", async (context) => {
  setIdentityEnvironment(context);
  const repository = new MemoryAccountRepository();
  setAccountRepository(repository);
  let delivered = "";
  const originalLog = console.log;
  console.log = (value?: unknown) => { delivered += String(value); };
  context.after(() => { console.log = originalLog; });
  const started = await startEmail(new Request("https://play.horizongame.us/api/auth/email/start", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.41" },
    body: JSON.stringify({ email: "new.commander@example.com", mode: "signin", returnTo: "/?join=ABC234" }),
  }));
  assert.equal(started.status, 200);
  const code = delivered.match(/: (\d{8})$/)?.[1];
  assert.ok(code);
  const cookie = started.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const verified = await verifyEmail(new Request("https://play.horizongame.us/api/auth/email/verify", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "cf-connecting-ip": "203.0.113.41" },
    body: JSON.stringify({ code, displayName: "Nova", deviceLabel: "Test browser" }),
  }));
  assert.equal(verified.status, 200);
  const payload = await verified.json() as { token?: string; recoveryKey: string; returnTo: string; account: { providers: string[] } };
  assert.equal(payload.token, undefined);
  assert.match(payload.recoveryKey, /^hzn_recovery_/);
  assert.equal(payload.returnTo, "/?join=ABC234");
  assert.ok(payload.account.providers.includes("email"));
  assert.equal((await repository.list()).length, 1);
  assert.equal(JSON.stringify(await repository.list()).includes("new.commander@example.com"), false);
});

test("existing recovery profiles can link email without losing rooms or progress", async (context) => {
  setIdentityEnvironment(context);
  const repository = new MemoryAccountRepository();
  const service = new AccountService(repository);
  const created = await service.create("Pathfinder");
  await service.linkIdentity(created.token, "email", "pathfinder@example.com", maskEmail("pathfinder@example.com"));
  const signedIn = await service.signInWithProvider("email", "pathfinder@example.com", maskEmail("pathfinder@example.com"), "Ignored", "Phone");
  assert.equal(signedIn.account.id, created.account.id);
  assert.equal((await repository.list()).length, 1);
  const other = await service.create("Other");
  await assert.rejects(() => service.linkIdentity(other.token, "email", "pathfinder@example.com", "p***@example.com"), /already linked/);
});

test("0.33.3 exposes email identity, profile progress, and deployment configuration", async () => {
  const [shell, client, compose, environment, health] = await Promise.all([
    readFile(new URL("../app/components/ApplicationShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/account-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../compose.yaml", import.meta.url), "utf8"),
    readFile(new URL("../.env.self-host.example", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /Continue with email/);
  assert.match(shell, /Faction mastery/);
  assert.match(shell, /Active devices/);
  assert.match(client, /verifyEmailIdentity/);
  assert.match(compose, /RESEND_API_KEY/);
  assert.match(environment, /HORIZON_EMAIL_PROVIDER/);
  assert.match(health, /accountSchemaVersion: 3/);
});
