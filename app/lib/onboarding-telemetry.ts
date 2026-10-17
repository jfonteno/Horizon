export type OnboardingEvent = "tutorial-started" | "tutorial-step" | "tutorial-resumed" | "tutorial-abandoned" | "tutorial-completed" | "quick-start";

export function recordOnboardingEvent(category: OnboardingEvent, step?: number) {
  if (typeof window === "undefined") return;
  const key = `horizon-onboarding-event:${category}:${step ?? "none"}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category, step }),
  }).catch(() => undefined);
}
