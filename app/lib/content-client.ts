import { installContentCatalog, type ContentCatalog } from "../../game";

let pending: Promise<ContentCatalog> | undefined;

export function loadInstalledContent() {
  pending ||= fetch("/api/content", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("The installed content catalog is unavailable.");
      const catalog = (await response.json()) as ContentCatalog;
      installContentCatalog(catalog);
      return catalog;
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
