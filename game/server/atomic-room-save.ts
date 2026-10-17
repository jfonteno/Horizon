import { rename } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const RETRY_DELAYS = [25, 50, 100, 200, 400, 800, 1000, 1000, 1000];
const TRANSIENT_WINDOWS_ERRORS = new Set(["EPERM", "EACCES", "EBUSY"]);

/** Retry only the atomic replacement, never the room command or Turn resolution. */
export async function replaceRoomFile(
  source: string,
  destination: string,
  options: {
    platform?: NodeJS.Platform;
    renameFile?: (source: string, destination: string) => Promise<void>;
    wait?: (milliseconds: number) => Promise<unknown>;
  } = {},
) {
  const renameFile = options.renameFile ?? rename;
  const wait = options.wait ?? setTimeout;
  for (let attempt = 0; ; attempt++) {
    try {
      await renameFile(source, destination);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((options.platform ?? process.platform) !== "win32" ||
          !code || !TRANSIENT_WINDOWS_ERRORS.has(code) || attempt >= RETRY_DELAYS.length) throw error;
      await wait(RETRY_DELAYS[attempt]);
    }
  }
}
