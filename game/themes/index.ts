import { horizonBase } from "./horizon-base";
import { tactical } from "./tactical";
import type { ThemeDefinition, ThemeId } from "./types";
export const themeLibrary:Record<ThemeId,ThemeDefinition>={"horizon-base":horizonBase,tactical};
export const themeIds=Object.keys(themeLibrary) as ThemeId[];
export type { ThemeDefinition, ThemeId } from "./types";
export * from "./assets";
