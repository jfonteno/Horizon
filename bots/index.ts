import type { BotProfile } from "../game/ai/types";
import { validateBotProfile } from "../game/ai/types";

const discovered = import.meta.glob("./profiles/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

export const botProfiles = Object.values(discovered).filter(validateBotProfile) as BotProfile[];

export function getBotProfile(id: string) {
  return botProfiles.find((profile) => profile.id === id);
}
