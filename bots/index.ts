import type { BotProfile } from "../game/ai/types";
import { validateBotProfile } from "../game/ai/types";
import metaAnalyst from "./profiles/meta-analyst.json";
import strategicDirector from "./profiles/strategic-director.json";
import tutorialGuide from "./profiles/tutorial-guide.json";
import aiEasy from "./profiles/ai-easy.json";
import aiMedium from "./profiles/ai-medium.json";
import aiHard from "./profiles/ai-hard.json";
import aiEmperor from "./profiles/ai-emperor.json";

export const botChallengeOptions = [
  { id: "ai-easy", label: "Easy", description: "Learn movement, expansion, and Gate contributions." },
  { id: "ai-medium", label: "Medium", description: "Pursue faction and shared objectives." },
  { id: "ai-hard", label: "Hard", description: "Plan several turns ahead and assess rivals." },
  { id: "ai-emperor", label: "Emperor", description: "Optimize objectives, alliances, and scoring threats." },
] as const;

export function botChallengeLabel(id: string) {
  return botChallengeOptions.find((option) => option.id === id)?.label ||
    ({ "tutorial-guide": "Easy", "strategic-director": "Hard", "meta-analyst": "Emperor" } as Record<string, string>)[id] || "Bot";
}

const bundledProfiles: unknown[] = [aiEasy, aiMedium, aiHard, aiEmperor, metaAnalyst, strategicDirector, tutorialGuide];
export const botProfiles = bundledProfiles.filter(validateBotProfile) as BotProfile[];

export function getBotProfile(id: string) {
  return botProfiles.find((profile) => profile.id === id);
}
