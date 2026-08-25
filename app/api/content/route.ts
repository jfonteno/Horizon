import { getContentCatalog } from "../../../game/content/runtime";
import { installContentCatalog } from "../../../game/content/registry";

export async function GET() {
  const catalog = getContentCatalog();
  installContentCatalog(catalog);
  return Response.json(catalog, {
    headers: { "cache-control": "no-store" },
  });
}
