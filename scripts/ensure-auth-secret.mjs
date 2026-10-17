import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const target = resolve(process.argv[2] || "./data/auth-secret");
let secret = "";
try {
  secret = (await readFile(target, "utf8")).trim();
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (secret.length < 32) {
  secret = randomBytes(48).toString("base64url");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${secret}\n`, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(secret);
