export type HorizonPlatform = "web" | "steam" | "windows" | "macos" | "ios" | "android";

export type PlatformCapabilities = {
  platform: HorizonPlatform;
  canQuit: boolean;
  supportsFullscreen: boolean;
  supportsPushNotifications: boolean;
  supportsNativePurchases: boolean;
  supportsAchievements: boolean;
  supportsDeepLinks: boolean;
};

export function platformCapabilities(userAgent = "", packagedPlatform?: HorizonPlatform): PlatformCapabilities {
  const platform = packagedPlatform || (/Android/i.test(userAgent) ? "android" : /iPhone|iPad|iPod/i.test(userAgent) ? "ios" : "web");
  const native = platform !== "web";
  return {
    platform,
    canQuit: ["steam", "windows", "macos"].includes(platform),
    supportsFullscreen: !["ios"].includes(platform),
    supportsPushNotifications: ["ios", "android"].includes(platform),
    supportsNativePurchases: native,
    supportsAchievements: native,
    supportsDeepLinks: true,
  };
}
