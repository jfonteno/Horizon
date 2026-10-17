type Counter = { count: number; resetAt: number };
const runtime = globalThis as typeof globalThis & { __horizonRateLimits?: Map<string, Counter>; __horizonRoomDatabase?: D1Database };
const message = "Too many requests. Wait briefly and try again.";

async function digestKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowMs = 60_000, discriminator?: string) {
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const principal = discriminator ? await digestKey(discriminator) : address;
  const database = runtime.__horizonRoomDatabase;
  if (database) {
    const key = await digestKey(`${scope}:${principal}`);
    await database.prepare("CREATE TABLE IF NOT EXISTS horizon_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)").run();
    await database.prepare("DELETE FROM horizon_rate_limits WHERE reset_at <= ?").bind(now).run();
    const row = await database.prepare("INSERT INTO horizon_rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END, reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END RETURNING count").bind(key, now + windowMs, now, now).first<{ count: number }>();
    if (!row || row.count > limit) throw new Error(message);
    return;
  }
  const counters = runtime.__horizonRateLimits ||= new Map();
  for (const [entry, value] of counters) if (value.resetAt <= now) counters.delete(entry);
  const key = `${scope}:${principal}`;
  const current = counters.get(key);
  if (!current) {
    if (counters.size >= 5000) throw new Error(message);
    counters.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    if (current.count >= limit) throw new Error(message);
    current.count++;
  }
}
