import type { BotProfile } from "../game/ai/types";
import { validateBotProfile } from "../game/ai/types";
import metaAnalyst from "./profiles/meta-analyst.json";
import strategicDirector from "./profiles/strategic-director.json";

const bundledProfiles: unknown[] = [metaAnalyst, strategicDirector];
export const botProfiles = bundledProfiles.filter(validateBotProfile) as BotProfile[];

export function getBotProfile(id: string) {
  return botProfiles.find((profile) => profile.id === id);
}
